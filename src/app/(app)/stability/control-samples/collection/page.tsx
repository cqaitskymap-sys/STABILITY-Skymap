"use client";

import { useState } from "react";
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
import { formatDate, formatFullDate, friendlyError, todayISO } from "@/lib/utils";
import { listControlBatches, listControlProducts, listMarkets, listUnits } from "@/services/masters";
import {
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

export default function ControlSampleCollectionPage() {
  const { profile, hasPermission } = useAuth();
  const canCollect = hasPermission("control.collect") || hasPermission("control.perform");
  const canReceive = hasPermission("control.perform");
  const catalog = useAsync(async () => {
    const [products, batches, units, markets, rows] = await Promise.all([
      listControlProducts(),
      listControlBatches(),
      listUnits(),
      listMarkets(),
      listCollections(),
    ]);
    return { products, batches, units, markets, rows };
  }, []);

  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [manufacturingDate, setManufacturingDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [marketId, setMarketId] = useState("");
  const [market, setMarket] = useState("");
  const [actualQty, setActualQty] = useState("");
  const [unit, setUnit] = useState("");
  const [collectionDate, setCollectionDate] = useState(todayISO());
  const [appearance, setAppearance] = useState(true);
  const [coding, setCoding] = useState(true);
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
  const requiredQty = qtyMaster.data?.quantity ?? 0;
  const requiredUnit = qtyMaster.data?.unit || unit;
  const markets = (catalog.data?.markets || []).filter((m) => m.status === "Active" || m.id === marketId);

  function applyProduct(nextProductId: string) {
    const product = products.find((p) => p.id === nextProductId);
    const marketMatch = (catalog.data?.markets || []).find(
      (m) => m.status === "Active" && m.name.trim().toLowerCase() === (product?.market || "").trim().toLowerCase()
    );
    setProductId(nextProductId);
    setBatchId("");
    setManufacturingDate("");
    setExpiryDate("");
    if (product?.market) {
      setMarket(product.market);
      setMarketId(marketMatch?.id || "");
    }
  }

  function applyBatch(nextBatchId: string) {
    const batch = batches.find((b) => b.id === nextBatchId);
    setBatchId(nextBatchId);
    setManufacturingDate(batch?.manufacturingDate || "");
    setExpiryDate(batch?.expiryDate || "");
  }

  function applyMarket(name: string) {
    const match = (catalog.data?.markets || []).find((m) => m.name === name);
    setMarket(name);
    setMarketId(match?.id || "");
  }

  function loadDraft(id: string) {
    const row = (catalog.data?.rows || []).find((r) => r.id === id);
    if (!row || row.status !== "Draft") return;
    setEditingId(row.id);
    setProductId(row.productId);
    setBatchId(row.batchId);
    setManufacturingDate(row.manufacturingDate || "");
    setExpiryDate(row.expiryDate || "");
    setMarketId(row.marketId || "");
    setMarket(row.market || "");
    setActualQty(String(row.actualQuantity));
    setUnit(row.unit);
    setCollectionDate(row.date || todayISO());
    setAppearance(row.physicalAppearanceCheck);
    setCoding(row.codingDetailsCheck);
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
    if (!manufacturingDate) {
      toast.error("Manufacturing date is required.");
      return;
    }
    if (!expiryDate) {
      toast.error("Expiry date is required.");
      return;
    }
    if (manufacturingDate > expiryDate) {
      toast.error("Manufacturing date must be on or before expiry date.");
      return;
    }
    if (!market.trim()) {
      toast.error("Market is required.");
      return;
    }
    if (!collectionDate) {
      toast.error("Collection date is required.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateCollectionDraft(editingId, {
          date: collectionDate,
          productId: selectedProduct.id,
          productName: selectedProduct.productName,
          batchId: selectedBatch.id,
          batchNumber: selectedBatch.batchNumber,
          batchSize: selectedBatch.batchSize,
          manufacturingDate,
          expiryDate,
          marketId: marketId || undefined,
          market: market.trim(),
          requiredQuantity: requiredQty,
          actualQuantity: qty,
          unit: unit || requiredUnit || "UNIT",
          collectionStage: "Initial",
          physicalAppearanceCheck: appearance,
          codingDetailsCheck: coding,
          batchKind: "Standard",
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
        date: collectionDate,
        productId: selectedProduct.id,
        productName: selectedProduct.productName,
        batchId: selectedBatch.id,
        batchNumber: selectedBatch.batchNumber,
        batchSize: selectedBatch.batchSize,
        manufacturingDate,
        expiryDate,
        marketId: marketId || undefined,
        market: market.trim(),
        requiredQuantity: requiredQty,
        actualQuantity: qty,
        unit: unit || requiredUnit || "UNIT",
        collectionStage: "Initial",
        collectedBy: profile.displayName || profile.email,
        physicalAppearanceCheck: appearance,
        codingDetailsCheck: coding,
        batchKind: "Standard",
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
        description="IPQA collects required quantity product-wise per Annexure-I. Product and batch come from the Control Sample masters, not from stability inventory."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void catalog.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>
            <Button href="/stability/control-samples/daily-collection" variant="outline">Daily Collection Record</Button>
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
              <Select label="Product" required value={productId} onChange={(e) => applyProduct(e.target.value)} disabled={!canCollect}>
                <option value="">Select product</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}
              </Select>
              {!products.length ? (
                <p className="text-xs text-slate-500">
                  No control sample products yet. Add them in{" "}
                  <Link href="/stability/control-samples/products" className="font-medium underline">Control Samples → Products</Link>
                  . They are not shared with stability inventory.
                </p>
              ) : null}
              <Select label="Batch" required value={batchId} onChange={(e) => applyBatch(e.target.value)} disabled={!canCollect || !productId}>
                <option value="">{productId ? "Select batch" : "Select a product first"}</option>
                {batches.map((b) => <option key={b.id} value={b.id}>{b.batchNumber}</option>)}
              </Select>
              {productId && !batches.length ? (
                <p className="text-xs text-slate-500">
                  No control sample batches for this product.{" "}
                  <Link href="/stability/control-samples/batches" className="font-medium underline">Add a batch</Link>
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-3">
                <Input label="Mfg. Date" type="date" required value={manufacturingDate} onChange={(e) => setManufacturingDate(e.target.value)} disabled={!canCollect} />
                <Input label="Expiry Date" type="date" required monthBound="end" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} disabled={!canCollect} />
                <Select
                  label="Market"
                  required
                  value={market}
                  onChange={(e) => applyMarket(e.target.value)}
                  disabled={!canCollect}
                  hint={!markets.length ? "Add markets in Admin → Markets." : undefined}
                >
                  <option value="">Select market</option>
                  {markets.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                  {market && !markets.some((m) => m.name === market) ? <option value={market}>{market}</option> : null}
                </Select>
              </div>
              {!markets.length ? (
                <p className="text-xs text-slate-500">
                  No markets yet. Add them in{" "}
                  <Link href="/masters/markets" className="font-medium underline">Masters → Markets</Link>
                  .
                </p>
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
                <Input label="Collection date" type="date" fullDate required value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} disabled={!canCollect} />
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={appearance} onChange={(e) => setAppearance(e.target.checked)} disabled={!canCollect} /> Physical appearance checked</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={coding} onChange={(e) => setCoding(e.target.checked)} disabled={!canCollect} /> Coding details checked</label>
              <Textarea label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} disabled={!canCollect} />
              {canCollect ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void save(false)} loading={saving}>{editingId ? "Save draft" : "Save draft"}</Button>
                  <Button onClick={() => void save(true)} loading={saving}>{editingId ? "Finalize draft" : "Record collected"}</Button>
                  {editingId ? <Button variant="ghost" onClick={() => { setEditingId(""); setActualQty(""); setRemarks(""); setCollectionDate(todayISO()); }}>Cancel edit</Button> : null}
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
                { key: "date", header: "Collection Date" },
                { key: "product", header: "Product" },
                { key: "batch", header: "Batch" },
                { key: "mfg", header: "Mfg" },
                { key: "exp", header: "Expiry" },
                { key: "market", header: "Market" },
                { key: "qty", header: "Qty" },
                { key: "status", header: "Status" },
                { key: "actions", header: "Action" },
              ]}
              rows={rows.map((r) => ({
                id: r.id,
                collectionId: r.collectionId,
                date: formatFullDate(r.date),
                product: r.productName,
                batch: r.batchNumber,
                mfg: formatDate(r.manufacturingDate),
                exp: formatDate(r.expiryDate),
                market: r.market || "—",
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
