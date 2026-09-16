"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { CsTable } from "@/components/control-samples/cs-table";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { COLLECTION_STAGES } from "@/lib/control-samples";
import { DEFAULT_ORG_SETTINGS } from "@/lib/sop";
import { formatDate, friendlyError, todayISO } from "@/lib/utils";
import { listBatches, listProducts, listUnits } from "@/services/masters";
import { getOrganizationSettings } from "@/services/organization";
import {
  collectionStagesForBatch,
  createCollection,
  getActiveQuantityMaster,
  listCollections,
  finalizeCollection,
  receiveCollection,
  recordVerificationException,
  submitCollection,
  updateCollectionDraft,
  verifyAndLogCollection,
} from "@/services/control-samples";
import type { CollectionStage } from "@/types/control-samples";

export default function ControlSampleCollectionPage() {
  const { profile, hasPermission } = useAuth();
  const canCollect = hasPermission("control.collect") || hasPermission("control.perform");
  const canReceive = hasPermission("control.perform");
  const catalog = useAsync(async () => {
    const [products, batches, units, rows, settings] = await Promise.all([
      listProducts(),
      listBatches(),
      listUnits(),
      listCollections(),
      getOrganizationSettings(),
    ]);
    return { products, batches, units, rows, settings };
  }, []);

  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [stage, setStage] = useState<CollectionStage>("Initial");
  const [actualQty, setActualQty] = useState("");
  const [unit, setUnit] = useState("");
  const [collectionTime, setCollectionTime] = useState("");
  const [appearance, setAppearance] = useState(true);
  const [coding, setCoding] = useState(true);
  const [batchKind, setBatchKind] = useState<"Standard" | "Mother Batch" | "Conversion Batch">("Standard");
  const [motherBatch, setMotherBatch] = useState("");
  const [conversionBatch, setConversionBatch] = useState("");
  const [brand, setBrand] = useState("");
  const [conversionNoteRef, setConversionNoteRef] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [exceptionId, setExceptionId] = useState("");
  const [discrepancy, setDiscrepancy] = useState("");
  const [exceptionRemarks, setExceptionRemarks] = useState("");
  const [editingId, setEditingId] = useState("");

  const products = (catalog.data?.products || []).filter((p) => p.status === "Active");
  const batches = (catalog.data?.batches || []).filter((b) => b.productId === productId && b.status === "Active");
  const selectedProduct = products.find((p) => p.id === productId);
  const selectedBatch = batches.find((b) => b.id === batchId);
  const qtyMaster = useAsync(async () => (productId ? getActiveQuantityMaster(productId) : null), [productId]);
  const settings = catalog.data?.settings || DEFAULT_ORG_SETTINGS;
  const requiredQty = useMemo(() => {
    if (batchKind === "Conversion Batch") {
      return qtyMaster.data?.conversionBatchQuantity ?? settings.controlConversionBatchQuantity;
    }
    return qtyMaster.data?.quantity ?? 0;
  }, [batchKind, qtyMaster.data, settings.controlConversionBatchQuantity]);
  const requiredUnit = batchKind === "Conversion Batch"
    ? (qtyMaster.data?.conversionBatchUnit || "pack")
    : (qtyMaster.data?.unit || unit);

  const stageStatus = selectedBatch ? collectionStagesForBatch(catalog.data?.rows || [], selectedBatch.id) : null;

  function loadDraft(id: string) {
    const row = (catalog.data?.rows || []).find((r) => r.id === id);
    if (!row || row.status !== "Draft") return;
    setEditingId(row.id);
    setProductId(row.productId);
    setBatchId(row.batchId);
    setStage(row.collectionStage);
    setActualQty(String(row.actualQuantity));
    setUnit(row.unit);
    setCollectionTime(row.collectionTime || "");
    setAppearance(row.physicalAppearanceCheck);
    setCoding(row.codingDetailsCheck);
    setBatchKind(row.batchKind || "Standard");
    setMotherBatch(row.motherBatch || "");
    setConversionBatch(row.conversionBatch || "");
    setBrand(row.brand || "");
    setConversionNoteRef(row.conversionNoteRef || "");
    setRemarks(row.remarks || "");
  }

  async function save(finalize: boolean) {
    if (!profile || !canCollect || !selectedProduct || !selectedBatch) {
      toast.error("Product and batch are required.");
      return;
    }
    const qty = Number(actualQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Actual quantity collected must be greater than zero.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateCollectionDraft(editingId, {
          productId: selectedProduct.id,
          productName: selectedProduct.productName,
          batchId: selectedBatch.id,
          batchNumber: selectedBatch.batchNumber,
          batchSize: selectedBatch.batchSize,
          manufacturingDate: selectedBatch.manufacturingDate,
          expiryDate: selectedBatch.expiryDate,
          requiredQuantity: requiredQty,
          actualQuantity: qty,
          unit: unit || requiredUnit || "UNIT",
          collectionStage: stage,
          collectionTime: collectionTime || undefined,
          physicalAppearanceCheck: appearance,
          codingDetailsCheck: coding,
          batchKind,
          motherBatch: motherBatch || undefined,
          conversionBatch: conversionBatch || undefined,
          brand: brand || undefined,
          conversionNoteRef: conversionNoteRef || undefined,
          remarks: remarks || undefined,
        }, profile);
        if (finalize) await finalizeCollection(editingId, profile);
        toast.success(finalize ? "Draft finalized." : "Draft updated.");
        setEditingId("");
        setActualQty("");
        setRemarks("");
        await catalog.reload();
        return;
      }
      await createCollection({
        date: todayISO(),
        productId: selectedProduct.id,
        productName: selectedProduct.productName,
        batchId: selectedBatch.id,
        batchNumber: selectedBatch.batchNumber,
        batchSize: selectedBatch.batchSize,
        manufacturingDate: selectedBatch.manufacturingDate,
        expiryDate: selectedBatch.expiryDate,
        requiredQuantity: requiredQty,
        actualQuantity: qty,
        unit: unit || requiredUnit || "UNIT",
        collectionStage: stage,
        collectionTime: collectionTime || undefined,
        collectedBy: profile.displayName || profile.email,
        physicalAppearanceCheck: appearance,
        codingDetailsCheck: coding,
        batchKind,
        motherBatch: motherBatch || undefined,
        conversionBatch: conversionBatch || undefined,
        brand: brand || undefined,
        conversionNoteRef: conversionNoteRef || undefined,
        remarks: remarks || undefined,
        user: profile,
        finalize,
      });
      toast.success(finalize ? "Collection recorded." : "Draft collection saved.");
      setActualQty("");
      setRemarks("");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function act(id: string, kind: "submit" | "receive" | "verify" | "finalize") {
    if (!profile) return;
    setSaving(true);
    try {
      if (kind === "finalize") await finalizeCollection(id, profile);
      if (kind === "submit") await submitCollection(id, profile);
      if (kind === "receive") await receiveCollection(id, profile);
      if (kind === "verify") await verifyAndLogCollection(id, profile);
      toast.success("Collection workflow updated.");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function onException() {
    if (!profile || !exceptionId) return;
    if (!discrepancy.trim()) {
      toast.error("Discrepancy is required.");
      return;
    }
    setSaving(true);
    try {
      await recordVerificationException(exceptionId, { discrepancy, remarks: exceptionRemarks, user: profile });
      toast.success("Verification exception recorded. Original collection quantity was not changed.");
      setDiscrepancy("");
      setExceptionRemarks("");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  const rows = catalog.data?.rows || [];

  return (
    <div>
      <PageHeader
        title="Control Sample Collection"
        description="IPQA collects required quantity product-wise per Annexure-I. Initial / Middle / End stages are recorded separately and are not auto-merged."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void catalog.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>
            <Link href="/stability/control-samples/daily-collection"><Button variant="outline">Daily Collection Record</Button></Link>
          </div>
        }
      />
      {catalog.loading ? <LoadingSkeleton rows={8} /> : null}
      {catalog.error ? <ErrorState message={catalog.error} onRetry={catalog.reload} /> : null}
      {!catalog.loading && !catalog.error ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title={editingId ? "Edit draft collection" : "Record collection"} />
            <div className="grid gap-3 p-4">
              <Select label="Product" required value={productId} onChange={(e) => { setProductId(e.target.value); setBatchId(""); }} disabled={!canCollect}>
                <option value="">Select product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}
              </Select>
              <Select label="Batch" required value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!canCollect}>
                <option value="">Select batch</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
              </Select>
              {stageStatus ? (
                <p className="text-xs text-slate-500">
                  Stages recorded for this batch: Initial {stageStatus.Initial ? "✓" : "—"} · Middle {stageStatus.Middle ? "✓" : "—"} · End {stageStatus.End ? "✓" : "—"}.
                  {stageStatus.complete ? " Required stages are complete." : " Batch is not marked fully represented until configured stages are completed."}
                </p>
              ) : null}
              <Select label="Collection stage" value={stage} onChange={(e) => setStage(e.target.value as CollectionStage)} disabled={!canCollect}>
                {COLLECTION_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
              <Select label="Batch kind" value={batchKind} onChange={(e) => setBatchKind(e.target.value as typeof batchKind)} disabled={!canCollect}>
                <option value="Standard">Standard</option>
                <option value="Mother Batch">Mother Batch</option>
                <option value="Conversion Batch">Conversion Batch</option>
              </Select>
              {batchKind !== "Standard" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Mother batch" value={motherBatch} onChange={(e) => setMotherBatch(e.target.value)} disabled={!canCollect} />
                  <Input label="Conversion batch" value={conversionBatch} onChange={(e) => setConversionBatch(e.target.value)} disabled={!canCollect} />
                  <Input label="Brand" value={brand} onChange={(e) => setBrand(e.target.value)} disabled={!canCollect} />
                  <Input label="Conversion note reference" value={conversionNoteRef} onChange={(e) => setConversionNoteRef(e.target.value)} disabled={!canCollect} />
                </div>
              ) : null}
              <p className="text-sm text-slate-600">
                Required quantity (Annexure-I{qtyMaster.data ? ` rev ${qtyMaster.data.revisionNumber}` : " — not configured"}): <strong>{requiredQty || "—"} {requiredUnit}</strong>
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Input label="Actual quantity collected" type="number" required value={actualQty} onChange={(e) => setActualQty(e.target.value)} disabled={!canCollect} />
                <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!canCollect}>
                  <option value="">Use master unit</option>
                  {(catalog.data?.units || []).filter((u) => u.status === "Active").map((u) => (
                    <option key={u.id} value={u.abbreviation || u.name}>{u.abbreviation || u.name}</option>
                  ))}
                </Select>
                <Input label="Collection time" type="time" value={collectionTime} onChange={(e) => setCollectionTime(e.target.value)} disabled={!canCollect} />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={appearance} onChange={(e) => setAppearance(e.target.checked)} disabled={!canCollect} /> Physical appearance checked</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={coding} onChange={(e) => setCoding(e.target.checked)} disabled={!canCollect} /> Coding details checked</label>
              <Textarea label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={!canCollect} />
              {canCollect ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void save(false)} loading={saving}>{editingId ? "Save draft" : "Save draft"}</Button>
                  <Button onClick={() => void save(true)} loading={saving}>{editingId ? "Finalize draft" : "Record collected"}</Button>
                  {editingId ? <Button variant="ghost" onClick={() => { setEditingId(""); setActualQty(""); setRemarks(""); }}>Cancel edit</Button> : null}
                </div>
              ) : null}
            </div>
          </Card>
          <Card>
            <CardHeader title="QA receipt / verification" description="Discrepancies become Verification Exception. Original collection values are not overwritten." />
            <div className="grid gap-3 p-4">
              <Select label="Received record" value={exceptionId} onChange={(e) => setExceptionId(e.target.value)} disabled={!canReceive}>
                <option value="">Select record</option>
                {rows.filter((r) => r.status === "Received" || r.status === "Verification Pending").map((r) => (
                  <option key={r.id} value={r.id}>{r.collectionId} — {r.productName} / {r.batchNumber}</option>
                ))}
              </Select>
              <Textarea label="Discrepancy" value={discrepancy} onChange={(e) => setDiscrepancy(e.target.value)} disabled={!canReceive} />
              <Textarea label="Exception remarks" value={exceptionRemarks} onChange={(e) => setExceptionRemarks(e.target.value)} disabled={!canReceive} />
              {canReceive ? <Button variant="outline" onClick={() => void onException()} loading={saving}>Record verification exception</Button> : null}
            </div>
          </Card>
          <Card className="xl:col-span-2">
            <CardHeader title="Collection records" />
            <CsTable
              page={page}
              onPage={setPage}
              rowKey={(r) => String(r.id)}
              empty={<EmptyState title="No collections" description="Collection is not a stability charging step." />}
              columns={[
                { key: "collectionId", header: "Collection ID" },
                { key: "date", header: "Date" },
                { key: "product", header: "Product" },
                { key: "batch", header: "Batch" },
                { key: "stage", header: "Stage" },
                { key: "qty", header: "Qty" },
                { key: "status", header: "Status" },
                { key: "actions", header: "Action" },
              ]}
              rows={rows.map((r) => ({
                id: r.id,
                collectionId: r.collectionId,
                date: formatDate(r.date),
                product: r.productName,
                batch: r.batchNumber,
                stage: r.collectionStage,
                qty: `${r.actualQuantity} ${r.unit}`,
                status: <StatusBadge status={r.status} />,
                actions: (
                  <div className="flex flex-wrap gap-2">
                    {r.status === "Draft" && canCollect ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => loadDraft(r.id)}>Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => void act(r.id, "finalize")}>Finalize</Button>
                      </>
                    ) : null}
                    {r.status === "Collected" && canCollect ? <Button size="sm" variant="outline" onClick={() => void act(r.id, "submit")}>Submit</Button> : null}
                    {r.status === "Submitted" && canReceive ? <Button size="sm" variant="outline" onClick={() => void act(r.id, "receive")}>Receive</Button> : null}
                    {(r.status === "Received" || r.status === "Verification Pending") && canReceive ? <Button size="sm" onClick={() => void act(r.id, "verify")}>Verify & log</Button> : null}
                  </div>
                ),
              }))}
            />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
