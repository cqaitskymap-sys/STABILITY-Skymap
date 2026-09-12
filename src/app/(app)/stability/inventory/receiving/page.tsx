"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileCheck2, PackagePlus, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  PageHeader,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { PrintDocument, PrintFieldGrid } from "@/components/print/print-document";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, friendlyError, todayISO } from "@/lib/utils";
import { listBatches, listProducts, listUnits } from "@/services/masters";
import {
  createSampleReceipt,
  listSampleReceipts,
  markCoaReceived,
  voidSampleReceipt,
} from "@/services/receipts";

export default function SampleInwardPage() {
  const { profile, hasPermission } = useAuth();
  const canReceive = hasPermission("receiving.perform") || hasPermission("charging.perform");
  const products = useAsync(listProducts, []);
  const batches = useAsync(listBatches, []);
  const units = useAsync(listUnits, []);
  const receipts = useAsync(listSampleReceipts, []);

  const [productId, setProductId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [receivedBy, setReceivedBy] = useState(profile?.displayName || "");
  const [dateReceived, setDateReceived] = useState(todayISO());
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [printId, setPrintId] = useState<string | null>(null);
  const [voidId, setVoidId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");

  const activeProducts = useMemo(
    () => (products.data || []).filter((p) => p.status === "Active"),
    [products.data]
  );
  const productBatches = useMemo(
    () => (batches.data || []).filter((b) => b.productId === productId && b.status === "Active"),
    [batches.data, productId]
  );
  const selectedBatch = productBatches.find((b) => b.id === batchId);
  const selectedProduct = activeProducts.find((p) => p.id === productId);
  const printRow = (receipts.data || []).find((r) => r.id === printId);

  async function save() {
    if (!profile || !canReceive) return;
    if (!selectedProduct || !selectedBatch) {
      toast.error("Product and batch are required.");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Quantity must be greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await createSampleReceipt({
        productId: selectedProduct.id,
        productName: selectedProduct.productName,
        batchId: selectedBatch.id,
        batchNumber: selectedBatch.batchNumber,
        manufacturingDate: selectedBatch.manufacturingDate,
        expiryDate: selectedBatch.expiryDate,
        sampleQuantity: qty,
        unit: unit || "UNIT",
        sampleReceivedBy: receivedBy || profile.displayName,
        dateReceived,
        remarks: remarks.trim() || undefined,
        user: profile,
      });
      toast.success("Stability sample inward recorded. Status: Received — Awaiting COA.");
      setQuantity("");
      setRemarks("");
      await receipts.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function onCoa(id: string) {
    if (!profile) return;
    setSaving(true);
    try {
      await markCoaReceived(id, profile);
      toast.success("COA received. Sample is ready for charging.");
      await receipts.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function onVoid() {
    if (!profile || !voidId) return;
    setSaving(true);
    try {
      await voidSampleReceipt(voidId, voidReason, profile);
      toast.success("Inward record voided.");
      setVoidId(null);
      setVoidReason("");
      await receipts.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  const loading = products.loading || batches.loading || receipts.loading;
  const error = products.error || batches.error || receipts.error;

  return (
    <div>
      <PageHeader
        title="Sample Inward / Receiving"
        description="Record stability samples received into the control sample room before charging. COA must be received before a sample can be charged."
        actions={
          <Button variant="outline" onClick={() => void receipts.reload()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {loading ? <LoadingSkeleton rows={6} /> : null}
      {error ? <ErrorState message={error} onRetry={() => void receipts.reload()} /> : null}

      {!loading && !error ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card>
            <CardHeader
              title="Stability Sample Record for Charging"
              description="IPQA / sample source → received → store in controlled area → await finished COA."
            />
            <div className="grid gap-3 p-4">
              {!canReceive ? (
                <p className="text-sm text-slate-500">You have view-only access to inward records.</p>
              ) : null}
              <Select
                label="Product"
                required
                value={productId}
                onChange={(e) => {
                  setProductId(e.target.value);
                  setBatchId("");
                }}
                disabled={!canReceive}
              >
                <option value="">Select product</option>
                {activeProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.productName}
                  </option>
                ))}
              </Select>
              <Select
                label="Batch"
                required
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                disabled={!canReceive || !productId}
              >
                <option value="">Select batch</option>
                {productBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber}
                  </option>
                ))}
              </Select>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Mfg Date" value={selectedBatch?.manufacturingDate || ""} readOnly />
                <Input label="Expiry Date" value={selectedBatch?.expiryDate || ""} readOnly />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Sample Quantity"
                  type="number"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={!canReceive}
                />
                <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!canReceive}>
                  <option value="">Select unit</option>
                  {(units.data || [])
                    .filter((u) => u.status === "Active")
                    .map((u) => (
                      <option key={u.id} value={u.abbreviation || u.name}>
                        {u.abbreviation || u.name}
                      </option>
                    ))}
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Sample Received By"
                  required
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  disabled={!canReceive}
                />
                <Input
                  label="Date Received"
                  type="date"
                  required
                  value={dateReceived}
                  onChange={(e) => setDateReceived(e.target.value)}
                  disabled={!canReceive}
                />
              </div>
              <Textarea
                label="Remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={!canReceive}
              />
              {canReceive ? (
                <Button onClick={() => void save()} loading={saving}>
                  Record inward
                </Button>
              ) : null}
            </div>
          </Card>

          <Card>
            <CardHeader title="Inward register" description="Awaiting COA → Ready for charging → Charged." />
            {!(receipts.data || []).length ? (
              <EmptyState title="No inward records yet" description="Receive samples before charging them into a chamber." />
            ) : (
              <div className="space-y-3 p-4">
                {(receipts.data || []).map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {row.receiptId} · {row.productName}
                        </p>
                        <p className="text-sm text-slate-500">
                          {row.batchNumber} · {row.sampleQuantity} {row.unit} · received {formatDate(row.dateReceived)}
                        </p>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {row.status === "Received - Awaiting COA" && canReceive ? (
                        <Button size="sm" onClick={() => void onCoa(row.id)} loading={saving}>
                          <FileCheck2 className="h-3.5 w-3.5" />
                          Mark COA received
                        </Button>
                      ) : null}
                      {row.status === "COA Received - Ready for Charging" ? (
                        <Link href={`/stability/inventory/charging?receipt=${row.id}`}>
                          <Button size="sm" variant="outline">
                            <PackagePlus className="h-3.5 w-3.5" />
                            Charge sample
                          </Button>
                        </Link>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => setPrintId(row.id)}>
                        Print
                      </Button>
                      {row.status !== "Charged" && row.status !== "Voided" && canReceive ? (
                        <Button size="sm" variant="ghost" onClick={() => setVoidId(row.id)}>
                          Void
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {printRow ? (
        <div className="mt-6">
          <PrintDocument title="Stability Sample Inward Record" documentNumber={printRow.receiptId}>
            <PrintFieldGrid
              rows={[
                { label: "Date", value: formatDate(printRow.date) },
                { label: "Product Name", value: printRow.productName },
                { label: "Batch No.", value: printRow.batchNumber },
                { label: "Mfg Date", value: formatDate(printRow.manufacturingDate) },
                { label: "Expiry Date", value: formatDate(printRow.expiryDate) },
                { label: "Sample Quantity", value: `${printRow.sampleQuantity} ${printRow.unit}` },
                { label: "Sample Received By", value: printRow.sampleReceivedBy },
                { label: "Date Received", value: formatDate(printRow.dateReceived) },
                { label: "Status", value: printRow.status },
                { label: "COA Status", value: printRow.coaStatus },
                { label: "Charging Eligibility", value: printRow.chargingEligibility ? "Yes" : "No" },
                { label: "Remarks", value: printRow.remarks },
                { label: "Created By", value: printRow.createdByName },
                { label: "Created Date", value: formatDate(printRow.createdAt) },
                { label: "Checked By", value: printRow.checkedBy },
                { label: "Checked Date", value: formatDate(printRow.checkedDate) },
              ]}
            />
          </PrintDocument>
          <Button className="mt-3 print:hidden" variant="outline" onClick={() => setPrintId(null)}>
            Close print preview
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!voidId}
        title="Void inward record?"
        description="The record will be archived as Voided. Historical inward data is retained."
        confirmLabel="Void"
        tone="danger"
        loading={saving}
        onCancel={() => setVoidId(null)}
        onConfirm={() => void onVoid()}
      />
      {voidId ? (
        <div className="mt-3 max-w-lg">
          <Textarea
            label="Void reason"
            required
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
          />
        </div>
      ) : null}
    </div>
  );
}
