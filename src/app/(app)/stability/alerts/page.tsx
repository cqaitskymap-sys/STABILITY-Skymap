"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, BellRing, Check, Info, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  Select,
  StatCard,
} from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime, friendlyError } from "@/lib/utils";
import { acknowledgeAlert, listAlerts, refreshAlerts } from "@/services/inventory";
import type { InventoryAlert } from "@/types";

function severityRank(severity: InventoryAlert["severity"]) {
  switch (severity) {
    case "critical":
      return 0;
    case "warning":
      return 1;
    default:
      return 2;
  }
}

function alertHref(alert: InventoryAlert): string | null {
  if (!alert.relatedId) return null;
  switch (alert.relatedType) {
    case "studyPullPoint":
      return `/stability/withdrawals?pull=${alert.relatedId}`;
    case "stabilitySample":
      return `/stability/inventory/${alert.relatedId}`;
    case "inventoryReconciliation":
      return `/stability/reconciliation?sample=${alert.relatedId}`;
    case "chamber":
      return "/masters/chambers";
    default:
      return null;
  }
}

export default function AlertsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("reports.view");
  const { data, loading, error, reload } = useAsync(listAlerts, []);

  const [severity, setSeverity] = useState<"all" | "critical" | "warning" | "info">("all");
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [ackingId, setAckingId] = useState<string | null>(null);

  const rows = data || [];

  const stats = useMemo(() => {
    const active = rows.filter((a) => !a.acknowledged);
    return {
      total: active.length,
      critical: active.filter((a) => a.severity === "critical").length,
      warning: active.filter((a) => a.severity === "warning").length,
      info: active.filter((a) => a.severity === "info").length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows
      .filter((a) => {
        if (!showAcknowledged && a.acknowledged) return false;
        if (severity !== "all" && a.severity !== severity) return false;
        return true;
      })
      .sort((a, b) => {
        const byAck = Number(a.acknowledged) - Number(b.acknowledged);
        if (byAck !== 0) return byAck;
        const bySev = severityRank(a.severity) - severityRank(b.severity);
        if (bySev !== 0) return bySev;
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      });
  }, [rows, severity, showAcknowledged]);

  async function onRefresh() {
    if (!canView) return;
    setRefreshing(true);
    try {
      const count = await refreshAlerts();
      toast.success(
        count === 0 ? "Alerts refreshed — nothing active right now." : `Alerts refreshed (${count} active).`
      );
      await reload();
    } catch (err) {
      toast.error(friendlyError(err, err instanceof Error ? err.message : "Unable to refresh alerts."));
    } finally {
      setRefreshing(false);
    }
  }

  async function onAcknowledge(alertId: string) {
    setAckingId(alertId);
    try {
      await acknowledgeAlert(alertId);
      toast.success("Alert acknowledged.");
      await reload();
    } catch (err) {
      toast.error(friendlyError(err, "Unable to acknowledge alert."));
    } finally {
      setAckingId(null);
    }
  }

  if (!canView) {
    return (
      <div>
        <PageHeader
          title="Alerts"
          description="Operational alerts for due pulls, capacity, variances, and depleted samples."
        />
        <Card>
          <EmptyState
            title="Reports permission required"
            description="Ask an Admin to grant the Reports & Alerts module on your account."
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Operational alerts for due pulls, capacity, variances, and depleted samples."
        actions={
          <Button onClick={() => void onRefresh()} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh Alerts"}
          </Button>
        }
      />

      {!loading && !error && rows.length > 0 ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Active" value={stats.total} icon={BellRing} tone="teal" />
          <StatCard title="Critical" value={stats.critical} icon={AlertTriangle} tone="rose" />
          <StatCard title="Warning" value={stats.warning} icon={BellRing} tone="amber" />
          <StatCard title="Info" value={stats.info} icon={Info} tone="blue" />
        </div>
      ) : null}

      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100/90 bg-slate-50/40 p-4 sm:flex-row sm:items-end sm:justify-between">
          <Select
            label="Severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as typeof severity)}
          >
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </Select>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="rounded border-slate-300"
              checked={showAcknowledged}
              onChange={(e) => setShowAcknowledged(e.target.checked)}
            />
            Show acknowledged
          </label>
        </div>

        {loading ? <LoadingSkeleton /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}

        {!loading && !error && rows.length === 0 ? (
          <EmptyState
            title="No alerts calculated yet"
            description="Refresh to scan pull points, inventory, chambers, and open reconciliations."
            action={
              <Button onClick={() => void onRefresh()} disabled={refreshing}>
                <RefreshCw className="h-4 w-4" />
                Refresh Alerts
              </Button>
            }
          />
        ) : null}

        {!loading && !error && rows.length > 0 && filtered.length === 0 ? (
          <EmptyState
            title="No alerts match this filter"
            description={
              showAcknowledged
                ? "Try another severity."
                : "All matching alerts may be acknowledged — enable Show acknowledged, or refresh."
            }
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSeverity("all");
                  setShowAcknowledged(true);
                }}
              >
                Reset filters
              </Button>
            }
          />
        ) : null}

        {!loading && !error && filtered.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filtered.map((alert) => {
              const Icon =
                alert.severity === "critical"
                  ? AlertTriangle
                  : alert.severity === "warning"
                    ? BellRing
                    : Info;
              const tone =
                alert.severity === "critical" ? "red" : alert.severity === "warning" ? "yellow" : "blue";
              const href = alertHref(alert);
              return (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 px-4 py-4 ${alert.acknowledged ? "opacity-60" : ""}`}
                >
                  <div
                    className={
                      alert.severity === "critical"
                        ? "rounded-xl bg-rose-50 p-2 text-rose-700"
                        : alert.severity === "warning"
                          ? "rounded-xl bg-amber-50 p-2 text-amber-700"
                          : "rounded-xl bg-sky-50 p-2 text-sky-700"
                    }
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{alert.title}</p>
                      <Badge tone={tone}>{alert.severity}</Badge>
                      {alert.acknowledged ? <Badge tone="slate">acknowledged</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(alert.createdAt)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {href ? (
                        <Link href={href}>
                          <Button size="sm" variant="outline">
                            Open related
                          </Button>
                        </Link>
                      ) : null}
                      {!alert.acknowledged ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={ackingId === alert.id}
                          onClick={() => void onAcknowledge(alert.id)}
                        >
                          <Check className="h-4 w-4" />
                          Acknowledge
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
