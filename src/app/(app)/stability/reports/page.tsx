"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
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
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import {
  derivePullStatus,
  downloadBlob,
  formatDate,
  formatDateTime,
  pullDueUrgency,
  toCsv,
} from "@/lib/utils";
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

type ReportRow = Record<string, string | number>;

const REPORTS: { key: ReportKey; title: string; description: string }[] = [
  { key: "current-inventory", title: "Current Inventory Report", description: "All sample balances" },
  { key: "study-wise", title: "Study-wise Inventory", description: "Grouped by study" },
  { key: "product-wise", title: "Product-wise Inventory", description: "Grouped by product" },
  { key: "batch-wise", title: "Batch-wise Inventory", description: "Grouped by batch" },
  { key: "study-type-wise", title: "Study Type-wise Inventory", description: "Totals by configured study type" },
  { key: "chamber-wise", title: "Chamber-wise Inventory", description: "Samples by chamber" },
  { key: "withdrawals", title: "Sample Withdrawal Report", description: "Completed withdrawals" },
  { key: "movements", title: "Sample Movement Report", description: "Location transfers" },
  { key: "reconciliation", title: "Reconciliation Report", description: "Variance and adjustments" },
  { key: "disposal", title: "Disposal Report", description: "Disposed quantities" },
  { key: "transactions", title: "Inventory Transaction Report", description: "Full transaction ledger" },
  { key: "due-overdue", title: "Due / Overdue Sample Report", description: "Open pull points including partials" },
  { key: "chamber-utilization", title: "Chamber Utilization Report", description: "Capacity usage" },
];

const DATE_FILTER_REPORTS = new Set<ReportKey>([
  "withdrawals",
  "movements",
  "reconciliation",
  "disposal",
  "transactions",
  "due-overdue",
]);

const PREVIEW_LIMIT = 200;

function humanizeHeader(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function displayRows(rows: ReportRow[]) {
  return rows.map((row) => {
    const next: ReportRow = {};
    Object.entries(row).forEach(([k, v]) => {
      if (k.startsWith("_")) return;
      next[k] = v;
    });
    return next;
  });
}

function duePriority(status: string) {
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

async function settledValue<T>(promise: Promise<T>, label: string, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    console.error(`Reports: failed to load ${label}`, err);
    return fallback;
  }
}

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("reports.view");

  const [report, setReport] = useState<ReportKey>("current-inventory");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const bundle = useAsync(async () => {
    const [
      samples,
      studies,
      withdrawals,
      movements,
      reconciliations,
      disposals,
      transactions,
      pulls,
      chambers,
    ] = await Promise.all([
      settledValue(listSamples(), "samples", []),
      settledValue(listStudies(), "studies", []),
      settledValue(listWithdrawals(), "withdrawals", []),
      settledValue(listMovements(), "movements", []),
      settledValue(listReconciliations(), "reconciliations", []),
      settledValue(listDisposals(), "disposals", []),
      settledValue(listTransactions(), "transactions", []),
      settledValue(listPullPoints(), "pulls", []),
      settledValue(getChamberUtilization(), "chambers", []),
    ]);
    return {
      samples,
      studies,
      withdrawals,
      movements,
      reconciliations,
      disposals,
      transactions,
      pulls,
      chambers,
    };
  }, []);

  const rawRows = useMemo(() => {
    if (!bundle.data) return [] as ReportRow[];
    const {
      samples,
      studies,
      withdrawals,
      movements,
      reconciliations,
      disposals,
      transactions,
      pulls,
      chambers,
    } = bundle.data;

    switch (report) {
      case "current-inventory":
        return samples.map((s) => ({
          sampleId: s.sampleId,
          studyId: s.studyId,
          product: s.productName,
          batch: s.batchNumber,
          studyType: s.studyType,
          condition: s.storageCondition,
          chamber: s.chamberName,
          location: s.locationLabel,
          total: s.totalQuantity,
          reserved: s.reservedQuantity,
          available: s.availableQuantity,
          withdrawn: s.withdrawnQuantity,
          disposed: s.disposedQuantity,
          status: s.status,
          nextPull: formatDate(s.nextPullDate),
        }));
      case "study-wise":
        return studies.map((s) => ({
          studyId: s.studyId,
          product: s.productName,
          batch: s.batchNumber,
          studyType: s.studyType,
          chamber: s.chamberName,
          total: s.totalQuantity,
          available: s.availableQuantity,
          withdrawn: s.withdrawnQuantity,
          disposed: s.disposedQuantity,
          status: s.status,
        }));
      case "product-wise": {
        const map = new Map<
          string,
          { product: string; samples: number; total: number; available: number; withdrawn: number; disposed: number }
        >();
        samples.forEach((s) => {
          const cur = map.get(s.productName) || {
            product: s.productName,
            samples: 0,
            total: 0,
            available: 0,
            withdrawn: 0,
            disposed: 0,
          };
          cur.samples += 1;
          cur.total += s.totalQuantity;
          cur.available += s.availableQuantity;
          cur.withdrawn += s.withdrawnQuantity;
          cur.disposed += s.disposedQuantity;
          map.set(s.productName, cur);
        });
        return [...map.values()].sort((a, b) => a.product.localeCompare(b.product));
      }
      case "batch-wise": {
        const map = new Map<
          string,
          { product: string; batch: string; samples: number; total: number; available: number; withdrawn: number }
        >();
        samples.forEach((s) => {
          const key = `${s.productName}|${s.batchNumber}`;
          const cur = map.get(key) || {
            product: s.productName,
            batch: s.batchNumber,
            samples: 0,
            total: 0,
            available: 0,
            withdrawn: 0,
          };
          cur.samples += 1;
          cur.total += s.totalQuantity;
          cur.available += s.availableQuantity;
          cur.withdrawn += s.withdrawnQuantity;
          map.set(key, cur);
        });
        return [...map.values()].sort((a, b) =>
          `${a.product}${a.batch}`.localeCompare(`${b.product}${b.batch}`)
        );
      }
      case "study-type-wise": {
        const map = new Map<
          string,
          { studyType: string; studies: number; total: number; available: number; withdrawn: number }
        >();
        studies.forEach((s) => {
          const cur = map.get(s.studyType) || {
            studyType: s.studyType || "—",
            studies: 0,
            total: 0,
            available: 0,
            withdrawn: 0,
          };
          cur.studies += 1;
          cur.total += s.totalQuantity;
          cur.available += s.availableQuantity;
          cur.withdrawn += s.withdrawnQuantity;
          map.set(s.studyType, cur);
        });
        return [...map.values()].sort((a, b) => a.studyType.localeCompare(b.studyType));
      }
      case "chamber-wise":
        return [...samples]
          .sort((a, b) =>
            `${a.chamberName}${a.sampleId}`.localeCompare(`${b.chamberName}${b.sampleId}`)
          )
          .map((s) => ({
            chamber: s.chamberName,
            location: s.locationLabel,
            sampleId: s.sampleId,
            product: s.productName,
            batch: s.batchNumber,
            available: s.availableQuantity,
            status: s.status,
          }));
      case "withdrawals":
        return withdrawals.map((w) => ({
          withdrawalId: w.withdrawalId,
          date: formatDate(w.withdrawalDate),
          sampleId: w.sampleId,
          product: w.productName,
          batch: w.batchNumber,
          pullPoint: w.pullPoint,
          planned: w.plannedQuantity,
          actual: w.actualQuantity,
          withdrawnBy: w.withdrawnBy,
          receivedBy: w.receivedBy,
          _date: w.withdrawalDate || "",
        }));
      case "movements":
        return movements.map((m) => ({
          movementId: m.movementId,
          date: formatDate(m.movementDate),
          sampleId: m.sampleId,
          product: m.productName,
          batch: m.batchNumber,
          fromChamber: m.fromChamberName,
          from: m.fromLocationLabel,
          toChamber: m.toChamberName,
          to: m.toLocationLabel,
          movedBy: m.movedBy,
          reason: m.reason,
          _date: m.movementDate || "",
        }));
      case "reconciliation":
        return reconciliations.map((r) => ({
          reconciliationId: r.reconciliationId,
          date: formatDate(r.reconciliationDate),
          sampleId: r.sampleId,
          product: r.productName,
          batch: r.batchNumber,
          systemQty: r.systemQuantity,
          physicalQty: r.physicalQuantity,
          variance: r.variance,
          status: r.status,
          _date: r.reconciliationDate || "",
        }));
      case "disposal":
        return disposals.map((d) => ({
          disposalId: d.disposalId,
          date: formatDate(d.disposalDate),
          sampleId: d.sampleId,
          product: d.productName,
          batch: d.batchNumber,
          quantity: d.quantity,
          reason: d.reason,
          disposedBy: d.disposedBy,
          _date: d.disposalDate || "",
        }));
      case "transactions":
        return transactions.map((t) => ({
          transactionId: t.transactionId,
          dateTime: formatDateTime(t.performedAt),
          type: t.transactionType,
          sampleId: t.sampleId,
          studyId: t.studyId,
          product: t.productName,
          batch: t.batchNumber,
          quantity: t.quantity,
          user: t.performedByName,
          reason: t.reason || "",
          _date: (t.performedAt || "").slice(0, 10),
        }));
      case "due-overdue":
        return pulls
          .map((p) => {
            const status = derivePullStatus(p.plannedDate, p.actualQuantity, p.plannedQuantity);
            const remaining = Math.max(0, p.plannedQuantity - p.actualQuantity);
            const urgency = remaining > 0 ? pullDueUrgency(p.plannedDate) : null;
            const displayStatus =
              status === "Partially Withdrawn" && urgency
                ? `${status} (${urgency})`
                : status;
            return {
              ...p,
              status,
              displayStatus,
              remaining,
              urgency,
            };
          })
          .filter((p) =>
            ["Upcoming", "Due Soon", "Due Today", "Overdue", "Partially Withdrawn"].includes(p.status)
          )
          .sort((a, b) => {
            const byUrgency =
              duePriority(a.urgency || a.status) - duePriority(b.urgency || b.status);
            if (byUrgency !== 0) return byUrgency;
            return String(a.plannedDate || "").localeCompare(String(b.plannedDate || ""));
          })
          .map((p) => ({
            dueDate: formatDate(p.plannedDate),
            sampleId: p.sampleId,
            product: p.productName,
            batch: p.batchNumber,
            studyType: p.studyType,
            pullPoint: p.pullPoint,
            planned: p.plannedQuantity,
            actual: p.actualQuantity,
            remaining: p.remaining,
            status: p.displayStatus,
            _date: p.plannedDate || "",
          }));
      case "chamber-utilization":
        return [...chambers]
          .sort((a, b) => String(a.chamberName || "").localeCompare(String(b.chamberName || "")))
          .map((c) => ({
            chamber: c.chamberName,
            condition: `${c.temperature} / ${c.relativeHumidity}`,
            capacity: c.capacity,
            used: c.usedCapacity,
            available: c.available,
            utilization: `${c.utilization}%`,
            status: c.status,
          }));
      default:
        return [];
    }
  }, [bundle.data, report]);

  const dateRangeError = from && to && from > to ? "From date cannot be after To date." : null;
  const supportsDateFilter = DATE_FILTER_REPORTS.has(report);
  const filtersActive = Boolean(search.trim() || (supportsDateFilter && (from || to)));

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (dateRangeError) return [] as ReportRow[];

    return rawRows.filter((row) => {
      if (supportsDateFilter && (from || to)) {
        const iso = String(row._date || "").slice(0, 10);
        if (!iso) return false;
        if (from && iso < from) return false;
        if (to && iso > to) return false;
      }
      if (!q) return true;
      return Object.entries(row)
        .filter(([k]) => !k.startsWith("_"))
        .some(([, v]) => String(v).toLowerCase().includes(q));
    });
  }, [rawRows, search, from, to, supportsDateFilter, dateRangeError]);

  const exportable = useMemo(() => displayRows(rows), [rows]);
  const headers = exportable[0] ? Object.keys(exportable[0]) : [];
  const selected = REPORTS.find((r) => r.key === report)!;

  function clearFilters() {
    setSearch("");
    setFrom("");
    setTo("");
  }

  function exportCsv() {
    if (!exportable.length) {
      toast.error("No rows to export.");
      return;
    }
    downloadBlob(`${report}-${Date.now()}.csv`, toCsv(exportable));
    toast.success(`CSV exported (${exportable.length} rows).`);
  }

  function exportExcel() {
    if (!exportable.length) {
      toast.error("No rows to export.");
      return;
    }
    const sheet = XLSX.utils.json_to_sheet(exportable);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Report");
    XLSX.writeFile(book, `${report}-${Date.now()}.xlsx`);
    toast.success(`Excel exported (${exportable.length} rows).`);
  }

  if (!canView) {
    return (
      <div>
        <PageHeader
          title="Reports"
          description="Inventory, withdrawal, reconciliation, and chamber utilization reports with export."
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
        title="Reports"
        description="Inventory, withdrawal, reconciliation, and chamber utilization reports with export."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="no-print"
              onClick={() => {
                void bundle.reload();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => window.print()} className="no-print">
              Print
            </Button>
            <Button
              variant="outline"
              onClick={exportCsv}
              className="no-print"
              disabled={!exportable.length}
            >
              Export CSV
            </Button>
            <Button onClick={exportExcel} className="no-print" disabled={!exportable.length}>
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
                type="button"
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
          <CardHeader
            title={selected.title}
            description={`${selected.description} · ${rows.length} row${rows.length === 1 ? "" : "s"}`}
          />
          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-4 no-print">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search report…"
            />
            {supportsDateFilter ? (
              <>
                <Input
                  label="From"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  error={dateRangeError || undefined}
                />
                <Input
                  label="To"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </>
            ) : (
              <div className="md:col-span-2 flex items-end">
                <p className="pb-2 text-xs text-slate-500">Date filter applies to event-based reports only.</p>
              </div>
            )}
            <div className="flex items-end gap-2">
              <Select
                className="flex-1"
                value={report}
                onChange={(e) => setReport(e.target.value as ReportKey)}
              >
                {REPORTS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.title}
                  </option>
                ))}
              </Select>
              <Button variant="ghost" onClick={clearFilters} disabled={!filtersActive}>
                Clear
              </Button>
            </div>
          </div>

          {bundle.loading ? <LoadingSkeleton /> : null}
          {bundle.error ? <ErrorState message={bundle.error} onRetry={bundle.reload} /> : null}

          {!bundle.loading && !bundle.error && rawRows.length === 0 ? (
            <EmptyState
              title="No data for this report"
              description="Charge samples or complete inventory activity to populate this report."
            />
          ) : null}

          {!bundle.loading && !bundle.error && rawRows.length > 0 && rows.length === 0 ? (
            <EmptyState
              title="No rows match your filters"
              description={dateRangeError || "Try clearing search or adjusting the date range."}
              action={
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : null}

          {!bundle.loading && !bundle.error && exportable.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} className="px-4 py-3">
                        {humanizeHeader(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {exportable.slice(0, PREVIEW_LIMIT).map((row, idx) => (
                    <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50/60">
                      {headers.map((h) => (
                        <td key={h} className="px-4 py-3 text-slate-700">
                          {h.toLowerCase() === "status" ? (
                            <StatusBadge status={String(row[h]).replace(/\s*\(.*\)$/, "")} />
                          ) : (
                            row[h]
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {exportable.length > PREVIEW_LIMIT ? (
                <p className="px-4 py-3 text-xs text-slate-500">
                  Showing first {PREVIEW_LIMIT} of {exportable.length} rows. Export for the full dataset.
                </p>
              ) : (
                <p className="px-4 py-3 text-xs text-slate-500">
                  Showing {exportable.length} row{exportable.length === 1 ? "" : "s"}.
                </p>
              )}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
