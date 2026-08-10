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
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { COLLECTIONS, getDb, getFirebaseAuth } from "@/lib/firebase/config";
import { can, type Permission } from "@/lib/permissions";
import { nowISO } from "@/lib/utils";
import { writeAuditLog } from "@/services/audit";
import type { AppUser, UserRole } from "@/types";

interface AuthContextValue {
  user: User | null;
  profile: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  registerDemoAdmin: () => Promise<void>;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadOrCreateProfile(user: User, role: UserRole = "QA User") {
  const ref = doc(getDb(), COLLECTIONS.users, user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return { uid: snap.id, ...snap.data() } as AppUser;

  const profile: AppUser = {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email || "User",
    role,
    active: true,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
  await setDoc(ref, profile);
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
          const p = await loadOrCreateProfile(firebaseUser);
          setProfile(p);
        } else {
          setProfile(null);
        }
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    let p = await loadOrCreateProfile(cred.user);

    // Keep demo admin elevated even if profile was first created with default role.
    if (email.toLowerCase() === "admin@stability.local" && p.role !== "Admin") {
      p = {
        ...p,
        role: "Admin",
        displayName: p.displayName || "System Admin",
        updatedAt: nowISO(),
      };
      await setDoc(doc(getDb(), COLLECTIONS.users, cred.user.uid), p, { merge: true });
    }

    setProfile(p);
    await writeAuditLog({
      action: "Login",
      recordType: "auth",
      userId: cred.user.uid,
      userName: p.displayName,
      userEmail: p.email,
    });
  }, []);

  const logout = useCallback(async () => {
    if (profile) {
      await writeAuditLog({
        action: "Logout",
        recordType: "auth",
        userId: profile.uid,
        userName: profile.displayName,
        userEmail: profile.email,
      }).catch(() => undefined);
    }
    await firebaseSignOut(getFirebaseAuth());
    setProfile(null);
  }, [profile]);

  const ensureAdminProfile = useCallback(async (firebaseUser: User) => {
    await updateProfile(firebaseUser, { displayName: "System Admin" }).catch(() => undefined);
    const p = await loadOrCreateProfile(firebaseUser, "Admin");
    const adminProfile: AppUser = {
      ...p,
      role: "Admin",
      displayName: "System Admin",
      email: firebaseUser.email || p.email,
      updatedAt: nowISO(),
    };
    await setDoc(doc(getDb(), COLLECTIONS.users, firebaseUser.uid), adminProfile, { merge: true });
    setProfile(adminProfile);
    setUser(firebaseUser);
  }, []);

  const registerDemoAdmin = useCallback(async () => {
    const email = "admin@stability.local";
    const password = "Admin@123";

    // Prefer sign-in first — admin is often already created.
    try {
      const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
      await ensureAdminProfile(cred.user);
      return;
    } catch (signInError: unknown) {
      const signInCode =
        typeof signInError === "object" && signInError && "code" in signInError
          ? String((signInError as { code: string }).code)
          : "";
      const signInMsg = signInError instanceof Error ? signInError.message : "";
      const canCreate =
        signInCode.includes("user-not-found") ||
        signInCode.includes("invalid-credential") ||
        signInMsg.includes("user-not-found") ||
        signInMsg.includes("invalid-credential");
      if (!canCreate) throw signInError;
    }

    try {
      const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      await ensureAdminProfile(cred.user);
    } catch (error: unknown) {
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code: string }).code)
          : "";
      const msg = error instanceof Error ? error.message : "";
      if (code.includes("email-already-in-use") || msg.includes("email-already-in-use")) {
        const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
        await ensureAdminProfile(cred.user);
        return;
      }
      throw error;
    }
  }, [ensureAdminProfile]);

  const hasPermission = useCallback(
    (permission: Permission) => can(profile?.role, permission),
    [profile?.role]
  );

  const value = useMemo(
    () => ({ user, profile, loading, login, logout, registerDemoAdmin, hasPermission }),
    [user, profile, loading, login, logout, registerDemoAdmin, hasPermission]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
