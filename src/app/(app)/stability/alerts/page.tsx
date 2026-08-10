"use client";

import { AlertTriangle, BellRing, Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge, Button, Card, EmptyState, ErrorState, LoadingSkeleton, PageHeader } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime, friendlyError } from "@/lib/utils";
import { listAlerts, refreshAlerts } from "@/services/inventory";

export default function AlertsPage() {
  const { data, loading, error, reload } = useAsync(listAlerts, []);

  async function onRefresh() {
    try {
      const count = await refreshAlerts();
      toast.success(`Alerts refreshed (${count} active).`);
      await reload();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  return (
    <div>
      <PageHeader
        title="Alerts"
        description="Operational alerts for due pulls, capacity, variances, and depleted samples."
        actions={
          <Button onClick={onRefresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh Alerts
          </Button>
        }
      />

      <Card>
        {loading ? <LoadingSkeleton /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {!loading && !error && !data?.length ? (
          <EmptyState title="No alerts right now." description="The inventory posture looks clear." />
        ) : null}

        {!loading && !error && !!data?.length ? (
          <div className="divide-y divide-slate-100">
            {data.map((alert) => {
              const Icon =
                alert.severity === "critical" ? AlertTriangle : alert.severity === "warning" ? BellRing : Info;
              const tone =
                alert.severity === "critical" ? "red" : alert.severity === "warning" ? "yellow" : "blue";
              return (
                <div key={alert.id} className="flex items-start gap-3 px-4 py-4">
                  <div
                    className={
                      alert.severity === "critical"
                        ? "rounded-lg bg-rose-50 p-2 text-rose-700"
                        : alert.severity === "warning"
                          ? "rounded-lg bg-amber-50 p-2 text-amber-700"
                          : "rounded-lg bg-sky-50 p-2 text-sky-700"
                    }
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{alert.title}</p>
                      <Badge tone={tone}>{alert.severity}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDateTime(alert.createdAt)}</p>
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
