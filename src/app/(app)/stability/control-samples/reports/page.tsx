"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, LoadingSkeleton, PageHeader, Select } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { CONTROL_SAMPLE_ANNEXURES, isDestructionEligible, isRetentionReviewDue } from "@/lib/control-samples";
import { downloadBlob, formatDate, formatFullDate, toCsv } from "@/lib/utils";
import {
  listBoxes,
  listCollections,
  listControlSamples,
  listControlTransactions,
  listDestructionLogs,
  listDestructions,
  listHolds,
  listObservations,
  listRacks,
  listRequisitions,
} from "@/services/control-samples";
import { getOrganizationSettings } from "@/services/organization";
import { controlOrg } from "@/lib/control-samples";

type ReportKey =
  | "register"
  | "daily-collection"
  | "product-wise"
  | "batch-wise"
  | "location-wise"
  | "rack-wise"
  | "box-wise"
  | "observation"
  | "withdrawal"
  | "return"
  | "destruction-due"
  | "destruction"
  | "destruction-log"
  | "transactions"
  | "holds";

const REPORTS: { key: ReportKey; title: string }[] = [
  { key: "register", title: "Control Sample Register" },
  { key: "daily-collection", title: "Daily Collection Report" },
  { key: "product-wise", title: "Product-wise Control Sample Report" },
  { key: "batch-wise", title: "Batch-wise Control Sample Report" },
  { key: "location-wise", title: "Location-wise Report" },
  { key: "rack-wise", title: "Rack-wise Report" },
  { key: "box-wise", title: "Box-wise Report" },
  { key: "observation", title: "Periodic Observation Report" },
  { key: "withdrawal", title: "Withdrawal/Requisition Report" },
  { key: "return", title: "Return Report" },
  { key: "destruction-due", title: "Destruction Due Report" },
  { key: "destruction", title: "Destruction Report" },
  { key: "destruction-log", title: "Destruction Log" },
  { key: "transactions", title: "Control Sample Transaction Report" },
  { key: "holds", title: "Control Sample Hold Report" },
];

export default function ControlSampleReportsPage() {
  const { hasPermission } = useAuth();
  const admin = hasPermission("users.manage") || hasPermission("masters.manage");
  const data = useAsync(async () => {
    const [samples, collections, observations, requisitions, destructions, logs, txs, holds, racks, boxes, settings] = await Promise.all([
      listControlSamples(),
      listCollections(),
      listObservations(),
      listRequisitions(),
      listDestructions(),
      listDestructionLogs(),
      listControlTransactions(),
      listHolds(),
      listRacks(),
      listBoxes(),
      getOrganizationSettings(),
    ]);
    return { samples, collections, observations, requisitions, destructions, logs, txs, holds, racks, boxes, settings };
  }, []);
  const [report, setReport] = useState<ReportKey>("register");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    if (!data.data) return [] as Record<string, string | number>[];
    const cfg = controlOrg(data.data.settings);
    const inRange = (date?: string) => {
      if (!date) return true;
      const d = date.slice(0, 10);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };
    const match = (text: string) => !q || text.toLowerCase().includes(q.toLowerCase());
    const result = ((): Record<string, string | number>[] => {
    switch (report) {
      case "register":
        return data.data.samples.filter((s) => match(`${s.productName} ${s.batchNumber} ${s.controlSampleId}`)).map((s) => ({
          ID: s.controlSampleId, Product: s.productName, Batch: s.batchNumber, Qty: s.availableQuantity, Unit: s.unit, Rack: s.rackNumber || "", Box: s.boxNumber || "", Status: s.status,
        }));
      case "daily-collection":
        return data.data.collections.filter((r) => inRange(r.date) && match(r.productName)).map((r) => ({
          Date: formatFullDate(r.date), Product: r.productName, Batch: r.batchNumber, Qty: r.actualQuantity, Stage: r.collectionStage, Status: r.status, CollectedBy: r.collectedBy,
        }));
      case "product-wise":
        return Object.values(data.data.samples.reduce<Record<string, { Product: string; Samples: number; Available: number }>>((acc, s) => {
          acc[s.productName] = acc[s.productName] || { Product: s.productName, Samples: 0, Available: 0 };
          acc[s.productName].Samples += 1;
          acc[s.productName].Available += s.availableQuantity || 0;
          return acc;
        }, {}));
      case "batch-wise":
        return data.data.samples.filter((s) => match(`${s.productName} ${s.batchNumber}`)).map((s) => ({
          Product: s.productName, Batch: s.batchNumber, Available: s.availableQuantity, Issued: s.issuedQuantity, Returned: s.returnedQuantity, Destroyed: s.destroyedQuantity || s.disposedQuantity, Status: s.status,
        }));
      case "location-wise":
        return data.data.samples.filter((s) => match(s.storageArea || "")).map((s) => ({
          Area: s.storageArea || "", Product: s.productName, Batch: s.batchNumber, Qty: s.availableQuantity,
        }));
      case "rack-wise":
        return data.data.samples.filter((s) => match(s.rackNumber || "")).map((s) => ({
          Rack: s.rackNumber || "", Partition: s.partitionNumber || "", Product: s.productName, Batch: s.batchNumber, Qty: s.availableQuantity,
        }));
      case "box-wise":
        return data.data.samples.filter((s) => match(s.boxNumber || "")).map((s) => ({
          Box: s.boxNumber || "", Rack: s.rackNumber || "", Product: s.productName, Batch: s.batchNumber, Qty: s.availableQuantity,
        }));
      case "observation":
        return data.data.observations.filter((o) => inRange(o.observationDate) && match(o.productName)).map((o) => ({
          ID: o.observationId, Date: formatDate(o.observationDate), Product: o.productName, Batch: o.batchNumber, Result: o.result, Status: o.status, Observer: o.observer,
        }));
      case "withdrawal":
        return data.data.requisitions.filter((r) => inRange(r.date) && match(r.productName)).map((r) => ({
          Number: r.requisitionNumber, Product: r.productName, Batch: r.batchNumber, Required: r.quantityRequired, Issued: r.quantityIssued, Status: r.status, ApprovedBy: r.approvedBy || "",
        }));
      case "return":
        return data.data.requisitions.filter((r) => r.quantityReturned > 0 && inRange(r.returnDate) && match(r.productName)).map((r) => ({
          Number: r.requisitionNumber, Product: r.productName, Returned: r.quantityReturned, ReturnedBy: r.returnedBy || "", Date: formatDate(r.returnDate),
        }));
      case "destruction-due":
        return data.data.samples.filter((s) => isDestructionEligible(s, cfg) || s.destructionHold).filter((s) => match(s.productName)).map((s) => ({
          Product: s.productName, Batch: s.batchNumber, Expiry: formatDate(s.expiryDate), Eligible: formatDate(s.destructionEligibleDate), Qty: s.availableQuantity, Hold: s.destructionHold ? "Yes" : "No",
        }));
      case "destruction":
        return data.data.destructions.filter((d) => inRange(d.date) && match(d.productName)).map((d) => ({
          DCN: d.dcnNumber, Product: d.productName, Batch: d.batchNumber, Qty: d.quantity, Status: d.status, VerifiedBy: d.verifiedBy || "",
        }));
      case "destruction-log":
        return data.data.logs.filter((d) => inRange(d.destructionDate) && match(d.productName)).map((d) => ({
          DCN: d.dcnNumber, Product: d.productName, Batch: d.batchNumber, Qty: d.quantity, Date: formatDate(d.destructionDate), Retention: isRetentionReviewDue(d.destructionDate) ? "Record Retention Review" : "Within retention",
        }));
      case "transactions":
        return data.data.txs.filter((t) => inRange(t.performedAt) && match(`${t.productName} ${t.transactionType}`)).map((t) => ({
          ID: t.transactionId, Type: t.transactionType, Product: t.productName, Batch: t.batchNumber, Qty: t.quantity, Previous: t.previousQuantity, New: t.newQuantity, User: t.performedByName, At: t.performedAt,
        }));
      case "holds":
        return data.data.holds.filter((h) => match(h.controlSampleId)).map((h) => ({
          Sample: h.controlSampleId, Type: h.holdType, Reason: h.reason, Active: h.active ? "Yes" : "No", AppliedBy: h.appliedBy, ReleasedBy: h.releasedBy || "",
        }));
      default:
        return [];
    }
    })();
    return result;
  }, [data.data, report, from, to, q]);

  function exportCsv() {
    downloadBlob(`control-sample-${report}.csv`, toCsv(rows));
  }
  function exportXlsx() {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Report");
    XLSX.writeFile(book, `control-sample-${report}.xlsx`);
  }

  return (
    <div>
      <PageHeader
        title="Control Sample Reports"
        description="Print, CSV, and Excel export for control sample records. These reports do not mix stability pull-point inventory."
        actions={<Button variant="outline" onClick={() => void data.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>}
      />
      {data.loading ? <LoadingSkeleton rows={8} /> : null}
      {data.error ? <ErrorState message={data.error} onRetry={data.reload} /> : null}
      <Card>
        <CardHeader title="Filters" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Report" value={report} onChange={(e) => setReport(e.target.value as ReportKey)}>
            {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.title}</option>)}
          </Select>
          <Input label="From" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label="To" type="date" monthBound="end" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2 px-4 pb-4 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>Print</Button>
          <Button variant="outline" onClick={exportCsv}>CSV</Button>
          <Button variant="outline" onClick={exportXlsx}>Excel</Button>
        </div>
        {!rows.length ? <EmptyState title="No rows for this report" /> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>{Object.keys(rows[0]).map((h) => <th key={h} className="px-4 py-2 text-left">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <tr key={i}>
                    {Object.keys(rows[0]).map((h) => <td key={h} className="px-4 py-2">{row[h]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {admin ? (
        <Card className="mt-6">
          <CardHeader title="SOP annexure mapping" description="Visible to Admin / Masters. Not shown as operational QA procedure text." />
          <ul className="space-y-1 p-4 text-sm text-slate-600">
            {CONTROL_SAMPLE_ANNEXURES.map((a) => (
              <li key={a.annexure}>{a.annexure} → {a.feature}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
