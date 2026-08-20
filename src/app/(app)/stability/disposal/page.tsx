"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Trash2 } from "lucide-react";
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
import { formatDate, formatDateTime, friendlyError, paginate, todayISO } from "@/lib/utils";
import { disposeSample, listDisposals, listSamples } from "@/services/inventory";
import type { DisposalReason } from "@/types";

const DISPOSAL_REASONS: DisposalReason[] = [
  "Study Completed",
  "Expired",
  "Damaged",
  "Excess Sample",
  "Other",
];

function DisposalPageInner() {
  const searchParams = useSearchParams();
  const sampleFromUrl = searchParams.get("sample") || "";
  const { profile, hasPermission } = useAuth();
  const canDispose = hasPermission("disposal.perform");

  const samples = useAsync(listSamples, []);
  const history = useAsync(listDisposals, []);

  const [sampleDocId, setSampleDocId] = useState(sampleFromUrl);
  const [quantity, setQuantity] = useState("");
  const [disposalDate, setDisposalDate] = useState(todayISO());
  const [reason, setReason] = useState<DisposalReason | "">("");
  const [disposedBy, setDisposedBy] = useState(profile?.displayName || "");
  const [remarks, setRemarks] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (sampleFromUrl) setSampleDocId(sampleFromUrl);
  }, [sampleFromUrl]);

  useEffect(() => {
    if (profile?.displayName && !disposedBy) {
      setDisposedBy(profile.displayName);
    }
  }, [profile?.displayName, disposedBy]);

  useEffect(() => {
    if (!sampleFromUrl || !samples.data?.length) return;
    const match = samples.data.find((s) => s.id === sampleFromUrl);
    if (!match) {
      toast.error("Linked sample was not found. Select a sample to dispose.");
      setSampleDocId("");
      return;
    }
    if (match.availableQuantity <= 0 || match.status === "Disposed") {
      toast.error("This sample has no available quantity to dispose.");
      setSampleDocId("");
    }
  }, [sampleFromUrl, samples.data]);

  const disposedByValue = disposedBy || profile?.displayName || "";

  const disposableSamples = useMemo(
    () =>
      (samples.data || []).filter((s) => s.availableQuantity > 0 && s.status !== "Disposed"),
    [samples.data]
  );

  const selectedSample = useMemo(
    () => disposableSamples.find((s) => s.id === sampleDocId) || null,
    [disposableSamples, sampleDocId]
  );

  useEffect(() => {
    if (!selectedSample) return;
    if (quantity.trim() !== "") return;
    setQuantity(String(selectedSample.availableQuantity));
  }, [selectedSample, quantity]);

  const qtyParsed = quantity.trim() === "" ? NaN : Number(quantity);
  const hasQty = Number.isFinite(qtyParsed) && qtyParsed > 0;
  const qty = hasQty ? qtyParsed : NaN;
  const available = selectedSample?.availableQuantity ?? 0;
  const remainingAfter = hasQty ? Math.max(0, available - qty) : available;

  const validationError = !canDispose
    ? "You do not have permission to dispose samples."
    : !selectedSample
      ? "Select a sample to dispose."
      : selectedSample.availableQuantity <= 0
        ? "No available quantity left to dispose."
        : !hasQty
          ? "Enter a valid disposal quantity greater than zero."
          : qty > available
            ? `Cannot dispose more than available quantity (${available}).`
            : !disposalDate
              ? "Disposal date is required."
              : !reason
                ? "Select a disposal reason."
                : reason === "Other" && !remarks.trim()
                  ? "Remarks are required when reason is Other."
                  : !disposedByValue.trim()
                    ? "Disposed by is required."
                    : null;

  function resetForm(keepSample = true) {
    if (!keepSample) setSampleDocId("");
    setQuantity("");
    setReason("");
    setRemarks("");
    setDisposalDate(todayISO());
  }

  async function onConfirm() {
    if (!profile || !selectedSample || !reason || validationError || !hasQty) return;
    setSaving(true);
    try {
      const result = await disposeSample({
        sampleDocId: selectedSample.id,
        quantity: qty,
        disposalDate,
        reason,
        disposedBy: disposedByValue.trim(),
        remarks: remarks.trim() || undefined,
        user: profile,
      });
      toast.success(
        `Disposal ${result.disposalId} recorded. Remaining available: ${result.remainingAvailable}.`
      );
      setConfirmOpen(false);
      if (result.remainingAvailable <= 0) {
        resetForm(false);
      } else {
        resetForm(true);
        setQuantity(String(result.remainingAvailable));
      }
      await Promise.all([samples.reload(), history.reload()]);
    } catch (err) {
      toast.error(friendlyError(err, err instanceof Error ? err.message : "Unable to dispose sample."));
    } finally {
      setSaving(false);
    }
  }

  const paged = paginate(history.data || [], page, 10);

  return (
    <div>
      <PageHeader
        title="Sample Disposal"
        description="Dispose remaining or excess stability samples with reason and audit trail."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void samples.reload();
              void history.reload();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {!canDispose ? (
        <Card className="mb-6">
          <EmptyState
            title="Disposal permission required"
            description="Ask an Admin to grant the Disposal module on your account."
          />
        </Card>
      ) : null}

      {canDispose ? (
        <Card className="mb-6">
          <CardHeader
            title="Dispose Sample"
            description="Validate quantity against available inventory before confirming."
          />
          <div className="space-y-5 p-4 sm:p-5">
            {samples.loading && !selectedSample ? <LoadingSkeleton rows={2} /> : null}
            {samples.error ? <ErrorState message={samples.error} onRetry={samples.reload} /> : null}

            {!samples.loading && !samples.error && disposableSamples.length === 0 ? (
              <EmptyState
                title="No samples available to dispose"
                description="Charge samples into inventory first, or all stock may already be withdrawn/disposed."
                action={
                  <Link href="/stability/inventory">
                    <Button variant="outline">Sample Inventory</Button>
                  </Link>
                }
              />
            ) : null}

            {disposableSamples.length > 0 ? (
              <>
                <Select
                  label="Sample"
                  required
                  value={sampleDocId}
                  onChange={(e) => {
                    setSampleDocId(e.target.value);
                    setQuantity("");
                  }}
                >
                  <option value="">Select sample…</option>
                  {disposableSamples.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sampleId} — {s.productName} / {s.batchNumber} (avail {s.availableQuantity}{" "}
                      {s.unit})
                    </option>
                  ))}
                </Select>

                {selectedSample ? (
                  <>
                    <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <Info label="Product" value={selectedSample.productName} />
                      <Info label="Batch" value={selectedSample.batchNumber} />
                      <Info
                        label="Available"
                        value={`${selectedSample.availableQuantity} ${selectedSample.unit}`}
                      />
                      <div>
                        <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                        <div className="mt-1">
                          <StatusBadge status={selectedSample.status} />
                        </div>
                      </div>
                      <Info label="Chamber" value={selectedSample.chamberName || "—"} />
                      <Info label="Location" value={selectedSample.locationLabel || "—"} />
                      <Info
                        label="Already disposed"
                        value={`${selectedSample.disposedQuantity} ${selectedSample.unit}`}
                      />
                      <div className="flex items-end">
                        <Link
                          href={`/stability/inventory/${selectedSample.id}`}
                          className="text-sm font-medium text-teal-800 hover:underline"
                        >
                          View sample detail
                        </Link>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Input
                        label="Quantity"
                        type="number"
                        min={0}
                        step="any"
                        required
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        hint={`Max ${available} ${selectedSample.unit}. Remaining after: ${
                          hasQty ? remainingAfter : "—"
                        }`}
                        error={
                          hasQty && qty > available
                            ? `Cannot exceed available (${available})`
                            : undefined
                        }
                      />
                      <Input
                        label="Disposal Date"
                        type="date"
                        required
                        value={disposalDate}
                        onChange={(e) => setDisposalDate(e.target.value)}
                      />
                      <Select
                        label="Reason"
                        required
                        value={reason}
                        onChange={(e) => setReason(e.target.value as DisposalReason | "")}
                      >
                        <option value="">Select reason…</option>
                        {DISPOSAL_REASONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                      <Input
                        label="Disposed By"
                        required
                        value={disposedByValue}
                        onChange={(e) => setDisposedBy(e.target.value)}
                      />
                      <div className="md:col-span-2">
                        <Textarea
                          label="Remarks"
                          required={reason === "Other"}
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder={
                            reason === "Other"
                              ? "Describe the disposal reason…"
                              : "Optional remarks"
                          }
                          hint={reason === "Other" ? "Required when reason is Other" : undefined}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {selectedSample || reason || quantity ? (
                        <Button variant="outline" type="button" onClick={() => resetForm(false)}>
                          Clear
                        </Button>
                      ) : null}
                      <Button
                        variant="outline"
                        type="button"
                        disabled={!selectedSample}
                        onClick={() => setQuantity(String(available))}
                      >
                        Dispose all available
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          if (validationError) {
                            toast.error(validationError);
                            return;
                          }
                          setConfirmOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Dispose Sample
                      </Button>
                    </div>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Disposal History" description="Previously disposed sample quantities." />
        {history.loading ? <LoadingSkeleton /> : null}
        {history.error ? <ErrorState message={history.error} onRetry={history.reload} /> : null}
        {!history.loading && !history.error && paged.items.length === 0 ? (
          <EmptyState title="No disposals yet" description="Completed disposals will appear here." />
        ) : null}
        {!history.loading && !history.error && paged.items.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Disposal ID</th>
                    <th className="px-4 py-3">Sample</th>
                    <th className="px-4 py-3">Product / Batch</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Disposed By</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((d) => (
                    <tr key={d.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-teal-800">{d.disposalId}</td>
                      <td className="px-4 py-3">
                        {d.sampleDocId ? (
                          <Link
                            href={`/stability/inventory/${d.sampleDocId}`}
                            className="font-medium text-teal-800 hover:underline"
                          >
                            {d.sampleId}
                          </Link>
                        ) : (
                          d.sampleId
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {d.productName}
                        <div className="text-xs text-slate-500">{d.batchNumber}</div>
                      </td>
                      <td className="px-4 py-3">{d.quantity}</td>
                      <td className="px-4 py-3">
                        {d.reason}
                        {d.remarks ? (
                          <div className="text-xs text-slate-500">{d.remarks}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{formatDate(d.disposalDate)}</td>
                      <td className="px-4 py-3">{d.disposedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-4 lg:hidden">
              {paged.items.map((d) => (
                <div key={d.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <p className="font-semibold text-slate-900">{d.disposalId}</p>
                  <p className="text-slate-500">
                    {d.sampleDocId ? (
                      <Link
                        href={`/stability/inventory/${d.sampleDocId}`}
                        className="text-teal-800 hover:underline"
                      >
                        {d.sampleId}
                      </Link>
                    ) : (
                      d.sampleId
                    )}{" "}
                    · {d.productName} / {d.batchNumber}
                  </p>
                  <p className="mt-2">
                    Qty {d.quantity} · {d.reason}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(d.disposalDate)} · {d.disposedBy}
                  </p>
                  <p className="text-xs text-slate-400">{formatDateTime(d.createdAt)}</p>
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
        title="Confirm sample disposal?"
        description={`Dispose ${hasQty ? qty : "—"} ${selectedSample?.unit || "unit(s)"} of ${selectedSample?.sampleId || "sample"} (${reason}). Remaining available after: ${hasQty ? remainingAfter : "—"}. This permanently reduces inventory and chamber capacity.`}
        confirmLabel="Confirm Disposal"
        tone="danger"
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

export default function DisposalPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={6} />}>
      <DisposalPageInner />
    </Suspense>
  );
}
