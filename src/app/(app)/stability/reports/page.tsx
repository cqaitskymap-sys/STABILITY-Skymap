"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  PageHeader,
  Select,
  StatusBadge,
} from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { downloadBlob, formatDate, formatDateTime, toCsv } from "@/lib/utils";
import { getChamberUtilization } from "@/services/dashboard";
import {
  listDisposals,
  listMovements,
  listPullPoints,
  listReconciliations,
  listSamples,
  listStudies,
  listTransactions,
  listWithdrawals,
} from "@/services/inventory";
import { derivePullStatus } from "@/lib/utils";

type ReportKey =
  | "current-inventory"
  | "study-wise"
  | "product-wise"
  | "batch-wise"
  | "study-type-wise"
  | "chamber-wise"
  | "withdrawals"
  | "movements"
  | "reconciliation"
  | "disposal"
  | "transactions"
  | "due-overdue"
  | "chamber-utilization";

const REPORTS: { key: ReportKey; title: string; description: string }[] = [
  { key: "current-inventory", title: "Current Inventory Report", description: "All sample balances" },
  { key: "study-wise", title: "Study-wise Inventory", description: "Grouped by study" },
  { key: "product-wise", title: "Product-wise Inventory", description: "Grouped by product" },
  { key: "batch-wise", title: "Batch-wise Inventory", description: "Grouped by batch" },
  { key: "study-type-wise", title: "Study Type-wise Inventory", description: "Accelerated / Intermediate / Long Term" },
  { key: "chamber-wise", title: "Chamber-wise Inventory", description: "Samples by chamber" },
  { key: "withdrawals", title: "Sample Withdrawal Report", description: "Completed withdrawals" },
  { key: "movements", title: "Sample Movement Report", description: "Location transfers" },
  { key: "reconciliation", title: "Reconciliation Report", description: "Variance and adjustments" },
  { key: "disposal", title: "Disposal Report", description: "Disposed quantities" },
  { key: "transactions", title: "Inventory Transaction Report", description: "Full transaction ledger" },
  { key: "due-overdue", title: "Due / Overdue Sample Report", description: "Open pull points" },
  { key: "chamber-utilization", title: "Chamber Utilization Report", description: "Capacity usage" },
];

export default function ReportsPage() {
  const [report, setReport] = useState<ReportKey>("current-inventory");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const bundle = useAsync(async () => {
    const [samples, studies, withdrawals, movements, reconciliations, disposals, transactions, pulls, chambers] =
      await Promise.all([
        listSamples(),
        listStudies(),
        listWithdrawals(),
        listMovements(),
        listReconciliations(),
        listDisposals(),
        listTransactions(),
        listPullPoints(),
        getChamberUtilization(),
      ]);
    return { samples, studies, withdrawals, movements, reconciliations, disposals, transactions, pulls, chambers };
  }, []);

  const rows = useMemo(() => {
    if (!bundle.data) return [] as Record<string, string | number>[];
    const { samples, studies, withdrawals, movements, reconciliations, disposals, transactions, pulls, chambers } =
      bundle.data;

    let result: Record<string, string | number>[] = [];
    switch (report) {
      case "current-inventory":
        result = samples.map((s) => ({
          sampleId: s.sampleId,
          studyId: s.studyId,
          product: s.productName,
          batch: s.batchNumber,
          studyType: s.studyType,
          condition: s.storageCondition,
          chamber: s.chamberName,
          total: s.totalQuantity,
          reserved: s.reservedQuantity,
          available: s.availableQuantity,
          withdrawn: s.withdrawnQuantity,
          disposed: s.disposedQuantity,
          status: s.status,
          nextPull: formatDate(s.nextPullDate),
        }));
        break;
      case "study-wise":
        result = studies.map((s) => ({
          studyId: s.studyId,
          product: s.productName,
          batch: s.batchNumber,
          studyType: s.studyType,
          total: s.totalQuantity,
          available: s.availableQuantity,
          withdrawn: s.withdrawnQuantity,
          status: s.status,
        }));
        break;
      case "product-wise": {
        const map = new Map<string, { product: string; total: number; available: number; withdrawn: number }>();
        samples.forEach((s) => {
          const cur = map.get(s.productName) || { product: s.productName, total: 0, available: 0, withdrawn: 0 };
          cur.total += s.totalQuantity;
          cur.available += s.availableQuantity;
          cur.withdrawn += s.withdrawnQuantity;
          map.set(s.productName, cur);
        });
        result = [...map.values()];
        break;
      }
      case "batch-wise": {
        const map = new Map<string, { product: string; batch: string; total: number; available: number }>();
        samples.forEach((s) => {
          const key = `${s.productName}|${s.batchNumber}`;
          const cur = map.get(key) || { product: s.productName, batch: s.batchNumber, total: 0, available: 0 };
          cur.total += s.totalQuantity;
          cur.available += s.availableQuantity;
          map.set(key, cur);
        });
        result = [...map.values()];
        break;
      }
      case "study-type-wise": {
        const map = new Map<string, { studyType: string; studies: number; total: number; available: number }>();
        studies.forEach((s) => {
          const cur = map.get(s.studyType) || { studyType: s.studyType, studies: 0, total: 0, available: 0 };
          cur.studies += 1;
          cur.total += s.totalQuantity;
          cur.available += s.availableQuantity;
          map.set(s.studyType, cur);
        });
        result = [...map.values()];
        break;
      }
      case "chamber-wise":
        result = samples.map((s) => ({
          chamber: s.chamberName,
          sampleId: s.sampleId,
          product: s.productName,
          batch: s.batchNumber,
          available: s.availableQuantity,
          status: s.status,
        }));
        break;
      case "withdrawals":
        result = withdrawals.map((w) => ({
          withdrawalId: w.withdrawalId,
          date: formatDate(w.withdrawalDate),
          product: w.productName,
          batch: w.batchNumber,
          pullPoint: w.pullPoint,
          planned: w.plannedQuantity,
          actual: w.actualQuantity,
          withdrawnBy: w.withdrawnBy,
          receivedBy: w.receivedBy,
        }));
        break;
      case "movements":
        result = movements.map((m) => ({
          movementId: m.movementId,
          date: formatDate(m.movementDate),
          sampleId: m.sampleId,
          from: m.fromLocationLabel,
          to: m.toLocationLabel,
          movedBy: m.movedBy,
          reason: m.reason,
        }));
        break;
      case "reconciliation":
        result = reconciliations.map((r) => ({
          reconciliationId: r.reconciliationId,
          date: formatDate(r.reconciliationDate),
          product: r.productName,
          batch: r.batchNumber,
          systemQty: r.systemQuantity,
          physicalQty: r.physicalQuantity,
          variance: r.variance,
          status: r.status,
        }));
        break;
      case "disposal":
        result = disposals.map((d) => ({
          disposalId: d.disposalId,
          date: formatDate(d.disposalDate),
          sampleId: d.sampleId,
          product: d.productName,
          batch: d.batchNumber,
          quantity: d.quantity,
          reason: d.reason,
          disposedBy: d.disposedBy,
        }));
        break;
      case "transactions":
        result = transactions.map((t) => ({
          transactionId: t.transactionId,
          dateTime: formatDateTime(t.performedAt),
          type: t.transactionType,
          sampleId: t.sampleId,
          product: t.productName,
          batch: t.batchNumber,
          quantity: t.quantity,
          user: t.performedByName,
        }));
        break;
      case "due-overdue":
        result = pulls
          .map((p) => ({ ...p, status: derivePullStatus(p.plannedDate, p.actualQuantity, p.plannedQuantity) }))
          .filter((p) => ["Upcoming", "Due Soon", "Due Today", "Overdue", "Partially Withdrawn"].includes(p.status))
          .map((p) => ({
            dueDate: formatDate(p.plannedDate),
            product: p.productName,
            batch: p.batchNumber,
            studyType: p.studyType,
            pullPoint: p.pullPoint,
            planned: p.plannedQuantity,
            actual: p.actualQuantity,
            status: p.status,
          }));
        break;
      case "chamber-utilization":
        result = chambers.map((c) => ({
          chamber: c.chamberName,
          condition: `${c.temperature} / ${c.relativeHumidity}`,
          capacity: c.capacity,
          used: c.usedCapacity,
          available: c.available,
          utilization: `${c.utilization}%`,
          status: c.status,
        }));
        break;
    }

    const q = search.trim().toLowerCase();
    return result.filter((row) => {
      if (from || to) {
        const dateVal = String(row.date || row.dateTime || row.dueDate || "");
        const isoish = dateVal.includes("/")
          ? "" // display dates skipped for simple filter
          : dateVal.slice(0, 10);
        if (isoish) {
          if (from && isoish < from) return false;
          if (to && isoish > to) return false;
        }
      }
      if (!q) return true;
      return Object.values(row).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [bundle.data, report, search, from, to]);

  function exportCsv() {
    if (!rows.length) {
      toast.error("No rows to export.");
      return;
    }
    downloadBlob(`${report}-${Date.now()}.csv`, toCsv(rows));
    toast.success("CSV exported.");
  }

  function exportExcel() {
    if (!rows.length) {
      toast.error("No rows to export.");
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(rows);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Report");
    XLSX.writeFile(book, `${report}-${Date.now()}.xlsx`);
    toast.success("Excel exported.");
  }

  const selected = REPORTS.find((r) => r.key === report)!;
  const headers = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Inventory, withdrawal, reconciliation, and chamber utilization reports with export."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()} className="no-print">
              Print
            </Button>
            <Button variant="outline" onClick={exportCsv} className="no-print">
              Export CSV
            </Button>
            <Button onClick={exportExcel} className="no-print">
              Export Excel
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit p-3 no-print">
          <div className="space-y-1">
            {REPORTS.map((r) => (
              <button
                key={r.key}
                onClick={() => setReport(r.key)}
                className={
                  report === r.key
                    ? "w-full rounded-lg bg-teal-50 px-3 py-2 text-left text-sm font-medium text-teal-800"
                    : "w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"
                }
              >
                {r.title}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title={selected.title} description={selected.description} />
          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-4 no-print">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search report..." />
            <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <Select value={report} onChange={(e) => setReport(e.target.value as ReportKey)}>
              {REPORTS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.title}
                </option>
              ))}
            </Select>
          </div>

          {bundle.loading ? <LoadingSkeleton /> : null}
          {bundle.error ? <ErrorState message={bundle.error} onRetry={bundle.reload} /> : null}
          {!bundle.loading && !bundle.error && rows.length === 0 ? <EmptyState title="No rows for this report." /> : null}

          {!bundle.loading && !bundle.error && rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((row, idx) => (
                    <tr key={idx} className="border-t border-slate-100">
                      {headers.map((h) => (
                        <td key={h} className="px-4 py-3 text-slate-700">
                          {h.toLowerCase() === "status" ? <StatusBadge status={String(row[h])} /> : row[h]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 200 ? (
                <p className="px-4 py-3 text-xs text-slate-500">Showing first 200 rows. Export for full dataset.</p>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
