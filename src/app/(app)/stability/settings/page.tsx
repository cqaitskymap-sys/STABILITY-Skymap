"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Beaker,
  Boxes,
  FileBarChart2,
  Package,
  RefreshCw,
  ShieldCheck,
  Users,
  Warehouse,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
} from "@/components/ui";
import { getMissingChargeMasters } from "@/components/stability/charge-form-logic";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { friendlyError } from "@/lib/utils";
import { refreshAlerts } from "@/services/inventory";
import {
  listBatches,
  listChambers,
  listLocations,
  listProducts,
  listPullPoints,
  listStorageConditions,
  listStudyTypes,
  listUnits,
} from "@/services/masters";
import { getBootstrapStatus } from "@/services/settings";

export default function StabilitySettingsPage() {
  const { profile, loading: authLoading, hasPermission } = useAuth();
  const canManage = hasPermission("users.manage");
  const canReports = hasPermission("reports.view");
  const canMasters = hasPermission("masters.manage");
  const [refreshing, setRefreshing] = useState(false);

  const bootstrap = useAsync(async () => {
    if (!canManage) return null;
    return getBootstrapStatus();
  }, [canManage]);

  const masters = useAsync(async () => {
    if (!canManage) return null;
    const [products, batches, studyTypes, conditions, chambers, locations, units, pullPoints] =
      await Promise.all([
        listProducts(),
        listBatches(),
        listStudyTypes(),
        listStorageConditions(),
        listChambers(),
        listLocations(),
        listUnits(),
        listPullPoints(),
      ]);
    return { products, batches, studyTypes, conditions, chambers, locations, units, pullPoints };
  }, [canManage]);

  const missingMasters = useMemo(
    () => (masters.data ? getMissingChargeMasters(masters.data) : []),
    [masters.data]
  );

  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "SKYMAP Stability";
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "—";
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "—";

  async function onRefreshAlerts() {
    setRefreshing(true);
    try {
      const count = await refreshAlerts();
      toast.success(
        count === 0
          ? "Alerts refreshed — nothing active right now."
          : `Alerts refreshed (${count} active).`
      );
    } catch (err) {
      toast.error(friendlyError(err, err instanceof Error ? err.message : "Unable to refresh alerts."));
    } finally {
      setRefreshing(false);
    }
  }

  if (authLoading) {
    return (
      <div>
        <PageHeader title="Settings" description="Admin tools for operational maintenance." />
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Settings" description="Admin tools for operational maintenance." />
        <Card>
          <EmptyState
            title="Admin settings permission required"
            description="Ask an Admin to grant User Management access if you need this page."
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Stability Settings"
        description="Operational tools for your live Firebase environment."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void bootstrap.reload();
              void masters.reload();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Connected account"
            description="Signed-in admin profile used for privileged operations."
          />
          <div className="space-y-2 p-4 text-sm text-slate-700">
            <Row label="Name" value={profile?.displayName || "—"} />
            <Row label="Employee ID" value={profile?.employeeId || "—"} />
            <Row label="Email" value={profile?.email || "—"} />
            <Row label="Role" value={profile?.role || "—"} />
            <Row
              label="Status"
              value={
                <Badge tone={profile?.active === false ? "slate" : "green"}>
                  {profile?.active === false ? "Inactive" : "Active"}
                </Badge>
              }
            />
            <Row
              label="Module access"
              value={
                profile?.moduleAccess?.length
                  ? `${profile.moduleAccess.length} custom permission(s)`
                  : "Role defaults"
              }
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Environment"
            description="Read-only runtime configuration (no secrets shown)."
          />
          <div className="space-y-2 p-4 text-sm text-slate-700">
            <Row label="Company" value={companyName} />
            <Row label="Firebase project" value={projectId} />
            <Row label="Auth domain" value={authDomain} />
            <div className="pt-2">
              {bootstrap.loading ? <LoadingSkeleton rows={1} /> : null}
              {bootstrap.error ? (
                <ErrorState message={bootstrap.error} onRetry={bootstrap.reload} />
              ) : null}
              {bootstrap.data ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-teal-700" />
                    <span className="font-medium text-slate-800">Bootstrap</span>
                    <Badge tone={bootstrap.data.open ? "yellow" : "green"}>
                      {bootstrap.data.open ? "Open" : "Closed"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {bootstrap.data.open
                      ? "First Admin profile creation is still allowed. It closes automatically after an Admin signs in."
                      : `Closed ${bootstrap.data.completedAtLabel || "—"}${
                          bootstrap.data.completedBy ? ` · by ${bootstrap.data.completedBy}` : ""
                        }`}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Alerts maintenance"
            description="Recalculate operational alerts from inventory, pull points, chambers, and reconciliations."
          />
          <div className="flex flex-wrap gap-2 p-4">
            <Button
              variant="outline"
              loading={refreshing}
              disabled={!canReports && !canManage}
              onClick={() => void onRefreshAlerts()}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Alerts
            </Button>
            {canReports ? (
              <Link href="/stability/alerts">
                <Button variant="ghost">
                  <AlertTriangle className="h-4 w-4" />
                  Open Alerts
                </Button>
              </Link>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="User management"
            description="Create users, manage accounts, and assign module access."
          />
          <div className="p-4">
            <Link href="/stability/admin/users">
              <Button>
                <Users className="h-4 w-4" />
                Open User Management
              </Button>
            </Link>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Masters readiness"
            description="Active masters required before Sample Charging / Create Study."
          />
          <div className="p-4">
            {masters.loading ? <LoadingSkeleton rows={2} /> : null}
            {masters.error ? <ErrorState message={masters.error} onRetry={masters.reload} /> : null}
            {!masters.loading && !masters.error && missingMasters.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                All required masters have at least one active record. Charging can proceed.
              </div>
            ) : null}
            {!masters.loading && !masters.error && missingMasters.length > 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-amber-800">
                  Missing or inactive: {missingMasters.map((m) => m.label).join(", ")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {missingMasters.map((m) => (
                    <Link key={m.href} href={m.href}>
                      <Button size="sm" variant="outline" disabled={!canMasters}>
                        Configure {m.label}
                      </Button>
                    </Link>
                  ))}
                </div>
                {!canMasters ? (
                  <p className="text-xs text-slate-500">
                    Masters links require the Masters module. Grant masters.manage to edit them.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Quick links" description="Common admin destinations." />
          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <QuickLink href="/stability/admin/users" icon={Users} label="Users" />
            <QuickLink href="/masters/products" icon={Package} label="Products" />
            <QuickLink href="/masters/batches" icon={Boxes} label="Batches" />
            <QuickLink href="/masters/study-types" icon={Beaker} label="Study Types" />
            <QuickLink href="/masters/chambers" icon={Warehouse} label="Chambers" />
            <QuickLink href="/stability/alerts" icon={AlertTriangle} label="Alerts" />
            <QuickLink href="/stability/reports" icon={FileBarChart2} label="Reports" />
            <QuickLink href="/stability/inventory" icon={Boxes} label="Inventory" />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
    >
      <Icon className="h-4 w-4 text-teal-700" />
      {label}
    </Link>
  );
}
