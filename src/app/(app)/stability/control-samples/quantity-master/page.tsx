"use client";

import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button, Card, CardHeader, EmptyState, ErrorState, Input, LoadingSkeleton, PageHeader, Select, StatusBadge } from "@/components/ui";
import { CsTable } from "@/components/control-samples/cs-table";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, friendlyError, todayISO } from "@/lib/utils";
import { listProducts, listUnits } from "@/services/masters";
import { createQuantityMasterRevision, listQuantityMasters } from "@/services/control-samples";

export default function QuantityMasterPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("control.perform") || hasPermission("masters.manage");
  const catalog = useAsync(async () => {
    const [products, units, rows] = await Promise.all([listProducts(), listUnits(), listQuantityMasters()]);
    return { products, units, rows };
  }, []);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(todayISO());
  const [preparedBy, setPreparedBy] = useState("");
  const [checkedBy, setCheckedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [conversionQty, setConversionQty] = useState("");
  const [conversionUnit, setConversionUnit] = useState("pack");
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const product = (catalog.data?.products || []).find((p) => p.id === productId);

  async function save() {
    if (!profile || !can || !product) {
      toast.error("Product is required.");
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Control sample quantity must be greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await createQuantityMasterRevision({
        productId: product.id,
        productName: product.productName,
        quantity: qty,
        unit: unit || "UNIT",
        effectiveDate,
        preparedBy: preparedBy || undefined,
        checkedBy: checkedBy || undefined,
        approvedBy: approvedBy || undefined,
        conversionBatchQuantity: conversionQty ? Number(conversionQty) : undefined,
        conversionBatchUnit: conversionUnit || undefined,
        user: profile,
      });
      toast.success("New Annexure-I revision created. Previous revision was retained as Inactive.");
      setQuantity("");
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
        title="Control Sample Quantity Master"
        description="Annexure-I — product-wise required quantity. Revisions are history-preserving; old requirements are never overwritten."
        actions={<Button variant="outline" onClick={() => void catalog.reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>}
      />
      {catalog.loading ? <LoadingSkeleton rows={6} /> : null}
      {catalog.error ? <ErrorState message={catalog.error} onRetry={catalog.reload} /> : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="New revision" />
          <div className="grid gap-3 p-4">
            <Select label="Product" required value={productId} onChange={(e) => setProductId(e.target.value)} disabled={!can}>
              <option value="">Select product</option>
              {(catalog.data?.products || []).filter((p) => p.status === "Active").map((p) => (
                <option key={p.id} value={p.id}>{p.productName}</option>
              ))}
            </Select>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Control sample quantity" type="number" required value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={!can} />
              <Select label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)} disabled={!can}>
                <option value="">Select unit</option>
                {(catalog.data?.units || []).filter((u) => u.status === "Active").map((u) => (
                  <option key={u.id} value={u.abbreviation || u.name}>{u.abbreviation || u.name}</option>
                ))}
              </Select>
            </div>
            <Input label="Effective date" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} disabled={!can} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Conversion batch quantity" type="number" value={conversionQty} onChange={(e) => setConversionQty(e.target.value)} disabled={!can} hint="SOP example is 1 shrink pack or 1 pack — keep this configurable." />
              <Input label="Conversion batch unit" value={conversionUnit} onChange={(e) => setConversionUnit(e.target.value)} disabled={!can} />
            </div>
            <Input label="Prepared by" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} disabled={!can} />
            <Input label="Checked by" value={checkedBy} onChange={(e) => setCheckedBy(e.target.value)} disabled={!can} />
            <Input label="Approved by" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} disabled={!can} />
            {can ? <Button onClick={() => void save()} loading={saving}>Create revision</Button> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Revision history" />
          <CsTable
            page={page}
            onPage={setPage}
            rowKey={(r) => String(r.id)}
            empty={<EmptyState title="No quantity masters" description="Do not hard-code product quantities." />}
            columns={[
              { key: "product", header: "Product" },
              { key: "rev", header: "Rev" },
              { key: "qty", header: "Quantity" },
              { key: "effective", header: "Effective" },
              { key: "status", header: "Status" },
            ]}
            rows={rows.map((r) => ({
              id: r.id,
              product: r.productName,
              rev: String(r.revisionNumber).padStart(2, "0"),
              qty: `${r.quantity} ${r.unit}`,
              effective: formatDate(r.effectiveDate),
              status: <StatusBadge status={r.status} />,
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
