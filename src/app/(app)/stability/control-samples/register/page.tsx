"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, LoadingSkeleton, PageHeader, Select, StatusBadge } from "@/components/ui";
import { PrintDocument, PrintFieldGrid } from "@/components/print/print-document";
import { CsTable } from "@/components/control-samples/cs-table";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, formatFullDate, friendlyError } from "@/lib/utils";
import { adjustControlSample, listBoxes, listControlSamples, listRacks, storeControlSample } from "@/services/control-samples";

export default function ControlSampleRegisterPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("control.perform");
  const canAdjust = hasPermission("approve.records");
  const catalog = useAsync(async () => {
    const [rows, racks, boxes] = await Promise.all([listControlSamples(), listRacks(), listBoxes()]);
    return { rows, racks, boxes };
  }, []);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [stampId, setStampId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [storageArea, setStorageArea] = useState("Control Sample Room");
  const [rackId, setRackId] = useState("");
  const [boxNumber, setBoxNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [adjustId, setAdjustId] = useState("");
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const rows = useMemo(() => {
    return (catalog.data?.rows || []).filter((r) => {
      const hay = `${r.controlSampleId} ${r.productName} ${r.productCode || ""} ${r.batchNumber} ${r.boxNumber || ""} ${r.rackNumber || ""}`.toLowerCase();
      if (q && !hay.includes(q.toLowerCase())) return false;
      if (status && r.status !== status) return false;
      return true;
    });
  }, [catalog.data, q, status]);
  const stamp = (catalog.data?.rows || []).find((r) => r.id === stampId);

  async function store() {
    if (!profile || !can || !storeId) return;
    const rack = (catalog.data?.racks || []).find((r) => r.id === rackId);
    if (!storageArea.trim() || !rack || !boxNumber.trim()) {
      toast.error("Storage area, rack, and box are required.");
      return;
    }
    setSaving(true);
    try {
      await storeControlSample({
        id: storeId,
        storageArea,
        rackNumber: rack.rackNumber,
        partitionNumber: rack.partitionNumber,
        boxNumber,
        user: profile,
      });
      toast.success("Sample stored. Location movement was recorded.");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function adjust() {
    if (!profile || !canAdjust || !adjustId) return;
    setSaving(true);
    try {
      await adjustControlSample({
        id: adjustId,
        quantityDelta: Number(adjustDelta),
        reason: adjustReason,
        user: profile,
      });
      toast.success("Approved adjustment recorded as a transaction. Quantity was not edited silently.");
      setAdjustDelta("");
      setAdjustReason("");
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
        title="Control Sample Log Book"
        description="Annexure-IV — Control Sample Log Book. Location and box are first-class fields. Records are not deleted after creation."
        actions={<Button variant="outline" onClick={() => void catalog.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>}
      />
      {catalog.loading ? <LoadingSkeleton rows={8} /> : null}
      {catalog.error ? <ErrorState message={catalog.error} onRetry={catalog.reload} /> : null}
      {stamp ? (
        <PrintDocument title="Control Sample Stamp" documentNumber="Annexure-III">
          <PrintFieldGrid rows={[
            { label: "Product", value: stamp.productName },
            { label: "Batch", value: stamp.batchNumber },
            { label: "Control Sample ID", value: stamp.controlSampleId },
            { label: "Quantity", value: `${stamp.availableQuantity} ${stamp.unit}` },
            { label: "Date", value: formatFullDate(stamp.collectionDate || stamp.createdAt) },
            { label: "Storage area", value: stamp.storageArea },
            { label: "Location", value: stamp.locationLabel },
            { label: "Box number", value: stamp.boxNumber },
          ]} />
        </PrintDocument>
      ) : null}
      <div className="grid gap-6">
        <Card>
          <CardHeader title="Assign storage" description="Original packed boxes are stored in the Control Sample Room, then may be packed into a larger box/shipper." />
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select label="Control sample" value={storeId} onChange={(e) => setStoreId(e.target.value)} disabled={!can}>
              <option value="">Select</option>
              {(catalog.data?.rows || []).filter((r) => r.status !== "Destroyed").map((r) => (
                <option key={r.id} value={r.id}>{r.controlSampleId} — {r.productName}</option>
              ))}
            </Select>
            <Input label="Storage area" value={storageArea} onChange={(e) => setStorageArea(e.target.value)} disabled={!can} />
            <Select label="Rack no." value={rackId} onChange={(e) => setRackId(e.target.value)} disabled={!can}>
              <option value="">Select rack</option>
              {(catalog.data?.racks || []).filter((r) => r.status === "Active").map((r) => (
                <option key={r.id} value={r.id}>{r.rackNumber}{r.partitionNumber ? ` / ${r.partitionNumber}` : ""}</option>
              ))}
            </Select>
            <Select label="Box no." value={boxNumber} onChange={(e) => setBoxNumber(e.target.value)} disabled={!can}>
              <option value="">Select box</option>
              {(catalog.data?.boxes || []).filter((b) => b.status === "Active").map((b) => (
                <option key={b.id} value={b.boxNumber}>{b.boxNumber}</option>
              ))}
            </Select>
          </div>
          <div className="px-4 pb-4">{can ? <Button onClick={() => void store()} loading={saving}>Store / move</Button> : null}</div>
        </Card>
        {canAdjust ? (
          <Card>
            <CardHeader title="Approved quantity adjustment" description="Available quantity cannot be typed over. An adjustment creates CONTROL_SAMPLE_ADJUSTED and cannot go negative." />
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select label="Control sample" value={adjustId} onChange={(e) => setAdjustId(e.target.value)}>
                <option value="">Select</option>
                {(catalog.data?.rows || []).filter((r) => r.status !== "Destroyed").map((r) => (
                  <option key={r.id} value={r.id}>{r.controlSampleId} ({r.availableQuantity} {r.unit})</option>
                ))}
              </Select>
              <Input label="Adjustment (+/−)" type="number" value={adjustDelta} onChange={(e) => setAdjustDelta(e.target.value)} />
              <Input label="Reason" required value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
              <div className="self-end"><Button onClick={() => void adjust()} loading={saving}>Record adjustment</Button></div>
            </div>
          </Card>
        ) : null}
        <Card>
          <CardHeader title="Register" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Input label="Search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
            <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option>
              {["Available", "Stored", "Partially Issued", "Depleted", "Destruction Eligible", "Destruction Hold", "Destroyed"].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
          <CsTable
            page={page}
            onPage={setPage}
            rowKey={(r) => String(r.id)}
            empty={<EmptyState title="No control samples in the log book" />}
            columns={[
              { key: "id", header: "Control Sample ID" },
              { key: "date", header: "Date" },
              { key: "product", header: "Product" },
              { key: "batch", header: "Batch" },
              { key: "mfg", header: "Mfg" },
              { key: "exp", header: "Expiry" },
              { key: "qty", header: "Available" },
              { key: "loc", header: "Location / Rack / Box" },
              { key: "status", header: "Status" },
              { key: "action", header: "Stamp" },
            ]}
            rows={rows.map((r) => ({
              id: r.controlSampleId,
              date: formatFullDate(r.collectionDate || r.createdAt),
              product: r.productName,
              batch: r.batchNumber,
              mfg: formatDate(r.manufacturingDate),
              exp: formatDate(r.expiryDate),
              qty: `${r.availableQuantity} ${r.unit}`,
              loc: [r.storageArea, r.rackNumber, r.partitionNumber, r.boxNumber].filter(Boolean).join(" / ") || "—",
              status: <StatusBadge status={r.status} />,
              action: <Button size="sm" variant="outline" onClick={() => setStampId(r.id)}>Print stamp</Button>,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
