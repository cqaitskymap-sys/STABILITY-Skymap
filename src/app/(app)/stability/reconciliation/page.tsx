"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck, RefreshCw } from "lucide-react";
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
  Pager,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, friendlyError, paginate, resolveReconciliationStatus } from "@/lib/utils";
import {
  listPullPoints,
  listReconciliations,
  listSamples,
  reconcileSample,
} from "@/services/inventory";

function ReconciliationPageInner() {
  const searchParams = useSearchParams();
  const sampleFromUrl = searchParams.get("sample") || "";
  const { profile } = useAuth();
  const samples = useAsync(listSamples, []);
  const history = useAsync(listReconciliations, []);

  const [sampleDocId, setSampleDocId] = useState(sampleFromUrl);
  const [physicalQty, setPhysicalQty] = useState("");
  const [adjust, setAdjust] = useState(false);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (sampleFromUrl) setSampleDocId(sampleFromUrl);
  }, [sampleFromUrl]);

  useEffect(() => {
    if (!sampleFromUrl || !samples.data?.length) return;
    const exists = samples.data.some((s) => s.id === sampleFromUrl);
    if (!exists) {
      toast.error("Linked sample was not found. Select a sample to reconcile.");
      setSampleDocId("");
    }
  }, [sampleFromUrl, samples.data]);

  const selectedSample = useMemo(
    () => (samples.data || []).find((s) => s.id === sampleDocId) || null,
    [samples.data, sampleDocId]
  );

  const pullPoints = useAsync(
    () => (sampleDocId ? listPullPoints({ sampleDocId }) : Promise.resolve([])),
    [sampleDocId]
  );

  const systemQty = selectedSample?.availableQuantity ?? 0;
  const physicalParsed = physicalQty.trim() === "" ? NaN : Number(physicalQty);
  const hasPhysical = Number.isFinite(physicalParsed) && physicalParsed >= 0;
  const physical = hasPhysical ? physicalParsed : NaN;
  const variance = hasPhysical ? physical - systemQty : 0;
  const liveStatus = hasPhysical ? resolveReconciliationStatus(variance, adjust) : "Matched";

  const validationError = !selectedSample
    ? "Select a sample to reconcile."
    : !hasPhysical
      ? "Enter a valid physical quantity (zero or greater)."
      : adjust && variance !== 0 && !reason.trim()
        ? "Adjustment reason is required when adjusting inventory."
        : null;

  async function onConfirm() {
    if (!profile || !selectedSample || validationError || !hasPhysical) return;
    setSaving(true);
    try {
      const result = await reconcileSample({
        sampleDocId: selectedSample.id,
        physicalQuantity: physical,
        reason: reason.trim() || undefined,
        remarks: remarks.trim() || undefined,
        adjust,
        user: profile,
      });
      toast.success(
        `Reconciliation ${result.reconciliationId} saved (${result.status}${result.variance !== 0 ? `, variance ${result.variance}` : ""}).`
      );
      setConfirmOpen(false);
      setReason("");
      setRemarks("");
      setAdjust(false);
      setPhysicalQty("");
      await Promise.all([samples.reload(), history.reload(), pullPoints.reload()]);
    } catch (err) {
      toast.error(friendlyError(err, err instanceof Error ? err.message : "Unable to reconcile sample."));
    } finally {
      setSaving(false);
    }
  }

  const paged = paginate(history.data || [], page, 10);

  return (
    <div>
      <PageHeader
        title="Inventory Reconciliation"
        description="Compare system quantity with physical count, review variance, and optionally adjust inventory."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void samples.reload();
              void history.reload();
              void pullPoints.reload();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader title="Reconcile Sample" description="Enter the physical count and review live variance status." />
        <div className="space-y-5 p-4 sm:p-5">
          {samples.loading ? <LoadingSkeleton rows={2} /> : null}
          {samples.error ? <ErrorState message={samples.error} onRetry={samples.reload} /> : null}

          {!samples.loading && !samples.error && (samples.data || []).length === 0 ? (
            <EmptyState
              title="No samples to reconcile"
              description="Charge a stability sample first, then return here to compare physical count with system quantity."
            />
          ) : null}

          {!samples.loading && !samples.error && (samples.data || []).length > 0 ? (
            <Select
              label="Sample"
              required
              value={sampleDocId}
              onChange={(e) => {
                setSampleDocId(e.target.value);
                setPhysicalQty("");
                setAdjust(false);
                setReason("");
              }}
            >
              <option value="">Select sample…</option>
              {(samples.data || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sampleId} — {s.productName} / {s.batchNumber}
                  {s.status === "Under Reconciliation" ? " (Under Reconciliation)" : ""}
                </option>
              ))}
            </Select>
          ) : null}

          {selectedSample ? (
            <>
              <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Info label="Product" value={selectedSample.productName} />
                <Info label="Batch" value={selectedSample.batchNumber} />
                <Info label="System Quantity" value={`${systemQty} ${selectedSample.unit}`} />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Sample Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedSample.status} />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Physical Quantity"
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={physicalQty}
                  onChange={(e) => setPhysicalQty(e.target.value)}
                />
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Live Variance</p>
                  <p
                    className={`mt-1 text-2xl font-semibold ${
                      !hasPhysical
                        ? "text-slate-400"
                        : variance === 0
                          ? "text-emerald-700"
                          : variance > 0
                            ? "text-sky-700"
                            : "text-rose-700"
                    }`}
                  >
                    {hasPhysical ? (variance > 0 ? `+${variance}` : variance) : "—"}
                  </p>
                  <div className="mt-2">
                    {hasPhysical ? <StatusBadge status={liveStatus} /> : null}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Matched (zero variance), Variance Found (non-zero), or Investigation Required
                    when the gap is significant (≥ 5). Adjusting will record status as Adjusted.
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                  checked={adjust}
                  onChange={(e) => setAdjust(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-slate-900">Adjust system quantity to physical count</span>
                  <span className="mt-0.5 block text-slate-500">
                    Requires a reason when variance is not zero. Inventory totals and chamber capacity will be updated.
                  </span>
                </span>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Reason"
                  required={adjust && variance !== 0}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={adjust ? "Required for adjustment" : "Optional"}
                />
                <Textarea
                  label="Remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional remarks"
                />
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    if (validationError) {
                      toast.error(validationError);
                      return;
                    }
                    setConfirmOpen(true);
                  }}
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Submit Reconciliation
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </Card>

      {selectedSample ? (
        <Card className="mb-6">
          <CardHeader
            title="Pull Point Matrix"
            description={`Scheduled pull points for ${selectedSample.sampleId}.`}
          />
          {pullPoints.loading ? <LoadingSkeleton rows={3} /> : null}
          {pullPoints.error ? <ErrorState message={pullPoints.error} onRetry={pullPoints.reload} /> : null}
          {!pullPoints.loading && !pullPoints.error && (pullPoints.data || []).length === 0 ? (
            <EmptyState title="No pull points" description="This sample has no scheduled pull points." />
          ) : null}
          {!pullPoints.loading && (pullPoints.data || []).length > 0 ? (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Pull Point</th>
                    <th className="px-4 py-3">Months</th>
                    <th className="px-4 py-3">Planned Date</th>
                    <th className="px-4 py-3">Planned Qty</th>
                    <th className="px-4 py-3">Actual Qty</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(pullPoints.data || []).map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-teal-800">{p.pullPoint}</td>
                      <td className="px-4 py-3">{p.months}</td>
                      <td className="px-4 py-3">{formatDate(p.plannedDate)}</td>
                      <td className="px-4 py-3">{p.plannedQuantity}</td>
                      <td className="px-4 py-3">{p.actualQuantity}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-4 md:hidden">
              {(pullPoints.data || []).map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{p.pullPoint}</p>
                      <p className="text-slate-500">{p.months}M · {formatDate(p.plannedDate)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-2 text-slate-600">
                    Planned {p.plannedQuantity} · Actual {p.actualQuantity}
                  </p>
                </div>
              ))}
            </div>
            </>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Reconciliation History" description="Prior inventory reconciliation records." />
        {history.loading ? <LoadingSkeleton /> : null}
        {history.error ? <ErrorState message={history.error} onRetry={history.reload} /> : null}
        {!history.loading && !history.error && paged.items.length === 0 ? (
          <EmptyState title="No reconciliations yet" description="Completed reconciliations will appear here." />
        ) : null}
        {!history.loading && !history.error && paged.items.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">Sample</th>
                    <th className="px-4 py-3">System</th>
                    <th className="px-4 py-3">Physical</th>
                    <th className="px-4 py-3">Variance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">By</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-teal-800">{r.reconciliationId}</td>
                      <td className="px-4 py-3">
                        {r.sampleId}
                        <div className="text-xs text-slate-500">
                          {r.productName} / {r.batchNumber}
                        </div>
                      </td>
                      <td className="px-4 py-3">{r.systemQuantity}</td>
                      <td className="px-4 py-3">{r.physicalQuantity}</td>
                      <td className="px-4 py-3">{r.variance > 0 ? `+${r.variance}` : r.variance}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3">{formatDate(r.reconciliationDate)}</td>
                      <td className="px-4 py-3">{r.performedByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-4 lg:hidden">
              {paged.items.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{r.reconciliationId}</p>
                      <p className="text-slate-500">{r.sampleId}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-2">
                    System {r.systemQuantity} · Physical {r.physicalQuantity} · Variance{" "}
                    {r.variance > 0 ? `+${r.variance}` : r.variance}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(r.reconciliationDate)} · {r.performedByName}
                  </p>
                </div>
              ))}
            </div>
            <Pager
              showing={paged.items.length}
              total={paged.total}
              page={paged.page}
              totalPages={paged.totalPages}
              onPrev={() => setPage((p) => p - 1)}
              onNext={() => setPage((p) => p + 1)}
            />
          </>
        ) : null}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm reconciliation?"
        description={`Record physical count of ${physical} for ${selectedSample?.sampleId || "sample"} (system ${systemQty}, variance ${variance > 0 ? `+${variance}` : variance})${adjust && variance !== 0 ? ". System quantity will be adjusted." : "."}`}
        confirmLabel="Confirm"
        loading={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void onConfirm()}
      />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-medium text-slate-900">{value}</p>
    </div>
  );
}

export default function ReconciliationPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={6} />}>
      <ReconciliationPageInner />
    </Suspense>
  );
}
