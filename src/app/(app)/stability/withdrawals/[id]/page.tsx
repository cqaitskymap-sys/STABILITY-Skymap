"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { PrintMasthead, PrintSheetFooter } from "@/components/print/print-document";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getWithdrawal } from "@/services/inventory";

export default function WithdrawalDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id || "";
  const { data, loading, error, reload } = useAsync(async () => {
    if (!id) return null;
    return getWithdrawal(id);
  }, [id]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="print-page">
      <div className="print:hidden">
        <PageHeader
          title="Withdrawal Record"
          description="QA print-ready sample withdrawal document."
          actions={
            <>
              <Link href="/stability/withdrawals">
                <Button variant="outline">Back</Button>
              </Link>
              {data?.sampleDocId ? (
                <Link href={`/stability/inventory/${data.sampleDocId}`}>
                  <Button variant="outline">View Sample</Button>
                </Link>
              ) : null}
              <Button onClick={handlePrint} disabled={!data}>
                <Printer className="h-4 w-4" />
                Print
              </Button>
            </>
          }
        />
      </div>

      {loading ? <LoadingSkeleton rows={6} /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}
      {!loading && !error && !data ? (
        <EmptyState
          title="Withdrawal record not found"
          description="This withdrawal may have been removed or the link is invalid."
          action={
            <Link href="/stability/withdrawals">
              <Button variant="outline">Back to Withdrawals</Button>
            </Link>
          }
        />
      ) : null}

      {data ? (
        <Card className="overflow-hidden print:border-0 print:shadow-none">
          <PrintMasthead title="Sample Withdrawal Record" documentNumber={data.withdrawalId} department="Quality Assurance" />
          <div className="flex justify-end px-5 pt-3 print:hidden">
            <StatusBadge status="Withdrawn" />
          </div>

          <div className="space-y-6 px-6 py-6">
            <section>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Study / Sample Identification
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Withdrawal ID" value={data.withdrawalId} />
                <Field label="Study ID" value={data.studyId} />
                <Field label="Sample ID" value={data.sampleId} />
                <Field label="Product" value={data.productName} />
                <Field label="Batch Number" value={data.batchNumber} />
                <Field label="Study Type" value={data.studyType} />
                <Field label="Storage Condition" value={data.storageCondition} />
                <Field label="Chamber" value={data.chamberName} />
                <Field label="Location" value={data.locationLabel} />
              </div>
            </section>

            <section className="border-t border-slate-100 pt-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Withdrawal Details
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Pull Point" value={data.pullPoint} />
                <Field label="Planned Quantity" value={String(data.plannedQuantity)} />
                <Field label="Actual Quantity Withdrawn" value={String(data.actualQuantity)} />
                <Field label="Withdrawal Date" value={formatDate(data.withdrawalDate)} />
                <Field label="Withdrawn By" value={data.withdrawnBy} />
                <Field label="Received By" value={data.receivedBy} />
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field label="Remarks" value={data.remarks || "—"} />
                </div>
                <Field label="Created By" value={data.createdByName} />
                <Field label="Created At" value={formatDateTime(data.createdAt)} />
              </div>
            </section>

            <section className="border-t border-slate-100 pt-6">
              <h3 className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Verification & Signatures
              </h3>
              <div className="grid gap-6 sm:grid-cols-3">
                <SignatureBlock title="Withdrawn By" name={data.withdrawnBy} />
                <SignatureBlock title="Received By (QA / Lab)" name={data.receivedBy} />
                <SignatureBlock title="Reviewed / Approved By" name="" />
              </div>
              <p className="mt-6 text-xs text-slate-500">
                This document confirms removal of stability samples from controlled storage. Retain
                with study documentation as per SOP. Recorded {formatDateTime(data.createdAt)}.
              </p>
            </section>
          </div>
          <PrintSheetFooter />
        </Card>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 px-3 py-2 print:rounded-none print:border-slate-300">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}

function SignatureBlock({ title, name }: { title: string; name: string }) {
  return (
    <div className="min-h-[120px] rounded-lg border border-dashed border-slate-300 p-3 print:border-slate-400">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {name ? (
        <p className="mt-2 text-sm font-medium text-slate-800">{name}</p>
      ) : (
        <p className="mt-2 text-sm text-slate-400">Name</p>
      )}
      <div className="mt-8 border-b border-slate-400" />
      <p className="mt-2 text-xs text-slate-500">Signature / Date</p>
    </div>
  );
}
