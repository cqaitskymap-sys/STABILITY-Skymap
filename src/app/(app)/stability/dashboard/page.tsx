"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  CheckCircle2,
  FlaskConical,
  PackageMinus,
  Thermometer,
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
  StatCard,
  StatusBadge,
} from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, formatDateTime, roundPct } from "@/lib/utils";
import { DashboardBriefing } from "@/components/ai/dashboard-briefing";
import { getChamberUtilization, getDashboardStats, getRecentActivity } from "@/services/dashboard";
import { listPullPoints } from "@/services/inventory";
import { derivePullStatus } from "@/lib/utils";

export default function StabilityDashboardPage() {
  const stats = useAsync(getDashboardStats, []);
  const chambers = useAsync(getChamberUtilization, []);
  const activity = useAsync(getRecentActivity, []);
  const upcoming = useAsync(async () => {
    const pulls = await listPullPoints();
    return pulls
      .map((p) => ({ ...p, status: derivePullStatus(p.plannedDate, p.actualQuantity, p.plannedQuantity) }))
      .filter((p) =>
        ["Upcoming", "Due Soon", "Due Today", "Overdue", "Partially Withdrawn"].includes(p.status)
      )
      .slice(0, 8);
  }, []);

  const loading = stats.loading || chambers.loading || activity.loading || upcoming.loading;
  const error = stats.error || chambers.error || activity.error || upcoming.error;

  return (
    <div>
      <PageHeader
        title="Stability Dashboard"
        description="Live view of studies, inventory balance, upcoming pulls, and chamber utilization."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/stability/studies/new">
              <Button>Create Stability Study</Button>
            </Link>
            <Link href="/stability/inventory/charging">
              <Button variant="outline">Charge Sample</Button>
            </Link>
            <Link href="/stability/withdrawals/upcoming">
              <Button variant="outline">Upcoming Withdrawals</Button>
            </Link>
          </div>
        }
      />

      <DashboardBriefing />

      {loading ? <LoadingSkeleton rows={6} /> : null}
      {error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            void stats.reload();
            void chambers.reload();
            void activity.reload();
            void upcoming.reload();
          }}
        />
      ) : null}

      {!loading && !error && stats.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Total Active Studies" value={stats.data.totalActiveStudies} icon={FlaskConical} tone="teal" />
            <StatCard title="Total Samples" value={stats.data.totalSamples} icon={Boxes} tone="blue" />
            <StatCard title="Available Samples" value={stats.data.availableSamples} icon={CheckCircle2} tone="emerald" />
            <StatCard title="Samples Withdrawn" value={stats.data.samplesWithdrawn} icon={PackageMinus} tone="indigo" />
            <StatCard title="Samples Due Soon" value={stats.data.samplesDueSoon} icon={CalendarClock} tone="amber" />
            <StatCard title="Overdue Samples" value={stats.data.overdueSamples} icon={AlertTriangle} tone="rose" />
            <StatCard title="Active Chambers" value={stats.data.activeChambers} icon={Warehouse} tone="blue" />
            <StatCard
              title="Chamber Capacity Utilization"
              value={`${stats.data.chamberUtilization}%`}
              icon={Thermometer}
              tone="teal"
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-1">
              <CardHeader title="Study Type Overview" description="Accelerated, Intermediate, and Long Term inventory posture." />
              <div className="space-y-3 p-4">
                {stats.data.studyTypeOverview.map((row) => (
                  <div key={row.studyType} className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{row.studyType}</p>
                      <Badge tone="teal">{row.activeStudies} active</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-slate-50 p-2">
                        <p className="text-slate-500">Total</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{row.totalSamples}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <p className="text-slate-500">Available</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{row.availableSamples}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-2">
                        <p className="text-slate-500">Upcoming</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{row.upcomingWithdrawals}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader
                title="Upcoming Sample Withdrawals"
                description="Prioritized pull schedule across all study types."
                action={
                  <Link href="/stability/withdrawals/upcoming">
                    <Button size="sm" variant="outline">
                      View all
                    </Button>
                  </Link>
                }
              />
              {!upcoming.data?.length ? (
                <EmptyState title="No upcoming withdrawals." />
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3">Due Date</th>
                          <th className="px-4 py-3">Product</th>
                          <th className="px-4 py-3">Batch</th>
                          <th className="px-4 py-3">Study Type</th>
                          <th className="px-4 py-3">Condition</th>
                          <th className="px-4 py-3">Pull</th>
                          <th className="px-4 py-3">Qty</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcoming.data.map((row) => (
                          <tr key={row.id} className="border-t border-slate-100">
                            <td className="px-4 py-3">{formatDate(row.plannedDate)}</td>
                            <td className="px-4 py-3">{row.productName}</td>
                            <td className="px-4 py-3">{row.batchNumber}</td>
                            <td className="px-4 py-3">{row.studyType}</td>
                            <td className="px-4 py-3">{row.storageCondition}</td>
                            <td className="px-4 py-3">{row.pullPoint}</td>
                            <td className="px-4 py-3">{row.plannedQuantity}</td>
                            <td className="px-4 py-3">
                              <StatusBadge status={row.status} />
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/stability/withdrawals?pull=${row.id}`}>
                                <Button size="sm" variant="outline">
                                  Withdraw
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-3 p-4 md:hidden">
                    {upcoming.data.map((row) => (
                      <div key={row.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-slate-900">{row.productName}</p>
                            <p className="text-sm text-slate-500">
                              {row.batchNumber} · {row.pullPoint}
                            </p>
                          </div>
                          <StatusBadge status={row.status} />
                        </div>
                        <p className="mt-2 text-sm text-slate-600">Due {formatDate(row.plannedDate)}</p>
                        <Link href={`/stability/withdrawals?pull=${row.id}`} className="mt-3 block">
                          <Button size="sm" className="w-full" variant="outline">
                            Withdraw
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="Chamber Utilization" description="Capacity usage across stability chambers." />
              {!chambers.data?.length ? (
                <EmptyState title="No chambers configured." />
              ) : (
                <div className="space-y-3 p-4">
                  {chambers.data.map((c) => (
                    <div key={c.id} className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/80 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{c.chamberName}</p>
                          <p className="text-sm text-slate-500">
                            {c.temperature} / {c.relativeHumidity}
                          </p>
                        </div>
                        <StatusBadge status={c.status} />
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs">
                        <div>
                          <p className="text-slate-500">Capacity</p>
                          <p className="font-semibold">{c.capacity}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Used</p>
                          <p className="font-semibold">{c.usedCapacity}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Available</p>
                          <p className="font-semibold">{c.available}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Util %</p>
                          <p className="font-semibold">{roundPct(c.usedCapacity, c.capacity)}%</p>
                        </div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-600"
                          style={{ width: `${roundPct(c.usedCapacity, c.capacity)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Recent Inventory Activity" description="Latest inventory transactions." />
              {!activity.data?.length ? (
                <EmptyState title="No inventory transactions found." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {activity.data.map((tx) => (
                    <div key={tx.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                      <div>
                        <p className="font-medium text-slate-900">{tx.transactionType.replaceAll("_", " ")}</p>
                        <p className="text-slate-500">
                          {tx.productName} · {tx.batchNumber} · Qty {tx.quantity}
                        </p>
                        <p className="text-xs text-slate-400">
                          {tx.performedByName} · {formatDateTime(tx.performedAt)}
                        </p>
                      </div>
                      <Badge tone="slate">{tx.transactionId}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
