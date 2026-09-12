"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardHeader, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { PrintDocument, PrintFieldGrid } from "@/components/print/print-document";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { percentWaterLoss } from "@/lib/sop";
import { friendlyError } from "@/lib/utils";
import { listBatches, listProducts } from "@/services/masters";
import { createWaterLossStudy, listWaterLossStudies } from "@/services/documents";
import { getOrganizationSettings } from "@/services/organization";

export default function WaterLossPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("protocol.manage");
  const catalog = useAsync(async () => {
    const [products, batches, rows, org] = await Promise.all([
      listProducts(),
      listBatches(),
      listWaterLossStudies(),
      getOrganizationSettings(),
    ]);
    return { products, batches, rows, org };
  }, []);
  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [studyType, setStudyType] = useState("Accelerated");
  const [initialWeight, setInitialWeight] = useState("");
  const [observedWeight, setObservedWeight] = useState("");
  const [interval, setInterval] = useState("");
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const product = (catalog.data?.products || []).find((p) => p.id === productId);
  const batch = (catalog.data?.batches || []).find((b) => b.id === batchId);
  const init = Number(initialWeight);
  const obs = Number(observedWeight);
  const pct = init > 0 && Number.isFinite(obs) ? percentWaterLoss(init, obs) : 0;
  const limit = catalog.data?.org.waterLossLimitPercent ?? 5;

  async function save() {
    if (!profile || !can || !product || !batch) return toast.error("Product and batch are required.");
    setSaving(true);
    try {
      await createWaterLossStudy({
        productName: product.productName,
        genericName: product.genericName,
        batchNumber: batch.batchNumber,
        studyType,
        initialWeight: init,
        observedWeight: obs,
        interval,
        remark,
        user: profile,
      });
      toast.success("% water loss recorded. Pass/fail is not declared automatically — QA must evaluate against the configured limit.");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Water Loss Study" description="For semi-permeable containers. Formula: ((Initial − Observed) / Initial) × 100. SOP example limit is NMT 5% and is configurable." />
      <div className="grid gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardHeader title="New observation" />
          <div className="grid gap-3 p-4">
            <Select label="Product" value={productId} onChange={(e) => { setProductId(e.target.value); setBatchId(""); }} disabled={!can}>
              <option value="">Select product</option>
              {(catalog.data?.products || []).map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}
            </Select>
            <Select label="Batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!can}>
              <option value="">Select batch</option>
              {(catalog.data?.batches || []).filter((b) => b.productId === productId).map((b) => (
                <option key={b.id} value={b.id}>{b.batchNumber}</option>
              ))}
            </Select>
            <Select label="Study type" value={studyType} onChange={(e) => setStudyType(e.target.value)} disabled={!can}>
              <option>Accelerated</option>
              <option>Long Term</option>
              <option>Intermediate</option>
            </Select>
            <Input label="Initial weight" type="number" value={initialWeight} onChange={(e) => setInitialWeight(e.target.value)} disabled={!can} />
            <Input label="Observed weight" type="number" value={observedWeight} onChange={(e) => setObservedWeight(e.target.value)} disabled={!can} />
            <Input label="Interval" value={interval} onChange={(e) => setInterval(e.target.value)} disabled={!can} />
            <p className="text-sm text-slate-600">Calculated % water loss: <strong>{init > 0 ? pct.toFixed(3) : "—"}</strong> (configured limit {limit}%)</p>
            <Textarea label="Remark" value={remark} onChange={(e) => setRemark(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void save()} loading={saving}>Save</Button> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Records" />
          {!(catalog.data?.rows || []).length ? <EmptyState title="No water-loss studies" /> : (
            <div className="space-y-3 p-4">
              {(catalog.data?.rows || []).map((r) => (
                <PrintDocument key={r.id} title="Water Loss Study" documentNumber={r.studyRef}>
                  <PrintFieldGrid
                    rows={[
                      { label: "Product", value: r.productName },
                      { label: "Batch", value: r.batchNumber },
                      { label: "Study type", value: r.studyType },
                      { label: "Initial weight", value: r.initialWeight },
                      { label: "Observed weight", value: r.observedWeight },
                      { label: "% Water loss", value: r.percentWaterLoss },
                      { label: "Acceptance limit", value: `${r.acceptanceLimit}%` },
                      { label: "Remark", value: r.remark },
                    ]}
                  />
                </PrintDocument>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
