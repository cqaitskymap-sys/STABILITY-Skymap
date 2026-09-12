"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardHeader, EmptyState, Input, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, friendlyError, todayISO } from "@/lib/utils";
import { listChambers } from "@/services/masters";
import { createMaintenanceRecord, listChamberMaintenance } from "@/services/chamber-ops";

export default function MaintenancePage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("chamber.ops");
  const chambers = useAsync(listChambers, []);
  const rows = useAsync(listChamberMaintenance, []);
  const [chamberId, setChamberId] = useState("");
  const [maintenanceType, setMaintenanceType] = useState("Preventive");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [engineer, setEngineer] = useState("");
  const [vendor, setVendor] = useState("");
  const [observation, setObservation] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const chamber = (chambers.data || []).find((c) => c.id === chamberId);

  async function save() {
    if (!profile || !can || !chamber) return toast.error("Select a chamber.");
    setSaving(true);
    try {
      await createMaintenanceRecord({
        chamberId: chamber.id,
        chamberName: chamber.chamberName || chamber.chamberId,
        maintenanceType,
        date,
        description,
        engineer,
        vendor,
        observation,
        correctiveAction,
        status: "Completed",
        nextDueDate,
        user: profile,
      });
      toast.success("Maintenance record saved.");
      await rows.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Chamber Maintenance" description="Includes condenser cleaning / 2-month engineering follow-up as a tracked activity, not an automated completion." />
      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardHeader title="New record" />
          <div className="grid gap-3 p-4">
            <Select label="Chamber" value={chamberId} onChange={(e) => setChamberId(e.target.value)} disabled={!can}>
              <option value="">Select chamber</option>
              {(chambers.data || []).map((c) => <option key={c.id} value={c.id}>{c.chamberId}</option>)}
            </Select>
            <Select label="Type" value={maintenanceType} onChange={(e) => setMaintenanceType(e.target.value)} disabled={!can}>
              <option>Preventive</option>
              <option>Corrective</option>
              <option>Condenser cleaning</option>
              <option>Breakdown</option>
            </Select>
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!can} />
            <Input label="Engineer" value={engineer} onChange={(e) => setEngineer(e.target.value)} disabled={!can} />
            <Input label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} disabled={!can} />
            <Textarea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!can} />
            <Textarea label="Observation" value={observation} onChange={(e) => setObservation(e.target.value)} disabled={!can} />
            <Textarea label="Corrective action" value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} disabled={!can} />
            <Input label="Next due date" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void save()} loading={saving}>Save record</Button> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="History" />
          {!(rows.data || []).length ? <EmptyState title="No maintenance records" /> : (
            <div className="space-y-3 p-4">
              {(rows.data || []).map((r) => (
                <div key={r.id} className="flex items-start justify-between rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-semibold">{r.recordId} · {r.chamberName}</p>
                    <p className="text-sm text-slate-500">{formatDate(r.date)} · {r.maintenanceType}</p>
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
