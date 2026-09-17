"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, LoadingSkeleton, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { PrintDocument } from "@/components/print/print-document";
import { CsTable } from "@/components/control-samples/cs-table";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { downloadBlob, formatDate, toCsv, todayISO } from "@/lib/utils";
import { controlOrg, isDestructionEligible } from "@/lib/control-samples";
import { applyDestructionHold, listControlSamples, listHolds, releaseDestructionHold } from "@/services/control-samples";
import { getOrganizationSettings } from "@/services/organization";
import type { ControlHoldType } from "@/types/control-samples";

const HOLD_TYPES: ControlHoldType[] = [
  "Legal enquiry pending",
  "Market complaint investigation pending",
  "Sample taken by regulatory authority",
  "Matter not cleared",
  "Other",
];

export default function DestructionDuePage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("control.perform") || hasPermission("disposal.perform");
  const catalog = useAsync(async () => {
    const [samples, holds, settings] = await Promise.all([listControlSamples(), listHolds(), getOrganizationSettings()]);
    return { samples, holds, settings };
  }, []);
  const [q, setQ] = useState("");
  const [hold, setHold] = useState("");
  const [page, setPage] = useState(1);
  const [print, setPrint] = useState(false);
  const [holdSample, setHoldSample] = useState("");
  const [holdType, setHoldType] = useState<ControlHoldType>(HOLD_TYPES[0]);
  const [reason, setReason] = useState("");
  const [refNo, setRefNo] = useState("");
  const [saving, setSaving] = useState(false);

  const cfg = controlOrg(catalog.data?.settings);
  const rows = useMemo(() => {
    return (catalog.data?.samples || []).filter((s) => {
      if (!isDestructionEligible(s, cfg) && !s.destructionHold) return false;
      const hay = `${s.productName} ${s.batchNumber} ${s.controlSampleId}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (hold === "hold" && !s.destructionHold) return false;
      if (hold === "clear" && s.destructionHold) return false;
      return true;
    });
  }, [catalog.data, cfg, q, hold]);

  async function applyHold() {
    if (!profile || !can || !holdSample) return;
    setSaving(true);
    try {
      await applyDestructionHold({ controlSampleDocId: holdSample, holdType, reason, referenceNumber: refNo || undefined, user: profile });
      toast.success("Destruction hold applied. Destruction is blocked while the hold is active.");
      setReason("");
      await catalog.reload();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function release(id: string) {
    if (!profile || !hasPermission("approve.records")) return;
    setSaving(true);
    try {
      await releaseDestructionHold(id, profile);
      toast.success("Hold released.");
      await catalog.reload();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="List of Control Samples Destruction"
        description="Annexure-IX — eligible date is expiry plus configured retention (SOP default: one year). Samples under hold cannot be destroyed."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void catalog.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>
            <Button variant="outline" onClick={() => downloadBlob(`destruction-due-${todayISO()}.csv`, toCsv(rows.map((r) => ({
              Product: r.productName, Batch: r.batchNumber, Expiry: formatDate(r.expiryDate), Eligible: formatDate(r.destructionEligibleDate), Qty: r.availableQuantity, Hold: r.destructionHold ? "Yes" : "No", Status: r.status,
            }))))}>Export CSV</Button>
            <Button onClick={() => setPrint(true)}>Print</Button>
          </div>
        }
      />
      {catalog.loading ? <LoadingSkeleton rows={6} /> : null}
      {catalog.error ? <ErrorState message={catalog.error} onRetry={catalog.reload} /> : null}
      {print ? (
        <PrintDocument title="List of Control Samples Destruction" documentNumber="Annexure-IX">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b">{["Product", "Batch", "Mfg", "Exp", "Qty", "Location", "Eligible", "Hold", "Status"].map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="px-2 py-1">{r.productName}</td>
                  <td className="px-2 py-1">{r.batchNumber}</td>
                  <td className="px-2 py-1">{formatDate(r.manufacturingDate)}</td>
                  <td className="px-2 py-1">{formatDate(r.expiryDate)}</td>
                  <td className="px-2 py-1">{r.availableQuantity}</td>
                  <td className="px-2 py-1">{[r.rackNumber, r.boxNumber].filter(Boolean).join(" / ")}</td>
                  <td className="px-2 py-1">{formatDate(r.destructionEligibleDate)}</td>
                  <td className="px-2 py-1">{r.destructionHold ? "Hold" : "Clear"}</td>
                  <td className="px-2 py-1">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintDocument>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Due list" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Input label="Search product / batch / ID" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            <Select label="Hold status" value={hold} onChange={(e) => { setHold(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="clear">Clear</option>
              <option value="hold">On hold</option>
            </Select>
          </div>
          <CsTable
            page={page}
            onPage={setPage}
            rowKey={(r) => String(r.id)}
            empty={<EmptyState title="No samples due for destruction" />}
            columns={[
              { key: "product", header: "Product" },
              { key: "batch", header: "Batch" },
              { key: "exp", header: "Expiry" },
              { key: "eligible", header: "Eligible" },
              { key: "qty", header: "Qty" },
              { key: "loc", header: "Location" },
              { key: "hold", header: "Hold" },
              { key: "status", header: "Status" },
              { key: "action", header: "Action" },
            ]}
            rows={rows.map((r) => ({
              id: r.id,
              product: r.productName,
              batch: r.batchNumber,
              exp: formatDate(r.expiryDate),
              eligible: formatDate(r.destructionEligibleDate),
              qty: `${r.availableQuantity} ${r.unit}`,
              loc: [r.rackNumber, r.boxNumber].filter(Boolean).join(" / ") || "—",
              hold: r.destructionHold ? "Hold" : "Clear",
              status: <StatusBadge status={r.destructionHold ? "Destruction Hold" : "Destruction Eligible"} />,
              action: r.destructionHold ? "—" : <Link className="text-teal-700" href="/stability/control-samples/destruction/new">Create DCN</Link>,
            }))}
          />
        </Card>
        <Card>
          <CardHeader title="Destruction hold" description="Legal enquiry, market complaint, regulatory sample, or uncleared matter." />
          <div className="grid gap-3 p-4">
            <Select label="Control sample" value={holdSample} onChange={(e) => setHoldSample(e.target.value)} disabled={!can}>
              <option value="">Select</option>
              {(catalog.data?.samples || []).filter((s) => s.status !== "Destroyed").map((s) => (
                <option key={s.id} value={s.id}>{s.controlSampleId} — {s.productName}</option>
              ))}
            </Select>
            <Select label="Hold type" value={holdType} onChange={(e) => setHoldType(e.target.value as ControlHoldType)} disabled={!can}>
              {HOLD_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
            <Input label="Reference number" value={refNo} onChange={(e) => setRefNo(e.target.value)} disabled={!can} />
            <Textarea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void applyHold()} loading={saving}>Apply hold</Button> : null}
            <ul className="space-y-2 text-sm">
              {(catalog.data?.holds || []).filter((h) => h.active).map((h) => (
                <li key={h.id} className="rounded-xl border border-slate-200 p-2">
                  <p className="font-medium">{h.controlSampleId} · {h.holdType}</p>
                  <p className="text-xs text-slate-500">{h.reason}</p>
                  {hasPermission("approve.records") ? <Button size="sm" variant="outline" className="mt-2" onClick={() => void release(h.id)}>Release</Button> : null}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
