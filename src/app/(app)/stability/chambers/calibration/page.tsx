"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardHeader, EmptyState, Input, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { addDaysISO } from "@/lib/sop";
import { formatDate, friendlyError, todayISO } from "@/lib/utils";
import { listChambers } from "@/services/masters";
import { createCalibrationRecord, listChamberCalibration } from "@/services/chamber-ops";

export default function CalibrationPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("chamber.ops");
  const chambers = useAsync(listChambers, []);
  const rows = useAsync(listChamberCalibration, []);
  const [chamberId, setChamberId] = useState("");
  const [instrument, setInstrument] = useState("Temperature controller/indicator");
  const [instrumentId, setInstrumentId] = useState("");
  const [calibrationDate, setCalibrationDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState(addDaysISO(todayISO(), 365));
  const [vendor, setVendor] = useState("");
  const [certificateNo, setCertificateNo] = useState("");
  const [result, setResult] = useState("");
  const [saving, setSaving] = useState(false);
  const chamber = (chambers.data || []).find((c) => c.id === chamberId);

  async function save() {
    if (!profile || !can || !chamber) return toast.error("Select a chamber.");
    setSaving(true);
    try {
      await createCalibrationRecord({
        chamberId: chamber.id,
        chamberName: chamber.chamberName || chamber.chamberId,
        instrument,
        instrumentId,
        calibrationDate,
        dueDate,
        vendor,
        certificateNo,
        result,
        user: profile,
      });
      toast.success("Calibration record saved. This tracks the outside-party activity; it does not perform calibration.");
      await rows.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Calibration Record" description="SOP: temperature controller/indicator calibration is done annually by an outside party. The software tracks certificates and due dates." />
      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardHeader title="New record" />
          <div className="grid gap-3 p-4">
            <Select label="Chamber" value={chamberId} onChange={(e) => setChamberId(e.target.value)} disabled={!can}>
              <option value="">Select chamber</option>
              {(chambers.data || []).map((c) => <option key={c.id} value={c.id}>{c.chamberId}</option>)}
            </Select>
            <Input label="Instrument" value={instrument} onChange={(e) => setInstrument(e.target.value)} disabled={!can} />
            <Input label="Instrument ID" value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)} disabled={!can} />
            <Input label="Calibration date" type="date" value={calibrationDate} onChange={(e) => setCalibrationDate(e.target.value)} disabled={!can} />
            <Input label="Due date" type="date" monthBound="end" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!can} />
            <Input label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} disabled={!can} />
            <Input label="Certificate No." value={certificateNo} onChange={(e) => setCertificateNo(e.target.value)} disabled={!can} />
            <Textarea label="Result" value={result} onChange={(e) => setResult(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void save()} loading={saving}>Save record</Button> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="History" />
          {!(rows.data || []).length ? <EmptyState title="No calibration records" /> : (
            <div className="space-y-3 p-4">
              {(rows.data || []).map((r) => (
                <div key={r.id} className="flex items-start justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-semibold">{r.recordId} · {r.chamberName}</p>
                    <p className="text-sm text-slate-500">{formatDate(r.calibrationDate)} · due {formatDate(r.dueDate)} · {r.vendor || "—"}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
