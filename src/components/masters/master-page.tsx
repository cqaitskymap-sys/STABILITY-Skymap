"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  PageHeader,
  StatusBadge,
} from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { friendlyError } from "@/lib/utils";
import { createMaster, deleteMaster, updateMaster } from "@/services/masters";
import { writeAuditLog } from "@/services/audit";
import { useAsync } from "@/hooks/useAsync";

export type FieldDef = {
  key: string;
  label: string;
  type?: "text" | "number" | "select";
  required?: boolean;
  options?: { label: string; value: string }[];
  placeholder?: string;
};

export function MasterPage<T extends { id: string; status?: string }>({
  title,
  description,
  collectionName,
  fields,
  loader,
  mapRow,
  buildPayload,
  recordType,
}: {
  title: string;
  description: string;
  collectionName: string;
  fields: FieldDef[];
  loader: () => Promise<T[]>;
  mapRow: (item: T) => Record<string, string | number>;
  buildPayload: (values: Record<string, string>, isCreate: boolean) => Record<string, unknown>;
  recordType: string;
}) {
  const { profile, hasPermission } = useAuth();
  const { data, loading, error, reload } = useAsync(loader, []);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<T | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const canManage = hasPermission("masters.manage");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter((item) => {
      if (!q) return true;
      return Object.values(mapRow(item)).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [data, search, mapRow]);

  function openCreate() {
    setEditing(null);
    const initial: Record<string, string> = {};
    fields.forEach((f) => {
      initial[f.key] = f.type === "number" ? "0" : f.options?.[0]?.value || "";
    });
    setValues(initial);
    setOpenForm(true);
  }

  function openEdit(item: T) {
    setEditing(item);
    const initial: Record<string, string> = {};
    const record = item as T & Record<string, unknown>;
    fields.forEach((f) => {
      initial[f.key] = String(record[f.key] ?? "");
    });
    setValues(initial);
    setOpenForm(true);
  }

  async function save() {
    for (const f of fields) {
      if (f.required && !String(values[f.key] ?? "").trim()) {
        toast.error(`${f.label} is required.`);
        return;
      }
    }
    setSaving(true);
    try {
      const payload = buildPayload(values, !editing);
      if (editing) {
        await updateMaster(collectionName, editing.id, payload);
        await writeAuditLog({
          action: "Master Data Changed",
          recordId: editing.id,
          recordType,
          previousValue: editing,
          newValue: payload,
          userId: profile!.uid,
          userName: profile!.displayName,
          userEmail: profile!.email,
        });
        toast.success("Record updated successfully.");
      } else {
        const created = await createMaster(collectionName, payload);
        await writeAuditLog({
          action: "Master Data Changed",
          recordId: created.id,
          recordType,
          newValue: payload,
          userId: profile!.uid,
          userName: profile!.displayName,
          userEmail: profile!.email,
        });
        toast.success("Record created successfully.");
      }
      setOpenForm(false);
      await reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteId) return;
    setSaving(true);
    try {
      await deleteMaster(collectionName, deleteId);
      await writeAuditLog({
        action: "Master Data Changed",
        recordId: deleteId,
        recordType,
        previousValue: { deleted: true },
        userId: profile!.uid,
        userName: profile!.displayName,
        userEmail: profile!.email,
      });
      toast.success("Record deleted.");
      setDeleteId(null);
      await reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={description}
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add New
            </Button>
          ) : null
        }
      />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search master records..."
            aria-label="Search"
          />
        </div>

        {loading ? <LoadingSkeleton /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}
        {!loading && !error && filtered.length === 0 ? (
          <EmptyState title="No records found." description="Add master data to begin configuration." />
        ) : null}

        {!loading && !error && filtered.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    {Object.keys(mapRow(filtered[0])).map((h) => (
                      <th key={h} className="px-4 py-3 font-semibold">
                        {h}
                      </th>
                    ))}
                    {canManage ? <th className="px-4 py-3 font-semibold">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const row = mapRow(item);
                    return (
                      <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                        {Object.entries(row).map(([k, v]) => (
                          <td key={k} className="px-4 py-3 text-slate-700">
                            {k.toLowerCase() === "status" ? <StatusBadge status={String(v)} /> : v}
                          </td>
                        ))}
                        {canManage ? (
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setDeleteId(item.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                              </Button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 md:hidden">
              {filtered.map((item) => {
                const row = mapRow(item);
                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-4">
                    {Object.entries(row).map(([k, v]) => (
                      <div key={k} className="mb-2 flex items-start justify-between gap-3 text-sm">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-right font-medium text-slate-800">
                          {k.toLowerCase() === "status" ? <StatusBadge status={String(v)} /> : v}
                        </span>
                      </div>
                    ))}
                    {canManage ? (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(item)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteId(item.id)}>
                          Delete
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </Card>

      {openForm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
          <Card className="w-full max-w-lg p-5">
            <h3 className="text-lg font-semibold text-slate-900">{editing ? "Edit Record" : "Add Record"}</h3>
            <div className="mt-4 grid gap-3">
              {fields.map((f) =>
                f.type === "select" ? (
                  <label key={f.key} className="block space-y-1.5">
                    <span className="text-sm font-medium text-slate-700">
                      {f.label}
                      {f.required ? <span className="text-rose-500"> *</span> : null}
                    </span>
                    <select
                      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
                      value={values[f.key] || ""}
                      onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                    >
                      {(f.options || []).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <Input
                    key={f.key}
                    label={f.label}
                    type={f.type || "text"}
                    required={f.required}
                    placeholder={f.placeholder}
                    value={values[f.key] || ""}
                    onChange={(e) => setValues((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                )
              )}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenForm(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={save} loading={saving}>
                Save
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!deleteId}
        title="Delete record?"
        description="This master record will be removed. Existing operational data will not be deleted."
        confirmLabel="Delete"
        tone="danger"
        loading={saving}
        onCancel={() => setDeleteId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
