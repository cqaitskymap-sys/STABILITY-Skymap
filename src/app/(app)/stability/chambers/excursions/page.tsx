"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardHeader, EmptyState, Input, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime, friendlyError, nowISO } from "@/lib/utils";
import { listChambers } from "@/services/masters";
import { createExcursion, listChamberExcursions } from "@/services/chamber-ops";
import { listSamples, listStudies } from "@/services/inventory";

export default function ExcursionsPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("chamber.ops");
  const chambers = useAsync(listChambers, []);
  const samples = useAsync(listSamples, []);
  const studies = useAsync(listStudies, []);
  const rows = useAsync(listChamberExcursions, []);
  const [chamberId, setChamberId] = useState("");
  const [parameter, setParameter] = useState<"Temperature" | "Humidity" | "Both">("Temperature");
  const [durationHours, setDurationHours] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [qaAssessment, setQaAssessment] = useState("");
  const [saving, setSaving] = useState(false);
  const chamber = (chambers.data || []).find((c) => c.id === chamberId);
  const beyond48 = Number(durationHours) > 48;

  async function save() {
    if (!profile || !can || !chamber) return toast.error("Select a chamber.");
    setSaving(true);
    try {
      const affectedSamples = (samples.data || []).filter((s) => s.chamberId === chamber.id && s.status !== "Disposed");
      await createExcursion({
        chamberId: chamber.id,
        chamberName: chamber.chamberName || chamber.chamberId,
        condition: `${chamber.temperature} / ${chamber.relativeHumidity}`,
        startTime: nowISO(),
        durationHours: Number(durationHours) || 0,
        parameter,
        beyond48Hours: beyond48,
        affectedSampleIds: affectedSamples.map((s) => s.id),
        affectedStudyIds: [...new Set(affectedSamples.map((s) => s.studyDocId))],
        actionTaken,
        qaAssessment,
        status: beyond48 ? "QA Assessment" : "Open",
        user: profile,
      });
      toast.success(
        beyond48
          ? "Excursion beyond 48 hours recorded. QA assessment is required. Product impact is not decided automatically."
          : "Excursion recorded for QA evaluation."
      );
      await rows.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Chamber Excursion Management"
        description="If temperature/RH exceeds configured limits, record the event, identify affected samples, and create a QA evaluation task. The software does not decide product impact."
      />
      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Record excursion" />
          <div className="grid gap-3 p-4">
            <Select label="Chamber" value={chamberId} onChange={(e) => setChamberId(e.target.value)} disabled={!can}>
              <option value="">Select chamber</option>
              {(chambers.data || []).map((c) => (
                <option key={c.id} value={c.id}>{c.chamberId}</option>
              ))}
            </Select>
            <Select label="Parameter" value={parameter} onChange={(e) => setParameter(e.target.value as typeof parameter)} disabled={!can}>
              <option value="Temperature">Temperature</option>
              <option value="Humidity">Humidity</option>
              <option value="Both">Both</option>
            </Select>
            <Input label="Duration (hours)" type="number" value={durationHours} onChange={(e) => setDurationHours(e.target.value)} disabled={!can} />
            {beyond48 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Beyond 48 hours: identify affected samples, transfer to standby/controlled area if required, and complete QA assessment. Study period is not auto-adjusted.
              </p>
            ) : null}
            <Textarea label="Action taken" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} disabled={!can} />
            <Textarea label="QA assessment" value={qaAssessment} onChange={(e) => setQaAssessment(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void save()} loading={saving}>Create excursion</Button> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Excursion log" description={`${(studies.data || []).length} studies in inventory may be linked when a chamber is selected.`} />
          {!(rows.data || []).length ? (
            <EmptyState title="No excursions recorded" />
          ) : (
            <div className="space-y-3 p-4">
              {(rows.data || []).map((e) => (
                <div key={e.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-semibold">{e.excursionId} · {e.chamberName}</p>
                      <p className="text-sm text-slate-500">{e.parameter} · {e.durationHours || 0}h · {formatDateTime(e.startTime)}</p>
                      <p className="text-xs text-slate-500">Affected samples: {e.affectedSampleIds.length}</p>
                    </div>
                    <StatusBadge status={e.status} />
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
