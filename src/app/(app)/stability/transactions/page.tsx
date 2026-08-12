"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDownUp, PackagePlus, RefreshCw, Trash2 } from "lucide-react";
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
import { downloadBlob, formatDateTime, paginate, toCsv } from "@/lib/utils";
import { listTransactions } from "@/services/inventory";
import type { TransactionType } from "@/types";

const TYPES: TransactionType[] = [
  "SAMPLE_CHARGED",
  "SAMPLE_ALLOCATED",
  "SAMPLE_WITHDRAWN",
  "SAMPLE_TRANSFERRED",
  "SAMPLE_RETURNED",
  "SAMPLE_ADJUSTED",
  "SAMPLE_DISPOSED",
];

function txDate(performedAt?: string) {
  return (performedAt || "").slice(0, 10);
}

function formatType(type: string) {
  return type.replaceAll("_", " ");
}

export default function TransactionsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission("reports.view");
  const { data, loading, error, reload } = useAsync(listTransactions, []);

  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const rows = data || [];
  const filtersActive = Boolean(search.trim() || type !== "all" || from || to);

  const stats = useMemo(() => {
    const charged = rows.filter((t) => t.transactionType === "SAMPLE_CHARGED").length;
    const withdrawn = rows.filter((t) => t.transactionType === "SAMPLE_WITHDRAWN").length;
    const transferred = rows.filter((t) => t.transactionType === "SAMPLE_TRANSFERRED").length;
    const disposed = rows.filter((t) => t.transactionType === "SAMPLE_DISPOSED").length;
    return { total: rows.length, charged, withdrawn, transferred, disposed };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const invalidRange = from && to && from > to;
    return rows.filter((tx) => {
      if (type !== "all" && tx.transactionType !== type) return false;
      const day = txDate(tx.performedAt);
      if (from && (!day || day < from)) return false;
      if (to && (!day || day > to)) return false;
      if (invalidRange) return false;
      if (!q) return true;
      return [
        tx.transactionId,
        tx.sampleId,
        tx.studyId,
        tx.productName,
        tx.batchNumber,
        tx.performedByName,
        tx.transactionType,
        formatType(tx.transactionType),
        tx.fromLocation,
        tx.toLocation,
        tx.reason,
        tx.remarks,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [rows, search, type, from, to]);

  const paged = paginate(filtered, page, 15);
  const dateRangeError = from && to && from > to ? "From date cannot be after To date." : null;

  function clearFilters() {
    setSearch("");
    setType("all");
    setFrom("");
    setTo("");
    setPage(1);
  }

  function exportCsv() {
    if (!filtered.length) {
      toast.error("Nothing to export for the current filters.");
      return;
    }
    downloadBlob(
      `inventory-transactions-${Date.now()}.csv`,
      toCsv(
        filtered.map((tx) => ({
          transactionId: tx.transactionId,
          dateTime: formatDateTime(tx.performedAt),
          sampleId: tx.sampleId,
          studyId: tx.studyId || "",
          product: tx.productName,
          batch: tx.batchNumber,
          type: tx.transactionType,
          quantity: tx.quantity,
          fromLocation: tx.fromLocation || "",
          toLocation: tx.toLocation || "",
          user: tx.performedByName,
          reason: tx.reason || "",
          remarks: tx.remarks || "",
        }))
      )
    );
    toast.success(`Exported ${filtered.length} transaction(s).`);
  }

  if (!canView) {
    return (
      <div>
        <PageHeader
          title="Inventory Transactions"
          description="Immutable history of every inventory quantity and location change."
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
        title="Inventory Transactions"
        description="Immutable history of every inventory quantity and location change."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={loading || !filtered.length}>
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void reload();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </>
        }
      />

      {!loading && !error && rows.length > 0 ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Total" value={stats.total} icon={ArrowDownUp} tone="teal" />
          <StatCard title="Charged" value={stats.charged} icon={PackagePlus} tone="emerald" />
          <StatCard title="Withdrawn" value={stats.withdrawn} icon={ArrowDownUp} tone="blue" />
          <StatCard title="Transferred" value={stats.transferred} icon={ArrowDownUp} tone="indigo" />
          <StatCard title="Disposed" value={stats.disposed} icon={Trash2} tone="rose" />
        </div>
      ) : null}

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-5">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search ID, sample, study, product, user…"
          />
          <Select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {formatType(t)}
              </option>
            ))}
          </Select>
          <Input
            label="From"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            error={dateRangeError || undefined}
          />
          <Input
            label="To"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
          <Button variant="ghost" onClick={clearFilters} disabled={!filtersActive}>
            Clear filters
          </Button>
        </div>

        {loading ? <LoadingSkeleton /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}

        {!loading && !error && rows.length === 0 ? (
          <EmptyState
            title="No inventory transactions yet"
            description="Transactions appear after charging, withdrawing, moving, adjusting, or disposing samples."
            action={
              <Link href="/stability/inventory/charging">
                <Button variant="outline">Sample Charging</Button>
              </Link>
            }
          />
        ) : null}

        {!loading && !error && rows.length > 0 && filtered.length === 0 ? (
          <EmptyState
            title="No transactions match your filters"
            description={dateRangeError || "Try clearing search, type, or date range."}
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : null}

        {!loading && !error && paged.items.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Transaction ID</th>
                    <th className="px-4 py-3">Date/Time</th>
                    <th className="px-4 py-3">Sample ID</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">From</th>
                    <th className="px-4 py-3">To</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((tx) => (
                    <tr key={tx.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-teal-800">{tx.transactionId}</td>
                      <td className="px-4 py-3">{formatDateTime(tx.performedAt)}</td>
                      <td className="px-4 py-3">
                        {tx.sampleDocId ? (
                          <Link
                            href={`/stability/inventory/${tx.sampleDocId}`}
                            className="font-medium text-teal-800 hover:underline"
                          >
                            {tx.sampleId}
                          </Link>
                        ) : (
                          tx.sampleId
                        )}
                        {tx.studyId ? (
                          <div className="text-xs text-slate-500">{tx.studyId}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{tx.productName}</td>
                      <td className="px-4 py-3">{tx.batchNumber}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={formatType(tx.transactionType)} />
                      </td>
                      <td className="px-4 py-3">{tx.quantity}</td>
                      <td className="px-4 py-3">{tx.fromLocation || "—"}</td>
                      <td className="px-4 py-3">{tx.toLocation || "—"}</td>
                      <td className="px-4 py-3">{tx.performedByName}</td>
                      <td className="px-4 py-3">
                        {tx.reason || "—"}
                        {tx.remarks ? (
                          <div className="text-xs text-slate-500">{tx.remarks}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {paged.items.map((tx) => (
                <div key={tx.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-slate-900">{tx.transactionId}</p>
                    <StatusBadge status={formatType(tx.transactionType)} />
                  </div>
                  <p className="mt-1 text-slate-600">
                    {tx.sampleDocId ? (
                      <Link
                        href={`/stability/inventory/${tx.sampleDocId}`}
                        className="font-medium text-teal-800 hover:underline"
                      >
                        {tx.sampleId}
                      </Link>
                    ) : (
                      tx.sampleId
                    )}{" "}
                    · {tx.productName} · {tx.batchNumber}
                  </p>
                  <p className="mt-1 text-slate-500">
                    Qty {tx.quantity} · {tx.performedByName}
                  </p>
                  {(tx.fromLocation || tx.toLocation) && (
                    <p className="mt-1 text-xs text-slate-500">
                      {tx.fromLocation || "—"} → {tx.toLocation || "—"}
                    </p>
                  )}
                  {tx.reason ? <p className="mt-1 text-xs text-slate-500">{tx.reason}</p> : null}
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(tx.performedAt)}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
              <p className="text-slate-500">
                Showing {paged.items.length} of {paged.total}
                {filtersActive ? " (filtered)" : ""}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={paged.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
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
