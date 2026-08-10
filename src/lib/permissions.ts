import type { UserRole } from "@/types";

export type Permission =
  | "masters.manage"
  | "users.manage"
  | "studies.create"
  | "studies.edit"
  | "charging.perform"
  | "withdrawal.perform"
  | "movement.perform"
  | "reconciliation.perform"
  | "disposal.perform"
  | "reports.view"
  | "inventory.view"
  | "seed.demo";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Admin: [
    "masters.manage",
    "users.manage",
    "studies.create",
    "studies.edit",
    "charging.perform",
    "withdrawal.perform",
    "movement.perform",
    "reconciliation.perform",
    "disposal.perform",
    "reports.view",
    "inventory.view",
    "seed.demo",
  ],
  "QA Manager": [
    "studies.create",
    "studies.edit",
    "charging.perform",
    "withdrawal.perform",
    "movement.perform",
    "reconciliation.perform",
    "disposal.perform",
    "reports.view",
    "inventory.view",
  ],
  "QA User": ["withdrawal.perform", "reports.view", "inventory.view"],
};

export function can(role: UserRole | undefined | null, permission: Permission) {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
