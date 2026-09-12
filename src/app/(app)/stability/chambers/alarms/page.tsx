"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardHeader, EmptyState, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { ALARM_TYPE_DEFAULTS } from "@/lib/sop";
import { formatDateTime, friendlyError, nowISO } from "@/lib/utils";
import { listChambers } from "@/services/masters";
import { acknowledgeAlarm, closeAlarm, createChamberAlarm, listChamberAlarms, rectifyAlarm } from "@/services/chamber-ops";

export default function ChamberAlarmsPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("chamber.ops");
  const chambers = useAsync(listChambers, []);
  const alarms = useAsync(listChamberAlarms, []);
  const [chamberId, setChamberId] = useState("");
  const [alarmType, setAlarmType] = useState(ALARM_TYPE_DEFAULTS[0]);
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const chamber = (chambers.data || []).find((c) => c.id === chamberId);

  async function create() {
    if (!profile || !can || !chamber) return toast.error("Select a chamber.");
    setSaving(true);
    try {
      await createChamberAlarm({
        chamberId: chamber.id,
        chamberName: chamber.chamberName || chamber.chamberId,
        alarmType,
        startTime: nowISO(),
        remark: remark || undefined,
        user: profile,
      });
      toast.success("Alarm recorded as Active. Acknowledge does not close it.");
      await alarms.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Chamber Alarm Management"
        description="Acknowledged is not the same as rectified. Alarms stay open until rectified and then closed."
      />
      <div className="grid gap-6 xl:grid-cols-[20rem_minmax(0,1fr)]">
        <Card>
          <CardHeader title="New alarm" />
          <div className="grid gap-3 p-4">
            <Select label="Chamber" value={chamberId} onChange={(e) => setChamberId(e.target.value)} disabled={!can}>
              <option value="">Select chamber</option>
              {(chambers.data || []).map((c) => (
                <option key={c.id} value={c.id}>{c.chamberId}</option>
              ))}
            </Select>
            <Select label="Alarm type" value={alarmType} onChange={(e) => setAlarmType(e.target.value)} disabled={!can}>
              {ALARM_TYPE_DEFAULTS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
            <Textarea label="Remark" value={remark} onChange={(e) => setRemark(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void create()} loading={saving}>Record alarm</Button> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Alarm log" />
          {!(alarms.data || []).length ? (
            <EmptyState title="No alarms" description="Hardware events can be recorded here when reported by engineering or imported later." />
          ) : (
            <div className="space-y-3 p-4">
              {(alarms.data || []).map((a) => (
                <div key={a.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{a.alarmId} · {a.alarmType}</p>
                      <p className="text-sm text-slate-500">{a.chamberName} · started {formatDateTime(a.startTime)}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  {can && a.status === "Active" ? (
                    <Button className="mt-2" size="sm" variant="outline" onClick={() => profile && acknowledgeAlarm(a.id, remark, profile).then(() => alarms.reload())}>
                      Acknowledge
                    </Button>
                  ) : null}
                  {can && a.status === "Acknowledged" ? (
                    <Button className="mt-2" size="sm" variant="outline" onClick={() => profile && rectifyAlarm(a.id, remark, profile).then(() => alarms.reload())}>
                      Rectify
                    </Button>
                  ) : null}
                  {can && a.status === "Rectified" ? (
                    <Button className="mt-2" size="sm" onClick={() => profile && closeAlarm(a.id, profile).then(() => alarms.reload())}>
                      Close
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
