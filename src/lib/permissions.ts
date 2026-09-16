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
    description: "Study types, conditions, chambers, locations, units, reasons",
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
    permission: "receiving.perform",
    label: "Sample Inward",
    description: "Receive stability samples and record COA status",
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
    label: "Disposal / Destruction",
    description: "Authorize and record sample destruction",
  },
  {
    permission: "control.collect",
    label: "Control Sample Collection (IPQA)",
    description: "Collect control samples, maintain the daily collection register, and submit collection records",
  },
  {
    permission: "control.perform",
    label: "Control Samples (QA)",
    description: "Receive, verify, store, observe, withdraw, review/finalize daily collection records, and prepare destruction",
  },
  {
    permission: "chamber.ops",
    label: "Chamber Operations",
    description: "Alarms, excursions, cleaning, calibration, mapping, maintenance",
  },
  {
    permission: "protocol.manage",
    label: "Protocols & Reports",
    description: "Stability protocols, study reports, and water-loss studies",
  },
  {
    permission: "analysis.perform",
    label: "Analysis Requests",
    description: "Stability analysis request handoff to QC",
  },
  {
    permission: "approve.records",
    label: "Electronic Approval",
    description: "Checked / approved electronic signatures",
  },
  {
    permission: "reports.view",
    label: "Reports & Alerts",
    description: "Reports, alerts, and transaction history",
  },
  {
    permission: "audit.view",
    label: "Audit Trail",
    description: "View immutable audit records",
  },
];

export const ALL_PERMISSIONS: Permission[] = MODULE_ACCESS.map((m) => m.permission);

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  Admin: [...ALL_PERMISSIONS],
  "QA Manager": [
    "masters.manage",
    "studies.create",
    "studies.edit",
    "receiving.perform",
    "charging.perform",
    "withdrawal.perform",
    "movement.perform",
    "reconciliation.perform",
    "disposal.perform",
    "control.collect",
    "control.perform",
    "chamber.ops",
    "protocol.manage",
    "analysis.perform",
    "approve.records",
    "reports.view",
    "inventory.view",
    "audit.view",
  ],
  "QA Executive": [
    "studies.create",
    "studies.edit",
    "receiving.perform",
    "charging.perform",
    "withdrawal.perform",
    "movement.perform",
    "reconciliation.perform",
    "control.collect",
    "control.perform",
    "protocol.manage",
    "analysis.perform",
    "reports.view",
    "inventory.view",
  ],
  "QA User": [
    "receiving.perform",
    "control.collect",
    "withdrawal.perform",
    "reports.view",
    "inventory.view",
    "analysis.perform",
  ],
  "QC User": ["inventory.view", "analysis.perform", "reports.view"],
  "Engineering User": ["chamber.ops", "inventory.view", "reports.view"],
  "Read Only": ["inventory.view", "reports.view"],
};

export const USER_ROLES: UserRole[] = [
  "Admin",
  "QA Manager",
  "QA Executive",
  "QA User",
  "QC User",
  "Engineering User",
  "Read Only",
];

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
