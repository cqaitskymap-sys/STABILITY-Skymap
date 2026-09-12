"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, LoadingSkeleton, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { CsTable } from "@/components/control-samples/cs-table";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { DEFAULT_OBSERVATION_TEMPLATES } from "@/lib/control-samples";
import { formatDate, friendlyError, todayISO } from "@/lib/utils";
import {
  listControlSamples,
  listObservationParameters,
  listObservations,
  recordObservation,
  reviewAbnormalObservation,
  saveObservationParameter,
} from "@/services/control-samples";

export default function ObservationPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("control.perform");
  const canReview = hasPermission("approve.records");
  const catalog = useAsync(async () => {
    const [samples, observations, parameters] = await Promise.all([
      listControlSamples(),
      listObservations(),
      listObservationParameters(),
    ]);
    return { samples, observations, parameters };
  }, []);

  const [sampleId, setSampleId] = useState("");
  const [productType, setProductType] = useState(DEFAULT_OBSERVATION_TEMPLATES[0].productType);
  const [result, setResult] = useState<"OK" | "Abnormal Observation">("OK");
  const [discarded, setDiscarded] = useState("0");
  const [checklist, setChecklist] = useState<Record<string, string>>({});
  const [physical, setPhysical] = useState("");
  const [pack, setPack] = useState("");
  const [leakage, setLeakage] = useState("");
  const [colour, setColour] = useState("");
  const [particles, setParticles] = useState("");
  const [seal, setSeal] = useState("");
  const [other, setOther] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [newParam, setNewParam] = useState("");
  const [reviewId, setReviewId] = useState("");
  const [reviewStatus, setReviewStatus] = useState<"QA Review" | "Investigation Required" | "Closed">("QA Review");
  const [reviewNote, setReviewNote] = useState("");
  const [invRef, setInvRef] = useState("");

  const configured = (catalog.data?.parameters || []).filter((p) => p.productType === productType && p.status === "Active");
  const template = DEFAULT_OBSERVATION_TEMPLATES.find((t) => t.productType === productType);
  const params = configured.length ? configured.map((p) => p.parameter) : (template?.parameters || []);
  const due = useMemo(
    () => (catalog.data?.samples || []).filter((s) => s.status !== "Destroyed" && s.nextObservationDate && s.nextObservationDate <= todayISO()),
    [catalog.data]
  );

  async function save() {
    if (!profile || !can || !sampleId) {
      toast.error("Select a control sample.");
      return;
    }
    setSaving(true);
    try {
      await recordObservation({
        controlSampleDocId: sampleId,
        productType,
        checklist: params.map((p) => ({ parameter: p, result: checklist[p] || "" })),
        physicalCondition: physical,
        packIntegrity: pack,
        leakage,
        colour,
        visibleParticles: particles,
        sealCondition: seal,
        otherObservation: other,
        result,
        discardedQuantity: Number(discarded) || 0,
        natureOfObservation: other,
        remarks,
        user: profile,
      });
      toast.success(result === "OK" ? "Observation recorded as OK." : "Abnormal observation recorded. It is not auto-closed.");
      setOther("");
      setRemarks("");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function addParam() {
    if (!profile || !can || !newParam.trim()) return;
    setSaving(true);
    try {
      await saveObservationParameter({ productType, parameter: newParam.trim(), user: profile });
      toast.success("Observation parameter added.");
      setNewParam("");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function review() {
    if (!profile || !canReview || !reviewId || !reviewNote.trim()) {
      toast.error("QA review remarks are required.");
      return;
    }
    setSaving(true);
    try {
      await reviewAbnormalObservation(reviewId, { status: reviewStatus, qaReview: reviewNote, investigationRef: invRef || undefined, user: profile });
      toast.success("Observation review updated.");
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
        title="Periodic Observation"
        description="Physical observation is recorded by QA. The application does not perform visual inspection, lux measurement, or panel checks."
        actions={<Button variant="outline" onClick={() => void catalog.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>}
      />
      {catalog.loading ? <LoadingSkeleton rows={8} /> : null}
      {catalog.error ? <ErrorState message={catalog.error} onRetry={catalog.reload} /> : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Record observation" />
          <div className="grid gap-3 p-4">
            <Select label="Control sample" value={sampleId} onChange={(e) => setSampleId(e.target.value)} disabled={!can}>
              <option value="">Select</option>
              {(catalog.data?.samples || []).filter((s) => s.status !== "Destroyed").map((s) => (
                <option key={s.id} value={s.id}>{s.controlSampleId} — {s.productName} / {s.batchNumber}</option>
              ))}
            </Select>
            <Select label="Product type / checklist" value={productType} onChange={(e) => setProductType(e.target.value)} disabled={!can}>
              {Array.from(new Set([...DEFAULT_OBSERVATION_TEMPLATES.map((t) => t.productType), ...(catalog.data?.parameters || []).map((p) => p.productType)])).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </Select>
            {template?.procedure ? <p className="text-xs text-slate-500">{template.procedure}</p> : null}
            {params.map((p) => (
              <Input key={p} label={p} value={checklist[p] || ""} onChange={(e) => setChecklist((c) => ({ ...c, [p]: e.target.value }))} disabled={!can} />
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Physical condition" value={physical} onChange={(e) => setPhysical(e.target.value)} disabled={!can} />
              <Input label="Pack integrity" value={pack} onChange={(e) => setPack(e.target.value)} disabled={!can} />
              <Input label="Leakage" value={leakage} onChange={(e) => setLeakage(e.target.value)} disabled={!can} />
              <Input label="Colour" value={colour} onChange={(e) => setColour(e.target.value)} disabled={!can} />
              <Input label="Visible particles" value={particles} onChange={(e) => setParticles(e.target.value)} disabled={!can} />
              <Input label="Seal condition" value={seal} onChange={(e) => setSeal(e.target.value)} disabled={!can} />
            </div>
            <Select label="Result" value={result} onChange={(e) => setResult(e.target.value as typeof result)} disabled={!can}>
              <option value="OK">OK</option>
              <option value="Abnormal Observation">Abnormal Observation</option>
            </Select>
            <Input label="Quantity discarded after verification" type="number" value={discarded} onChange={(e) => setDiscarded(e.target.value)} disabled={!can} hint="SOP: sample used for physical verification shall be discarded. Creates CONTROL_SAMPLE_VERIFICATION_DISCARDED." />
            <Textarea label={result === "Abnormal Observation" ? "Nature of observation (required)" : "Other observation"} value={other} onChange={(e) => setOther(e.target.value)} disabled={!can} />
            <Textarea label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void save()} loading={saving}>Save observation</Button> : null}
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input label="Add configurable parameter" value={newParam} onChange={(e) => setNewParam(e.target.value)} disabled={!can} />
              {can ? <Button className="self-end" variant="outline" onClick={() => void addParam()}>Add</Button> : null}
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Due now" />
          {!due.length ? <EmptyState title="No observations due" /> : (
            <ul className="space-y-2 p-4 text-sm">
              {due.map((s) => (
                <li key={s.id} className="flex justify-between gap-2">
                  <span>{s.productName} / {s.batchNumber}</span>
                  <span className="text-slate-500">Next {formatDate(s.nextObservationDate)}</span>
                </li>
              ))}
            </ul>
          )}
          <CardHeader title="QA review of abnormal observations" />
          <div className="grid gap-3 p-4">
            <Select label="Observation" value={reviewId} onChange={(e) => setReviewId(e.target.value)} disabled={!canReview}>
              <option value="">Select</option>
              {(catalog.data?.observations || []).filter((o) => o.result === "Abnormal Observation" && o.status !== "Closed").map((o) => (
                <option key={o.id} value={o.id}>{o.observationId} — {o.productName}</option>
              ))}
            </Select>
            <Select label="Next status" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value as typeof reviewStatus)} disabled={!canReview}>
              <option>QA Review</option>
              <option>Investigation Required</option>
              <option>Closed</option>
            </Select>
            <Input label="Investigation reference" value={invRef} onChange={(e) => setInvRef(e.target.value)} disabled={!canReview} />
            <Textarea label="QA review" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} disabled={!canReview} />
            {canReview ? <Button onClick={() => void review()} loading={saving}>Update review</Button> : null}
          </div>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader title="Observation history" />
          <CsTable
            page={page}
            onPage={setPage}
            rowKey={(r) => String(r.id)}
            empty={<EmptyState title="No observations recorded" />}
            columns={[
              { key: "id", header: "Observation ID" },
              { key: "sample", header: "Control Sample" },
              { key: "product", header: "Product" },
              { key: "date", header: "Date" },
              { key: "observer", header: "Observer" },
              { key: "result", header: "Result" },
              { key: "status", header: "Status" },
            ]}
            rows={(catalog.data?.observations || []).map((o) => ({
              id: o.observationId,
              sample: o.controlSampleId,
              product: `${o.productName} / ${o.batchNumber}`,
              date: formatDate(o.observationDate),
              observer: o.observer,
              result: <StatusBadge status={o.result} />,
              status: <StatusBadge status={o.status} />,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
