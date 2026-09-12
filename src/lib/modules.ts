import type { Permission } from "@/lib/permissions";

export type AppModuleId = "stability" | "control-samples" | "admin";

export type AppModule = {
  id: AppModuleId;
  title: string;
  description: string;
  href: string;
  permissions: Permission[];
};

export const APP_MODULES: AppModule[] = [
  {
    id: "control-samples",
    title: "Control Samples",
    description: "Collection, register, observation, withdrawal, and destruction of control samples.",
    href: "/stability/control-samples",
    permissions: ["control.perform", "control.collect", "inventory.view"],
  },
  {
    id: "stability",
    title: "Stability Inventory",
    description: "Studies, sample charging, withdrawals, chambers, and pull schedules.",
    href: "/stability/dashboard",
    permissions: [
      "inventory.view",
      "studies.create",
      "studies.edit",
      "receiving.perform",
      "charging.perform",
      "withdrawal.perform",
      "chamber.ops",
      "reports.view",
      "protocol.manage",
      "analysis.perform",
      "movement.perform",
      "reconciliation.perform",
      "disposal.perform",
    ],
  },
  {
    id: "admin",
    title: "Admin",
    description: "Users, organization, masters, audit trail, backup, and system settings.",
    href: "/stability/admin/users",
    permissions: ["users.manage", "masters.manage", "audit.view"],
  },
];

export function resolveAppModule(pathname: string): AppModuleId | "home" {
  if (pathname === "/home" || pathname === "/") return "home";
  if (pathname.startsWith("/stability/control-samples")) return "control-samples";
  if (
    pathname.startsWith("/stability/admin") ||
    pathname.startsWith("/masters") ||
    pathname.startsWith("/stability/settings") ||
    pathname.startsWith("/stability/audit") ||
    pathname.startsWith("/stability/backup")
  ) {
    return "admin";
  }
  return "stability";
}

export function moduleHref(id: AppModuleId, hasPermission: (permission: Permission) => boolean): string {
  if (id === "admin") {
    if (hasPermission("users.manage")) return "/stability/admin/users";
    if (hasPermission("masters.manage")) return "/masters/products";
    if (hasPermission("audit.view")) return "/stability/audit";
    return "/stability/settings";
  }
  const match = APP_MODULES.find((m) => m.id === id);
  return match?.href ?? "/home";
}

export function canAccessModule(id: AppModuleId, hasPermission: (permission: Permission) => boolean) {
  const match = APP_MODULES.find((m) => m.id === id);
  if (!match) return false;
  return match.permissions.some((permission) => hasPermission(permission));
}
