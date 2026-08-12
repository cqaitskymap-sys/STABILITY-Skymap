"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  PackageMinus,
  RefreshCw,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
} from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, paginate, todayISO } from "@/lib/utils";
import { listPullPoints } from "@/services/inventory";
import { listChambers } from "@/services/masters";
import type { PullPointStatus, StudyPullPoint } from "@/types";

const OPEN_STATUSES: PullPointStatus[] = [
  "Upcoming",
  "Due Soon",
  "Due Today",
  "Overdue",
  "Partially Withdrawn",
];

type WindowFilter = "all" | "today" | "7" | "30" | "overdue";

function daysUntil(plannedDate: string) {
  const today = startOfDay(new Date());
  const due = startOfDay(parseISO(`${plannedDate}T00:00:00`));
  return differenceInCalendarDays(due, today);
}

function dueHint(plannedDate: string, status: PullPointStatus) {
  const days = daysUntil(plannedDate);
  if (status === "Overdue" || days < 0) {
    const n = Math.abs(days);
    return `${n} day${n === 1 ? "" : "s"} overdue`;
  }
  if (days === 0 || status === "Due Today") return "Due today";
  if (days === 1) return "Due tomorrow";
  return `In ${days} days`;
}

function matchesWindow(pull: StudyPullPoint, window: WindowFilter) {
  if (window === "all") return true;
  if (window === "overdue") return pull.status === "Overdue" || daysUntil(pull.plannedDate) < 0;
  const days = daysUntil(pull.plannedDate);
  // Include overdue in near-term windows so critical pulls stay visible.
  if (window === "today") return days <= 0 || pull.status === "Due Today" || pull.status === "Overdue";
  if (window === "7") return days <= 7;
  if (window === "30") return days <= 30;
  return true;
}

function statusPriority(status: PullPointStatus) {
  switch (status) {
    case "Overdue":
      return 0;
    case "Due Today":
      return 1;
    case "Due Soon":
      return 2;
    case "Partially Withdrawn":
      return 3;
    default:
      return 4;
  }
}

export default function UpcomingWithdrawalsPage() {
  const { hasPermission } = useAuth();
  const canWithdraw = hasPermission("withdrawal.perform");

  const pulls = useAsync(listPullPoints, []);
  const chambers = useAsync(listChambers, []);
  const [window, setWindow] = useState<WindowFilter>("7");
  const [studyType, setStudyType] = useState("all");
  const [chamberId, setChamberId] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const openPulls = useMemo(() => {
    return (pulls.data || []).filter((p) => OPEN_STATUSES.includes(p.status));
  }, [pulls.data]);

  const studyTypes = useMemo(() => {
    const set = new Set(openPulls.map((p) => p.studyType).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [openPulls]);

  const chamberOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of chambers.data || []) {
      map.set(c.id, c.chamberName);
    }
    for (const p of openPulls) {
      if (p.chamberId && !map.has(p.chamberId)) {
        map.set(p.chamberId, p.chamberName || p.chamberId);
      }
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [chambers.data, openPulls]);

  const stats = useMemo(() => {
    return {
      overdue: openPulls.filter((p) => p.status === "Overdue" || daysUntil(p.plannedDate) < 0).length,
      dueToday: openPulls.filter((p) => p.status === "Due Today" || daysUntil(p.plannedDate) === 0).length,
      dueSoon: openPulls.filter((p) => p.status === "Due Soon").length,
      open: openPulls.length,
    };
  }, [openPulls]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return openPulls
      .filter((p) => matchesWindow(p, window))
      .filter((p) => (studyType === "all" ? true : p.studyType === studyType))
      .filter((p) => (chamberId === "all" ? true : p.chamberId === chamberId))
      .filter((p) => {
        if (!q) return true;
        return [p.productName, p.batchNumber, p.pullPoint, p.studyType, p.chamberName, p.sampleId]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => {
        const byStatus = statusPriority(a.status) - statusPriority(b.status);
        if (byStatus !== 0) return byStatus;
        return a.plannedDate.localeCompare(b.plannedDate);
      });
  }, [openPulls, window, studyType, chamberId, search]);

  const paged = paginate(filtered, page, 12);
  const filtersActive =
    window !== "all" || studyType !== "all" || chamberId !== "all" || search.trim() !== "";

  function clearFilters() {
    setWindow("all");
    setStudyType("all");
    setChamberId("all");
    setSearch("");
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Upcoming Withdrawals"
        description="Track pull points that are upcoming, due, overdue, or partially withdrawn."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                void pulls.reload();
                void chambers.reload();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {canWithdraw ? (
              <Link href="/stability/withdrawals">
                <Button variant="outline">Withdrawal Form</Button>
              </Link>
            ) : null}
          </div>
        }
      />

      {!pulls.loading && !pulls.error ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Open Pulls" value={stats.open} icon={CalendarDays} tone="teal" />
          <StatCard title="Overdue" value={stats.overdue} icon={AlertTriangle} tone="rose" />
          <StatCard title="Due Today" value={stats.dueToday} icon={CalendarClock} tone="amber" />
          <StatCard title="Due Soon (≤7d)" value={stats.dueSoon} icon={CalendarClock} tone="indigo" />
        </div>
      ) : null}

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-5">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search product, batch, pull point..."
            className="xl:col-span-2"
          />
          <Select
            label="Due Window"
            value={window}
            onChange={(e) => {
              setWindow(e.target.value as WindowFilter);
              setPage(1);
            }}
          >
            <option value="all">All Open</option>
            <option value="today">Today + Overdue</option>
            <option value="7">Next 7 Days + Overdue</option>
            <option value="30">Next 30 Days + Overdue</option>
            <option value="overdue">Overdue Only</option>
          </Select>
          <Select
            label="Study Type"
            value={studyType}
            onChange={(e) => {
              setStudyType(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Study Types</option>
            {studyTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select
            label="Chamber"
            value={chamberId}
            onChange={(e) => {
              setChamberId(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Chambers</option>
            {chamberOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 text-sm text-slate-500">
          <p>
            As of {formatDate(todayISO())} · {filtered.length} pull point
            {filtered.length === 1 ? "" : "s"}
          </p>
          {filtersActive ? (
            <Button size="sm" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>

        {pulls.loading ? <LoadingSkeleton /> : null}
        {pulls.error ? <ErrorState message={pulls.error} onRetry={pulls.reload} /> : null}

        {!pulls.loading && !pulls.error && openPulls.length === 0 ? (
          <EmptyState
            title="No upcoming withdrawals"
            description="Open pull points appear here after samples are charged with a withdrawal schedule."
            action={
              <Link href="/stability/inventory/charging">
                <Button variant="outline">Charge Sample</Button>
              </Link>
            }
          />
        ) : null}

        {!pulls.loading && !pulls.error && openPulls.length > 0 && paged.items.length === 0 ? (
          <EmptyState
            title="No pull points match your filters"
            description="Try clearing search or widening the due window."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : null}

        {!pulls.loading && !pulls.error && paged.items.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Study Type</th>
                    <th className="px-4 py-3">Condition</th>
                    <th className="px-4 py-3">Chamber</th>
                    <th className="px-4 py-3">Pull Point</th>
                    <th className="px-4 py-3">Due Date</th>
                    <th className="px-4 py-3">Planned</th>
                    <th className="px-4 py-3">Remaining</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((p) => {
                    const remaining = Math.max(0, p.plannedQuantity - p.actualQuantity);
                    return (
                      <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-medium text-slate-900">{p.productName}</td>
                        <td className="px-4 py-3">{p.batchNumber}</td>
                        <td className="px-4 py-3">{p.studyType}</td>
                        <td className="px-4 py-3">{p.storageCondition}</td>
                        <td className="px-4 py-3">{p.chamberName}</td>
                        <td className="px-4 py-3 font-medium text-teal-800">{p.pullPoint}</td>
                        <td className="px-4 py-3">
                          <div>{formatDate(p.plannedDate)}</div>
                          <div
                            className={
                              p.status === "Overdue"
                                ? "text-xs text-rose-600"
                                : p.status === "Due Today"
                                  ? "text-xs text-orange-600"
                                  : p.status === "Due Soon"
                                    ? "text-xs text-amber-600"
                                    : "text-xs text-slate-500"
                            }
                          >
                            {dueHint(p.plannedDate, p.status)}
                          </div>
                        </td>
                        <td className="px-4 py-3">{p.plannedQuantity}</td>
                        <td className="px-4 py-3 font-medium">{remaining}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={p.status} />
                        </td>
                        <td className="px-4 py-3">
                          {canWithdraw ? (
                            <Link href={`/stability/withdrawals?pull=${p.id}`}>
                              <Button size="sm">
                                <PackageMinus className="h-3.5 w-3.5" />
                                Withdraw
                              </Button>
                            </Link>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {paged.items.map((p) => {
                const remaining = Math.max(0, p.plannedQuantity - p.actualQuantity);
                return (
                  <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{p.productName}</p>
                        <p className="text-sm text-slate-500">
                          {p.batchNumber} · {p.pullPoint}
                        </p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                    <p
                      className={
                        p.status === "Overdue"
                          ? "mt-1 text-xs font-medium text-rose-600"
                          : p.status === "Due Today"
                            ? "mt-1 text-xs font-medium text-orange-600"
                            : p.status === "Due Soon"
                              ? "mt-1 text-xs font-medium text-amber-600"
                              : "mt-1 text-xs text-slate-500"
                      }
                    >
                      {dueHint(p.plannedDate, p.status)}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <p className="text-slate-500">Study Type</p>
                      <p className="text-right font-medium">{p.studyType}</p>
                      <p className="text-slate-500">Chamber</p>
                      <p className="text-right font-medium">{p.chamberName}</p>
                      <p className="text-slate-500">Due</p>
                      <p className="text-right font-medium">{formatDate(p.plannedDate)}</p>
                      <p className="text-slate-500">Remaining</p>
                      <p className="text-right font-medium">
                        {remaining} / {p.plannedQuantity}
                      </p>
                    </div>
                    {canWithdraw ? (
                      <Link href={`/stability/withdrawals?pull=${p.id}`} className="mt-3 block">
                        <Button className="w-full" size="sm">
                          <PackageMinus className="h-4 w-4" />
                          Withdraw
                        </Button>
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
              <p className="text-slate-500">
                Showing {paged.items.length} of {paged.total}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={paged.page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={paged.page >= paged.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}
