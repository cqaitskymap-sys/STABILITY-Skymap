"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  PageHeader,
  Select,
  StatusBadge,
} from "@/components/ui";
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

export default function TransactionsPage() {
  const { data, loading, error, reload } = useAsync(listTransactions, []);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter((tx) => {
      if (type !== "all" && tx.transactionType !== type) return false;
      if (from && tx.performedAt.slice(0, 10) < from) return false;
      if (to && tx.performedAt.slice(0, 10) > to) return false;
      if (!q) return true;
      return [tx.transactionId, tx.sampleId, tx.productName, tx.batchNumber, tx.performedByName, tx.transactionType]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [data, search, type, from, to]);

  const paged = paginate(filtered, page, 15);

  function exportCsv() {
    downloadBlob(
      `inventory-transactions-${Date.now()}.csv`,
      toCsv(
        filtered.map((tx) => ({
          transactionId: tx.transactionId,
          dateTime: formatDateTime(tx.performedAt),
          sampleId: tx.sampleId,
          product: tx.productName,
          batch: tx.batchNumber,
          type: tx.transactionType,
          quantity: tx.quantity,
          fromLocation: tx.fromLocation || "",
          toLocation: tx.toLocation || "",
          user: tx.performedByName,
          reason: tx.reason || "",
        }))
      )
    );
  }

  return (
    <div>
      <PageHeader
        title="Inventory Transactions"
        description="Immutable history of every inventory quantity and location change."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button variant="outline" onClick={() => reload()}>
              Refresh
            </Button>
          </>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-5">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search product, batch, sample, user..."
          />
          <Select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="all">All Types</option>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setType("all");
              setFrom("");
              setTo("");
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        </div>

        {loading ? <LoadingSkeleton /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {!loading && !error && paged.items.length === 0 ? (
          <EmptyState title="No inventory transactions found." />
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
                    <tr key={tx.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-teal-800">{tx.transactionId}</td>
                      <td className="px-4 py-3">{formatDateTime(tx.performedAt)}</td>
                      <td className="px-4 py-3">{tx.sampleId}</td>
                      <td className="px-4 py-3">{tx.productName}</td>
                      <td className="px-4 py-3">{tx.batchNumber}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={tx.transactionType.replaceAll("_", " ")} />
                      </td>
                      <td className="px-4 py-3">{tx.quantity}</td>
                      <td className="px-4 py-3">{tx.fromLocation || "—"}</td>
                      <td className="px-4 py-3">{tx.toLocation || "—"}</td>
                      <td className="px-4 py-3">{tx.performedByName}</td>
                      <td className="px-4 py-3">{tx.reason || "—"}</td>
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
                    <StatusBadge status={tx.transactionType.replaceAll("_", " ")} />
                  </div>
                  <p className="mt-1 text-slate-600">
                    {tx.productName} · {tx.batchNumber}
                  </p>
                  <p className="mt-1 text-slate-500">
                    Qty {tx.quantity} · {tx.performedByName}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(tx.performedAt)}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
              <p className="text-slate-500">
                Page {paged.page} of {paged.totalPages}
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
