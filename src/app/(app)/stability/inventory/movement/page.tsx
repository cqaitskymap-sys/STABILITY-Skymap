"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeftRight, RefreshCw } from "lucide-react";
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
import { listMovements, listSamples, moveSample } from "@/services/inventory";
import { listChambers, listLocations } from "@/services/masters";

function MovementPageInner() {
  const searchParams = useSearchParams();
  const sampleFromUrl = searchParams.get("sample") || "";
  const { profile, hasPermission } = useAuth();
  const canMove = hasPermission("movement.perform");

  const samples = useAsync(listSamples, []);
  const chambers = useAsync(listChambers, []);
  const locations = useAsync(listLocations, []);
  const movements = useAsync(listMovements, []);

  const [sampleDocId, setSampleDocId] = useState(sampleFromUrl);
  const [toChamberId, setToChamberId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [movementDate, setMovementDate] = useState(todayISO());
  const [movedBy, setMovedBy] = useState(profile?.displayName || "");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (sampleFromUrl) setSampleDocId(sampleFromUrl);
  }, [sampleFromUrl]);

  useEffect(() => {
    if (profile?.displayName && !movedBy) {
      setMovedBy(profile.displayName);
    }
  }, [profile?.displayName, movedBy]);

  useEffect(() => {
    if (!sampleFromUrl || !samples.data?.length) return;
    const match = samples.data.find((s) => s.id === sampleFromUrl);
    if (!match) {
      toast.error("Linked sample was not found. Select a sample to move.");
      setSampleDocId("");
      return;
    }
    if (match.status === "Disposed") {
      toast.error("Disposed samples cannot be moved.");
      setSampleDocId("");
    }
  }, [sampleFromUrl, samples.data]);

  const movedByValue = movedBy || profile?.displayName || "";

  const movableSamples = useMemo(
    () => (samples.data || []).filter((s) => s.status !== "Disposed"),
    [samples.data]
  );

  const selectedSample = useMemo(
    () => movableSamples.find((s) => s.id === sampleDocId) || null,
    [movableSamples, sampleDocId]
  );

  const activeChambers = useMemo(
    () => (chambers.data || []).filter((c) => c.status !== "Inactive"),
    [chambers.data]
  );

  const destinationChamber = useMemo(
    () => (chambers.data || []).find((c) => c.id === toChamberId) || null,
    [chambers.data, toChamberId]
  );

  const filteredLocations = useMemo(() => {
    return (locations.data || []).filter((l) => l.chamberId === toChamberId && l.status === "Active");
  }, [locations.data, toChamberId]);

  const destinationLocation = useMemo(
    () => filteredLocations.find((l) => l.id === toLocationId) || null,
    [filteredLocations, toLocationId]
  );

  const changingChamber =
    !!selectedSample && !!toChamberId && selectedSample.chamberId !== toChamberId;
  const destFree = destinationChamber
    ? Math.max(0, Number(destinationChamber.capacity || 0) - Number(destinationChamber.usedCapacity || 0))
    : 0;
  const moveQty = selectedSample?.availableQuantity ?? 0;
  const capacityShort =
    changingChamber && destinationChamber && moveQty > destFree
      ? `Need ${moveQty} free capacity; destination has ${destFree}.`
      : null;

  const maintenanceWarning =
    destinationChamber?.status === "Under Maintenance"
      ? "Destination chamber is Under Maintenance. Proceed only if authorized."
      : null;

  const mastersReady = activeChambers.length > 0 && (locations.data || []).some((l) => l.status === "Active");

  const validationError = !canMove
    ? "You do not have permission to move samples."
    : !mastersReady
      ? "Configure active chambers and locations before moving samples."
      : !selectedSample
        ? "Select a sample to move."
        : selectedSample.status === "Disposed"
          ? "Disposed samples cannot be moved."
          : !toChamberId
            ? "Select a destination chamber."
            : destinationChamber?.status === "Inactive"
              ? "Cannot move samples to an inactive chamber."
              : !toLocationId
                ? "Select a destination location."
                : filteredLocations.length === 0
                  ? "No active locations for this chamber."
                  : !destinationLocation
                    ? "Select a valid destination location."
                    : !movementDate
                      ? "Movement date is required."
                      : !movedByValue.trim()
                        ? "Moved by is required."
                        : !reason.trim()
                          ? "Reason is required."
                          : selectedSample.chamberId === toChamberId &&
                              selectedSample.locationId === toLocationId
                            ? "Destination must differ from the current location."
                            : capacityShort
                              ? capacityShort
                              : null;

  function resetForm(keepSample = true) {
    if (!keepSample) setSampleDocId("");
    setToChamberId("");
    setToLocationId("");
    setReason("");
    setRemarks("");
    setMovementDate(todayISO());
  }

  async function onConfirmMove() {
    if (!profile || !selectedSample || !destinationChamber || !destinationLocation || validationError) return;
    setSaving(true);
    try {
      const result = await moveSample({
        sampleDocId: selectedSample.id,
        toChamberId: destinationChamber.id,
        toChamberName: destinationChamber.chamberName,
        toLocationId: destinationLocation.id,
        toLocationLabel: destinationLocation.label,
        movementDate,
        movedBy: movedByValue.trim(),
        reason: reason.trim(),
        remarks: remarks.trim() || undefined,
        user: profile,
      });
      toast.success(`Movement ${result.movementId} recorded successfully.`);
      setConfirmOpen(false);
      resetForm(true);
      await Promise.all([samples.reload(), chambers.reload(), movements.reload()]);
    } catch (err) {
      toast.error(friendlyError(err, err instanceof Error ? err.message : "Unable to move sample."));
    } finally {
      setSaving(false);
    }
  }

  const paged = paginate(movements.data || [], page, 10);
  const formLoading =
    (samples.loading || chambers.loading || locations.loading) && !selectedSample;

  return (
    <div>
      <PageHeader
        title="Sample Movement"
        description="Transfer samples between chambers and storage locations with full audit history."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void samples.reload();
              void chambers.reload();
              void locations.reload();
              void movements.reload();
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {!canMove ? (
        <Card className="mb-6">
          <EmptyState
            title="Movement permission required"
            description="Ask an Admin to grant the Movement module on your account."
          />
        </Card>
      ) : null}

      {canMove ? (
        <Card className="mb-6">
          <CardHeader title="Move Sample" description="Select a sample and destination, then confirm the transfer." />
          <div className="space-y-5 p-4 sm:p-5">
            {formLoading ? <LoadingSkeleton rows={3} /> : null}
            {samples.error ? <ErrorState message={samples.error} onRetry={samples.reload} /> : null}
            {chambers.error ? <ErrorState message={chambers.error} onRetry={chambers.reload} /> : null}
            {locations.error ? <ErrorState message={locations.error} onRetry={locations.reload} /> : null}

            {!formLoading && !samples.error && movableSamples.length === 0 ? (
              <EmptyState
                title="No movable samples"
                description="Charge a sample into inventory first. Disposed samples cannot be moved."
                action={
                  <Link href="/stability/inventory/charging">
                    <Button variant="outline">Sample Charging</Button>
                  </Link>
                }
              />
            ) : null}

            {!formLoading && !chambers.error && !locations.error && movableSamples.length > 0 && !mastersReady ? (
              <EmptyState
                title="Chambers / locations not ready"
                description="Add at least one active chamber and storage location before transferring samples."
                action={
                  <Link href="/masters/chambers">
                    <Button variant="outline">Open Chambers</Button>
                  </Link>
                }
              />
            ) : null}

            {movableSamples.length > 0 && mastersReady ? (
              <>
                <Select
                  label="Sample"
                  required
                  value={sampleDocId}
                  onChange={(e) => {
                    setSampleDocId(e.target.value);
                    setToChamberId("");
                    setToLocationId("");
                  }}
                >
                  <option value="">Select sample…</option>
                  {movableSamples.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.sampleId} — {s.productName} / {s.batchNumber} ({s.availableQuantity} {s.unit})
                    </option>
                  ))}
                </Select>

                {selectedSample ? (
                  <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <Info label="Current Chamber" value={selectedSample.chamberName} />
                    <Info label="Current Location" value={selectedSample.locationLabel} />
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
                    <div className="sm:col-span-2 lg:col-span-4">
                      <Link
                        href={`/stability/inventory/${selectedSample.id}`}
                        className="text-sm font-medium text-teal-800 hover:underline"
                      >
                        View sample detail
                      </Link>
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <Select
                    label="New Chamber"
                    required
                    value={toChamberId}
                    onChange={(e) => {
                      setToChamberId(e.target.value);
                      setToLocationId("");
                    }}
                    error={
                      destinationChamber?.status === "Inactive"
                        ? "Chamber is inactive"
                        : capacityShort || undefined
                    }
                    hint={
                      destinationChamber
                        ? `Capacity ${destinationChamber.usedCapacity}/${destinationChamber.capacity} (free ${destFree})`
                        : undefined
                    }
                  >
                    <option value="">Select chamber…</option>
                    {(chambers.data || []).map((c) => (
                      <option key={c.id} value={c.id} disabled={c.status === "Inactive"}>
                        {c.chamberName} ({c.status}) · free{" "}
                        {Math.max(0, Number(c.capacity || 0) - Number(c.usedCapacity || 0))}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label="New Location"
                    required
                    value={toLocationId}
                    onChange={(e) => setToLocationId(e.target.value)}
                    disabled={!toChamberId}
                    hint={
                      toChamberId && filteredLocations.length === 0
                        ? "No active locations for this chamber"
                        : undefined
                    }
                  >
                    <option value="">{toChamberId ? "Select location…" : "Select chamber first…"}</option>
                    {filteredLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Movement Date"
                    type="date"
                    required
                    value={movementDate}
                    onChange={(e) => setMovementDate(e.target.value)}
                  />
                  <Input
                    label="Moved By"
                    required
                    value={movedByValue}
                    onChange={(e) => setMovedBy(e.target.value)}
                  />
                  <Input
                    label="Reason"
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Chamber capacity rebalance"
                  />
                  <Textarea
                    label="Remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional remarks"
                  />
                </div>

                {maintenanceWarning ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {maintenanceWarning}
                  </p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  {selectedSample || toChamberId || reason ? (
                    <Button variant="outline" type="button" onClick={() => resetForm(false)}>
                      Clear
                    </Button>
                  ) : null}
                  <Button
                    onClick={() => {
                      if (validationError) {
                        toast.error(validationError);
                        return;
                      }
                      setConfirmOpen(true);
                    }}
                  >
                    <ArrowLeftRight className="h-4 w-4" />
                    Move Sample
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Movement History" description="Past chamber and location transfers." />
        {movements.loading ? <LoadingSkeleton /> : null}
        {movements.error ? <ErrorState message={movements.error} onRetry={movements.reload} /> : null}
        {!movements.loading && !movements.error && paged.items.length === 0 ? (
          <EmptyState
            title="No movements recorded"
            description="Transfers will appear here after confirmation."
          />
        ) : null}
        {!movements.loading && !movements.error && paged.items.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Movement ID</th>
                    <th className="px-4 py-3">Sample</th>
                    <th className="px-4 py-3">From</th>
                    <th className="px-4 py-3">To</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Moved By</th>
                    <th className="px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((m) => (
                    <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-teal-800">{m.movementId}</td>
                      <td className="px-4 py-3">
                        {m.sampleDocId ? (
                          <Link
                            href={`/stability/inventory/${m.sampleDocId}`}
                            className="font-medium text-teal-800 hover:underline"
                          >
                            {m.sampleId}
                          </Link>
                        ) : (
                          m.sampleId
                        )}
                        <div className="text-xs text-slate-500">
                          {m.productName} / {m.batchNumber}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {m.fromChamberName}
                        <div className="text-xs text-slate-500">{m.fromLocationLabel}</div>
                      </td>
                      <td className="px-4 py-3">
                        {m.toChamberName}
                        <div className="text-xs text-slate-500">{m.toLocationLabel}</div>
                      </td>
                      <td className="px-4 py-3">{formatDate(m.movementDate)}</td>
                      <td className="px-4 py-3">{m.movedBy}</td>
                      <td className="px-4 py-3">{m.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-4 lg:hidden">
              {paged.items.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200 p-4 text-sm">
                  <p className="font-semibold text-slate-900">{m.movementId}</p>
                  <p className="text-slate-500">
                    {m.sampleDocId ? (
                      <Link
                        href={`/stability/inventory/${m.sampleDocId}`}
                        className="text-teal-800 hover:underline"
                      >
                        {m.sampleId}
                      </Link>
                    ) : (
                      m.sampleId
                    )}{" "}
                    · {m.productName}
                  </p>
                  <p className="mt-2">
                    {m.fromChamberName} / {m.fromLocationLabel} → {m.toChamberName} / {m.toLocationLabel}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(m.movementDate)} · {m.movedBy}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(m.createdAt)}</p>
                  {m.reason ? <p className="mt-1 text-xs text-slate-500">{m.reason}</p> : null}
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
        title="Confirm sample movement?"
        description={`Move ${selectedSample?.sampleId || "sample"} from ${selectedSample?.chamberName || "—"} / ${selectedSample?.locationLabel || "—"} to ${destinationChamber?.chamberName || "—"} / ${destinationLocation?.label || "—"}${changingChamber ? ` (transfer ${moveQty} capacity)` : ""}${maintenanceWarning ? " — chamber under maintenance" : ""}.`}
        confirmLabel="Confirm Move"
        loading={saving}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void onConfirmMove()}
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

export default function MovementPage() {
  return (
    <Suspense fallback={<LoadingSkeleton rows={6} />}>
      <MovementPageInner />
    </Suspense>
  );
}
