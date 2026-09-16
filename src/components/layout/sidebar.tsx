"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeftRight,
  Beaker,
  Boxes,
  CalendarClock,
  ChevronDown,
  ClipboardCheck,
  FileBarChart2,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LayoutGrid,
  MapPin,
  Package,
  PackageMinus,
  PackagePlus,
  Recycle,
  Ruler,
  Settings2,
  Shield,
  Thermometer,
  Trash2,
  Users,
  Warehouse,
  Droplets,
  Inbox,
  ListTodo,
  ScrollText,
  HardDrive,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { SkymapLogo } from "@/components/brand/skymap-logo";
import { DeveloperCredit } from "@/components/brand/developer-credit";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import type { Permission } from "@/lib/permissions";
import { resolveAppModule, type AppModuleId } from "@/lib/modules";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Any of these permissions unlocks the nav item. */
  permission?: Permission | Permission[];
};
type NavGroup = { label: string; items: NavItem[]; module: AppModuleId };

function isNavActive(pathname: string, href: string, allHrefs: string[]) {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  return !allHrefs.some(
    (other) =>
      other !== href &&
      other.length > href.length &&
      (pathname === other || pathname.startsWith(other + "/"))
  );
}

const MODULE_SUBTITLE: Record<AppModuleId, string> = {
  "control-samples": "Control Samples",
  stability: "Stability Inventory",
  admin: "Admin",
};

const NAV: NavGroup[] = [
  {
    label: "STABILITY",
    module: "stability",
    items: [
      { label: "Dashboard", href: "/stability/dashboard", icon: LayoutDashboard },
      { label: "Alerts", href: "/stability/alerts", icon: AlertTriangle, permission: "reports.view" },
      { label: "Tasks", href: "/stability/tasks", icon: ListTodo, permission: ["inventory.view", "chamber.ops", "reports.view"] },
    ],
  },
  {
    label: "Admin",
    module: "admin",
    items: [
      { label: "User Management", href: "/stability/admin/users", icon: Users, permission: "users.manage" },
      { label: "Organization", href: "/stability/admin/organization", icon: Settings2, permission: "users.manage" },
      { label: "Audit Trail", href: "/stability/audit", icon: ScrollText, permission: "audit.view" },
      { label: "Backup & Recovery", href: "/stability/backup", icon: HardDrive, permission: "users.manage" },
      { label: "Settings", href: "/stability/settings", icon: Settings2, permission: "users.manage" },
    ],
  },
  {
    label: "Stability Studies",
    module: "stability",
    items: [
      { label: "Study List", href: "/stability/studies", icon: FlaskConical, permission: ["inventory.view", "studies.create", "studies.edit"] },
      { label: "Protocols", href: "/stability/protocols", icon: ScrollText, permission: "protocol.manage" },
      { label: "Water Loss Study", href: "/stability/water-loss", icon: Droplets, permission: "protocol.manage" },
    ],
  },
  {
    label: "Sample Management",
    module: "stability",
    items: [
      { label: "Sample Inward", href: "/stability/inventory/receiving", icon: Inbox, permission: ["receiving.perform", "charging.perform", "inventory.view"] },
      { label: "Sample Charging", href: "/stability/inventory/charging", icon: PackagePlus, permission: ["charging.perform", "studies.create"] },
      { label: "Sample Inventory", href: "/stability/inventory", icon: Boxes, permission: "inventory.view" },
      { label: "Upcoming Withdrawals", href: "/stability/withdrawals/upcoming", icon: CalendarClock, permission: "withdrawal.perform" },
      { label: "Sample Withdrawal", href: "/stability/withdrawals", icon: PackageMinus, permission: "withdrawal.perform" },
      { label: "Analysis Requests", href: "/stability/analysis", icon: FileText, permission: ["analysis.perform", "withdrawal.perform", "reports.view"] },
      { label: "Movement", href: "/stability/inventory/movement", icon: ArrowLeftRight, permission: "movement.perform" },
      { label: "Reconciliation", href: "/stability/reconciliation", icon: ClipboardCheck, permission: "reconciliation.perform" },
      { label: "Destruction", href: "/stability/disposal", icon: Trash2, permission: "disposal.perform" },
      { label: "Transactions", href: "/stability/transactions", icon: Recycle, permission: "reports.view" },
    ],
  },
  {
    label: "Control Samples",
    module: "control-samples",
    items: [
      { label: "Dashboard", href: "/stability/control-samples", icon: LayoutDashboard, permission: ["control.perform", "control.collect", "inventory.view"] },
      { label: "Collection / Inward", href: "/stability/control-samples/collection", icon: Inbox, permission: ["control.collect", "control.perform"] },
      { label: "Daily Collection Record", href: "/stability/control-samples/daily-collection", icon: ClipboardCheck, permission: ["control.collect", "control.perform"] },
      { label: "Control Sample Register", href: "/stability/control-samples/register", icon: Shield, permission: ["control.perform", "control.collect", "inventory.view"] },
      { label: "Periodic Observation", href: "/stability/control-samples/observation", icon: ClipboardCheck, permission: "control.perform" },
      { label: "Withdrawal / Requisition", href: "/stability/control-samples/withdrawal", icon: PackageMinus, permission: ["control.perform", "approve.records"] },
      { label: "Location & Boxes", href: "/stability/control-samples/locations", icon: MapPin, permission: "control.perform" },
      { label: "Destruction Due", href: "/stability/control-samples/destruction-due", icon: AlertTriangle, permission: ["control.perform", "disposal.perform"] },
      { label: "Destruction", href: "/stability/control-samples/destruction/new", icon: Trash2, permission: ["control.perform", "disposal.perform", "approve.records"] },
      { label: "Destruction Log", href: "/stability/control-samples/destruction-log", icon: ScrollText, permission: ["control.perform", "disposal.perform"] },
      { label: "Products", href: "/stability/control-samples/products", icon: Package, permission: ["control.perform", "control.collect", "masters.manage"] },
      { label: "Batches", href: "/stability/control-samples/batches", icon: Boxes, permission: ["control.perform", "control.collect", "masters.manage"] },
      { label: "Quantity Master", href: "/stability/control-samples/quantity-master", icon: Ruler, permission: ["control.perform", "masters.manage"] },
      { label: "Transactions", href: "/stability/control-samples/transactions", icon: Recycle, permission: ["control.perform", "reports.view"] },
      { label: "Reports", href: "/stability/control-samples/reports", icon: FileBarChart2, permission: ["control.perform", "reports.view"] },
    ],
  },
  {
    label: "Scheduler",
    module: "stability",
    items: [{ label: "Monthly Plan", href: "/stability/scheduler", icon: CalendarClock, permission: ["withdrawal.perform", "reports.view", "inventory.view"] }],
  },
  {
    label: "Stability Chamber",
    module: "stability",
    items: [
      { label: "Chamber Dashboard", href: "/stability/chambers", icon: Warehouse, permission: ["chamber.ops", "inventory.view", "reports.view"] },
      { label: "Current Status", href: "/stability/chambers/status", icon: Thermometer, permission: ["chamber.ops", "inventory.view"] },
      { label: "Alarms", href: "/stability/chambers/alarms", icon: AlertTriangle, permission: "chamber.ops" },
      { label: "Excursions", href: "/stability/chambers/excursions", icon: AlertTriangle, permission: "chamber.ops" },
      { label: "Cleaning", href: "/stability/chambers/cleaning", icon: ClipboardCheck, permission: "chamber.ops" },
      { label: "Calibration", href: "/stability/chambers/calibration", icon: Thermometer, permission: "chamber.ops" },
      { label: "Mapping", href: "/stability/chambers/mapping", icon: CalendarClock, permission: "chamber.ops" },
      { label: "Maintenance", href: "/stability/chambers/maintenance", icon: Settings2, permission: "chamber.ops" },
      { label: "MKT Report", href: "/stability/chambers/mkt", icon: FileBarChart2, permission: ["chamber.ops", "reports.view"] },
    ],
  },
  {
    label: "Reports",
    module: "stability",
    items: [
      { label: "Reports", href: "/stability/reports", icon: FileBarChart2, permission: "reports.view" },
    ],
  },
  {
    label: "Masters",
    module: "admin",
    items: [
      { label: "Stability Products", href: "/masters/products", icon: Package, permission: "masters.manage" },
      { label: "Stability Batches", href: "/masters/batches", icon: Boxes, permission: "masters.manage" },
      { label: "Study Types", href: "/masters/study-types", icon: Beaker, permission: "masters.manage" },
      { label: "Study Reasons", href: "/masters/study-reasons", icon: FileText, permission: "masters.manage" },
      { label: "Storage Conditions", href: "/masters/storage-conditions", icon: Thermometer, permission: "masters.manage" },
      { label: "Pull Points", href: "/masters/pull-points", icon: CalendarClock, permission: "masters.manage" },
      { label: "Chambers", href: "/masters/chambers", icon: Warehouse, permission: "masters.manage" },
      { label: "Locations", href: "/masters/locations", icon: MapPin, permission: "masters.manage" },
      { label: "Packaging", href: "/masters/packaging", icon: Package, permission: "masters.manage" },
      { label: "Markets", href: "/masters/markets", icon: MapPin, permission: "masters.manage" },
      { label: "Pack Sizes", href: "/masters/pack-sizes", icon: Ruler, permission: "masters.manage" },
      { label: "Units", href: "/masters/units", icon: Ruler, permission: "masters.manage" },
    ],
  },
];

export function Sidebar({
  open,
  onClose,
  collapsed,
}: {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const { hasPermission } = useAuth();
  const currentModule = resolveAppModule(pathname);
  const moduleId: AppModuleId = currentModule === "home" ? "stability" : currentModule;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    STABILITY: true,
    Admin: true,
    "Stability Studies": true,
    "Sample Management": true,
    "Control Samples": true,
    Scheduler: true,
    "Stability Chamber": false,
    Reports: true,
    Masters: true,
  });

  const groups = useMemo(() => {
    return NAV.filter((g) => g.module === moduleId)
      .map((g) => ({
        ...g,
        items: g.items.filter((item) => {
          if (!item.permission) return true;
          const needed = Array.isArray(item.permission) ? item.permission : [item.permission];
          return needed.some((p) => hasPermission(p));
        }),
      }))
      .filter((g) => g.items.length > 0);
  }, [hasPermission, moduleId]);

  const allHrefs = useMemo(() => groups.flatMap((g) => g.items.map((item) => item.href)), [groups]);

  const content = (
    <div className="flex h-full flex-col bg-[var(--sidebar)] text-slate-300">
      <div className="flex items-center justify-between gap-2 border-b border-white/8 px-3 py-3.5">
        <Link
          href="/home"
          className={cn("min-w-0 rounded-xl px-1.5 py-1", collapsed && "mx-auto px-0")}
          onClick={onClose}
          aria-label="SKYMAP modules"
        >
          {collapsed ? (
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
              <SkymapLogo priority variant="compact" className="h-10 w-auto max-w-none scale-125" />
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <SkymapLogo priority className="h-11 w-auto max-w-[158px]" />
              <p className="px-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-300/80">
                {MODULE_SUBTITLE[moduleId]}
              </p>
            </div>
          )}
        </Link>
        <button className="rounded-lg p-2 text-slate-400 hover:bg-white/8 hover:text-white lg:hidden" onClick={onClose} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        <Link
          href="/home"
          onClick={onClose}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-slate-400 transition hover:bg-white/6 hover:text-slate-100",
            collapsed && "justify-center px-2"
          )}
          title="All modules"
        >
          <LayoutGrid className="h-4 w-4 shrink-0 text-slate-500" />
          {!collapsed ? <span className="truncate">All modules</span> : null}
        </Link>
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <button
                className="mb-1.5 flex w-full items-center justify-between px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500"
                onClick={() => setExpanded((s) => ({ ...s, [group.label]: !s[group.label] }))}
              >
                {group.label}
                <ChevronDown className={cn("h-3.5 w-3.5 transition", expanded[group.label] ? "rotate-0" : "-rotate-90")} />
              </button>
            ) : null}
            {(collapsed || expanded[group.label]) && (
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isNavActive(pathname, item.href, allHrefs);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label + item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13px] transition",
                        active
                          ? "bg-teal-400/12 font-medium text-teal-200 shadow-[inset_0_0_0_1px_rgba(45,212,191,0.12)]"
                          : "text-slate-400 hover:bg-white/6 hover:text-slate-100",
                        collapsed && "justify-center px-2"
                      )}
                      title={item.label}
                    >
                      {active ? (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-teal-400" />
                      ) : null}
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-teal-300" : "text-slate-500 group-hover:text-slate-300")} />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="border-t border-white/8 p-4 text-xs text-slate-500">
          <div className="rounded-xl bg-white/4 px-3 py-2.5 ring-1 ring-white/6">
            <div className="flex items-center gap-2 text-slate-400">
              <Settings2 className="h-3.5 w-3.5 text-teal-300" />
              {MODULE_SUBTITLE[moduleId]}
            </div>
            <DeveloperCredit className="mt-1.5" tone="light" />
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden overflow-hidden transition-all lg:block",
          collapsed ? "w-[76px]" : "w-72"
        )}
      >
        {content}
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(18rem,calc(100vw-2.5rem))] overflow-hidden pt-[env(safe-area-inset-top)] transition-transform lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {content}
      </aside>
    </>
  );
}
