"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, LoadingSkeleton, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { PrintDocument, PrintFieldGrid } from "@/components/print/print-document";
import { CsTable } from "@/components/control-samples/cs-table";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatFullDate, friendlyError } from "@/lib/utils";
import {
  approveRequisition,
  createRequisition,
  issueApprovedRequisition,
  listControlSamples,
  listRequisitions,
  returnRequisition,
} from "@/services/control-samples";

export default function WithdrawalPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("control.perform");
  const canApprove = hasPermission("approve.records");
  const catalog = useAsync(async () => {
    const [samples, rows] = await Promise.all([listControlSamples(), listRequisitions()]);
    return { samples, rows };
  }, []);
  const [sampleId, setSampleId] = useState("");
  const [dept, setDept] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [issuedTo, setIssuedTo] = useState("");
  const [issueQty, setIssueQty] = useState("");
  const [issueId, setIssueId] = useState("");
  const [returnId, setReturnId] = useState("");
  const [returnQty, setReturnQty] = useState("");
  const [returnedBy, setReturnedBy] = useState("");
  const [condition, setCondition] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [printId, setPrintId] = useState("");

  const printRow = (catalog.data?.rows || []).find((r) => r.id === printId);

  async function create() {
    if (!profile || !can || !sampleId) return;
    if (!dept.trim()) return toast.error("From department is required.");
    if (!Number.isFinite(Number(qty)) || Number(qty) <= 0) return toast.error("Quantity required must be greater than zero.");
    if (!reason.trim()) return toast.error("Reason for withdrawal is required.");
    setSaving(true);
    try {
      await createRequisition({
        fromDepartment: dept,
        controlSampleDocId: sampleId,
        quantityRequired: Number(qty),
        reason,
        user: profile,
      });
      toast.success("Requisition submitted. Issue is blocked until QA Manager approval.");
      setQty("");
      setReason("");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function decide(id: string, approved: boolean) {
    if (!profile || !canApprove) return;
    setSaving(true);
    try {
      await approveRequisition(id, profile, approved);
      toast.success(approved ? "Requisition approved." : "Requisition rejected.");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function issue() {
    if (!profile || !can || !issueId) return;
    if (!issuedTo.trim()) return toast.error("Issued to is required.");
    if (!Number.isFinite(Number(issueQty)) || Number(issueQty) <= 0) return toast.error("Issue quantity must be greater than zero.");
    setSaving(true);
    try {
      await issueApprovedRequisition(issueId, { quantity: Number(issueQty), issuedTo, user: profile });
      toast.success("CONTROL_SAMPLE_ISSUED recorded.");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function ret() {
    if (!profile || !can || !returnId) return;
    if (!returnedBy.trim()) return toast.error("Returned by is required.");
    if (!Number.isFinite(Number(returnQty)) || Number(returnQty) <= 0) return toast.error("Return quantity must be greater than zero.");
    setSaving(true);
    try {
      await returnRequisition(returnId, { quantity: Number(returnQty), returnedBy, condition, user: profile });
      toast.success("CONTROL_SAMPLE_RETURNED recorded.");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Requisition for Withdrawal of Controlled Sample"
        description="Annexure-V — QA Manager approval is required before issue. Quantity cannot exceed available stock."
        actions={<Button variant="outline" onClick={() => void catalog.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>}
      />
      {catalog.loading ? <LoadingSkeleton rows={6} /> : null}
      {catalog.error ? <ErrorState message={catalog.error} onRetry={catalog.reload} /> : null}
      {printRow ? (
        <div className="mb-6">
        <PrintDocument title="Requisition for Withdrawal of Controlled Sample" documentNumber={printRow.requisitionNumber}>
          <PrintFieldGrid rows={[
            { label: "Requisition Number", value: printRow.requisitionNumber },
            { label: "Date", value: formatFullDate(printRow.date) },
            { label: "From Department", value: printRow.fromDepartment },
            { label: "Product", value: printRow.productName },
            { label: "Batch No.", value: printRow.batchNumber },
            { label: "Quantity Required", value: printRow.quantityRequired },
            { label: "Reason", value: printRow.reason },
            { label: "Requested By", value: printRow.requestedBy },
            { label: "Approved By", value: printRow.approvedBy },
            { label: "Quantity Issued", value: printRow.quantityIssued },
            { label: "Quantity Returned", value: printRow.quantityReturned },
            { label: "Returned By", value: printRow.returnedBy },
            { label: "QA Checked By", value: printRow.returnCheckedBy },
            { label: "Remarks", value: printRow.remarks },
          ]} />
        </PrintDocument>
        <Button className="mt-3 print:hidden" variant="outline" onClick={() => setPrintId("")}>Close print preview</Button>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="New requisition" />
          <div className="grid gap-3 p-4">
            <Select label="Controlled sample" value={sampleId} onChange={(e) => setSampleId(e.target.value)} disabled={!can}>
              <option value="">Select</option>
              {(catalog.data?.samples || []).filter((s) => (s.availableQuantity || 0) > 0).map((s) => (
                <option key={s.id} value={s.id}>{s.controlSampleId} — {s.productName} ({s.availableQuantity} {s.unit})</option>
              ))}
            </Select>
            <Input label="From department" value={dept} onChange={(e) => setDept(e.target.value)} disabled={!can} />
            <Input label="Quantity required" type="number" value={qty} onChange={(e) => setQty(e.target.value)} disabled={!can} />
            <Textarea label="Reason for withdrawal/removal" value={reason} onChange={(e) => setReason(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void create()} loading={saving}>Submit requisition</Button> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Issue" />
          <div className="grid gap-3 p-4">
            <Select label="Approved requisition" value={issueId} onChange={(e) => setIssueId(e.target.value)} disabled={!can}>
              <option value="">Select</option>
              {(catalog.data?.rows || []).filter((r) => r.status === "Approved" && (r.quantityIssued || 0) < (r.quantityRequired || 0)).map((r) => (
                <option key={r.id} value={r.id}>{r.requisitionNumber} — {(r.quantityRequired || 0) - (r.quantityIssued || 0)} remaining</option>
              ))}
            </Select>
            <Input label="Issued to" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} disabled={!can} />
            <Input label="Quantity issued" type="number" value={issueQty} onChange={(e) => setIssueQty(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void issue()} loading={saving}>Issue</Button> : null}
            <Select label="Issued requisition to return" value={returnId} onChange={(e) => setReturnId(e.target.value)} disabled={!can}>
              <option value="">Select</option>
              {(catalog.data?.rows || []).filter((r) => ["Approved", "Issued", "Partially Returned"].includes(r.status) && (r.quantityIssued || 0) > (r.quantityReturned || 0)).map((r) => (
                <option key={r.id} value={r.id}>{r.requisitionNumber} — {(r.quantityIssued || 0) - (r.quantityReturned || 0)} outstanding</option>
              ))}
            </Select>
            <Input label="Returned by" value={returnedBy} onChange={(e) => setReturnedBy(e.target.value)} disabled={!can} />
            <Input label="Return quantity" type="number" value={returnQty} onChange={(e) => setReturnQty(e.target.value)} disabled={!can} />
            <Input label="Condition on return" value={condition} onChange={(e) => setCondition(e.target.value)} disabled={!can} />
            {can ? <Button variant="outline" onClick={() => void ret()} loading={saving}>Record return</Button> : null}
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Requisitions" />
          <CsTable
            page={page}
            onPage={setPage}
            rowKey={(r) => String(r.id)}
            empty={<EmptyState title="No requisitions" />}
            columns={[
              { key: "no", header: "Requisition" },
              { key: "product", header: "Product" },
              { key: "qty", header: "Required / Issued / Returned" },
              { key: "status", header: "Status" },
              { key: "actions", header: "Action" },
            ]}
            rows={(catalog.data?.rows || []).map((r) => ({
              id: r.id,
              no: r.requisitionNumber,
              product: `${r.productName} / ${r.batchNumber}`,
              qty: `${r.quantityRequired} / ${r.quantityIssued} / ${r.quantityReturned}`,
              status: <StatusBadge status={r.status} />,
              actions: (
                <div className="flex flex-wrap gap-2">
                  {r.status === "Submitted" && canApprove ? (
                    <>
                      <Button size="sm" onClick={() => void decide(r.id, true)}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => void decide(r.id, false)}>Reject</Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={() => setPrintId(r.id)}>Print</Button>
                </div>
              ),
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
