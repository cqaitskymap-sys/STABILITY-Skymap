"use client";

import { toast } from "sonner";
import { Button, Card, EmptyState, ErrorState, LoadingSkeleton, PageHeader, StatusBadge } from "@/components/ui";
import { PrintDocument, PrintFieldGrid } from "@/components/print/print-document";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, friendlyError } from "@/lib/utils";
import { completeAnalysisRequest, listAnalysisRequests } from "@/services/analysis";
import { useState } from "react";

export default function AnalysisRequestsPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("analysis.perform");
  const rows = useAsync(listAnalysisRequests, []);
  const [printId, setPrintId] = useState<string | null>(null);
  const printRow = (rows.data || []).find((r) => r.id === printId);

  return (
    <div>
      <PageHeader
        title="Analysis Request for Stability Study Sample"
        description="Handoff to QC only — this is not a LIMS. Timelines default to +21 days (accelerated) and +30 days (long term) and are configurable."
      />
      {rows.loading ? <LoadingSkeleton rows={6} /> : null}
      {rows.error ? <ErrorState message={rows.error} onRetry={rows.reload} /> : null}
      {!rows.loading && !(rows.data || []).length ? (
        <EmptyState title="No analysis requests" description="Requests are created when a stability sample is withdrawn." />
      ) : null}
      <div className="space-y-3">
        {(rows.data || []).map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.requestId} · {r.productName} / {r.batchNumber}</p>
                <p className="text-sm text-slate-500">
                  {r.studyType} · {r.stage} · analysis due {formatDate(r.analysisDueDate)} · qty {r.sampleQuantity}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setPrintId(r.id)}>Print request</Button>
              {can && r.status !== "Completed" && r.status !== "Cancelled" ? (
                <Button
                  size="sm"
                  onClick={() => {
                    if (!profile) return;
                    completeAnalysisRequest(r.id, profile)
                      .then(() => {
                        toast.success("Marked completed.");
                        void rows.reload();
                      })
                      .catch((err) => toast.error(friendlyError(err)));
                  }}
                >
                  Mark completed
                </Button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
      {printRow ? (
        <div className="mt-6">
          <PrintDocument title="Analysis Request for Stability Study Sample" documentNumber={printRow.requestId}>
            <PrintFieldGrid
              rows={[
                { label: "Date", value: formatDate(printRow.date) },
                { label: "Product Name", value: printRow.productName },
                { label: "Batch No.", value: printRow.batchNumber },
                { label: "Sample Quantity", value: printRow.sampleQuantity },
                { label: "Type of Stability", value: printRow.studyType },
                { label: "Stage / Month", value: printRow.stage },
                { label: "Due Date", value: formatDate(printRow.dueDate) },
                { label: "Analysis due", value: formatDate(printRow.analysisDueDate) },
                { label: "Analysis Required", value: printRow.analysisRequired },
                { label: "QA Officer", value: printRow.qaOfficer },
                { label: "QC Officer", value: printRow.qcOfficer },
              ]}
            />
          </PrintDocument>
        </div>
      ) : null}
    </div>
  );
}
