"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import {
  authEmailToEmployeeId,
  employeeIdToAuthEmail,
  isValidEmployeeId,
  normalizeEmployeeId,
} from "@/lib/auth-identity";
import { COLLECTIONS, getDb, getFirebaseApp, getFirebaseAuth } from "@/lib/firebase/config";
import { can, type Permission } from "@/lib/permissions";
import { nowISO } from "@/lib/utils";
import { writeAuditLog } from "@/services/audit";
import type { AppUser, UserRole } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
  /** Sign in with Employee ID + password. */
  login: (employeeId: string, password: string) => Promise<void>;
  createUser: (input: {
    employeeId: string;
    password: string;
    displayName: string;
    role: UserRole;
    moduleAccess?: Permission[];
  }) => Promise<AppUser>;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const BOOTSTRAP_DOC = "bootstrap";

function initialAdminEmployeeId() {
  return normalizeEmployeeId(process.env.NEXT_PUBLIC_INITIAL_ADMIN_EMPLOYEE_ID || "");
}

/** Legacy bootstrap support while migrating from email-based admin setup. */
function initialAdminEmail() {
  return (process.env.NEXT_PUBLIC_INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
}

function firebaseWebConfig() {
  const app = getFirebaseApp();
  return app.options;
}

async function loadProfile(user: User): Promise<AppUser | null> {
  const ref = doc(getDb(), COLLECTIONS.users, user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<AppUser, "uid">;
  const employeeId = data.employeeId || authEmailToEmployeeId(data.email || user.email);
  const profile = { uid: snap.id, ...data, employeeId } as AppUser;

  // Backfill Employee ID for legacy bootstrap accounts created without it.
  if (!data.employeeId && employeeId) {
    await updateDoc(ref, { employeeId, updatedAt: nowISO() }).catch(() => undefined);
  }

  return profile;
}

async function isBootstrapOpen() {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.settings, BOOTSTRAP_DOC));
  return !snap.exists();
}

async function markBootstrapComplete(adminUid: string) {
  await setDoc(doc(getDb(), COLLECTIONS.settings, BOOTSTRAP_DOC), {
    completedAt: nowISO(),
    completedBy: adminUid,
  });
}

async function closeBootstrapIfNeeded(profile: AppUser) {
  if (profile.role !== "Admin") return;
  if (await isBootstrapOpen()) {
    await markBootstrapComplete(profile.uid);
  }
}

/** Creates Firestore profile only for the initial admin bootstrap (no public self-signup). */
async function ensureProfile(user: User, displayName: string): Promise<AppUser | null> {
  const existing = await loadProfile(user);
  if (existing) {
    await closeBootstrapIfNeeded(existing).catch(() => undefined);
    return existing;
  }

  const authEmail = (user.email || "").trim().toLowerCase();
  const employeeId = authEmailToEmployeeId(authEmail);
  const configuredEmp = initialAdminEmployeeId();
  const configuredEmail = initialAdminEmail();
  const bootstrapOpen = await isBootstrapOpen();
  if (!bootstrapOpen) return null;

  const allowed =
    (configuredEmp && employeeId === configuredEmp) ||
    (configuredEmail && authEmail === configuredEmail) ||
    (!configuredEmp && !configuredEmail && Boolean(authEmail));
  if (!allowed) return null;

  const now = nowISO();
  const profile: AppUser = {
    uid: user.uid,
    employeeId: employeeId || normalizeEmployeeId(authEmail.split("@")[0] || "ADMIN"),
    email: authEmail,
    displayName: displayName || user.displayName || employeeId || "Admin",
    role: "Admin",
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(getDb(), COLLECTIONS.users, user.uid), profile);
  await markBootstrapComplete(user.uid);
  return profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser) => {
      try {
        setUser(firebaseUser);
        if (firebaseUser) {
          const p = await ensureProfile(firebaseUser, firebaseUser.displayName || "");
          if (!p || !p.active) {
            setProfile(null);
            await firebaseSignOut(getFirebaseAuth()).catch(() => undefined);
            setUser(null);
          } else {
            setProfile(p);
          }
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Failed to load user profile from Firestore:", error);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (employeeIdOrEmail: string, password: string) => {
    const raw = employeeIdOrEmail.trim();
    const authEmail = raw.includes("@")
      ? raw.toLowerCase()
      : employeeIdToAuthEmail(raw);

    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), authEmail, password);
    const p = await ensureProfile(cred.user, cred.user.displayName || "");
    if (!p) {
      await firebaseSignOut(getFirebaseAuth()).catch(() => undefined);
      throw new Error(
        "This account is not provisioned. Ask an Admin to create your user in User Management."
      );
    }
    if (!p.active) {
      await firebaseSignOut(getFirebaseAuth()).catch(() => undefined);
      throw new Error("This account is inactive. Contact an Admin.");
    }
    setUser(cred.user);
    setProfile(p);
    await writeAuditLog({
      action: "Login",
      recordType: "auth",
      userId: cred.user.uid,
      userName: p.displayName,
      userEmail: p.employeeId || p.email,
    });
  }, []);

  const createUser = useCallback(
    async ({
      employeeId,
      password,
      displayName,
      role,
      moduleAccess,
    }: {
      employeeId: string;
      password: string;
      displayName: string;
      role: UserRole;
      moduleAccess?: Permission[];
    }) => {
      if (!can(profile, "users.manage")) {
        throw new Error("Only an Admin can create users.");
      }

      const id = normalizeEmployeeId(employeeId);
      if (!isValidEmployeeId(id)) {
        throw new Error("Invalid Employee ID. Use 2–32 letters, numbers, hyphen, or underscore.");
      }
      const authEmail = employeeIdToAuthEmail(id);

      let secondaryApp: FirebaseApp | undefined;
      try {
        secondaryApp = initializeApp(firebaseWebConfig(), `user-provision-${Date.now()}`);
        const secondaryAuth = getAuth(secondaryApp);
        const cred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, password);
        const name = displayName.trim() || id;
        await updateProfile(cred.user, { displayName: name }).catch(() => undefined);

        const now = nowISO();
        const created: AppUser = {
          uid: cred.user.uid,
          employeeId: id,
          email: authEmail,
          displayName: name,
          role,
          moduleAccess: moduleAccess && moduleAccess.length > 0 ? moduleAccess : undefined,
          active: true,
          createdAt: now,
          updatedAt: now,
        };

        try {
          await setDoc(doc(getDb(), COLLECTIONS.users, created.uid), created);

          await writeAuditLog({
            action: "CreateUser",
            recordType: "users",
            recordId: created.uid,
            userId: profile!.uid,
            userName: profile!.displayName,
            userEmail: profile!.employeeId || profile!.email,
            newValue: {
              employeeId: created.employeeId,
              role: created.role,
              displayName: created.displayName,
              moduleAccess: created.moduleAccess ?? null,
            },
          });
        } catch (err) {
          // Avoid orphan Auth accounts if Firestore profile write fails.
          await cred.user.delete().catch(() => undefined);
          throw err;
        }

        await secondaryAuth.signOut().catch(() => undefined);
        return created;
      } finally {
        if (secondaryApp) {
          await deleteApp(secondaryApp).catch(() => undefined);
        }
      }
    },
    [profile]
  );

  const refreshProfile = useCallback(async () => {
    const authUser = getFirebaseAuth().currentUser;
    if (!authUser) {
      setProfile(null);
      return;
    }
    const p = await loadProfile(authUser);
    setProfile(p);
  }, []);

  const logout = useCallback(async () => {
    if (profile) {
      await writeAuditLog({
        action: "Logout",
        recordType: "auth",
        userId: profile.uid,
        userName: profile.displayName,
        userEmail: profile.employeeId || profile.email,
      }).catch(() => undefined);
    }
    await firebaseSignOut(getFirebaseAuth());
    setProfile(null);
  }, [profile]);

  const hasPermission = useCallback(
    (permission: Permission) => Boolean(profile?.active) && can(profile, permission),
    [profile]
  );

  const value = useMemo(
    () => ({ user, profile, loading, login, createUser, refreshProfile, logout, hasPermission }),
    [user, profile, loading, login, createUser, refreshProfile, logout, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
