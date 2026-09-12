"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, LoadingSkeleton, PageHeader } from "@/components/ui";
import { PrintDocument } from "@/components/print/print-document";
import { CsTable } from "@/components/control-samples/cs-table";
import { useAsync } from "@/hooks/useAsync";
import { isRetentionReviewDue } from "@/lib/control-samples";
import { formatDate } from "@/lib/utils";
import { listDestructionLogs } from "@/services/control-samples";

export default function DestructionLogPage() {
  const logs = useAsync(listDestructionLogs, []);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);
  const [print, setPrint] = useState(false);

  const rows = useMemo(() => {
    return (logs.data || []).filter((r) => {
      if (month && r.month !== month.padStart(2, "0") && r.month !== month) return false;
      if (year && r.year !== year) return false;
      return true;
    });
  }, [logs.data, month, year]);

  return (
    <div>
      <PageHeader
        title="Destruction Log Book of Control Sample"
        description="Annexure-VII — destruction history is retained. Records are never auto-deleted after two years; a retention review flag is shown instead."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void logs.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>
            <Button onClick={() => setPrint(true)}>Print</Button>
          </div>
        }
      />
      {logs.loading ? <LoadingSkeleton rows={6} /> : null}
      {logs.error ? <ErrorState message={logs.error} onRetry={logs.reload} /> : null}
      {print ? (
        <PrintDocument title="Destruction Log Book of Control Sample" documentNumber="Annexure-VII">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b">{["Month", "Year", "DCN", "Product", "Batch", "Qty", "Date", "Initiated", "Checked", "Verified"].map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-2 py-1">{r.month}</td>
                  <td className="px-2 py-1">{r.year}</td>
                  <td className="px-2 py-1">{r.dcnNumber}</td>
                  <td className="px-2 py-1">{r.productName}</td>
                  <td className="px-2 py-1">{r.batchNumber}</td>
                  <td className="px-2 py-1">{r.quantity}</td>
                  <td className="px-2 py-1">{formatDate(r.destructionDate)}</td>
                  <td className="px-2 py-1">{r.initiatedBy}</td>
                  <td className="px-2 py-1">{r.checkedBy}</td>
                  <td className="px-2 py-1">{r.verifiedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintDocument>
      ) : null}
      <Card>
        <CardHeader title="Monthly filter" />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Input label="Month (MM)" value={month} onChange={(e) => { setMonth(e.target.value); setPage(1); }} />
          <Input label="Year (YYYY)" value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} />
        </div>
        <CsTable
          page={page}
          onPage={setPage}
          rowKey={(r) => String(r.id)}
          empty={<EmptyState title="No destruction log entries" />}
          columns={[
            { key: "period", header: "Month / Year" },
            { key: "dcn", header: "DCN" },
            { key: "product", header: "Product" },
            { key: "batch", header: "Batch" },
            { key: "qty", header: "Qty" },
            { key: "date", header: "Destruction Date" },
            { key: "init", header: "Initiated" },
            { key: "check", header: "Checked" },
            { key: "verify", header: "Verified" },
            { key: "review", header: "Retention" },
          ]}
          rows={rows.map((r) => ({
            id: r.id,
            period: `${r.month}/${r.year}`,
            dcn: r.dcnNumber,
            product: r.productName,
            batch: r.batchNumber,
            qty: r.quantity,
            date: formatDate(r.destructionDate),
            init: r.initiatedBy || "—",
            check: r.checkedBy || "—",
            verify: r.verifiedBy || "—",
            review: isRetentionReviewDue(r.destructionDate) ? "Record Retention Review" : "Within retention",
          }))}
        />
      </Card>
    </div>
  );
}
