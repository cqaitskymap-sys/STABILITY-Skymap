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
    const p = await loadOrCreateProfile(cred.user);
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

  const registerDemoAdmin = useCallback(async () => {
    const email = "admin@stability.local";
    const password = "Admin@123";
    try {
      const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      await updateProfile(cred.user, { displayName: "System Admin" });
      const p = await loadOrCreateProfile(cred.user, "Admin");
      // Force Admin role
      await setDoc(
        doc(getDb(), COLLECTIONS.users, cred.user.uid),
        { ...p, role: "Admin", displayName: "System Admin", updatedAt: nowISO() },
        { merge: true }
      );
      setProfile({ ...p, role: "Admin", displayName: "System Admin" });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("email-already-in-use")) {
        await login(email, password);
        return;
      }
      throw error;
    }
  }, [login]);

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
