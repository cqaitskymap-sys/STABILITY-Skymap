"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, LoadingSkeleton, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { PrintDocument, PrintFieldGrid } from "@/components/print/print-document";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { DEFAULT_DESTRUCTION_STEPS } from "@/lib/control-samples";
import { formatDate, friendlyError } from "@/lib/utils";
import {
  approveDestruction,
  completeDestructionChecklist,
  createDestructionNote,
  listControlSamples,
  listDestructions,
  verifyDestruction,
} from "@/services/control-samples";

export default function DestructionNotePage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("control.perform") || hasPermission("disposal.perform");
  const canApprove = hasPermission("approve.records");
  const catalog = useAsync(async () => {
    const [samples, notes] = await Promise.all([listControlSamples(), listDestructions()]);
    return { samples, notes };
  }, []);
  const [sampleId, setSampleId] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState("");
  const [saving, setSaving] = useState(false);
  const [printId, setPrintId] = useState("");
  const [checkId, setCheckId] = useState("");
  const [checks, setChecks] = useState(DEFAULT_DESTRUCTION_STEPS.map((step) => ({ step, completed: false, remarks: "" })));

  const printRow = (catalog.data?.notes || []).find((n) => n.id === printId);
  const selected = (catalog.data?.samples || []).find((s) => s.id === sampleId);

  async function create() {
    if (!profile || !can || !sampleId) return;
    setSaving(true);
    try {
      await createDestructionNote({
        controlSampleDocId: sampleId,
        quantity: Number(qty),
        reason,
        modeOfDestruction: mode || undefined,
        user: profile,
      });
      toast.success("Destruction note created with DCN/MM/YY/serial numbering. QA Head check is still required.");
      setQty("");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function approve(id: string) {
    if (!profile || !canApprove) return;
    setSaving(true);
    try {
      await approveDestruction(id, profile);
      toast.success("Destruction note checked by QA Head.");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function perform() {
    if (!profile || !can || !checkId) return;
    setSaving(true);
    try {
      await completeDestructionChecklist(checkId, checks.map((c) => ({
        step: c.step,
        completed: c.completed,
        completedBy: c.completed ? (profile.displayName || profile.email) : undefined,
        completedAt: c.completed ? new Date().toISOString() : undefined,
        remarks: c.remarks || undefined,
      })), profile);
      toast.success("Destruction activity recorded. Status remains pending verification.");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function verify(id: string) {
    if (!profile || !can) return;
    setSaving(true);
    try {
      await verifyDestruction(id, profile);
      toast.success("Destruction verified. Sample marked Destroyed and log book updated.");
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
        title="Destruction of Control Sample"
        description="Annexure-VI — DCN numbering is DCN/MM/YY/001. The application records checklist completion; it does not perform physical destruction."
        actions={<Button variant="outline" onClick={() => void catalog.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>}
      />
      {catalog.loading ? <LoadingSkeleton rows={6} /> : null}
      {catalog.error ? <ErrorState message={catalog.error} onRetry={catalog.reload} /> : null}
      {printRow ? (
        <div className="space-y-6">
          <PrintDocument title="Destruction of Control Sample" documentNumber={printRow.dcnNumber}>
            <PrintFieldGrid rows={[
              { label: "DCN Number", value: printRow.dcnNumber },
              { label: "Date", value: formatDate(printRow.date) },
              { label: "Product / Material", value: printRow.productName },
              { label: "Batch No.", value: printRow.batchNumber },
              { label: "Quantity", value: printRow.quantity },
              { label: "Reason for Destruction", value: printRow.reason },
              { label: "Mode of Destruction", value: printRow.modeOfDestruction },
              { label: "Initiated By QA", value: printRow.initiatedBy },
              { label: "Checked By QA Head", value: printRow.checkedBy },
              { label: "Verified By QA", value: printRow.verifiedBy },
            ]} />
          </PrintDocument>
          {printRow.status === "Destroyed" ? (
            <PrintDocument title="Destruction Verification Report" documentNumber={printRow.dcnNumber}>
              <PrintFieldGrid rows={[
                { label: "Material Destructed On", value: formatDate(printRow.destroyedOn) },
                { label: "Material Destructed By QA", value: printRow.destroyedBy },
                { label: "Verified By QA", value: printRow.verifiedBy },
                { label: "Date", value: formatDate(printRow.destroyedOn) },
                { label: "Remarks", value: printRow.remarks },
              ]} />
            </PrintDocument>
          ) : null}
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Create destruction note" />
          <div className="grid gap-3 p-4">
            <Select label="Control sample" value={sampleId} onChange={(e) => setSampleId(e.target.value)} disabled={!can}>
              <option value="">Select</option>
              {(catalog.data?.samples || []).filter((s) => (s.availableQuantity || 0) > 0).map((s) => (
                <option key={s.id} value={s.id}>{s.controlSampleId} — {s.productName} / {s.batchNumber}</option>
              ))}
            </Select>
            {selected?.destructionHold ? <p className="text-sm text-rose-600">This sample is on destruction hold.</p> : null}
            <Input label="Quantity" type="number" value={qty} onChange={(e) => setQty(e.target.value)} disabled={!can} />
            <Textarea label="Reason for destruction" value={reason} onChange={(e) => setReason(e.target.value)} disabled={!can} />
            <Input label="Mode of destruction" value={mode} onChange={(e) => setMode(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void create()} loading={saving}>Create DCN</Button> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Destruction checklist" />
          <div className="grid gap-3 p-4">
            <Select label="Approved note" value={checkId} onChange={(e) => setCheckId(e.target.value)} disabled={!can}>
              <option value="">Select</option>
              {(catalog.data?.notes || []).filter((n) => n.status === "Approved").map((n) => (
                <option key={n.id} value={n.id}>{n.dcnNumber}</option>
              ))}
            </Select>
            {checks.map((c, i) => (
              <label key={c.step} className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1" checked={c.completed} onChange={(e) => setChecks((rows) => rows.map((r, idx) => idx === i ? { ...r, completed: e.target.checked } : r))} disabled={!can} />
                <span>{c.step}</span>
              </label>
            ))}
            {can ? <Button onClick={() => void perform()} loading={saving}>Record destruction activity</Button> : null}
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Destruction notes" />
          {!(catalog.data?.notes || []).length ? <EmptyState title="No destruction notes" /> : (
            <div className="space-y-3 p-4">
              {(catalog.data?.notes || []).map((n) => (
                <div key={n.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{n.dcnNumber} · {n.productName} / {n.batchNumber}</p>
                      <p className="text-sm text-slate-500">{n.quantity} · {n.reason}</p>
                    </div>
                    <StatusBadge status={n.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {n.status === "QA Initiated" && canApprove ? <Button size="sm" onClick={() => void approve(n.id)}>QA Head check</Button> : null}
                    {n.status === "Destroyed Pending Verification" && can ? <Button size="sm" onClick={() => void verify(n.id)}>Verify destruction</Button> : null}
                    <Button size="sm" variant="outline" onClick={() => setPrintId(n.id)}>Print</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
