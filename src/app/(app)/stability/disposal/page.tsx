"use client";

import { useMemo, useState } from "react";
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

export default function DisposalPage() {
  const { profile } = useAuth();
  const samples = useAsync(listSamples, []);
  const history = useAsync(listDisposals, []);

  const [sampleDocId, setSampleDocId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [disposalDate, setDisposalDate] = useState(todayISO());
  const [reason, setReason] = useState<DisposalReason | "">("");
  const [disposedBy, setDisposedBy] = useState(profile?.displayName || "");
  const [remarks, setRemarks] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const disposedByValue = disposedBy || profile?.displayName || "";

  const selectedSample = useMemo(
    () => (samples.data || []).find((s) => s.id === sampleDocId) || null,
    [samples.data, sampleDocId]
  );

  const qty = Number(quantity);
  const available = selectedSample?.availableQuantity ?? 0;

  const validationError = !selectedSample
    ? "Select a sample to dispose."
    : !Number.isFinite(qty) || qty <= 0
      ? "Enter a valid disposal quantity greater than zero."
      : qty > available
        ? `Cannot dispose more than available quantity (${available}).`
        : !disposalDate
          ? "Disposal date is required."
          : !reason
            ? "Select a disposal reason."
            : !disposedByValue.trim()
              ? "Disposed by is required."
              : null;

  async function onConfirm() {
    if (!profile || !selectedSample || !reason || validationError) return;
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
      toast.success(`Disposal ${result.disposalId} recorded successfully.`);
      setConfirmOpen(false);
      setQuantity("");
      setRemarks("");
      setReason("");
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

      <Card className="mb-6">
        <CardHeader title="Dispose Sample" description="Validate quantity against available inventory before confirming." />
        <div className="space-y-5 p-4 sm:p-5">
          {samples.loading ? <LoadingSkeleton rows={2} /> : null}
          {samples.error ? <ErrorState message={samples.error} onRetry={samples.reload} /> : null}

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
            {(samples.data || [])
              .filter((s) => s.availableQuantity > 0 && s.status !== "Disposed")
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sampleId} — {s.productName} / {s.batchNumber} (avail {s.availableQuantity} {s.unit})
                </option>
              ))}
          </Select>

          {selectedSample ? (
            <>
              <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Info label="Product" value={selectedSample.productName} />
                <Info label="Batch" value={selectedSample.batchNumber} />
                <Info label="Available" value={`${selectedSample.availableQuantity} ${selectedSample.unit}`} />
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                  <div className="mt-1">
                    <StatusBadge status={selectedSample.status} />
                  </div>
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
                  error={
                    Number.isFinite(qty) && qty > available
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
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional remarks"
                  />
                </div>
              </div>

              <div className="flex justify-end">
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
        </div>
      </Card>

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
                      <td className="px-4 py-3">{d.sampleId}</td>
                      <td className="px-4 py-3">
                        {d.productName}
                        <div className="text-xs text-slate-500">{d.batchNumber}</div>
                      </td>
                      <td className="px-4 py-3">{d.quantity}</td>
                      <td className="px-4 py-3">{d.reason}</td>
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
                    {d.sampleId} · {d.productName} / {d.batchNumber}
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
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
              <p className="text-slate-500">
                Showing {paged.items.length} of {paged.total}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={paged.page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={paged.page >= paged.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm sample disposal?"
        description={`Dispose ${qty} unit(s) of ${selectedSample?.sampleId || "sample"} (${reason}). This permanently reduces available inventory.`}
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
