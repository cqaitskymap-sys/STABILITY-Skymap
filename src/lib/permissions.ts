import type { Permission, UserRole } from "@/types";

export type { Permission };

/** Modules an Admin can grant/revoke on a user profile. */
export const MODULE_ACCESS: {
  permission: Permission;
  label: string;
  description: string;
  adminOnly?: boolean;
}[] = [
  {
    permission: "users.manage",
    label: "User Management",
    description: "Create users, manage accounts, and assign module access",
    adminOnly: true,
  },
  {
    permission: "masters.manage",
    label: "Masters",
    description: "Study types, conditions, chambers, locations, units",
  },
  {
    permission: "studies.create",
    label: "Create Studies",
    description: "Create new stability studies",
  },
  {
    permission: "studies.edit",
    label: "Edit Studies",
    description: "Update existing stability studies",
  },
  {
    permission: "charging.perform",
    label: "Sample Charging",
    description: "Charge samples into chamber inventory",
  },
  {
    permission: "inventory.view",
    label: "Inventory",
    description: "View sample inventory and stock",
  },
  {
    permission: "withdrawal.perform",
    label: "Withdrawals",
    description: "Upcoming withdrawals and sample withdrawal",
  },
  {
    permission: "movement.perform",
    label: "Movement",
    description: "Transfer samples between locations",
  },
  {
    permission: "reconciliation.perform",
    label: "Reconciliation",
    description: "Inventory reconciliation and adjustments",
  },
  {
    permission: "disposal.perform",
    label: "Disposal",
    description: "Dispose samples from inventory",
  },
  {
    permission: "reports.view",
    label: "Reports & Alerts",
    description: "Reports, alerts, and transaction history",
  },
];

export const ALL_PERMISSIONS: Permission[] = MODULE_ACCESS.map((m) => m.permission);

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Admin: [...ALL_PERMISSIONS],
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

export function permissionsForRole(role: UserRole): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

/** Custom moduleAccess overrides role defaults when present. */
export function effectivePermissions(input: {
  role?: UserRole | null;
  moduleAccess?: Permission[] | null;
}): Permission[] {
  if (input.moduleAccess && input.moduleAccess.length > 0) {
    return [...input.moduleAccess];
  }
  if (!input.role) return [];
  return permissionsForRole(input.role);
}

export function can(
  roleOrUser:
    | UserRole
    | undefined
    | null
    | { role?: UserRole | null; moduleAccess?: Permission[] | null },
  permission: Permission
) {
  if (!roleOrUser) return false;
  if (typeof roleOrUser === "string") {
    return ROLE_PERMISSIONS[roleOrUser]?.includes(permission) ?? false;
  }
  return effectivePermissions(roleOrUser).includes(permission);
}
