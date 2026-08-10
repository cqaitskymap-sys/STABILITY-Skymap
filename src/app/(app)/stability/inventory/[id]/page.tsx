"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeftRight, ClipboardCheck, PackageMinus, Printer } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { derivePullStatus, formatDate, formatDateTime } from "@/lib/utils";
import { getSample, listPullPoints } from "@/services/inventory";

export default function SampleDetailPage() {
  const params = useParams<{ id: string }>();
  const sampleId = params?.id ?? "";
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "SKYMAP Stability";

  const detail = useAsync(async () => {
    if (!sampleId) return null;
    const sample = await getSample(sampleId);
    if (!sample) return null;
    const pulls = await listPullPoints({ sampleDocId: sample.id });
    return {
      sample,
      pulls: pulls.map((p) => ({
        ...p,
        status: derivePullStatus(p.plannedDate, p.actualQuantity, p.plannedQuantity),
      })),
    };
  }, [sampleId]);

  if (detail.loading) return <LoadingSkeleton rows={8} />;
  if (detail.error) return <ErrorState message={detail.error} onRetry={detail.reload} />;
  if (!detail.data) {
    return (
      <EmptyState
        title="Sample not found"
        description="This inventory record may have been removed."
        action={
          <Link href="/stability/inventory">
            <Button variant="outline">Back to Inventory</Button>
          </Link>
        }
      />
    );
  }

  const { sample, pulls } = detail.data;

  return (
    <div>
      <PageHeader
        title={sample.sampleId}
        description={`${sample.productName} · ${sample.batchNumber} · Study ${sample.studyId}`}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Link href={`/stability/withdrawals?sample=${sample.id}`}>
              <Button variant="outline">
                <PackageMinus className="h-4 w-4" />
                Withdraw
              </Button>
            </Link>
            <Link href={`/stability/inventory/movement?sample=${sample.id}`}>
              <Button variant="outline">
                <ArrowLeftRight className="h-4 w-4" />
                Move
              </Button>
            </Link>
            <Link href={`/stability/reconciliation?sample=${sample.id}`}>
              <Button variant="outline">
                <ClipboardCheck className="h-4 w-4" />
                Reconcile
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        }
      />

      <div className="print-only mb-4 hidden print:block">
        <p className="text-lg font-semibold text-slate-900">{companyName}</p>
        <p className="text-sm text-slate-500">Stability Sample Inventory Record</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Sample Summary" description="Charged inventory balance and study linkage." />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Info label="Sample ID" value={sample.sampleId} />
            <Info label="Study ID" value={sample.studyId} />
            <Info label="Product" value={sample.productName} />
            <Info label="Batch" value={sample.batchNumber} />
            <Info label="Study Type" value={sample.studyType} />
            <Info label="Storage Condition" value={sample.storageCondition} />
            <Info label="Manufacturing Date" value={formatDate(sample.manufacturingDate)} />
            <Info label="Expiry Date" value={formatDate(sample.expiryDate)} />
            <Info label="Date of Charging" value={formatDate(sample.chargingDate)} />
            <Info label="Next Pull" value={formatDate(sample.nextPullDate)} />
            <Info label="Status" value={<StatusBadge status={sample.status} />} />
            <Info label="Created By" value={sample.createdByName} />
          </div>
          {sample.notes ? (
            <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Notes: </span>
              {sample.notes}
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Quantities & Location" />
          <div className="space-y-3 p-4">
            <QtyRow label="Total" value={`${sample.totalQuantity} ${sample.unit}`} />
            <QtyRow label="Reserved" value={`${sample.reservedQuantity} ${sample.unit}`} />
            <QtyRow label="Available" value={`${sample.availableQuantity} ${sample.unit}`} highlight />
            <QtyRow label="Withdrawn" value={`${sample.withdrawnQuantity} ${sample.unit}`} />
            <QtyRow label="Disposed" value={`${sample.disposedQuantity} ${sample.unit}`} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-slate-500">Chamber</p>
              <p className="font-medium text-slate-900">{sample.chamberName}</p>
              <p className="mt-2 text-slate-500">Location</p>
              <p className="font-medium text-slate-900">{sample.locationLabel}</p>
            </div>
            <Link href={`/stability/studies/${sample.studyDocId}`} className="block print:hidden">
              <Button variant="outline" className="w-full" size="sm">
                Open Study
              </Button>
            </Link>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Pull Point Matrix"
          description="Planned versus actual withdrawals for this sample."
          action={<Badge tone="teal">{pulls.length} points</Badge>}
        />
        {!pulls.length ? (
          <EmptyState title="No pull points allocated for this sample." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Pull Point</th>
                    <th className="px-4 py-3">Planned Date</th>
                    <th className="px-4 py-3">Planned Qty</th>
                    <th className="px-4 py-3">Actual Qty</th>
                    <th className="px-4 py-3">Completed</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pulls.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium">{p.pullPoint}</td>
                      <td className="px-4 py-3">{formatDate(p.plannedDate)}</td>
                      <td className="px-4 py-3">{p.plannedQuantity}</td>
                      <td className="px-4 py-3">{p.actualQuantity}</td>
                      <td className="px-4 py-3">{formatDate(p.completedDate)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3 print:hidden">
                        {p.status !== "Withdrawn" ? (
                          <Link href={`/stability/withdrawals?pull=${p.id}`}>
                            <Button size="sm" variant="outline">
                              Withdraw
                            </Button>
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 p-4 md:hidden print:hidden">
              {pulls.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{p.pullPoint}</p>
                      <p className="text-sm text-slate-500">Due {formatDate(p.plannedDate)}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Planned {p.plannedQuantity} · Actual {p.actualQuantity}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <p className="mt-4 hidden text-xs text-slate-400 print:block">
        Printed {formatDateTime(new Date().toISOString())} · {companyName}
      </p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}

function QtyRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={highlight ? "font-semibold text-teal-800" : "font-medium text-slate-900"}>
        {value}
      </span>
    </div>
  );
}
