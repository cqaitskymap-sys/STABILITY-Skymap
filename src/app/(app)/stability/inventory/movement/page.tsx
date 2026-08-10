"use client";

import { useMemo, useState } from "react";
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
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, formatDateTime, friendlyError, paginate, todayISO } from "@/lib/utils";
import { listMovements, listSamples, moveSample } from "@/services/inventory";
import { listChambers, listLocations } from "@/services/masters";

export default function MovementPage() {
  const { profile } = useAuth();
  const samples = useAsync(listSamples, []);
  const chambers = useAsync(listChambers, []);
  const locations = useAsync(listLocations, []);
  const movements = useAsync(listMovements, []);

  const [sampleDocId, setSampleDocId] = useState("");
  const [toChamberId, setToChamberId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [movementDate, setMovementDate] = useState(todayISO());
  const [movedBy, setMovedBy] = useState(profile?.displayName || "");
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const movedByValue = movedBy || profile?.displayName || "";

  const selectedSample = useMemo(
    () => (samples.data || []).find((s) => s.id === sampleDocId) || null,
    [samples.data, sampleDocId]
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

  const maintenanceWarning =
    destinationChamber?.status === "Under Maintenance"
      ? "Destination chamber is Under Maintenance. Proceed only if authorized."
      : null;

  const validationError = !selectedSample
    ? "Select a sample to move."
    : !toChamberId
      ? "Select a destination chamber."
      : destinationChamber?.status === "Inactive"
        ? "Cannot move samples to an inactive chamber."
        : !toLocationId
          ? "Select a destination location."
          : !movementDate
            ? "Movement date is required."
            : !movedByValue.trim()
              ? "Moved by is required."
              : !reason.trim()
                ? "Reason is required."
                : selectedSample.chamberId === toChamberId && selectedSample.locationId === toLocationId
                  ? "Destination must differ from the current location."
                  : null;

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
      setReason("");
      setRemarks("");
      setToChamberId("");
      setToLocationId("");
      await Promise.all([samples.reload(), movements.reload()]);
    } catch (err) {
      toast.error(friendlyError(err, err instanceof Error ? err.message : "Unable to move sample."));
    } finally {
      setSaving(false);
    }
  }

  const paged = paginate(movements.data || [], page, 10);

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

      <Card className="mb-6">
        <CardHeader title="Move Sample" description="Select a sample and destination, then confirm the transfer." />
        <div className="space-y-5 p-4 sm:p-5">
          {(samples.loading || chambers.loading || locations.loading) && !selectedSample ? (
            <LoadingSkeleton rows={3} />
          ) : null}
          {samples.error ? <ErrorState message={samples.error} onRetry={samples.reload} /> : null}

          <Select
            label="Sample"
            required
            value={sampleDocId}
            onChange={(e) => setSampleDocId(e.target.value)}
          >
            <option value="">Select sample…</option>
            {(samples.data || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.sampleId} — {s.productName} / {s.batchNumber} ({s.availableQuantity} {s.unit})
              </option>
            ))}
          </Select>

          {selectedSample ? (
            <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Current Chamber" value={selectedSample.chamberName} />
              <Info label="Current Location" value={selectedSample.locationLabel} />
              <Info label="Available" value={`${selectedSample.availableQuantity} ${selectedSample.unit}`} />
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
                <div className="mt-1">
                  <StatusBadge status={selectedSample.status} />
                </div>
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
              error={destinationChamber?.status === "Inactive" ? "Chamber is inactive" : undefined}
            >
              <option value="">Select chamber…</option>
              {(chambers.data || []).map((c) => (
                <option key={c.id} value={c.id} disabled={c.status === "Inactive"}>
                  {c.chamberName} ({c.status})
                </option>
              ))}
            </Select>
            <Select
              label="New Location"
              required
              value={toLocationId}
              onChange={(e) => setToLocationId(e.target.value)}
              disabled={!toChamberId}
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
              <ArrowLeftRight className="h-4 w-4" />
              Move Sample
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Movement History" description="Past chamber and location transfers." />
        {movements.loading ? <LoadingSkeleton /> : null}
        {movements.error ? <ErrorState message={movements.error} onRetry={movements.reload} /> : null}
        {!movements.loading && !movements.error && paged.items.length === 0 ? (
          <EmptyState title="No movements recorded" description="Transfers will appear here after confirmation." />
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
                        {m.sampleId}
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
                    {m.sampleId} · {m.productName}
                  </p>
                  <p className="mt-2">
                    {m.fromLocationLabel} → {m.toLocationLabel}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatDate(m.movementDate)} · {m.movedBy}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(m.createdAt)}</p>
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
        title="Confirm sample movement?"
        description={`Move ${selectedSample?.sampleId || "sample"} from ${selectedSample?.locationLabel || "—"} to ${destinationLocation?.label || "—"}${maintenanceWarning ? " (chamber under maintenance)" : ""}.`}
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
