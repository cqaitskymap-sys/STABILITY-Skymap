"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { Boxes, Printer } from "lucide-react";
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
import {
  getStudy,
  listPullPoints,
  listSamplesByStudy,
  listTransactionsByStudy,
} from "@/services/inventory";

export default function StudyDetailPage() {
  const params = useParams<{ id: string }>();
  const studyDocId = params?.id ?? "";
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "SKYMAP Stability";

  const detail = useAsync(async () => {
    if (!studyDocId) return null;
    const study = await getStudy(studyDocId);
    if (!study) return null;
    const [pulls, samples, transactions] = await Promise.all([
      listPullPoints({ studyDocId: study.id }),
      listSamplesByStudy(study.id),
      listTransactionsByStudy(study.studyId),
    ]);
    return {
      study,
      pulls: pulls
        .map((p) => ({
          ...p,
          status: derivePullStatus(p.plannedDate, p.actualQuantity, p.plannedQuantity),
        }))
        .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)),
      samples,
      transactions,
    };
  }, [studyDocId]);

  if (detail.loading) return <LoadingSkeleton rows={8} />;
  if (detail.error) return <ErrorState message={detail.error} onRetry={detail.reload} />;
  if (!detail.data) {
    return (
      <EmptyState
        title="Study not found"
        description="This stability study may have been removed."
        action={
          <Link href="/stability/studies">
            <Button variant="outline">Back to Studies</Button>
          </Link>
        }
      />
    );
  }

  const { study, pulls, samples, transactions } = detail.data;
  const primarySample = samples[0];

  return (
    <div>
      <PageHeader
        title={study.studyId}
        description={`${study.productName} · ${study.batchNumber} · ${study.studyType}`}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            {primarySample ? (
              <Link href={`/stability/inventory/${primarySample.id}`}>
                <Button variant="outline">
                  <Boxes className="h-4 w-4" />
                  Inventory
                </Button>
              </Link>
            ) : (
              <Link href="/stability/inventory">
                <Button variant="outline">
                  <Boxes className="h-4 w-4" />
                  Inventory
                </Button>
              </Link>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        }
      />

      <div className="mb-4 hidden print:block">
        <p className="text-lg font-semibold text-slate-900">{companyName}</p>
        <p className="text-sm text-slate-500">Stability Study Summary</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Study Summary" />
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Info label="Study ID" value={study.studyId} />
            <Info label="Status" value={<StatusBadge status={study.status} />} />
            <Info label="Product" value={study.productName} />
            <Info label="Batch" value={study.batchNumber} />
            <Info label="Study Type" value={study.studyType} />
            <Info label="Duration" value={study.duration} />
            <Info label="Storage Condition" value={study.storageCondition} />
            <Info label="Charging Date" value={formatDate(study.chargingDate)} />
            <Info label="Manufacturing Date" value={formatDate(study.manufacturingDate)} />
            <Info label="Expiry Date" value={formatDate(study.expiryDate)} />
            <Info label="Chamber" value={study.chamberName} />
            <Info label="Location" value={study.locationLabel} />
            <Info label="Next Pull" value={formatDate(study.nextPullDate)} />
            <Info label="Created By" value={study.createdByName} />
          </div>
          {study.notes ? (
            <div className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Notes: </span>
              {study.notes}
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader title="Inventory Balance" />
          <div className="space-y-3 p-4 text-sm">
            <Qty label="Total" value={`${study.totalQuantity} ${study.unit}`} />
            <Qty label="Reserved" value={`${study.reservedQuantity} ${study.unit}`} />
            <Qty label="Available" value={`${study.availableQuantity} ${study.unit}`} highlight />
            <Qty label="Withdrawn" value={`${study.withdrawnQuantity} ${study.unit}`} />
            <Qty label="Disposed" value={`${study.disposedQuantity} ${study.unit}`} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-slate-500">Linked samples</p>
              <p className="mt-1 font-semibold text-slate-900">{samples.length}</p>
              {samples.map((s) => (
                <Link
                  key={s.id}
                  href={`/stability/inventory/${s.id}`}
                  className="mt-2 block text-teal-700 hover:underline print:no-underline"
                >
                  {s.sampleId}
                </Link>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Pull Points"
          description="Planned withdrawal schedule for this study."
          action={<Badge tone="teal">{pulls.length}</Badge>}
        />
        {!pulls.length ? (
          <EmptyState title="No pull points for this study." />
        ) : (
          <>
          <div className="hidden overflow-x-auto md:block print:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Pull Point</th>
                  <th className="px-4 py-3">Sample</th>
                  <th className="px-4 py-3">Planned Date</th>
                  <th className="px-4 py-3">Planned</th>
                  <th className="px-4 py-3">Actual</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 print:hidden">Action</th>
                </tr>
              </thead>
              <tbody>
                {pulls.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium">{p.pullPoint}</td>
                    <td className="px-4 py-3">{p.sampleId}</td>
                    <td className="px-4 py-3">{formatDate(p.plannedDate)}</td>
                    <td className="px-4 py-3">{p.plannedQuantity}</td>
                    <td className="px-4 py-3">{p.actualQuantity}</td>
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
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{p.pullPoint}</p>
                    <p className="text-sm text-slate-500">{p.sampleId} · Due {formatDate(p.plannedDate)}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Planned {p.plannedQuantity} · Actual {p.actualQuantity}
                </p>
                {p.status !== "Withdrawn" ? (
                  <Link href={`/stability/withdrawals?pull=${p.id}`} className="mt-3 block">
                    <Button size="sm" variant="outline" className="w-full">
                      Withdraw
                    </Button>
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
          </>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Transactions"
          description="Inventory transactions filtered by this study."
          action={<Badge tone="slate">{transactions.length}</Badge>}
        />
        {!transactions.length ? (
          <EmptyState title="No transactions recorded for this study." />
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-slate-900">{tx.transactionType.replaceAll("_", " ")}</p>
                  <p className="text-slate-500">
                    {tx.sampleId} · Qty {tx.quantity}
                    {tx.reason ? ` · ${tx.reason}` : ""}
                  </p>
                  <p className="text-xs text-slate-400">
                    {tx.performedByName} · {formatDateTime(tx.performedAt)}
                  </p>
                </div>
                <Badge tone="slate">{tx.transactionId}</Badge>
              </div>
            ))}
          </div>
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

function Qty({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={highlight ? "font-semibold text-teal-800" : "font-medium text-slate-900"}>
        {value}
      </span>
    </div>
  );
}
