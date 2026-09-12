"use client";

import { Card, EmptyState, ErrorState, Input, LoadingSkeleton, PageHeader } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime } from "@/lib/utils";
import { listAuditLogs } from "@/services/audit";
import { useMemo, useState } from "react";

export default function AuditTrailPage() {
  const { hasPermission } = useAuth();
  const can = hasPermission("audit.view");
  const logs = useAsync(async () => (can ? listAuditLogs(300) : []), [can]);
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (logs.data || []).filter((row) =>
      !term ||
      [row.action, row.module, row.recordType, row.recordId, row.userName, row.reason]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [logs.data, q]);

  if (!can) {
    return (
      <div>
        <PageHeader title="Audit Trail" description="Immutable activity history." />
        <EmptyState title="No permission" description="Ask an Admin to grant Audit Trail access." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Audit Trail" description="Create/edit/approve/charge/withdraw and configuration changes. Records cannot be edited or deleted by normal users." />
      <Card className="mb-4 p-4">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search action, module, record, user…" />
      </Card>
      {logs.loading ? <LoadingSkeleton rows={8} /> : null}
      {logs.error ? <ErrorState message={logs.error} onRetry={logs.reload} /> : null}
      {!logs.loading && !filtered.length ? <EmptyState title="No audit records match" /> : null}
      <div className="space-y-2">
        {filtered.map((row) => (
          <Card key={row.id} className="p-4 text-sm">
            <p className="font-semibold text-slate-900">{row.action} {row.module ? `· ${row.module}` : ""}</p>
            <p className="text-slate-500">
              {formatDateTime(row.createdAt)} · {row.userName} {row.userRole ? `(${row.userRole})` : ""} · {row.recordType || "—"} {row.recordId || ""}
            </p>
            {row.reason ? <p className="mt-1 text-slate-600">Reason: {row.reason}</p> : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
