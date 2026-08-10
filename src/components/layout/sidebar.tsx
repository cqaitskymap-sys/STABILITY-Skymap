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
  FlaskConical,
  LayoutDashboard,
  MapPin,
  PackageMinus,
  PackagePlus,
  Recycle,
  Ruler,
  Settings2,
  Thermometer,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    label: "STABILITY",
    items: [{ label: "Dashboard", href: "/stability/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Inventory Management",
    items: [
      { label: "Inventory Dashboard", href: "/stability/inventory", icon: Boxes },
      { label: "Stability Studies", href: "/stability/studies", icon: FlaskConical },
      { label: "Sample Charging", href: "/stability/inventory/charging", icon: PackagePlus },
      { label: "Sample Inventory", href: "/stability/inventory", icon: Warehouse },
      { label: "Upcoming Withdrawals", href: "/stability/withdrawals/upcoming", icon: CalendarClock },
      { label: "Sample Withdrawal", href: "/stability/withdrawals", icon: PackageMinus },
      { label: "Movement", href: "/stability/inventory/movement", icon: ArrowLeftRight },
      { label: "Reconciliation", href: "/stability/reconciliation", icon: ClipboardCheck },
      { label: "Disposal", href: "/stability/disposal", icon: Trash2 },
      { label: "Transactions", href: "/stability/transactions", icon: Recycle },
      { label: "Alerts", href: "/stability/alerts", icon: AlertTriangle },
      { label: "Reports", href: "/stability/reports", icon: FileBarChart2 },
      { label: "Settings", href: "/stability/settings", icon: Settings2 },
    ],
  },
  {
    label: "Masters",
    items: [
      { label: "Study Types", href: "/masters/study-types", icon: Beaker },
      { label: "Storage Conditions", href: "/masters/storage-conditions", icon: Thermometer },
      { label: "Pull Points", href: "/masters/pull-points", icon: CalendarClock },
      { label: "Chambers", href: "/masters/chambers", icon: Warehouse },
      { label: "Locations", href: "/masters/locations", icon: MapPin },
      { label: "Units", href: "/masters/units", icon: Ruler },
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    STABILITY: true,
    "Inventory Management": true,
    Masters: true,
  });

  const groups = useMemo(() => {
    return NAV.map((g) => ({
      ...g,
      items:
        g.label === "Masters" && !hasPermission("masters.manage")
          ? []
          : g.items.filter((item, idx, arr) => arr.findIndex((x) => x.href === item.href) === idx),
    })).filter((g) => g.items.length > 0);
  }, [hasPermission]);

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
        <div className={cn("min-w-0", collapsed && "mx-auto")}>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-700 text-white">
              <FlaskConical className="h-5 w-5" />
            </div>
            {!collapsed ? (
              <div>
                <p className="truncate text-sm font-semibold text-slate-900">SKYMAP Stability</p>
                <p className="truncate text-xs text-slate-500">Sample Inventory</p>
              </div>
            ) : null}
          </div>
        </div>
        <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={onClose} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <button
                className="mb-1 flex w-full items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                onClick={() => setExpanded((s) => ({ ...s, [group.label]: !s[group.label] }))}
              >
                {group.label}
                <ChevronDown className={cn("h-3.5 w-3.5 transition", expanded[group.label] ? "rotate-0" : "-rotate-90")} />
              </button>
            ) : null}
            {(collapsed || expanded[group.label]) && (
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label + item.href}
                      href={item.href}
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                        active
                          ? "bg-teal-50 font-medium text-teal-800"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                        collapsed && "justify-center px-2"
                      )}
                      title={item.label}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
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
        <div className="border-t border-slate-200 p-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5" />
            QA Stability Module
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white transition-all lg:block",
          collapsed ? "w-[72px]" : "w-72"
        )}
      >
        {content}
      </aside>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 transition lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-white transition-transform lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {content}
      </aside>
    </>
  );
}
