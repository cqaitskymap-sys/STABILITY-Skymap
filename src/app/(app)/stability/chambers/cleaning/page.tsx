"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardHeader, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, friendlyError, todayISO } from "@/lib/utils";
import { listChambers } from "@/services/masters";
import { createCleaningRecord, listChamberCleaning } from "@/services/chamber-ops";

export default function CleaningPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("chamber.ops");
  const chambers = useAsync(listChambers, []);
  const rows = useAsync(listChamberCleaning, []);
  const [chamberId, setChamberId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [cleaningAgent, setCleaningAgent] = useState("");
  const [durationFrom, setDurationFrom] = useState("");
  const [durationTo, setDurationTo] = useState("");
  const [cleanedBy, setCleanedBy] = useState(profile?.displayName || "");
  const [checkedBy, setCheckedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const chamber = (chambers.data || []).find((c) => c.id === chamberId);

  async function save() {
    if (!profile || !can || !chamber) return toast.error("Select a chamber.");
    setSaving(true);
    try {
      await createCleaningRecord({
        chamberId: chamber.id,
        chamberName: chamber.chamberName || chamber.chamberId,
        date,
        cleaningAgent,
        durationFrom,
        durationTo,
        cleanedBy,
        checkedBy,
        remarks,
        user: profile,
      });
      toast.success("Cleaning record saved. Schedule remains configurable.");
      await rows.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Chamber Cleaning Record" description="Stability management references weekly cleaning. Frequency is configurable; this screen tracks the record, it does not perform cleaning." />
      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardHeader title="New record" />
          <div className="grid gap-3 p-4">
            <Select label="Chamber" value={chamberId} onChange={(e) => setChamberId(e.target.value)} disabled={!can}>
              <option value="">Select chamber</option>
              {(chambers.data || []).map((c) => <option key={c.id} value={c.id}>{c.chamberId}</option>)}
            </Select>
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!can} />
            <Input label="Cleaning agent" value={cleaningAgent} onChange={(e) => setCleaningAgent(e.target.value)} disabled={!can} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="From" type="time" value={durationFrom} onChange={(e) => setDurationFrom(e.target.value)} disabled={!can} />
              <Input label="To" type="time" value={durationTo} onChange={(e) => setDurationTo(e.target.value)} disabled={!can} />
            </div>
            <Input label="Cleaned by" value={cleanedBy} onChange={(e) => setCleanedBy(e.target.value)} disabled={!can} />
            <Input label="Checked by" value={checkedBy} onChange={(e) => setCheckedBy(e.target.value)} disabled={!can} />
            <Textarea label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void save()} loading={saving}>Save record</Button> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="History" />
          {!(rows.data || []).length ? <EmptyState title="No cleaning records" /> : (
            <div className="space-y-3 p-4">
              {(rows.data || []).map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold">{r.recordId} · {r.chamberName}</p>
                  <p className="text-sm text-slate-500">{formatDate(r.date)} · {r.cleanedBy} · {r.cleaningAgent || "—"}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
