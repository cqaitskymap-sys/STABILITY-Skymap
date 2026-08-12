import { collection, deleteDoc, doc, getDocs, updateDoc } from "firebase/firestore";
import { authEmailToEmployeeId } from "@/lib/auth-identity";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { permissionsForRole, type Permission } from "@/lib/permissions";
import { nowISO } from "@/lib/utils";
import { writeAuditLog } from "@/services/audit";
import type { AppUser, UserRole } from "@/types";

function mapUserDoc(id: string, data: Record<string, unknown>): AppUser {
  const email = String(data.email || "");
  const employeeId =
    (typeof data.employeeId === "string" && data.employeeId.trim()) ||
    authEmailToEmployeeId(email) ||
    "";
  return { uid: id, ...data, email, employeeId } as AppUser;
}

export async function listUsers() {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.users));
  return snap.docs
    .map((d) => mapUserDoc(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function updateManagedUser(input: {
  uid: string;
  displayName?: string;
  role?: UserRole;
  moduleAccess?: Permission[];
  active?: boolean;
  actor: AppUser;
}) {
  if (input.uid === input.actor.uid && input.active === false) {
    throw new Error("You cannot deactivate your own account.");
  }

  const ref = doc(getDb(), COLLECTIONS.users, input.uid);
  const patch: Record<string, unknown> = { updatedAt: nowISO() };
  if (input.displayName !== undefined) patch.displayName = input.displayName.trim();
  if (input.role !== undefined) patch.role = input.role;
  if (input.moduleAccess !== undefined) patch.moduleAccess = input.moduleAccess;
  if (input.active !== undefined) patch.active = input.active;

  // Prevent self-lockout from User Management.
  if (input.uid === input.actor.uid) {
    const nextRole = (input.role ?? input.actor.role) as UserRole;
    const nextAccess =
      input.moduleAccess !== undefined
        ? input.moduleAccess
        : input.actor.moduleAccess;
    const effective =
      nextAccess && nextAccess.length > 0 ? nextAccess : permissionsForRole(nextRole);
    if (!effective.includes("users.manage")) {
      throw new Error("You cannot remove your own User Management access.");
    }
  }

  await updateDoc(ref, patch);
  await writeAuditLog({
    action: "UpdateUser",
    recordType: "users",
    recordId: input.uid,
    userId: input.actor.uid,
    userName: input.actor.displayName,
    userEmail: input.actor.email,
    newValue: patch,
  });
}

export async function deleteManagedUser(input: {
  uid: string;
  employeeId?: string;
  displayName?: string;
  role?: UserRole;
  actor: AppUser;
}) {
  if (input.uid === input.actor.uid) {
    throw new Error("You cannot delete your own account.");
  }

  await deleteDoc(doc(getDb(), COLLECTIONS.users, input.uid));
  await writeAuditLog({
    action: "DeleteUser",
    recordType: "users",
    recordId: input.uid,
    userId: input.actor.uid,
    userName: input.actor.displayName,
    userEmail: input.actor.employeeId || input.actor.email,
    previousValue: {
      employeeId: input.employeeId || null,
      displayName: input.displayName || null,
      role: input.role || null,
    },
  });
}
