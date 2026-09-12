"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardHeader, EmptyState, Input, PageHeader, Select, StatusBadge } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { addDaysISO } from "@/lib/sop";
import { formatDate, friendlyError, todayISO } from "@/lib/utils";
import { listChambers } from "@/services/masters";
import { createMappingRecord, listTemperatureMappings } from "@/services/chamber-ops";

export default function MappingPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("chamber.ops");
  const chambers = useAsync(listChambers, []);
  const rows = useAsync(listTemperatureMappings, []);
  const [chamberId, setChamberId] = useState("");
  const [mappingDate, setMappingDate] = useState(todayISO());
  const [nextDueDate, setNextDueDate] = useState(addDaysISO(todayISO(), 365));
  const [protocolNumber, setProtocolNumber] = useState("");
  const [reportNumber, setReportNumber] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [vendor, setVendor] = useState("");
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);
  const chamber = (chambers.data || []).find((c) => c.id === chamberId);
  const today = todayISO();
  const dueSoon = (rows.data || []).filter((r) => r.nextDueDate >= today && r.nextDueDate <= addDaysISO(today, 30)).length;
  const overdue = (rows.data || []).filter((r) => r.nextDueDate < today).length;

  async function save() {
    if (!profile || !can || !chamber) return toast.error("Select a chamber.");
    setSaving(true);
    try {
      await createMappingRecord({
        chamberId: chamber.id,
        chamberName: chamber.chamberName || chamber.chamberId,
        mappingDate,
        nextDueDate,
        protocolNumber,
        reportNumber,
        performedBy,
        vendor,
        result,
        approvalStatus: "Draft",
        user: profile,
      });
      toast.success("Mapping activity tracked. Mapping is not performed by this application.");
      await rows.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Temperature Mapping Schedule" description="SOP: QA performs temperature mapping annually. This module tracks protocol/report numbers and due dates only." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Card className="p-4"><p className="text-xs text-slate-500">Mapping due soon</p><p className="text-2xl font-semibold">{dueSoon}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Mapping overdue</p><p className="text-2xl font-semibold text-rose-700">{overdue}</p></Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardHeader title="New mapping record" />
          <div className="grid gap-3 p-4">
            <Select label="Chamber" value={chamberId} onChange={(e) => setChamberId(e.target.value)} disabled={!can}>
              <option value="">Select chamber</option>
              {(chambers.data || []).map((c) => <option key={c.id} value={c.id}>{c.chamberId}</option>)}
            </Select>
            <Input label="Mapping date" type="date" value={mappingDate} onChange={(e) => setMappingDate(e.target.value)} disabled={!can} />
            <Input label="Next due date" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} disabled={!can} />
            <Input label="Protocol number" value={protocolNumber} onChange={(e) => setProtocolNumber(e.target.value)} disabled={!can} />
            <Input label="Report number" value={reportNumber} onChange={(e) => setReportNumber(e.target.value)} disabled={!can} />
            <Input label="Performed by" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} disabled={!can} />
            <Input label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} disabled={!can} />
            <Input label="Result" value={result} onChange={(e) => setResult(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void save()} loading={saving}>Save record</Button> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="History" />
          {!(rows.data || []).length ? <EmptyState title="No mapping records" /> : (
            <div className="space-y-3 p-4">
              {(rows.data || []).map((r) => (
                <div key={r.id} className="flex items-start justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-semibold">{r.recordId} · {r.chamberName}</p>
                    <p className="text-sm text-slate-500">{formatDate(r.mappingDate)} · next {formatDate(r.nextDueDate)}</p>
                  </div>
                  <StatusBadge status={r.approvalStatus} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
