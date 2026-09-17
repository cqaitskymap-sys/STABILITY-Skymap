"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, LoadingSkeleton, PageHeader, Select, StatusBadge } from "@/components/ui";
import { PrintDocument } from "@/components/print/print-document";
import { CsTable } from "@/components/control-samples/cs-table";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, friendlyError } from "@/lib/utils";
import { createBox, createRack, listBoxes, listBoxCategories, listControlSamples, listRacks, saveBoxCategory } from "@/services/control-samples";

export default function LocationsPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("control.perform") || hasPermission("masters.manage");
  const catalog = useAsync(async () => {
    const [racks, boxes, categories, samples] = await Promise.all([listRacks(), listBoxes(), listBoxCategories(), listControlSamples()]);
    return { racks, boxes, categories, samples };
  }, []);
  const [rackNumber, setRackNumber] = useState("");
  const [partition, setPartition] = useState("");
  const [category, setCategory] = useState("");
  const [prefix, setPrefix] = useState("");
  const [pattern, setPattern] = useState("{prefix}{seq:3}");
  const [categoryId, setCategoryId] = useState("");
  const [boxRack, setBoxRack] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [printBox, setPrintBox] = useState("");

  const box = (catalog.data?.boxes || []).find((b) => b.id === printBox);
  const occupants = (catalog.data?.samples || []).filter((s) => s.boxNumber === box?.boxNumber);

  async function addRack() {
    if (!profile || !can) return;
    setSaving(true);
    try {
      await createRack({ rackNumber, partitionNumber: partition || undefined, user: profile });
      toast.success("Rack saved. Duplicate active identifiers are not allowed.");
      setRackNumber("");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    if (!profile || !can) return;
    setSaving(true);
    try {
      await saveBoxCategory({ category, prefix, numberingPattern: pattern, user: profile });
      toast.success("Box category saved.");
      setCategory("");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function addBox() {
    if (!profile || !can) return;
    setSaving(true);
    try {
      await createBox({ categoryId: categoryId || undefined, rackNumber: boxRack, user: profile });
      toast.success("Box created with sequential numbering.");
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
        title="Control Sample Location & Boxes"
        description="Annexure-VIII — Control Sample Room → Rack → Partition/Column → Box → Sample. Numbering is configurable."
        actions={<Button variant="outline" onClick={() => void catalog.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>}
      />
      {catalog.loading ? <LoadingSkeleton rows={6} /> : null}
      {catalog.error ? <ErrorState message={catalog.error} onRetry={catalog.reload} /> : null}
      {box ? (
        <PrintDocument title="Control Sample Location & Box No." documentNumber="Annexure-VIII">
          <p className="mb-3 text-sm">Rack {box.rackNumber} · Box {box.boxNumber}{box.partitionNumber ? ` · Partition ${box.partitionNumber}` : ""}</p>
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b">{["S.No.", "Product", "Batch", "Mfg", "Expiry", "Qty", "Remarks"].map((h) => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr>
            </thead>
            <tbody>
              {occupants.map((s, i) => (
                <tr key={s.id} className="border-b">
                  <td className="px-2 py-1">{i + 1}</td>
                  <td className="px-2 py-1">{s.productName}</td>
                  <td className="px-2 py-1">{s.batchNumber}</td>
                  <td className="px-2 py-1">{formatDate(s.manufacturingDate)}</td>
                  <td className="px-2 py-1">{formatDate(s.expiryDate)}</td>
                  <td className="px-2 py-1">{s.availableQuantity} {s.unit}</td>
                  <td className="px-2 py-1">{s.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </PrintDocument>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="Racks" description="Sequential rack numbers 1, 2, 3… and partitions A, B, C… as configured." />
          <div className="grid gap-3 p-4">
            <Input label="Rack number" value={rackNumber} onChange={(e) => setRackNumber(e.target.value)} disabled={!can} />
            <Input label="Partition / column" value={partition} onChange={(e) => setPartition(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void addRack()} loading={saving}>Add rack</Button> : null}
            <ul className="text-sm text-slate-600">
              {(catalog.data?.racks || []).map((r) => <li key={r.id}>{r.area} · Rack {r.rackNumber}{r.partitionNumber ? ` / ${r.partitionNumber}` : ""}</li>)}
            </ul>
          </div>
        </Card>
        <Card>
          <CardHeader title="Box categories" description="Prefixes such as Ampoule or Vial are configurable, not permanently hard-coded." />
          <div className="grid gap-3 p-4">
            <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={!can} />
            <Input label="Prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} disabled={!can} />
            <Input label="Numbering pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void addCategory()} loading={saving}>Save category</Button> : null}
            <ul className="text-sm">
              {(catalog.data?.categories || []).map((c) => <li key={c.id}>{c.category} ({c.prefix}) seq {c.currentSequence}</li>)}
            </ul>
          </div>
        </Card>
        <Card>
          <CardHeader title="Create box" />
          <div className="grid gap-3 p-4">
            <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!can}>
              <option value="">Select</option>
              {(catalog.data?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.category}</option>)}
            </Select>
            <Select label="Rack" value={boxRack} onChange={(e) => setBoxRack(e.target.value)} disabled={!can}>
              <option value="">Select</option>
              {(catalog.data?.racks || []).map((r) => <option key={r.id} value={r.rackNumber}>{r.rackNumber}</option>)}
            </Select>
            {can ? <Button onClick={() => void addBox()} loading={saving}>Create next box number</Button> : null}
          </div>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader title="Boxes" />
          <CsTable
            page={page}
            onPage={setPage}
            rowKey={(r) => String(r.id)}
            empty={<EmptyState title="No boxes" />}
            columns={[
              { key: "box", header: "Box No." },
              { key: "rack", header: "Rack" },
              { key: "cat", header: "Category" },
              { key: "status", header: "Status" },
              { key: "action", header: "Label" },
            ]}
            rows={(catalog.data?.boxes || []).map((b) => ({
              id: b.id,
              box: b.boxNumber,
              rack: `${b.rackNumber}${b.partitionNumber ? ` / ${b.partitionNumber}` : ""}`,
              cat: b.category || "—",
              status: <StatusBadge status={b.status} />,
              action: <Button size="sm" variant="outline" onClick={() => setPrintBox(b.id)}>Print label</Button>,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
