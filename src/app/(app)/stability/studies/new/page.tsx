"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Check } from "lucide-react";
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
import { peekNextId } from "@/services/ids";
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

const STEPS = [
  "Study Information",
  "Storage & Chamber",
  "Sample Quantity",
  "Pull Points",
  "Storage Location",
  "Review & Confirm",
] as const;

export default function NewStabilityStudyPage() {
  const router = useRouter();
  const { profile, hasPermission } = useAuth();
  const canCreate = hasPermission("studies.create") || hasPermission("charging.perform");

  const masters = useAsync(async () => {
    const [products, batches, studyTypes, conditions, pullPoints, chambers, locations, units, studyIdPreview] =
      await Promise.all([
        listProducts(),
        listBatches(),
        listStudyTypes(),
        listStorageConditions(),
        listPullPointMasters(),
        listChambers(),
        listLocations(),
        listUnits(),
        peekNextId("STB"),
      ]);
    return { products, batches, studyTypes, conditions, pullPoints, chambers, locations, units, studyIdPreview };
  }, []);

  const [step, setStep] = useState(0);
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

  const totalQuantity = Number(form.totalQuantity) || 0;
  const reservedQuantity = Number(form.reservedQuantity) || 0;
  const totalRequired = sumAllocations(form.pullAllocations);
  const totalChargedNeeded = totalRequired + reservedQuantity;

  const selectedProduct =
    (masters.data?.products || []).find((p) => p.id === form.productId) || null;
  const selectedBatch =
    (masters.data?.batches || []).find((b) => b.id === form.batchId) || null;
  const selectedStudyType = activeStudyTypes.find((s) => s.id === form.studyTypeId);
  const selectedCondition = activeConditions.find((c) => c.id === form.storageConditionId);
  const selectedLocation = chamberLocations.find((l) => l.id === form.locationId);

  const mastersReady = useMemo(
    () => (masters.data ? getMissingChargeMasters(masters.data) : null),
    [masters.data]
  );

  function updateField<K extends keyof ChargeFormState>(key: K, value: ChargeFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, allocations: undefined, chamber: undefined }));
  }

  function validateStep(current: number): boolean {
    const next: ChargeFormErrors = {};
    if (current === 0) {
      if (!form.productId) next.productId = "Product is required.";
      if (!form.batchId) next.batchId = "Batch is required.";
      if (!form.manufacturingDate) next.manufacturingDate = "Manufacturing date is required.";
      if (!form.expiryDate) next.expiryDate = "Expiry date is required.";
      if (form.manufacturingDate && form.expiryDate && form.expiryDate < form.manufacturingDate) {
        next.expiryDate = "Expiry date cannot be before manufacturing date.";
      }
      if (!form.chargingDate) next.chargingDate = "Date of charging is required.";
      if (!form.studyTypeId) next.studyTypeId = "Study type is required.";
    }
    if (current === 1) {
      if (!form.storageConditionId) next.storageConditionId = "Storage condition is required.";
      if (!form.chamberId) next.chamberId = "Chamber is required.";
      if (selectedChamber?.status === "Inactive") {
        next.chamber = "Cannot allocate samples to an inactive chamber.";
      }
    }
    if (current === 2) {
      const total = Number(form.totalQuantity);
      const reserved = Number(form.reservedQuantity || 0);
      if (!Number.isFinite(total) || total <= 0) next.totalQuantity = "Total quantity must be greater than zero.";
      if (!Number.isFinite(reserved) || reserved < 0) next.reservedQuantity = "Reserve quantity cannot be negative.";
      if (!form.unit) next.unit = "Unit is required.";
    }
    if (current === 3) {
      const allocated = sumAllocations(form.pullAllocations);
      const total = Number(form.totalQuantity) || 0;
      const reserved = Number(form.reservedQuantity) || 0;
      if (allocated <= 0) next.allocations = "Allocate quantity to at least one pull point.";
      if (allocated + reserved > total) {
        next.allocations = "Allocated pull points plus reserve cannot exceed total quantity.";
      }
    }
    if (current === 4) {
      if (!form.locationId) next.locationId = "Location is required.";
    }
    if (current === 5) {
      Object.assign(next, validateChargeForm(form, { chamber: selectedChamber }));
    }
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error(Object.values(next)[0] || "Please complete required fields.");
      return false;
    }
    return true;
  }

  function nextStep() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function onConfirm() {
    if (!profile || !masters.data) return;
    if (!validateStep(5)) return;
    setSubmitting(true);
    try {
      const payload = resolveChargePayload(form, masters.data, profile);
      const result = await createStudyAndCharge(payload);
      toast.success(`Study ${result.studyId} created successfully.`);
      setConfirmOpen(false);
      router.push(`/stability/studies/${result.studyDocId}`);
    } catch (err) {
      toast.error(friendlyError(err, err instanceof Error ? err.message : "Unable to create study."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Create Stability Study"
        description="Guided wizard to create a study and charge samples in one flow."
        actions={
          <Link href="/stability/studies">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" />
              Back to Studies
            </Button>
          </Link>
        }
      />

      {!canCreate ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your role can view this screen but cannot create studies.
        </Card>
      ) : null}

      {masters.loading ? <LoadingSkeleton rows={8} /> : null}
      {masters.error ? <ErrorState message={masters.error} onRetry={masters.reload} /> : null}

      {!masters.loading && !masters.error && masters.data && mastersReady && mastersReady.length > 0 ? (
        <Card className="mb-4">
          <EmptyState
            title="Complete master setup before creating a study"
            description="These masters are missing or inactive. Configure them first, then return here."
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
          <Card className="p-4">
            <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {STEPS.map((label, index) => {
                const active = index === step;
                const done = index < step;
                return (
                  <li
                    key={label}
                    className={`rounded-xl border px-3 py-2 text-xs sm:text-sm ${
                      active
                        ? "border-teal-500 bg-teal-50 text-teal-800 shadow-sm"
                        : done
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border-slate-200 bg-white text-slate-500"
                    }`}
                  >
                    <span className="font-semibold">{index + 1}. </span>
                    {label}
                  </li>
                );
              })}
            </ol>
          </Card>

          {step === 0 ? (
            <Card>
              <CardHeader
                title="1. Study Information"
                description={`Study ID preview: ${masters.data.studyIdPreview}`}
              />
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <div className="rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 sm:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Study ID</p>
                  <p className="mt-1 text-lg font-semibold text-teal-900">{masters.data.studyIdPreview}</p>
                  <p className="mt-1 text-xs text-teal-700">Assigned on confirm (preview only).</p>
                </div>
                <Select
                  label="Product"
                  required
                  value={form.productId}
                  error={errors.productId}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      productId: e.target.value,
                      batchId: "",
                      manufacturingDate: "",
                      expiryDate: "",
                    }))
                  }
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
                  onChange={(e) => {
                    const batch = productBatches.find((b) => b.id === e.target.value);
                    setForm((prev) => ({
                      ...prev,
                      batchId: e.target.value,
                      manufacturingDate: batch?.manufacturingDate || "",
                      expiryDate: batch?.expiryDate || "",
                    }));
                  }}
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
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, studyTypeId: e.target.value, pullAllocations: {} }))
                  }
                >
                  <option value="">Select study type</option>
                  {activeStudyTypes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            </Card>
          ) : null}

          {step === 1 ? (
            <Card>
              <CardHeader title="2. Storage Condition + Chamber" />
              <div className="grid gap-4 p-4 sm:grid-cols-2">
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
                  label="Chamber"
                  required
                  value={form.chamberId}
                  error={errors.chamberId || errors.chamber}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, chamberId: e.target.value, locationId: "" }))
                  }
                >
                  <option value="">Select chamber</option>
                  {(masters.data.chambers || []).map((c) => (
                    <option key={c.id} value={c.id} disabled={c.status === "Inactive"}>
                      {c.chamberName} ({c.status})
                    </option>
                  ))}
                </Select>
              </div>
              {selectedChamber?.status === "Under Maintenance" ? (
                <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Chamber is Under Maintenance.
                </div>
              ) : null}
              {selectedChamber?.status === "Inactive" ? (
                <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Inactive chambers are blocked.
                </div>
              ) : null}
            </Card>
          ) : null}

          {step === 2 ? (
            <Card>
              <CardHeader title="3. Sample Quantity" />
              <div className="grid gap-4 p-4 sm:grid-cols-3">
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
                <div className="sm:col-span-3">
                  <Textarea
                    label="Notes"
                    value={form.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                  />
                </div>
              </div>
            </Card>
          ) : null}

          {step === 3 ? (
            <Card>
              <CardHeader
                title="4. Pull Points Allocation"
                description={`Total Required ${totalRequired} + Reserve ${reservedQuantity} = ${totalChargedNeeded} (Total ${totalQuantity})`}
              />
              {errors.allocations ? (
                <p className="px-4 pt-2 text-xs text-rose-600">{errors.allocations}</p>
              ) : null}
              {!pullPoints.length ? (
                <p className="p-4 text-sm text-slate-500">No active pull points for this study type.</p>
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
                          <td className="px-4 py-3 font-medium">
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
                              onChange={(e) => {
                                const qty = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0);
                                setForm((prev) => ({
                                  ...prev,
                                  pullAllocations: { ...prev.pullAllocations, [p.id]: qty },
                                }));
                                setErrors((prev) => ({ ...prev, allocations: undefined }));
                              }}
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
                          onChange={(e) => {
                            const qty = e.target.value === "" ? 0 : Math.max(0, Number(e.target.value) || 0);
                            setForm((prev) => ({
                              ...prev,
                              pullAllocations: { ...prev.pullAllocations, [p.id]: qty },
                            }));
                            setErrors((prev) => ({ ...prev, allocations: undefined }));
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                </>
              )}
            </Card>
          ) : null}

          {step === 4 ? (
            <Card>
              <CardHeader title="5. Storage Location" description="Locations filtered by selected chamber." />
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <Select
                  label="Location"
                  required
                  value={form.locationId}
                  error={errors.locationId}
                  onChange={(e) => updateField("locationId", e.target.value)}
                >
                  <option value="">Select location</option>
                  {chamberLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </Select>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="text-slate-500">Chamber</p>
                  <p className="font-medium text-slate-900">{selectedChamber?.chamberName || "—"}</p>
                  <p className="mt-2 text-slate-500">Capacity used / total</p>
                  <p className="font-medium text-slate-900">
                    {selectedChamber
                      ? `${selectedChamber.usedCapacity} / ${selectedChamber.capacity}`
                      : "—"}
                  </p>
                </div>
              </div>
            </Card>
          ) : null}

          {step === 5 ? (
            <Card>
              <CardHeader title="6. Review & Confirm" description="Verify details before creating the study and charging samples." />
              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <ReviewRow label="Study ID (preview)" value={masters.data.studyIdPreview} />
                <ReviewRow label="Product" value={selectedProduct?.productName} />
                <ReviewRow label="Batch" value={selectedBatch?.batchNumber} />
                <ReviewRow label="Study Type" value={selectedStudyType?.name} />
                <ReviewRow label="Charging Date" value={formatDate(form.chargingDate)} />
                <ReviewRow label="Condition" value={selectedCondition?.displayLabel || selectedCondition?.name} />
                <ReviewRow label="Chamber" value={selectedChamber?.chamberName} />
                <ReviewRow label="Location" value={selectedLocation?.label} />
                <ReviewRow label="Total Quantity" value={`${totalQuantity} ${form.unit}`} />
                <ReviewRow label="Reserve" value={String(reservedQuantity)} />
                <ReviewRow label="Pull Required" value={String(totalRequired)} />
                <ReviewRow label="Notes" value={form.notes || "—"} />
              </div>
              <div className="border-t border-slate-100 p-4">
                <p className="mb-2 text-sm font-medium text-slate-800">Pull allocations</p>
                <ul className="space-y-1 text-sm text-slate-600">
                  {pullPoints
                    .filter((p) => (form.pullAllocations[p.id] || 0) > 0)
                    .map((p) => (
                      <li key={p.id}>
                        {p.code}: {form.pullAllocations[p.id]} · due{" "}
                        {formatDate(addMonthsToDate(form.chargingDate, p.months))}
                      </li>
                    ))}
                </ul>
              </div>
            </Card>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" className="w-full sm:w-auto" onClick={prevStep} disabled={step === 0}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button className="w-full sm:w-auto" onClick={nextStep} disabled={!canCreate}>
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="w-full sm:w-auto"
                disabled={!canCreate}
                onClick={() => {
                  if (!canCreate) {
                    toast.error("You do not have permission to create studies.");
                    return;
                  }
                  if (!profile) {
                    toast.error("User profile is required.");
                    return;
                  }
                  if (!validateStep(5)) return;
                  setConfirmOpen(true);
                }}
              >
                <Check className="h-4 w-4" />
                Create Study & Charge
              </Button>
            )}
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm study creation"
        description={`Create study and charge ${totalQuantity} ${form.unit || "units"}? Study ID will be assigned on save.`}
        confirmLabel="Confirm"
        loading={submitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void onConfirm()}
      />
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value || "—"}</p>
    </div>
  );
}
