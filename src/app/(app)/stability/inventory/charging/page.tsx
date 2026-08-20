"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, PackagePlus, RefreshCw } from "lucide-react";
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
  Textarea,
} from "@/components/ui";
import {
  activePullPointsForStudy,
  emptyChargeForm,
  getMissingChargeMasters,
  resolveChargePayload,
  sumAllocations,
  validateChargeForm,
  type ChargeFormErrors,
  type ChargeFormState,
} from "@/components/stability/charge-form-logic";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { addMonthsToDate, formatDate, friendlyError, todayISO } from "@/lib/utils";
import { createStudyAndCharge } from "@/services/inventory";
import {
  listBatches,
  listChambers,
  listLocations,
  listProducts,
  listPullPoints as listPullPointMasters,
  listStorageConditions,
  listStudyTypes,
  listUnits,
} from "@/services/masters";

export default function SampleChargingPage() {
  const router = useRouter();
  const { profile, hasPermission } = useAuth();
  const canCharge = hasPermission("charging.perform") || hasPermission("studies.create");

  const masters = useAsync(async () => {
    const [products, batches, studyTypes, conditions, pullPoints, chambers, locations, units] =
      await Promise.all([
        listProducts(),
        listBatches(),
        listStudyTypes(),
        listStorageConditions(),
        listPullPointMasters(),
        listChambers(),
        listLocations(),
        listUnits(),
      ]);
    return { products, batches, studyTypes, conditions, pullPoints, chambers, locations, units };
  }, []);

  const [form, setForm] = useState<ChargeFormState>(() => emptyChargeForm(todayISO()));
  const [errors, setErrors] = useState<ChargeFormErrors>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeProducts = useMemo(
    () => (masters.data?.products || []).filter((p) => p.status === "Active"),
    [masters.data]
  );
  const productBatches = useMemo(
    () =>
      (masters.data?.batches || []).filter(
        (b) => b.productId === form.productId && b.status === "Active"
      ),
    [masters.data, form.productId]
  );
  const activeStudyTypes = useMemo(
    () => (masters.data?.studyTypes || []).filter((s) => s.status === "Active"),
    [masters.data]
  );
  const activeConditions = useMemo(
    () => (masters.data?.conditions || []).filter((c) => c.status === "Active"),
    [masters.data]
  );
  const activeUnits = useMemo(
    () => (masters.data?.units || []).filter((u) => u.status === "Active"),
    [masters.data]
  );
  const chamberLocations = useMemo(
    () =>
      (masters.data?.locations || []).filter(
        (l) => l.chamberId === form.chamberId && l.status === "Active"
      ),
    [masters.data, form.chamberId]
  );
  const selectedChamber = useMemo(
    () => (masters.data?.chambers || []).find((c) => c.id === form.chamberId) || null,
    [masters.data, form.chamberId]
  );
  const pullPoints = useMemo(
    () => activePullPointsForStudy(masters.data?.pullPoints || [], form.studyTypeId),
    [masters.data, form.studyTypeId]
  );
  const mastersReady = useMemo(
    () => (masters.data ? getMissingChargeMasters(masters.data) : null),
    [masters.data]
  );

  const totalQuantity = Number(form.totalQuantity) || 0;
  const reservedQuantity = Number(form.reservedQuantity) || 0;
  const totalRequired = sumAllocations(form.pullAllocations);
  const totalChargedNeeded = totalRequired + reservedQuantity;
  const remaining = totalQuantity - totalChargedNeeded;
  const chamberAvailable = selectedChamber
    ? Math.max(0, Number(selectedChamber.capacity || 0) - Number(selectedChamber.usedCapacity || 0))
    : null;

  function updateField<K extends keyof ChargeFormState>(key: K, value: ChargeFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, allocations: undefined, chamber: undefined }));
  }

  function onProductChange(productId: string) {
    setForm((prev) => ({
      ...prev,
      productId,
      batchId: "",
      manufacturingDate: "",
      expiryDate: "",
    }));
    setErrors((prev) => ({
      ...prev,
      productId: undefined,
      batchId: undefined,
      manufacturingDate: undefined,
      expiryDate: undefined,
    }));
  }

  function onBatchChange(batchId: string) {
    const batch = productBatches.find((b) => b.id === batchId);
    setForm((prev) => ({
      ...prev,
      batchId,
      manufacturingDate: batch?.manufacturingDate || "",
      expiryDate: batch?.expiryDate || "",
    }));
    setErrors((prev) => ({
      ...prev,
      batchId: undefined,
      manufacturingDate: undefined,
      expiryDate: undefined,
    }));
  }

  function onChamberChange(chamberId: string) {
    setForm((prev) => ({ ...prev, chamberId, locationId: "" }));
    setErrors((prev) => ({ ...prev, chamberId: undefined, locationId: undefined, chamber: undefined }));
  }

  function onStudyTypeChange(studyTypeId: string) {
    setForm((prev) => ({ ...prev, studyTypeId, pullAllocations: {} }));
    setErrors((prev) => ({ ...prev, studyTypeId: undefined, allocations: undefined }));
  }

  function setAllocation(pullId: string, value: string) {
    const qty = value === "" ? 0 : Math.max(0, Number(value) || 0);
    setForm((prev) => ({
      ...prev,
      pullAllocations: { ...prev.pullAllocations, [pullId]: qty },
    }));
    setErrors((prev) => ({ ...prev, allocations: undefined }));
  }

  function validate(): boolean {
    const next = validateChargeForm(form, { chamber: selectedChamber });
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error(Object.values(next)[0] || "Please fix validation errors.");
      return false;
    }
    return true;
  }

  function onSubmitClick() {
    if (!canCharge) {
      toast.error("You do not have permission to charge samples.");
      return;
    }
    if (!profile) {
      toast.error("User profile is required.");
      return;
    }
    if (!validate()) return;
    setConfirmOpen(true);
  }

  async function onConfirm() {
    if (!profile || !masters.data) return;
    setSubmitting(true);
    try {
      const payload = resolveChargePayload(form, masters.data, profile);
      const result = await createStudyAndCharge(payload);
      toast.success(`Sample ${result.sampleId} charged · Study ${result.studyId} created.`);
      setConfirmOpen(false);
      router.push(`/stability/inventory/${result.sampleDocId}`);
    } catch (err) {
      toast.error(friendlyError(err, err instanceof Error ? err.message : "Unable to charge sample."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sample Charging"
        description="Digitize the charging register — create a study and load samples into chamber inventory."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void masters.reload()} disabled={masters.loading}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/stability/inventory">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" />
                Back to Inventory
              </Button>
            </Link>
          </div>
        }
      />

      {!canCharge ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your role can view this screen but cannot charge samples.
        </Card>
      ) : null}

      {masters.loading ? <LoadingSkeleton rows={8} /> : null}
      {masters.error ? <ErrorState message={masters.error} onRetry={masters.reload} /> : null}

      {!masters.loading && !masters.error && masters.data && mastersReady && mastersReady.length > 0 ? (
        <Card className="mb-4">
          <EmptyState
            title="Complete master setup before charging"
            description="These masters are missing or inactive. Configure them first, then return here to charge samples."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {mastersReady.map((item) => (
                  <Link key={item.href} href={item.href}>
                    <Button variant="outline">{item.label}</Button>
                  </Link>
                ))}
              </div>
            }
          />
        </Card>
      ) : null}

      {!masters.loading && !masters.error && masters.data && (!mastersReady || mastersReady.length === 0) ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Product & Batch"
              description="Select product and batch. Manufacturing and expiry auto-fill from batch master."
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="Product"
                required
                value={form.productId}
                error={errors.productId}
                onChange={(e) => onProductChange(e.target.value)}
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
                value={form.batchId}
                error={errors.batchId}
                disabled={!form.productId}
                onChange={(e) => onBatchChange(e.target.value)}
              >
                <option value="">Select batch</option>
                {productBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.batchNumber}
                  </option>
                ))}
              </Select>
              <Input
                label="Manufacturing Date"
                type="date"
                required
                value={form.manufacturingDate}
                error={errors.manufacturingDate}
                onChange={(e) => updateField("manufacturingDate", e.target.value)}
              />
              <Input
                label="Expiry Date"
                type="date"
                required
                value={form.expiryDate}
                error={errors.expiryDate}
                onChange={(e) => updateField("expiryDate", e.target.value)}
              />
            </div>
            {form.productId && productBatches.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-amber-700">
                No active batches for this product.{" "}
                <Link href="/masters/batches" className="font-medium underline">
                  Add a batch
                </Link>
                .
              </p>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Study Setup" description="Study type, storage condition, and charging date." />
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Date of Charging"
                type="date"
                required
                value={form.chargingDate}
                error={errors.chargingDate}
                onChange={(e) => updateField("chargingDate", e.target.value)}
              />
              <Select
                label="Study Type"
                required
                value={form.studyTypeId}
                error={errors.studyTypeId}
                onChange={(e) => onStudyTypeChange(e.target.value)}
              >
                <option value="">Select study type</option>
                {activeStudyTypes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Storage Condition"
                required
                value={form.storageConditionId}
                error={errors.storageConditionId}
                onChange={(e) => updateField("storageConditionId", e.target.value)}
              >
                <option value="">Select condition</option>
                {activeConditions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayLabel || c.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Unit"
                required
                value={form.unit}
                error={errors.unit}
                onChange={(e) => updateField("unit", e.target.value)}
              >
                <option value="">Select unit</option>
                {activeUnits.map((u) => (
                  <option key={u.id} value={u.abbreviation || u.name}>
                    {u.name} ({u.abbreviation})
                  </option>
                ))}
              </Select>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Chamber & Location"
              description="Inactive chambers are blocked. Maintenance chambers show a warning."
            />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <Select
                label="Chamber"
                required
                value={form.chamberId}
                error={errors.chamberId || errors.chamber}
                onChange={(e) => onChamberChange(e.target.value)}
              >
                <option value="">Select chamber</option>
                {(masters.data.chambers || []).map((c) => (
                  <option key={c.id} value={c.id} disabled={c.status === "Inactive"}>
                    {c.chamberName} ({c.status})
                  </option>
                ))}
              </Select>
              <Select
                label="Location"
                required
                value={form.locationId}
                error={errors.locationId}
                disabled={!form.chamberId}
                onChange={(e) => updateField("locationId", e.target.value)}
              >
                <option value="">Select location</option>
                {chamberLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </div>
            {selectedChamber ? (
              <div className="mx-4 mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="text-slate-500">Chamber capacity</p>
                <p className="font-medium text-slate-900">
                  Used {selectedChamber.usedCapacity} / {selectedChamber.capacity} · Available{" "}
                  {chamberAvailable}
                </p>
                {totalQuantity > 0 && chamberAvailable !== null && totalQuantity > chamberAvailable ? (
                  <p className="mt-1 text-xs text-rose-600">
                    Requested quantity exceeds available chamber capacity.
                  </p>
                ) : null}
              </div>
            ) : null}
            {form.chamberId && chamberLocations.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-amber-700">
                No active locations for this chamber.{" "}
                <Link href="/masters/locations" className="font-medium underline">
                  Add a location
                </Link>
                .
              </p>
            ) : null}
            {selectedChamber?.status === "Under Maintenance" ? (
              <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Chamber is Under Maintenance. You may still proceed, but confirm with QA before charging.
              </div>
            ) : null}
            {selectedChamber?.status === "Inactive" ? (
              <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Inactive chambers cannot receive samples. Select another chamber.
              </div>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Quantities" description="Total charged must cover pull allocations plus reserve." />
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                label="Total Quantity"
                type="number"
                min={0}
                required
                value={form.totalQuantity}
                error={errors.totalQuantity}
                onChange={(e) => updateField("totalQuantity", e.target.value)}
              />
              <Input
                label="Reserve Quantity"
                type="number"
                min={0}
                value={form.reservedQuantity}
                error={errors.reservedQuantity}
                onChange={(e) => updateField("reservedQuantity", e.target.value)}
              />
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="text-slate-500">Live calculation</p>
                <p className="mt-2 text-slate-700">
                  Total Required (pulls): <span className="font-semibold text-slate-900">{totalRequired}</span>
                </p>
                <p className="text-slate-700">
                  + Reserve: <span className="font-semibold text-slate-900">{reservedQuantity}</span>
                </p>
                <p className="mt-1 font-medium text-teal-800">
                  = Total Charged needed: {totalChargedNeeded}
                </p>
                <p className={`mt-1 text-xs ${remaining < 0 ? "text-rose-600" : "text-slate-500"}`}>
                  {remaining < 0
                    ? `Exceeds total by ${Math.abs(remaining)}`
                    : `Unallocated balance: ${remaining}`}
                </p>
              </div>
            </div>
            <div className="px-4 pb-4">
              <Textarea
                label="Notes"
                value={form.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Optional charging remarks"
              />
            </div>
          </Card>

          {form.studyTypeId ? (
            <Card>
              <CardHeader
                title="Pull Point Allocation"
                description="Quantities per pull point from the pull point master for the selected study type."
              />
              {errors.allocations ? (
                <p className="px-4 pt-2 text-xs text-rose-600">{errors.allocations}</p>
              ) : null}
              {!pullPoints.length ? (
                <p className="p-4 text-sm text-amber-700">
                  No active pull points for this study type.{" "}
                  <Link href="/masters/pull-points" className="font-medium underline">
                    Configure pull points
                  </Link>{" "}
                  and link them to the study type.
                </p>
              ) : (
                <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Pull Point</th>
                        <th className="px-4 py-3">Months</th>
                        <th className="px-4 py-3">Planned Date</th>
                        <th className="px-4 py-3">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pullPoints.map((p) => (
                        <tr key={p.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {p.code}
                            <span className="ml-2 text-xs font-normal text-slate-500">{p.label}</span>
                          </td>
                          <td className="px-4 py-3">{p.months}M</td>
                          <td className="px-4 py-3">
                            {form.chargingDate
                              ? formatDate(addMonthsToDate(form.chargingDate, p.months))
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Input
                              type="number"
                              min={0}
                              className="max-w-[140px]"
                              value={form.pullAllocations[p.id] ?? ""}
                              onChange={(e) => setAllocation(p.id, e.target.value)}
                              aria-label={`Quantity for ${p.code}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3 p-4 md:hidden">
                  {pullPoints.map((p) => (
                    <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                      <p className="font-semibold text-slate-900">{p.code}</p>
                      <p className="text-sm text-slate-500">
                        {p.label} · {p.months}M
                        {form.chargingDate ? ` · ${formatDate(addMonthsToDate(form.chargingDate, p.months))}` : ""}
                      </p>
                      <div className="mt-3">
                        <Input
                          type="number"
                          min={0}
                          label="Quantity"
                          value={form.pullAllocations[p.id] ?? ""}
                          onChange={(e) => setAllocation(p.id, e.target.value)}
                          aria-label={`Quantity for ${p.code}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}
            </Card>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Link href="/stability/inventory">
              <Button variant="outline" className="w-full sm:w-auto">
                Cancel
              </Button>
            </Link>
            <Button className="w-full sm:w-auto" onClick={onSubmitClick} disabled={!canCharge || submitting}>
              <PackagePlus className="h-4 w-4" />
              Charge Sample
            </Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm sample charging"
        description={`Charge ${totalQuantity} ${form.unit || "units"} into ${selectedChamber?.chamberName || "chamber"}? Allocations: ${totalRequired}, Reserve: ${reservedQuantity}. This also creates the linked stability study.`}
        confirmLabel="Confirm & Charge"
        loading={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void onConfirm()}
      />
    </div>
  );
}
