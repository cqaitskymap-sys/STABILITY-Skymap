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
  const [categoryId, setCategoryId] = useState("");
  const [boxRackId, setBoxRackId] = useState("");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [printBox, setPrintBox] = useState("");

  const box = (catalog.data?.boxes || []).find((b) => b.id === printBox);
  const occupants = (catalog.data?.samples || []).filter((s) => s.boxNumber === box?.boxNumber);

  function rackLabel(rackNumber: string, partitionNumber?: string) {
    return partitionNumber ? `Rack ${rackNumber}, shelf ${partitionNumber}` : `Rack ${rackNumber}`;
  }

  function nextBoxNumber(prefix: string, currentSequence: number) {
    return `${prefix}${String((currentSequence || 0) + 1).padStart(3, "0")}`;
  }

  async function addRack() {
    if (!profile || !can) return;
    if (!rackNumber.trim()) return toast.error("Enter a rack number, for example 1.");
    setSaving(true);
    try {
      await createRack({ rackNumber: rackNumber.trim(), partitionNumber: partition.trim() || undefined, user: profile });
      toast.success("Rack saved.");
      setRackNumber("");
      setPartition("");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function addCategory() {
    if (!profile || !can) return;
    if (!category.trim()) return toast.error("Enter a box type, for example Ampoule.");
    if (!prefix.trim()) return toast.error("Enter a short code, for example AM. Box numbers will look like AM001.");
    setSaving(true);
    try {
      await saveBoxCategory({ category: category.trim(), prefix: prefix.trim(), numberingPattern: "{prefix}{seq:3}", user: profile });
      toast.success(`Box type saved. The first box number will be ${prefix.trim()}001.`);
      setCategory("");
      setPrefix("");
      await catalog.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function addBox() {
    if (!profile || !can) return;
    const rack = (catalog.data?.racks || []).find((r) => r.id === boxRackId);
    const boxType = (catalog.data?.categories || []).find((c) => c.id === categoryId);
    if (!boxType) return toast.error("Choose a box type first. If the list is empty, save one in step 2.");
    if (!rack) return toast.error("Choose a rack first. If the list is empty, save one in step 1.");
    setSaving(true);
    try {
      const created = await createBox({
        categoryId: boxType.id,
        category: boxType.category,
        rackNumber: rack.rackNumber,
        partitionNumber: rack.partitionNumber,
        user: profile,
      });
      toast.success(`Box ${created.boxNumber} created on ${rackLabel(rack.rackNumber, rack.partitionNumber)}.`);
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
        title="Where samples are stored"
        description="Do these in order: 1) save a rack, 2) save a box type, 3) create a box. The box number is filled in for you, for example AM001."
        actions={<Button variant="outline" onClick={() => void catalog.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>}
      />
      {catalog.loading ? <LoadingSkeleton rows={6} /> : null}
      {catalog.error ? <ErrorState message={catalog.error} onRetry={catalog.reload} /> : null}
      {box ? (
        <div className="mb-6">
          <PrintDocument title="Controlled Sample Location & Box No." documentNumber="Annexure-VIII">
            <p className="mb-3 text-sm">{rackLabel(box.rackNumber, box.partitionNumber)} · Box {box.boxNumber}</p>
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
          <Button className="mt-3 print:hidden" variant="outline" onClick={() => setPrintBox("")}>Close print preview</Button>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <CardHeader title="1. Add a rack" description="A rack is the shelf location in the room. Shelf is optional, for example A or C3." />
          <div className="grid gap-3 p-4">
            <Input label="Rack number" placeholder="Example: 1" value={rackNumber} onChange={(e) => setRackNumber(e.target.value)} disabled={!can} />
            <Input label="Shelf (optional)" placeholder="Example: A" value={partition} onChange={(e) => setPartition(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void addRack()} loading={saving}>Save rack</Button> : null}
            {(catalog.data?.racks || []).length ? (
              <ul className="space-y-1 text-sm text-slate-600">
                {(catalog.data?.racks || []).map((r) => <li key={r.id}>{rackLabel(r.rackNumber, r.partitionNumber)}</li>)}
              </ul>
            ) : <p className="text-sm text-slate-500">No racks yet.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="2. Add a box type" description="The short code starts every box number. AM becomes AM001, AM002, AM003." />
          <div className="grid gap-3 p-4">
            <Input label="Box type" placeholder="Example: Ampoule" value={category} onChange={(e) => setCategory(e.target.value)} disabled={!can} />
            <Input label="Short code" placeholder="Example: AM" value={prefix} onChange={(e) => setPrefix(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void addCategory()} loading={saving}>Save box type</Button> : null}
            {(catalog.data?.categories || []).length ? (
              <ul className="space-y-1 text-sm text-slate-600">
                {(catalog.data?.categories || []).map((c) => (
                  <li key={c.id}>{c.category} — next box {nextBoxNumber(c.prefix, c.currentSequence)}</li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-500">No box types yet.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="3. Create a box" description="Pick a box type and a rack. The next number is given automatically." />
          <div className="grid gap-3 p-4">
            <Select label="Box type" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!can}>
              <option value="">Select box type</option>
              {(catalog.data?.categories || []).map((c) => <option key={c.id} value={c.id}>{c.category} ({nextBoxNumber(c.prefix, c.currentSequence)})</option>)}
            </Select>
            <Select label="Rack" value={boxRackId} onChange={(e) => setBoxRackId(e.target.value)} disabled={!can}>
              <option value="">Select rack</option>
              {(catalog.data?.racks || []).map((r) => <option key={r.id} value={r.id}>{rackLabel(r.rackNumber, r.partitionNumber)}</option>)}
            </Select>
            {can ? <Button onClick={() => void addBox()} loading={saving}>Create box</Button> : null}
          </div>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader title="Boxes already created" />
          <CsTable
            page={page}
            onPage={setPage}
            rowKey={(r) => String(r.id)}
            empty={<EmptyState title="No boxes yet" description="Save a rack and a box type, then create a box." />}
            columns={[
              { key: "box", header: "Box No." },
              { key: "rack", header: "Rack" },
              { key: "cat", header: "Box type" },
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
