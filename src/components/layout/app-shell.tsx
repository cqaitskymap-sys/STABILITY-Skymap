"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AssistantPanel } from "@/components/ai/assistant-panel";
import { LoadingSkeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { resolveAppModule } from "@/lib/modules";
import { listAlerts } from "@/services/inventory";

const TITLE_MAP: Record<string, string> = {
  "/home": "Select a module",
  "/stability/dashboard": "Stability Dashboard",
  "/stability/control-samples": "Control Samples",
  "/stability/admin/users": "User Management",
  "/stability/admin/organization": "Organization",
  "/stability/audit": "Audit Trail",
  "/stability/backup": "Backup & Recovery",
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
  "/masters/products": "Product Master",
  "/masters/batches": "Batch Master",
  "/masters/study-types": "Study Type Master",
  "/masters/storage-conditions": "Storage Condition Master",
  "/masters/pull-points": "Pull Point Master",
  "/masters/chambers": "Chamber Master",
  "/masters/locations": "Storage Location Master",
  "/masters/units": "Unit Master",
  "/masters/markets": "Market Master",
  "/masters/pack-sizes": "Pack Size Master",
  "/stability/control-samples/daily-collection": "Daily Collection Record",
};

function resolveTitle(pathname: string) {
  if (TITLE_MAP[pathname]) return TITLE_MAP[pathname];
  if (pathname.startsWith("/stability/studies/")) return "Study Details";
  if (pathname.startsWith("/stability/inventory/")) return "Sample Details";
  if (pathname.startsWith("/stability/withdrawals/")) return "Withdrawal Details";
  const moduleId = resolveAppModule(pathname);
  if (moduleId === "control-samples") return "Control Samples";
  if (moduleId === "admin") return "Admin";
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
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm backdrop-blur">
          <div className="mb-4 h-1.5 w-20 rounded-full bg-gradient-to-r from-teal-400 to-teal-600" />
          <LoadingSkeleton rows={5} />
        </div>
      </div>
    );
  }

  const title = resolveTitle(pathname);
  const currentModule = resolveAppModule(pathname);
  const isHome = currentModule === "home";
  const moduleLabel =
    currentModule === "control-samples"
      ? "Control Samples"
      : currentModule === "admin"
        ? "Admin"
        : "Stability Inventory";
  const moduleHref =
    currentModule === "control-samples"
      ? "/stability/control-samples"
      : currentModule === "admin"
        ? "/stability/admin/users"
        : "/stability/dashboard";
  const crumbs = isHome
    ? undefined
    : [
        { label: "Modules", href: "/home" },
        { label: moduleLabel, href: title === moduleLabel ? undefined : moduleHref },
        ...(title === moduleLabel ? [] : [{ label: title }]),
      ];

  return (
    <div className="min-h-screen overflow-x-hidden">
      {!isHome ? <Sidebar open={open} onClose={() => setOpen(false)} collapsed={collapsed} /> : null}
      <div className={cn("min-w-0 transition-all", isHome ? "" : collapsed ? "lg:pl-[76px]" : "lg:pl-72")}>
        <Header
          title={title}
          breadcrumbs={crumbs}
          onMenuClick={() => setOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((v) => !v)}
          alertCount={alertCount}
          hideNav={isHome}
        />
        <main className="animate-fade-up px-3 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-6 sm:pb-6 lg:px-8">{children}</main>
      </div>
      {isHome ? null : <AssistantPanel />}
      <Toaster
        richColors
        position="top-center"
        offset={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        toastOptions={{
          className: "rounded-xl border-slate-200 shadow-lg !w-[calc(100vw-1.5rem)] sm:!w-auto",
        }}
      />
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
