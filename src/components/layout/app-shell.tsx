"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { LoadingSkeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { listAlerts } from "@/services/inventory";

const TITLE_MAP: Record<string, string> = {
  "/stability/dashboard": "Stability Dashboard",
  "/stability/studies": "Stability Studies",
  "/stability/studies/new": "Create Stability Study",
  "/stability/inventory": "Sample Inventory",
  "/stability/inventory/charging": "Sample Charging",
  "/stability/inventory/movement": "Sample Movement",
  "/stability/withdrawals": "Sample Withdrawals",
  "/stability/withdrawals/upcoming": "Upcoming Withdrawals",
  "/stability/reconciliation": "Reconciliation",
  "/stability/disposal": "Sample Disposal",
  "/stability/transactions": "Inventory Transactions",
  "/stability/alerts": "Alerts",
  "/stability/reports": "Reports",
  "/stability/settings": "Settings",
  "/masters/study-types": "Study Type Master",
  "/masters/storage-conditions": "Storage Condition Master",
  "/masters/pull-points": "Pull Point Master",
  "/masters/chambers": "Chamber Master",
  "/masters/locations": "Storage Location Master",
  "/masters/units": "Unit Master",
};

function resolveTitle(pathname: string) {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  if (pathname.startsWith("/stability/studies/")) return "Study Details";
  if (pathname.startsWith("/stability/inventory/")) return "Inventory Details";
  if (pathname.startsWith("/stability/withdrawals/")) return "Withdrawal Details";
  return "Stability Inventory";
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    listAlerts()
      .then((alerts) => setAlertCount(alerts.filter((a) => !a.acknowledged).length))
      .catch(() => setAlertCount(0));
  }, [user, pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <LoadingSkeleton rows={8} />
      </div>
    );
  }

  const title = resolveTitle(pathname);
  const crumbs = [
    { label: "Stability", href: "/stability/dashboard" },
    { label: title },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar open={open} onClose={() => setOpen(false)} collapsed={collapsed} />
      <div className={cn("transition-all", collapsed ? "lg:pl-[72px]" : "lg:pl-72")}>
        <Header
          title={title}
          breadcrumbs={crumbs}
          onMenuClick={() => setOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          alertCount={alertCount}
        />
        <main className="px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ShellInner>{children}</ShellInner>
    </AuthProvider>
  );
}
