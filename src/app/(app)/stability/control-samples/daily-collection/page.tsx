"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  Modal,
  PageHeader,
  Pager,
  SearchInput,
  Select,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { PrintDocument } from "@/components/print/print-document";
import { DailyCollectionEntryForm, type DailyCollectionCatalog, type DailyCollectionEntryMode } from "@/components/daily-collection/entry-form";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatQuantity, monthKey, monthLabel, registerTitle } from "@/lib/daily-collection";
import { downloadBlob, formatDate, formatDateTime, formatFullDate, paginate, toCsv, todayISO } from "@/lib/utils";
import { listAuditLogsForRecord } from "@/services/audit";
import { listCollections, listControlSamples } from "@/services/control-samples";
import {
  cancelDailyCollectionRecord,
  correctDailyCollectionRecord,
  createDailyCollectionRecord,
  finalizeDailyCollectionRecord,
  listDailyCollectionRecords,
  reviewDailyCollectionRecord,
  submitDailyCollectionRecord,
  updateDailyCollectionDraft,
} from "@/services/daily-collection";
import { listStudies } from "@/services/inventory";
import { listBatches, listControlBatches, listControlProducts, listMarkets, listPackagingMaterials, listPackSizes, listProducts, listUnits } from "@/services/masters";
import { getOrganizationSettings } from "@/services/organization";
import { listUsers } from "@/services/users";
import type { DailyCollectionInput, DailyCollectionRecord } from "@/types/daily-collection";

const COMPANY_FALLBACK = "SKYMAP PHARMACEUTICALS PVT. LTD., ROORKEE";

type WorkflowKind = "submit" | "review" | "finalize" | "cancel";

export default function DailyCollectionRecordPage() {
  const { profile, hasPermission } = useAuth();
  const canCreate = hasPermission("control.collect");
  const canReview = hasPermission("control.perform");
  const canCorrect = hasPermission("approve.records");
  const canExport = canCreate || canReview || hasPermission("reports.view");
  const canViewAudit = hasPermission("audit.view");
  const allowCollectorSelect = hasPermission("users.manage");
  const allowFutureDate = hasPermission("users.manage");

  const catalog = useAsync(async () => {
    const [products, batches, controlProducts, controlBatches, units, markets, packSizes, packaging, controlSamples, studies, collections, rows, settings, users] =
      await Promise.all([
        listProducts(),
        listBatches(),
        listControlProducts(),
        listControlBatches(),
        listUnits(),
        listMarkets(),
        listPackSizes().catch(() => []),
        listPackagingMaterials(),
        listControlSamples(),
        listStudies(),
        listCollections(),
        listDailyCollectionRecords().catch(() => []),
        getOrganizationSettings(),
        allowCollectorSelect ? listUsers() : Promise.resolve([]),
      ]);
    return { products, batches, controlProducts, controlBatches, units, markets, packSizes, packaging, controlSamples, studies, collections, rows, settings, users };
  }, [allowCollectorSelect]);

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [productId, setProductId] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [market, setMarket] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [collectedBy, setCollectedBy] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);
  const [print, setPrint] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<DailyCollectionEntryMode>("create");
  const [editing, setEditing] = useState<DailyCollectionRecord | null>(null);
  const [workflow, setWorkflow] = useState<{ kind: WorkflowKind; row: DailyCollectionRecord } | null>(null);
  const [workflowReason, setWorkflowReason] = useState("");
  const [auditId, setAuditId] = useState("");

  const audit = useAsync(
    async () => (canViewAudit && auditId ? listAuditLogsForRecord("dailyCollectionRecord", auditId) : []),
    [auditId, canViewAudit]
  );

  const rows = useMemo(() => catalog.data?.rows || [], [catalog.data?.rows]);
  const formCatalog: DailyCollectionCatalog = useMemo(
    () => ({
      products: catalog.data?.products || [],
      batches: catalog.data?.batches || [],
      controlProducts: catalog.data?.controlProducts || [],
      controlBatches: catalog.data?.controlBatches || [],
      units: catalog.data?.units || [],
      markets: catalog.data?.markets || [],
      packSizes: catalog.data?.packSizes || [],
      packaging: catalog.data?.packaging || [],
      controlSamples: catalog.data?.controlSamples || [],
      studies: catalog.data?.studies || [],
      collections: catalog.data?.collections || [],
      users: catalog.data?.users || [],
    }),
    [catalog.data]
  );

  const productFilterOptions = useMemo(() => {
    const map = new Map<string, string>();
    // Masters stay separate: dump the stability catalog only when the user
    // explicitly filters to Stability Sample. "All types" is Control Sample
    // masters plus products that already appear on this register.
    if (sampleType === "Stability Sample") {
      for (const p of catalog.data?.products || []) map.set(p.id, p.productName);
    } else {
      for (const p of catalog.data?.controlProducts || []) map.set(p.id, p.productName);
    }
    for (const r of rows) {
      if (sampleType && r.sampleType !== sampleType) continue;
      if (r.productId) map.set(r.productId, r.productName);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [catalog.data, rows, sampleType]);

  const months = useMemo(() => {
    const keys = Array.from(new Set(rows.map((r) => monthKey(r.date)).filter(Boolean)));
    return keys.sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const next = rows.filter((r) => {
      if (dateFrom && r.date < dateFrom) return false;
      if (dateTo && r.date > dateTo) return false;
      if (productId && r.productId !== productId) return false;
      if (batchFilter && !r.batchNumber.toLowerCase().includes(batchFilter.toLowerCase())) return false;
      if (market && r.market !== market) return false;
      if (sampleType && r.sampleType !== sampleType) return false;
      if (collectedBy && !r.collectedByName.toLowerCase().includes(collectedBy.toLowerCase())) return false;
      if (month && monthKey(r.date) !== month) return false;
      if (q) {
        const hay = [r.serialDisplay, r.recordId, r.productName, r.batchNumber, r.market, r.packSize, r.collectedByName, r.remarks, r.sampleType]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    next.sort((a, b) => {
      if (month) {
        if (a.serialYear !== b.serialYear) return a.serialYear - b.serialYear;
        return a.serialNumber - b.serialNumber;
      }
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.serialNumber - a.serialNumber;
    });
    return next;
  }, [batchFilter, collectedBy, dateFrom, dateTo, market, month, productId, rows, sampleType, search]);

  const paged = paginate(filtered, page, 20);
  const companyName = catalog.data?.settings.companyName?.trim() || process.env.NEXT_PUBLIC_COMPANY_NAME || COMPANY_FALLBACK;
  const markets = useMemo(() => {
    const names = new Set<string>();
    for (const m of catalog.data?.markets || []) {
      if (m.status === "Active" && m.name.trim()) names.add(m.name.trim());
    }
    for (const r of rows) {
      if (r.market?.trim()) names.add(r.market.trim());
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [catalog.data?.markets, rows]);

  function openCreate() {
    setEditing(null);
    setFormMode("create");
    setFormOpen(true);
  }

  function openRow(row: DailyCollectionRecord, mode: DailyCollectionEntryMode) {
    setEditing(row);
    setFormMode(mode);
    setFormOpen(true);
  }

  async function reload() {
    await catalog.reload();
  }

  async function handleSave(input: DailyCollectionInput, action: "draft" | "submit" | "correct", reason?: string) {
    if (!profile) return;
    setSaving(true);
    try {
      if (action === "correct" && editing) {
        if (!reason?.trim()) throw new Error("A reason is required to correct a finalized collection record.");
        await correctDailyCollectionRecord(editing.id, { ...input, user: profile, reason, allowFutureDate });
        toast.success("Controlled correction recorded. Previous values remain in the audit trail.");
      } else if (editing && editing.status === "Draft") {
        await updateDailyCollectionDraft(editing.id, { ...input, user: profile, allowFutureDate });
        if (action === "submit") await submitDailyCollectionRecord(editing.id, profile);
        toast.success(action === "submit" ? "Draft submitted." : "Draft updated.");
      } else {
        const created = await createDailyCollectionRecord({ ...input, user: profile, allowFutureDate });
        if (action === "submit") await submitDailyCollectionRecord(created.id, profile);
        toast.success(action === "submit" ? "Collection entry submitted." : "Draft saved.");
      }
      setFormOpen(false);
      setEditing(null);
      await reload();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save the collection entry.";
      if (message === "DUPLICATE_COLLECTION") {
        toast.error("Similar collection record already exists for this Product + Batch + Date.");
      } else {
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function runWorkflow() {
    if (!profile || !workflow) return;
    if ((workflow.kind === "cancel") && !workflowReason.trim()) {
      toast.error("A reason is required.");
      return;
    }
    setSaving(true);
    try {
      if (workflow.kind === "submit") await submitDailyCollectionRecord(workflow.row.id, profile);
      if (workflow.kind === "review") await reviewDailyCollectionRecord(workflow.row.id, profile, workflowReason);
      if (workflow.kind === "finalize") await finalizeDailyCollectionRecord(workflow.row.id, profile, workflowReason);
      if (workflow.kind === "cancel") await cancelDailyCollectionRecord(workflow.row.id, profile, workflowReason);
      toast.success("Register workflow updated.");
      setWorkflow(null);
      setWorkflowReason("");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update workflow.");
    } finally {
      setSaving(false);
    }
  }

  function exportRows() {
    return filtered.map((r) => ({
      "S. No.": r.serialDisplay,
      Date: formatFullDate(r.date),
      "Product Name": r.productName,
      "Batch No.": r.batchNumber,
      "Batch Size": r.batchSize || "",
      "Mfg. Date": formatDate(r.manufacturingDate),
      "Expiry Date": formatDate(r.expiryDate),
      Market: r.market,
      "Pack Size": r.packSize,
      "Quantity Collected": r.quantityCollected,
      Unit: r.quantityUnit,
      "Collected By": r.collectedByName,
      Remarks: r.remarks || "",
      "Sample Type": r.sampleType,
      Status: r.status,
    }));
  }

  function exportCsv() {
    downloadBlob(`daily-collection-record-${todayISO()}.csv`, toCsv(exportRows()));
  }

  function exportExcel() {
    const book = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(exportRows());
    XLSX.utils.book_append_sheet(book, sheet, "Daily Collection");
    XLSX.writeFile(book, `daily-collection-record-${todayISO()}.xlsx`);
  }

  if (!profile) return <LoadingSkeleton rows={8} />;

  return (
    <div>
      <PageHeader
        title="Daily Collection Record"
        description="Digital register for daily collection of Control Samples and Stability Samples. Product and batch masters are separate for each sample type and are not linked."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void reload()}><RefreshCw className="h-4 w-4" />Refresh</Button>
            {canExport ? <Button variant="outline" onClick={exportCsv}>Export CSV</Button> : null}
            {canExport ? <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4" />Excel</Button> : null}
            {canExport ? <Button variant="outline" onClick={() => setPrint(true)}><Printer className="h-4 w-4" />Print</Button> : null}
            {canCreate ? <Button onClick={openCreate}>Add Entry</Button> : null}
          </div>
        }
      />

      <p className="mb-4 text-sm text-slate-500">
        SOP collection with Initial / Middle / End stages remains on{" "}
        <Link className="text-teal-700 underline" href="/stability/control-samples/collection">Collection / Inward</Link>.
        This page replaces the QA/IPQA physical daily collection register.
      </p>

      {catalog.loading ? <LoadingSkeleton rows={8} /> : null}
      {catalog.error ? <ErrorState message={catalog.error} onRetry={catalog.reload} /> : null}

      {print ? (
        <PrintDocument
          title={registerTitle()}
          documentNumber="Annexure-II"
          companyName={companyName}
          department="QUALITY ASSURANCE"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[11px]">
              <thead>
                <tr>
                  {["S. No.", "Date", "Product Name", "Batch No.", "Batch Size", "Mfg. Date", "Expiry Date", "Market", "Pack Size", "Quantity Collected", "Collected By", "Remarks"].map((h) => (
                    <th key={h} className="border border-slate-400 bg-slate-50 px-2 py-1 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.filter((r) => r.status !== "Cancelled").map((r) => (
                  <tr key={r.id}>
                    <td className="border border-slate-300 px-2 py-1">{r.serialDisplay}</td>
                    <td className="border border-slate-300 px-2 py-1">{formatFullDate(r.date)}</td>
                    <td className="border border-slate-300 px-2 py-1">{r.productName}</td>
                    <td className="border border-slate-300 px-2 py-1">{r.batchNumber}</td>
                    <td className="border border-slate-300 px-2 py-1">{r.batchSize || "—"}</td>
                    <td className="border border-slate-300 px-2 py-1">{formatDate(r.manufacturingDate)}</td>
                    <td className="border border-slate-300 px-2 py-1">{formatDate(r.expiryDate)}</td>
                    <td className="border border-slate-300 px-2 py-1">{r.market}</td>
                    <td className="border border-slate-300 px-2 py-1">{r.packSize}</td>
                    <td className="border border-slate-300 px-2 py-1">{formatQuantity(r.quantityCollected, r.quantityUnit)}</td>
                    <td className="border border-slate-300 px-2 py-1">{r.collectedByName}</td>
                    <td className="border border-slate-300 px-2 py-1">{r.remarks || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PrintDocument>
      ) : null}

      {!catalog.loading && !catalog.error ? (
        <>
          <Card className="mb-4">
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
              <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search register..." />
              <Input label="From date" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
              <Input label="To date" type="date" monthBound="end" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
              <Select label="Product" value={productId} onChange={(e) => { setProductId(e.target.value); setPage(1); }}>
                <option value="">All products</option>
                {productFilterOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </Select>
              <Input label="Batch" value={batchFilter} onChange={(e) => { setBatchFilter(e.target.value); setPage(1); }} />
              <Select label="Market" value={market} onChange={(e) => { setMarket(e.target.value); setPage(1); }}>
                <option value="">All markets</option>
                {markets.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
              <Select label="Sample Type" value={sampleType} onChange={(e) => { setSampleType(e.target.value); setProductId(""); setPage(1); }}>
                <option value="">All types</option>
                <option value="Control Sample">Control Sample</option>
                <option value="Stability Sample">Stability Sample</option>
              </Select>
              <Input label="Collected By" value={collectedBy} onChange={(e) => { setCollectedBy(e.target.value); setPage(1); }} />
            </div>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 px-4 py-3">
              <span className="self-center text-xs font-semibold uppercase tracking-wide text-slate-500">View register by month</span>
              <Button size="sm" variant={month ? "outline" : "secondary"} onClick={() => { setMonth(""); setPage(1); }}>Latest first</Button>
              {months.map((key) => (
                <Button key={key} size="sm" variant={month === key ? "secondary" : "outline"} onClick={() => { setMonth(key); setPage(1); }}>
                  {monthLabel(key)}
                </Button>
              ))}
            </div>
          </Card>

          <div className="overflow-hidden rounded-2xl border-2 border-slate-700 bg-[#fbf8f1] shadow-sm">
            <div className="border-b-2 border-slate-700 px-4 py-4 text-center">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-slate-600">{companyName}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Quality Assurance</p>
              <h2 className="mt-1 text-base font-semibold uppercase tracking-wide text-slate-900 sm:text-lg">{registerTitle()}</h2>
              {month ? <p className="mt-1 text-sm text-slate-600">{monthLabel(month)}</p> : null}
            </div>

            {!filtered.length ? (
              <EmptyState title="No collection entries" description="Add a daily collection entry to start this controlled register." />
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-[1280px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-200/80 text-left text-[11px] uppercase tracking-wide text-slate-700">
                        {["S. No.", "Date", "Product Name", "Batch No.", "Batch Size", "Mfg. Date", "Expiry Date", "Market", "Pack Size", "Qty Collected", "Collected By", "Remarks", "Type", "Status", "Actions"].map((h) => (
                          <th key={h} className="border border-slate-400 px-2 py-2 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paged.items.map((r) => (
                        <tr key={r.id} className={r.status === "Cancelled" ? "bg-slate-100 text-slate-500" : "bg-white"}>
                          <td className="border border-slate-300 px-2 py-2 font-medium">{r.serialDisplay}</td>
                          <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{formatFullDate(r.date)}</td>
                          <td className="border border-slate-300 px-2 py-2">{r.productName}</td>
                          <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{r.batchNumber}</td>
                          <td className="border border-slate-300 px-2 py-2">{r.batchSize || "—"}</td>
                          <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{formatDate(r.manufacturingDate)}</td>
                          <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{formatDate(r.expiryDate)}</td>
                          <td className="border border-slate-300 px-2 py-2">{r.market}</td>
                          <td className="border border-slate-300 px-2 py-2">{r.packSize}</td>
                          <td className="border border-slate-300 px-2 py-2 whitespace-nowrap">{formatQuantity(r.quantityCollected, r.quantityUnit)}</td>
                          <td className="border border-slate-300 px-2 py-2">{r.collectedByName}</td>
                          <td className="border border-slate-300 px-2 py-2">{r.remarks || "—"}</td>
                          <td className="border border-slate-300 px-2 py-2">{r.sampleType}</td>
                          <td className="border border-slate-300 px-2 py-2"><StatusBadge status={r.status} /></td>
                          <td className="border border-slate-300 px-2 py-2">
                            <RowActions
                              row={r}
                              canCreate={canCreate}
                              canReview={canReview}
                              canCorrect={canCorrect}
                              canViewAudit={canViewAudit}
                              onView={() => openRow(r, "view")}
                              onEdit={() => openRow(r, "edit")}
                              onCorrect={() => openRow(r, "correct")}
                              onWorkflow={(kind) => { setWorkflow({ kind, row: r }); setWorkflowReason(""); }}
                              onAudit={() => setAuditId(r.recordId)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="space-y-3 p-4 md:hidden">
                  {paged.items.map((r) => (
                    <div key={r.id} className="rounded-xl border border-slate-300 bg-white p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs text-slate-500">S. No. {r.serialDisplay} · {formatFullDate(r.date)}</p>
                          <p className="font-semibold text-slate-900">{r.productName}</p>
                          <p className="text-sm text-slate-600">{r.batchNumber} · {r.market} · {r.packSize}</p>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                      <p className="mt-2 text-sm">{formatQuantity(r.quantityCollected, r.quantityUnit)} · {r.collectedByName}</p>
                      <p className="text-sm text-slate-500">{r.sampleType}{r.remarks ? ` · ${r.remarks}` : ""}</p>
                      <div className="mt-3">
                        <RowActions
                          row={r}
                          canCreate={canCreate}
                          canReview={canReview}
                          canCorrect={canCorrect}
                          canViewAudit={canViewAudit}
                          onView={() => openRow(r, "view")}
                          onEdit={() => openRow(r, "edit")}
                          onCorrect={() => openRow(r, "correct")}
                          onWorkflow={(kind) => { setWorkflow({ kind, row: r }); setWorkflowReason(""); }}
                          onAudit={() => setAuditId(r.recordId)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Pager showing={paged.items.length} total={filtered.length} page={paged.page} totalPages={paged.totalPages} onPrev={() => setPage(paged.page - 1)} onNext={() => setPage(paged.page + 1)} />
              </>
            )}
          </div>
        </>
      ) : null}

      {auditId && canViewAudit ? (
        <Card className="mt-6">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="font-semibold">Audit history — {auditId}</h3>
            <Button size="sm" variant="ghost" onClick={() => setAuditId("")}>Close</Button>
          </div>
          {audit.loading ? <LoadingSkeleton rows={3} /> : null}
          {!(audit.data || []).length && !audit.loading ? <EmptyState title="No audit entries for this record" /> : (
            <ul className="space-y-2 p-4 text-sm">
              {(audit.data || []).map((a) => (
                <li key={a.id} className="rounded-xl border border-slate-100 px-3 py-2">
                  <span className="font-medium">{a.action}</span> · {a.userName} · {formatDateTime(a.createdAt)}
                  {a.reason ? <span className="text-slate-500"> · {a.reason}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Modal
        open={formOpen}
        title={formMode === "create" ? "Add Daily Collection Entry" : formMode === "edit" ? "Edit Draft Entry" : formMode === "correct" ? "Correct Finalized Entry" : "View Entry"}
        description={formMode === "correct" ? "Finalized register values are preserved. This records a controlled amendment." : "Values are stored as a snapshot and will not change if Product or Batch masters are updated later."}
        onClose={() => { if (!saving) setFormOpen(false); }}
        size="xl"
      >
        {formOpen ? (
          <DailyCollectionEntryForm
            mode={formMode}
            initial={editing}
            catalog={formCatalog}
            profile={profile}
            existing={rows}
            allowCollectorSelect={allowCollectorSelect}
            allowFutureDate={allowFutureDate}
            saving={saving}
            onCancel={() => setFormOpen(false)}
            onSave={handleSave}
          />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(workflow)}
        title={workflow?.kind === "submit" ? "Submit entry" : workflow?.kind === "review" ? "Review entry" : workflow?.kind === "finalize" ? "Finalize entry" : "Cancel entry"}
        description={workflow?.kind === "finalize" ? "After finalization this register line cannot be silently edited." : workflow?.kind === "cancel" ? "The serial number remains reserved and will not be reused." : "Confirm this controlled register action."}
        onClose={() => { if (!saving) setWorkflow(null); }}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setWorkflow(null)} disabled={saving}>Close</Button>
            <Button variant={workflow?.kind === "cancel" ? "danger" : "primary"} onClick={() => void runWorkflow()} loading={saving}>
              Confirm
            </Button>
          </div>
        }
      >
        {workflow?.kind === "cancel" || workflow?.kind === "finalize" || workflow?.kind === "review" ? (
          <Textarea label={workflow.kind === "cancel" ? "Reason" : "Remarks"} required={workflow.kind === "cancel"} value={workflowReason} onChange={(e) => setWorkflowReason(e.target.value)} />
        ) : (
          <p className="text-sm text-slate-600">Submit {workflow?.row.serialDisplay} — {workflow?.row.productName} / {workflow?.row.batchNumber}?</p>
        )}
      </Modal>
    </div>
  );
}

function RowActions({
  row,
  canCreate,
  canReview,
  canCorrect,
  canViewAudit,
  onView,
  onEdit,
  onCorrect,
  onWorkflow,
  onAudit,
}: {
  row: DailyCollectionRecord;
  canCreate: boolean;
  canReview: boolean;
  canCorrect: boolean;
  canViewAudit: boolean;
  onView: () => void;
  onEdit: () => void;
  onCorrect: () => void;
  onWorkflow: (kind: WorkflowKind) => void;
  onAudit: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <Button size="sm" variant="ghost" onClick={onView}>View</Button>
      {row.status === "Draft" && canCreate ? <Button size="sm" variant="outline" onClick={onEdit}>Edit</Button> : null}
      {row.status === "Draft" && canCreate ? <Button size="sm" variant="outline" onClick={() => onWorkflow("submit")}>Submit</Button> : null}
      {row.status === "Submitted" && canReview ? <Button size="sm" variant="outline" onClick={() => onWorkflow("review")}>Review</Button> : null}
      {row.status === "Reviewed" && canReview ? <Button size="sm" onClick={() => onWorkflow("finalize")}>Finalize</Button> : null}
      {(row.status === "Draft" && canCreate) || (row.status === "Submitted" && canReview) ? (
        <Button size="sm" variant="ghost" onClick={() => onWorkflow("cancel")}>Cancel</Button>
      ) : null}
      {row.status === "Finalized" && canCorrect ? <Button size="sm" variant="outline" onClick={onCorrect}>Correct</Button> : null}
      {canViewAudit ? <Button size="sm" variant="ghost" onClick={onAudit}>Audit</Button> : null}
    </div>
  );
}
