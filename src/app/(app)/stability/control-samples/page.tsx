"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, Boxes, ClipboardCheck, PackageMinus, RefreshCw, Shield, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatCard,
  StatusBadge,
} from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getControlDashboard } from "@/services/control-samples";

export default function ControlSampleDashboardPage() {
  const dash = useAsync(getControlDashboard, []);
  const data = dash.data;
  const stats = useMemo(() => {
    if (!data) return [];
    return [
      { title: "Total Control Samples", value: data.total, icon: Shield, tone: "teal" as const },
      { title: "Available Control Samples", value: data.available, icon: Boxes, tone: "emerald" as const },
      { title: "Samples Under Periodic Observation", value: data.observationDue, icon: ClipboardCheck, tone: "blue" as const },
      { title: "Samples Requiring Attention", value: data.requiringAttention, icon: AlertTriangle, tone: "amber" as const },
      { title: "Withdrawal Requests", value: data.withdrawalRequests, icon: PackageMinus, tone: "indigo" as const },
      { title: "Samples Due for Destruction", value: data.destructionDue, icon: Trash2, tone: "amber" as const },
      { title: "Samples Overdue for Destruction", value: data.destructionOverdue, icon: AlertTriangle, tone: "rose" as const },
      { title: "Recently Destroyed Samples", value: data.recentlyDestroyed, icon: Trash2, tone: "teal" as const },
    ];
  }, [data]);

  return (
    <div>
      <PageHeader
        title="Control Samples"
        description="Control samples are separate from stability pull-point inventory. No accelerated, intermediate, or long-term schedules are created here."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void dash.reload()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button href="/stability/control-samples/collection">New collection</Button>
            <Button href="/stability/control-samples/daily-collection" variant="outline">Daily Collection Record</Button>
          </div>
        }
      />
      {dash.loading ? <LoadingSkeleton rows={8} /> : null}
      {dash.error ? <ErrorState message={dash.error} onRetry={dash.reload} /> : null}
      {data ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((s) => (
              <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} tone={s.tone} />
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Recent Collection Activity" action={<Link className="text-sm text-teal-700" href="/stability/control-samples/collection">View all</Link>} />
              {!data.recentCollections.length ? (
                <EmptyState title="No collections yet" description="IPQA records collection against Annexure-I quantities." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        {["Date", "Product", "Batch", "Quantity", "Collected By", "Received By", "Status"].map((h) => (
                          <th key={h} className="px-4 py-2 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.recentCollections.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-2">{formatDate(r.date)}</td>
                          <td className="px-4 py-2">{r.productName}</td>
                          <td className="px-4 py-2">{r.batchNumber}</td>
                          <td className="px-4 py-2">{r.actualQuantity} {r.unit}</td>
                          <td className="px-4 py-2">{r.collectedBy}</td>
                          <td className="px-4 py-2">{r.receivedBy || "—"}</td>
                          <td className="px-4 py-2"><StatusBadge status={r.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Periodic Observation Due" action={<Link className="text-sm text-teal-700" href="/stability/control-samples/observation">Open</Link>} />
              {!data.observationDueRows.length ? (
                <EmptyState title="No observations due" description="Default interval is 6 months up to shelf life, configurable in Organization settings." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        {["Product", "Batch", "Expiry", "Last Observation", "Next Observation", "Status", "Action"].map((h) => (
                          <th key={h} className="px-4 py-2 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.observationDueRows.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-2">{r.productName}</td>
                          <td className="px-4 py-2">{r.batchNumber}</td>
                          <td className="px-4 py-2">{formatDate(r.expiryDate)}</td>
                          <td className="px-4 py-2">{formatDate(r.lastObservationDate)}</td>
                          <td className="px-4 py-2">{formatDate(r.nextObservationDate)}</td>
                          <td className="px-4 py-2"><StatusBadge status="Observation Due" /></td>
                          <td className="px-4 py-2"><Link className="text-teal-700" href="/stability/control-samples/observation">Record</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Destruction Due" action={<Link className="text-sm text-teal-700" href="/stability/control-samples/destruction-due">Open</Link>} />
              {!data.destructionDueRows.length ? (
                <EmptyState title="No samples due" description="Eligible date is expiry plus the configured retention (SOP default: 1 year)." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        {["Product", "Batch", "Expiry Date", "Destruction Eligible Date", "Quantity", "Status", "Action"].map((h) => (
                          <th key={h} className="px-4 py-2 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.destructionDueRows.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-2">{r.productName}</td>
                          <td className="px-4 py-2">{r.batchNumber}</td>
                          <td className="px-4 py-2">{formatDate(r.expiryDate)}</td>
                          <td className="px-4 py-2">{formatDate(r.destructionEligibleDate)}</td>
                          <td className="px-4 py-2">{r.availableQuantity} {r.unit}</td>
                          <td className="px-4 py-2"><StatusBadge status={r.destructionHold ? "Destruction Hold" : "Destruction Eligible"} /></td>
                          <td className="px-4 py-2"><Link className="text-teal-700" href="/stability/control-samples/destruction/new">Destroy</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Recent Activity" action={<Link className="text-sm text-teal-700" href="/stability/control-samples/transactions">Ledger</Link>} />
              {!data.recentActivity.length ? (
                <EmptyState title="No control sample transactions" description="Control sample quantity changes are recorded in a separate ledger from stability inventory." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr>
                        {["User", "Date/Time", "Action", "Product", "Batch", "Quantity", "Status"].map((h) => (
                          <th key={h} className="px-4 py-2 text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.recentActivity.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-2">{r.performedByName}</td>
                          <td className="px-4 py-2">{formatDateTime(r.performedAt)}</td>
                          <td className="px-4 py-2">{r.transactionType.replaceAll("CONTROL_SAMPLE_", "")}</td>
                          <td className="px-4 py-2">{r.productName}</td>
                          <td className="px-4 py-2">{r.batchNumber}</td>
                          <td className="px-4 py-2">{r.quantity}</td>
                          <td className="px-4 py-2">{r.newQuantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
