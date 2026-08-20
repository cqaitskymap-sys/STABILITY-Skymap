"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, PackageMinus, RefreshCw } from "lucide-react";
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
import {
  getSample,
  listPullPoints,
  listWithdrawals,
  withdrawSample,
} from "@/services/inventory";
import type { PullPointStatus, StabilitySample } from "@/types";

const OPEN_STATUSES: PullPointStatus[] = [
  "Upcoming",
  "Due Soon",
  "Due Today",
  "Overdue",
  "Partially Withdrawn",
];

function statusPriority(status: PullPointStatus) {
  switch (status) {
    case "Overdue":
      return 0;
    case "Due Today":
      return 1;
    case "Due Soon":
      return 2;
    case "Partially Withdrawn":
      return 3;
    default:
      return 4;
  }
}

function WithdrawalsPageInner() {
  const searchParams = useSearchParams();
  const pullId = searchParams.get("pull") || "";
  const sampleFromUrl = searchParams.get("sample") || "";
  const router = useRouter();
  const { profile, hasPermission } = useAuth();
  const canWithdraw = hasPermission("withdrawal.perform");

  const pulls = useAsync(listPullPoints, []);
  const history = useAsync(listWithdrawals, []);

  const [manualPullId, setManualPullId] = useState("");
  const selectedPullId = pullId || manualPullId;
  const [sample, setSample] = useState<StabilitySample | null>(null);
  const [sampleLoading, setSampleLoading] = useState(false);
  const [actualQuantity, setActualQuantity] = useState("");
  const [withdrawalDate, setWithdrawalDate] = useState(todayISO());
  const [withdrawnBy, setWithdrawnBy] = useState(profile?.displayName || "");
  const [receivedBy, setReceivedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [duePick, setDuePick] = useState("");

  useEffect(() => {
    if (profile?.displayName && !withdrawnBy) {
      setWithdrawnBy(profile.displayName);
    }
  }, [profile?.displayName, withdrawnBy]);

  const withdrawnByValue = withdrawnBy || profile?.displayName || "";

  const selectedPull = useMemo(
    () => (pulls.data || []).find((p) => p.id === selectedPullId) || null,
    [pulls.data, selectedPullId]
  );

  // Inventory / Upcoming links with ?sample= — auto-select the earliest open pull for that sample.
  useEffect(() => {
    if (pullId || !sampleFromUrl || !pulls.data?.length) return;
    const open = pulls.data
      .filter((p) => p.sampleDocId === sampleFromUrl && OPEN_STATUSES.includes(p.status))
      .sort((a, b) => {
        const byStatus = statusPriority(a.status) - statusPriority(b.status);
        if (byStatus !== 0) return byStatus;
        return a.plannedDate.localeCompare(b.plannedDate);
      })[0];
    if (open) {
      setManualPullId(open.id);
      setDuePick(open.id);
      router.replace(`/stability/withdrawals?pull=${open.id}`);
    } else {
      toast.error("No open pull points found for this sample.");
    }
  }, [pullId, sampleFromUrl, pulls.data, router]);

  useEffect(() => {
    let cancelled = false;
    async function loadSample() {
      if (!selectedPull?.sampleDocId) {
        setSample(null);
        return;
      }
      setSampleLoading(true);
      try {
        const s = await getSample(selectedPull.sampleDocId);
        if (!cancelled) {
          setSample(s);
          if (s && selectedPull) {
            const remaining = Math.max(0, selectedPull.plannedQuantity - selectedPull.actualQuantity);
            const suggested = Math.min(remaining, s.availableQuantity);
            setActualQuantity(suggested > 0 ? String(suggested) : "");
          }
        }
      } catch (err) {
        if (!cancelled) {
          setSample(null);
          toast.error(friendlyError(err, err instanceof Error ? err.message : "Unable to load sample."));
        }
      } finally {
        if (!cancelled) setSampleLoading(false);
      }
    }
    void loadSample();
    return () => {
      cancelled = true;
    };
  }, [selectedPull]);

  const duePulls = useMemo(() => {
    return (pulls.data || [])
      .filter((p) => OPEN_STATUSES.includes(p.status))
      .sort((a, b) => {
        const byStatus = statusPriority(a.status) - statusPriority(b.status);
        if (byStatus !== 0) return byStatus;
        return a.plannedDate.localeCompare(b.plannedDate);
      });
  }, [pulls.data]);

  const pagedHistory = paginate(history.data || [], page, 10);

  const qtyParsed = actualQuantity.trim() === "" ? NaN : Number(actualQuantity);
  const hasQty = Number.isFinite(qtyParsed) && qtyParsed > 0;
  const qty = hasQty ? qtyParsed : NaN;
  const available = sample?.availableQuantity ?? 0;
  const remainingPlanned = selectedPull
    ? Math.max(0, selectedPull.plannedQuantity - selectedPull.actualQuantity)
    : 0;
  const maxWithdrawable = Math.min(available, remainingPlanned);

  const validationError = !canWithdraw
    ? "You do not have permission to withdraw samples."
    : !selectedPull
      ? "Select a pull point to withdraw."
      : selectedPull.status === "Withdrawn"
        ? "This pull point is already fully withdrawn."
        : !sample
          ? "Sample inventory could not be loaded."
          : sample.availableQuantity <= 0
            ? "No available quantity left for this sample."
            : remainingPlanned <= 0
              ? "No remaining planned quantity for this pull point."
              : !hasQty
                ? "Enter a valid actual quantity greater than zero."
                : qty > available
                  ? `Actual quantity cannot exceed available quantity (${available}).`
                  : qty > remainingPlanned
                    ? `Cannot exceed remaining planned quantity (${remainingPlanned}).`
                    : !withdrawalDate
                      ? "Withdrawal date is required."
                      : !withdrawnByValue.trim()
                        ? "Withdrawn by is required."
                        : !receivedBy.trim()
                          ? "Received by is required."
                          : null;

  function clearSelection() {
    setManualPullId("");
    setDuePick("");
    setSample(null);
    setActualQuantity("");
    setReceivedBy("");
    setRemarks("");
    setWithdrawalDate(todayISO());
    router.push("/stability/withdrawals");
  }

  async function onConfirmWithdraw() {
    if (!profile || !selectedPull || validationError || !hasQty) return;
    setSaving(true);
    try {
      const result = await withdrawSample({
        pullPointDocId: selectedPull.id,
        actualQuantity: qty,
        withdrawalDate,
        withdrawnBy: withdrawnByValue.trim(),
        receivedBy: receivedBy.trim(),
        remarks: remarks.trim() || undefined,
        user: profile,
      });
      toast.success(`Withdrawal ${result.withdrawalId} recorded successfully.`);
      setConfirmOpen(false);
      setRemarks("");
      setReceivedBy("");
      setActualQuantity("");
      await Promise.all([pulls.reload(), history.reload()]);
      router.push(`/stability/withdrawals/${result.withdrawalDocId}`);
    } catch (err) {
      toast.error(friendlyError(err, err instanceof Error ? err.message : "Unable to withdraw sample."));
    } finally {
      setSaving(false);
    }
  }

  function selectDuePull(id: string) {
    setDuePick(id);
    if (!id) return;
    router.push(`/stability/withdrawals?pull=${id}`);
  }

  const showForm = Boolean(selectedPullId);

  return (
    <div>
      <PageHeader
        title="Sample Withdrawal"
        description="Withdraw samples against scheduled pull points and review withdrawal history."
        actions={
          <>
            <Link href="/stability/withdrawals/upcoming">
              <Button variant="outline">Upcoming</Button>
            </Link>
            <Button
              variant="outline"
              onClick={() => {
                void pulls.reload();
                void history.reload();
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </>
        }
      />

      {!canWithdraw ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your role can view withdrawal history but cannot submit withdrawals.
        </Card>
      ) : null}

      {showForm ? (
        <Card className="mb-6">
          <CardHeader
            title="Withdrawal Form"
            description="Confirm pull-point details and record the actual quantity withdrawn."
            action={
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear selection
              </Button>
            }
          />
          <div className="space-y-5 p-4 sm:p-5">
            {pulls.loading || sampleLoading ? <LoadingSkeleton rows={3} /> : null}
            {pulls.error ? <ErrorState message={pulls.error} onRetry={pulls.reload} /> : null}
            {!pulls.loading && selectedPullId && !selectedPull ? (
              <ErrorState message="Selected pull point was not found." onRetry={pulls.reload} />
            ) : null}

            {selectedPull ? (
              <>
                <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                  <Info label="Product" value={selectedPull.productName} />
                  <Info label="Batch" value={selectedPull.batchNumber} />
                  <Info label="Study" value={selectedPull.studyId} />
                  <Info label="Study Type" value={selectedPull.studyType} />
                  <Info label="Condition" value={selectedPull.storageCondition} />
                  <Info label="Chamber" value={selectedPull.chamberName} />
                  <Info label="Location" value={sample?.locationLabel || "—"} />
                  <Info label="Pull Point" value={selectedPull.pullPoint} />
                  <Info label="Due Date" value={formatDate(selectedPull.plannedDate)} />
                  <Info label="Planned Qty" value={String(selectedPull.plannedQuantity)} />
                  <Info label="Already Withdrawn" value={String(selectedPull.actualQuantity)} />
                  <Info label="Remaining Planned" value={String(remainingPlanned)} />
                  <Info
                    label="Available Qty"
                    value={sample ? `${sample.availableQuantity} ${sample.unit}` : "—"}
                  />
                  <Info label="Max This Withdrawal" value={String(maxWithdrawable)} />
                  <div className="sm:col-span-2 lg:col-span-3">
                    <StatusBadge status={selectedPull.status} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    label="Actual Quantity"
                    type="number"
                    min={0}
                    max={maxWithdrawable || undefined}
                    step="any"
                    required
                    value={actualQuantity}
                    onChange={(e) => setActualQuantity(e.target.value)}
                    hint={`Max ${maxWithdrawable} (min of available and remaining planned)`}
                    error={
                      hasQty && qty > maxWithdrawable
                        ? `Cannot exceed ${maxWithdrawable}`
                        : undefined
                    }
                  />
                  <Input
                    label="Withdrawal Date"
                    type="date"
                    required
                    value={withdrawalDate}
                    onChange={(e) => setWithdrawalDate(e.target.value)}
                  />
                  <Input
                    label="Withdrawn By"
                    required
                    value={withdrawnByValue}
                    onChange={(e) => setWithdrawnBy(e.target.value)}
                  />
                  <Input
                    label="Received By"
                    required
                    value={receivedBy}
                    onChange={(e) => setReceivedBy(e.target.value)}
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

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  {sample?.id ? (
                    <Link href={`/stability/inventory/${sample.id}`}>
                      <Button variant="outline">View Sample</Button>
                    </Link>
                  ) : null}
                  <Button
                    disabled={!canWithdraw || saving}
                    onClick={() => {
                      if (validationError) {
                        toast.error(validationError);
                        return;
                      }
                      setConfirmOpen(true);
                    }}
                  >
                    <PackageMinus className="h-4 w-4" />
                    Submit Withdrawal
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardHeader
            title="Select a due pull point"
            description="Choose an open pull point to begin a withdrawal, or browse history below."
          />
          <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-end sm:p-5">
            <Select
              label="Due / Open Pull Points"
              value={duePick}
              onChange={(e) => selectDuePull(e.target.value)}
              disabled={!canWithdraw}
            >
              <option value="">Select pull point…</option>
              {duePulls.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.productName} / {p.batchNumber} — {p.pullPoint} ({p.status}, due{" "}
                  {formatDate(p.plannedDate)})
                </option>
              ))}
            </Select>
            <Link href="/stability/withdrawals/upcoming">
              <Button variant="outline" className="w-full sm:w-auto">
                View Upcoming List
              </Button>
            </Link>
          </div>
          {pulls.loading ? <LoadingSkeleton rows={2} /> : null}
          {!pulls.loading && duePulls.length === 0 ? (
            <EmptyState
              title="No open pull points"
              description="All scheduled withdrawals are complete, or no studies have been charged yet."
              action={
                <Link href="/stability/inventory/charging">
                  <Button variant="outline">Charge Sample</Button>
                </Link>
              }
            />
          ) : null}
        </Card>
      )}

      <Card>
        <CardHeader title="Withdrawal History" description="Recently recorded sample withdrawals." />
        {history.loading ? <LoadingSkeleton /> : null}
        {history.error ? <ErrorState message={history.error} onRetry={history.reload} /> : null}
        {!history.loading && !history.error && pagedHistory.items.length === 0 ? (
          <EmptyState title="No withdrawals yet" description="Completed withdrawals will appear here." />
        ) : null}
        {!history.loading && !history.error && pagedHistory.items.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Withdrawal ID</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Pull</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Withdrawn By</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedHistory.items.map((w) => (
                    <tr key={w.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-teal-800">{w.withdrawalId}</td>
                      <td className="px-4 py-3">{w.productName}</td>
                      <td className="px-4 py-3">{w.batchNumber}</td>
                      <td className="px-4 py-3">{w.pullPoint}</td>
                      <td className="px-4 py-3">{w.actualQuantity}</td>
                      <td className="px-4 py-3">{formatDate(w.withdrawalDate)}</td>
                      <td className="px-4 py-3">{w.withdrawnBy}</td>
                      <td className="px-4 py-3">
                        <Link href={`/stability/withdrawals/${w.id}`}>
                          <Button size="sm" variant="outline">
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-4 lg:hidden">
              {pagedHistory.items.map((w) => (
                <div key={w.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-semibold text-slate-900">{w.withdrawalId}</p>
                  <p className="text-sm text-slate-500">
                    {w.productName} · {w.batchNumber} · {w.pullPoint}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Qty {w.actualQuantity} on {formatDate(w.withdrawalDate)}
                  </p>
                  <p className="text-xs text-slate-400">{formatDateTime(w.createdAt)}</p>
                  <Link href={`/stability/withdrawals/${w.id}`} className="mt-3 block">
                    <Button className="w-full" size="sm" variant="outline">
                      View Details
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
            <Pager
              showing={pagedHistory.items.length}
              total={pagedHistory.total}
              page={pagedHistory.page}
              totalPages={pagedHistory.totalPages}
              onPrev={() => setPage((p) => p - 1)}
              onNext={() => setPage((p) => p + 1)}
            />
          </>
        ) : null}
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm sample withdrawal?"
        description={`Withdraw ${qty} unit(s) for ${selectedPull?.productName || "sample"} / ${selectedPull?.pullPoint || ""} on ${formatDate(withdrawalDate)}. Remaining planned after this: ${Math.max(0, remainingPlanned - (hasQty ? qty : 0))}. Inventory and chamber capacity will update.`}
        confirmLabel="Confirm Withdrawal"
        loading={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void onConfirmWithdraw()}
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

export default function WithdrawalsPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={6} />}>
      <WithdrawalsPageInner />
    </Suspense>
  );
}
