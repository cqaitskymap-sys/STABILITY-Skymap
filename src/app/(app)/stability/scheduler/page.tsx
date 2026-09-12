"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Printer, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { PrintDocument } from "@/components/print/print-document";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, toCsv, downloadBlob } from "@/lib/utils";
import { listPullPoints } from "@/services/inventory";

export default function MonthlyPlannerPage() {
  const month = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(month);
  const [view, setView] = useState<"list" | "calendar" | "print">("list");
  const pulls = useAsync(listPullPoints, []);

  const rows = useMemo(() => {
    return (pulls.data || []).filter((p) => (p.plannedDate || "").startsWith(selectedMonth));
  }, [pulls.data, selectedMonth]);

  const daysInMonth = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return new Date(y, m, 0).getDate();
  }, [selectedMonth]);

  function exportCsv() {
    downloadBlob(
      `monthly-stability-plan-${selectedMonth}.csv`,
      toCsv(
        rows.map((r) => ({
          Month: selectedMonth,
          Product: r.productName,
          Batch: r.batchNumber,
          "Study Type": r.studyType,
          Condition: r.storageCondition,
          Chamber: r.chamberName,
          "Pull Point": r.pullPoint,
          "Due Date": r.plannedDate,
          "Allowed Date": r.windowEndDate || "",
          Quantity: r.plannedQuantity,
          Status: r.status,
        }))
      )
    );
  }

  return (
    <div>
      <PageHeader
        title="Monthly Stability Planner"
        description="Pull points for the selected month, calculated from sample incubation / charging date."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void pulls.reload()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
              Export
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        }
      />
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Month" type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
          <div className="flex items-end gap-2">
            {(["list", "calendar", "print"] as const).map((v) => (
              <Button key={v} size="sm" variant={view === v ? "primary" : "outline"} onClick={() => setView(v)}>
                {v}
              </Button>
            ))}
          </div>
          <p className="self-end text-sm text-slate-500">{rows.length} planned pulls</p>
        </div>
      </Card>
      {pulls.loading ? <LoadingSkeleton rows={6} /> : null}
      {pulls.error ? <ErrorState message={pulls.error} onRetry={pulls.reload} /> : null}
      {!pulls.loading && !pulls.error && !rows.length ? (
        <EmptyState title="No pulls in this month" description="Change month or charge studies with pull points." />
      ) : null}
      {view === "list" && rows.length ? (
        <Card>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  {["Product", "Batch", "Type", "Condition", "Chamber", "Pull", "Due", "Window", "Qty", "Status"].map((h) => (
                    <th key={h} className="px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">{r.productName}</td>
                    <td className="px-4 py-3">{r.batchNumber}</td>
                    <td className="px-4 py-3">{r.studyType}</td>
                    <td className="px-4 py-3">{r.storageCondition}</td>
                    <td className="px-4 py-3">{r.chamberName}</td>
                    <td className="px-4 py-3">{r.pullPoint}</td>
                    <td className="px-4 py-3">{formatDate(r.plannedDate)}</td>
                    <td className="px-4 py-3">{formatDate(r.windowEndDate)}</td>
                    <td className="px-4 py-3">{r.plannedQuantity}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 p-4 md:hidden">
            {rows.map((r) => (
              <div key={r.id} className="rounded-xl border border-slate-200 p-3">
                <p className="font-semibold">{r.productName} / {r.batchNumber}</p>
                <p className="text-sm text-slate-500">{r.pullPoint} · {formatDate(r.plannedDate)}</p>
                <StatusBadge status={r.status} />
              </div>
            ))}
          </div>
        </Card>
      ) : null}
      {view === "calendar" && rows.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = String(i + 1).padStart(2, "0");
            const iso = `${selectedMonth}-${day}`;
            const dayRows = rows.filter((r) => r.plannedDate === iso);
            return (
              <Card key={iso} className="min-h-24 p-2">
                <p className="text-xs font-semibold text-slate-500">{day}</p>
                {dayRows.map((r) => (
                  <Link key={r.id} href={`/stability/withdrawals?pull=${r.id}`} className="mt-1 block truncate text-[11px] text-teal-800">
                    {r.productName} {r.pullPoint}
                  </Link>
                ))}
              </Card>
            );
          })}
        </div>
      ) : null}
      {view === "print" && rows.length ? (
        <PrintDocument title="Monthly Stability Planner" documentNumber={selectedMonth}>
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2">Product</th>
                <th>Batch</th>
                <th>Type</th>
                <th>Pull</th>
                <th>Due</th>
                <th>Qty</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2">{r.productName}</td>
                  <td>{r.batchNumber}</td>
                  <td>{r.studyType}</td>
                  <td>{r.pullPoint}</td>
                  <td>{formatDate(r.plannedDate)}</td>
                  <td>{r.plannedQuantity}</td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintDocument>
      ) : null}
    </div>
  );
}
