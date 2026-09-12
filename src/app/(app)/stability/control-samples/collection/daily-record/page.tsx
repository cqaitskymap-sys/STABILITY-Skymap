"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, LoadingSkeleton, PageHeader, StatusBadge } from "@/components/ui";
import { PrintDocument } from "@/components/print/print-document";
import { CsTable } from "@/components/control-samples/cs-table";
import { useAsync } from "@/hooks/useAsync";
import { downloadBlob, formatDate, formatDateTime, toCsv, todayISO } from "@/lib/utils";
import { listCollections } from "@/services/control-samples";
import { listAuditLogsForRecord } from "@/services/audit";

export default function DailyCollectionRecordPage() {
  const rows = useAsync(listCollections, []);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [product, setProduct] = useState("");
  const [page, setPage] = useState(1);
  const [print, setPrint] = useState(false);
  const [auditId, setAuditId] = useState("");
  const audit = useAsync(async () => (auditId ? listAuditLogsForRecord("controlSample", auditId) : []), [auditId]);

  const filtered = useMemo(() => {
    return (rows.data || []).filter((r) => {
      if (r.status === "Draft") return false;
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (product && !r.productName.toLowerCase().includes(product.toLowerCase()) && !r.batchNumber.toLowerCase().includes(product.toLowerCase())) return false;
      return true;
    });
  }, [rows.data, dateFrom, dateTo, product]);

  function exportCsv() {
    downloadBlob(`daily-collection-record-${todayISO()}.csv`, toCsv(filtered.map((r, i) => ({
      "Serial Number": i + 1,
      Date: r.date,
      "Product Name": r.productName,
      "Batch Number": r.batchNumber,
      "Batch Size": r.batchSize || "",
      "Quantity Collected": r.actualQuantity,
      Unit: r.unit,
      "Collected By": r.collectedBy,
      "Collection Stage": r.collectionStage,
      "Submission Status": r.status,
      "Received By": r.receivedBy || "",
      "Received Date": r.receivedAt || "",
      Remarks: r.remarks || "",
    }))));
  }

  return (
    <div>
      <PageHeader
        title="Daily Collection Record"
        description="Annexure-II — Daily Collection Record of Control Sample and Stability Sample (control sample portion). Finalized records are preserved."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void rows.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>
            <Link href="/stability/control-samples/collection"><Button variant="outline">Add record</Button></Link>
            <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
            <Button onClick={() => setPrint(true)}>Print</Button>
          </div>
        }
      />
      {rows.loading ? <LoadingSkeleton rows={6} /> : null}
      {rows.error ? <ErrorState message={rows.error} onRetry={rows.reload} /> : null}
      {print ? (
        <PrintDocument title="Daily Collection Record of Control Sample" documentNumber="Annexure-II">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b">
                {["S.No.", "Date", "Product", "Batch", "Batch Size", "Qty", "Collected By", "Stage", "Status", "Received By", "Remarks"].map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id} className="border-b">
                  <td className="px-2 py-1">{i + 1}</td>
                  <td className="px-2 py-1">{formatDate(r.date)}</td>
                  <td className="px-2 py-1">{r.productName}</td>
                  <td className="px-2 py-1">{r.batchNumber}</td>
                  <td className="px-2 py-1">{r.batchSize}</td>
                  <td className="px-2 py-1">{r.actualQuantity} {r.unit}</td>
                  <td className="px-2 py-1">{r.collectedBy}</td>
                  <td className="px-2 py-1">{r.collectionStage}</td>
                  <td className="px-2 py-1">{r.status}</td>
                  <td className="px-2 py-1">{r.receivedBy}</td>
                  <td className="px-2 py-1">{r.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintDocument>
      ) : null}
      <Card>
        <CardHeader title="Filters" />
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <Input label="From date" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
          <Input label="To date" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
          <Input label="Product / batch" value={product} onChange={(e) => { setProduct(e.target.value); setPage(1); }} />
        </div>
        <CsTable
          page={page}
          onPage={setPage}
          rowKey={(r) => String(r.id)}
          empty={<EmptyState title="No finalized collection records" />}
          columns={[
            { key: "sn", header: "S.No." },
            { key: "date", header: "Date" },
            { key: "product", header: "Product Name" },
            { key: "batch", header: "Batch Number" },
            { key: "size", header: "Batch Size" },
            { key: "qty", header: "Quantity Collected" },
            { key: "by", header: "Collected By" },
            { key: "stage", header: "Collection Stage" },
            { key: "status", header: "Submission Status" },
            { key: "received", header: "Received By" },
            { key: "remarks", header: "Remarks" },
            { key: "audit", header: "Audit" },
          ]}
          rows={filtered.map((r, i) => ({
            id: r.id,
            sn: i + 1,
            date: formatDate(r.date),
            product: r.productName,
            batch: r.batchNumber,
            size: r.batchSize || "—",
            qty: `${r.actualQuantity} ${r.unit}`,
            by: r.collectedBy,
            stage: r.collectionStage,
            status: <StatusBadge status={r.status} />,
            received: r.receivedBy || "—",
            remarks: r.remarks || "—",
            audit: <Button size="sm" variant="outline" onClick={() => setAuditId(r.collectionId)}>History</Button>,
          }))}
        />
      </Card>
      {auditId ? (
        <Card className="mt-6">
          <CardHeader title={`Audit history — ${auditId}`} action={<Button size="sm" variant="ghost" onClick={() => setAuditId("")}>Close</Button>} />
          {audit.loading ? <LoadingSkeleton rows={3} /> : null}
          {!(audit.data || []).length && !audit.loading ? <EmptyState title="No audit entries for this collection ID" /> : (
            <ul className="space-y-2 p-4 text-sm">
              {(audit.data || []).map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-100 px-3 py-2">
                  <span className="font-medium">{a.action}</span> · {a.userName} · {formatDateTime(a.createdAt)}
                  {a.reason ? <span className="text-slate-500"> · {a.reason}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}
