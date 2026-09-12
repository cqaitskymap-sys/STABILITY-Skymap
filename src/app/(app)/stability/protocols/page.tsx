"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardHeader, EmptyState, Input, PageHeader, Textarea } from "@/components/ui";
import { SignatureModal } from "@/components/approval/signature-modal";
import { PrintDocument } from "@/components/print/print-document";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { PROTOCOL_SECTIONS } from "@/lib/sop";
import { friendlyError } from "@/lib/utils";
import { createProtocol, listProtocols } from "@/services/documents";

export default function ProtocolsPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("protocol.manage");
  const rows = useAsync(listProtocols, []);
  const [productName, setProductName] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [sections, setSections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [signRecord, setSignRecord] = useState<{ id: string; meaning: "Prepared By" | "Checked By" | "Approved By" } | null>(null);

  async function save() {
    if (!profile || !can) return;
    if (!productName.trim()) return toast.error("Product name is required.");
    setSaving(true);
    try {
      await createProtocol({ productName, batchNumber, sections, user: profile });
      toast.success("Protocol draft created with configurable numbering.");
      setProductName("");
      await rows.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Stability Study Protocol" description="Structured protocol record. This is not a QC laboratory system." />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="New protocol" />
          <div className="grid gap-3 p-4">
            <Input label="Product name" required value={productName} onChange={(e) => setProductName(e.target.value)} disabled={!can} />
            <Input label="Batch number" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} disabled={!can} />
            {PROTOCOL_SECTIONS.map((section) => (
              <Textarea
                key={section}
                label={section}
                value={sections[section] || ""}
                onChange={(e) => setSections((s) => ({ ...s, [section]: e.target.value }))}
                disabled={!can}
              />
            ))}
            {can ? <Button onClick={() => void save()} loading={saving}>Save draft</Button> : null}
          </div>
        </Card>
        <Card>
          <CardHeader title="Protocols" />
          {!(rows.data || []).length ? <EmptyState title="No protocols yet" /> : (
            <div className="space-y-4 p-4">
              {(rows.data || []).map((p) => (
                <PrintDocument key={p.id} title="Stability Study Protocol" documentNumber={p.protocolNumber}>
                  <p className="mb-3 text-sm text-slate-600">{p.productName} {p.batchNumber ? `· ${p.batchNumber}` : ""} · {p.status}</p>
                  {PROTOCOL_SECTIONS.map((section) => (
                    <section key={section} className="mb-3">
                      <h3 className="text-sm font-semibold text-slate-900">{section}</h3>
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{p.sections[section] || "—"}</p>
                    </section>
                  ))}
                  <div className="mt-3 flex flex-wrap gap-2 print:hidden">
                    <Button size="sm" variant="outline" onClick={() => setSignRecord({ id: p.protocolNumber, meaning: "Prepared By" })}>
                      Prepared By
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setSignRecord({ id: p.protocolNumber, meaning: "Checked By" })}>
                      Checked By
                    </Button>
                    <Button size="sm" onClick={() => setSignRecord({ id: p.protocolNumber, meaning: "Approved By" })}>
                      Approved By
                    </Button>
                  </div>
                </PrintDocument>
              ))}
            </div>
          )}
        </Card>
      </div>
      <SignatureModal
        open={!!signRecord}
        recordType="stabilityProtocol"
        recordId={signRecord?.id || ""}
        meaning={signRecord?.meaning || "Prepared By"}
        onClose={() => setSignRecord(null)}
      />
    </div>
  );
}
