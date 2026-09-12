"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, LoadingSkeleton, PageHeader, Select } from "@/components/ui";
import { CsTable } from "@/components/control-samples/cs-table";
import { useAsync } from "@/hooks/useAsync";
import { downloadBlob, formatDateTime, toCsv, todayISO } from "@/lib/utils";
import { listControlTransactions } from "@/services/control-samples";

export default function ControlTransactionsPage() {
  const rows = useAsync(listControlTransactions, []);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    return (rows.data || []).filter((r) => {
      const hay = `${r.controlSampleId} ${r.productName} ${r.batchNumber} ${r.transactionId}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (type && r.transactionType !== type) return false;
      return true;
    });
  }, [rows.data, q, type]);

  const types = Array.from(new Set((rows.data || []).map((r) => r.transactionType)));

  return (
    <div>
      <PageHeader
        title="Control Sample Transactions"
        description="Append-only ledger for control samples. These records are not mixed with stability inventory transactions and cannot be edited from this screen."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void rows.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>
            <Button variant="outline" onClick={() => downloadBlob(`control-transactions-${todayISO()}.csv`, toCsv(filtered as unknown as Record<string, unknown>[]))}>Export CSV</Button>
          </div>
        }
      />
      {rows.loading ? <LoadingSkeleton rows={8} /> : null}
      {rows.error ? <ErrorState message={rows.error} onRetry={rows.reload} /> : null}
      <Card>
        <CardHeader title="Ledger" />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Input label="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          <Select label="Type" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
            <option value="">All</option>
            {types.map((t) => <option key={t}>{t}</option>)}
          </Select>
        </div>
        <CsTable
          page={page}
          onPage={setPage}
          rowKey={(r) => String(r.id)}
          empty={<EmptyState title="No control sample transactions" />}
          columns={[
            { key: "id", header: "Transaction ID" },
            { key: "when", header: "Date/Time" },
            { key: "user", header: "User" },
            { key: "type", header: "Action" },
            { key: "product", header: "Product" },
            { key: "batch", header: "Batch" },
            { key: "qty", header: "Qty" },
            { key: "prev", header: "Previous" },
            { key: "next", header: "New" },
            { key: "ref", header: "Reference" },
          ]}
          rows={filtered.map((r) => ({
            id: r.transactionId,
            when: formatDateTime(r.performedAt),
            user: r.performedByName,
            type: r.transactionType.replaceAll("CONTROL_SAMPLE_", ""),
            product: r.productName,
            batch: r.batchNumber,
            qty: r.quantity,
            prev: r.previousQuantity,
            next: r.newQuantity,
            ref: r.reference || "—",
          }))}
        />
      </Card>
    </div>
  );
}
