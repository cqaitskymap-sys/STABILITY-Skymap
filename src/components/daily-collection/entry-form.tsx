"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Input, Select, Textarea } from "@/components/ui";
import {
  DAILY_COLLECTION_REMARK_PRESETS,
  DAILY_COLLECTION_SAMPLE_TYPES,
  DUPLICATE_WARNING,
  findDuplicateRecords,
  toDailyCollectionInput,
  validateDailyCollectionInput,
} from "@/lib/daily-collection";
import { todayISO } from "@/lib/utils";
import type { AppUser, Batch, ControlSample, ControlSampleCollection, Market, PackagingMaterial, PackSize, Product, StabilityStudy, Unit } from "@/types";
import type { DailyCollectionInput, DailyCollectionRecord } from "@/types/daily-collection";

export type DailyCollectionEntryMode = "create" | "edit" | "view" | "correct";

export type DailyCollectionCatalog = {
  products: Product[];
  batches: Batch[];
  controlProducts: Product[];
  controlBatches: Batch[];
  units: Unit[];
  markets: Market[];
  packSizes: PackSize[];
  packaging: PackagingMaterial[];
  controlSamples: ControlSample[];
  studies: StabilityStudy[];
  collections: ControlSampleCollection[];
  users: AppUser[];
};

function uniqueNames(values: (string | undefined)[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const next = (value || "").trim();
    if (!next) continue;
    const key = next.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function emptyForm(profile: AppUser): DailyCollectionInput {
  return {
    date: todayISO(),
    sampleType: "Control Sample",
    productId: "",
    productName: "",
    productCode: "",
    batchId: "",
    batchNumber: "",
    batchSize: "",
    manufacturingDate: "",
    expiryDate: "",
    marketId: "",
    market: "",
    packSizeId: "",
    packSize: "",
    quantityCollected: 0,
    quantityUnit: "",
    collectedByUserId: profile.uid,
    collectedByName: profile.displayName || profile.email,
    collectedByEmployeeCode: profile.employeeId,
    remarks: "",
  };
}

export function DailyCollectionEntryForm({
  mode,
  initial,
  catalog,
  profile,
  existing,
  allowCollectorSelect,
  allowFutureDate,
  saving,
  onCancel,
  onSave,
}: {
  mode: DailyCollectionEntryMode;
  initial?: DailyCollectionRecord | null;
  catalog: DailyCollectionCatalog;
  profile: AppUser;
  existing: DailyCollectionRecord[];
  allowCollectorSelect: boolean;
  allowFutureDate: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: (input: DailyCollectionInput, action: "draft" | "submit" | "correct", reason?: string) => Promise<void>;
}) {
  const readOnly = mode === "view";
  const [form, setForm] = useState<DailyCollectionInput>(() =>
    initial ? toDailyCollectionInput(initial) : emptyForm(profile)
  );
  const [qty, setQty] = useState(initial ? String(initial.quantityCollected) : "");
  const [productQuery, setProductQuery] = useState("");
  const [collectorQuery, setCollectorQuery] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [error, setError] = useState("");
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"draft" | "submit" | "correct" | null>(null);

  const productCatalog = form.sampleType === "Control Sample" ? catalog.controlProducts : catalog.products;
  const batchCatalog = form.sampleType === "Control Sample" ? catalog.controlBatches : catalog.batches;
  const productMasterHref =
    form.sampleType === "Control Sample" ? "/stability/control-samples/products" : "/masters/products";
  const batchMasterHref =
    form.sampleType === "Control Sample" ? "/stability/control-samples/batches" : "/masters/batches";

  const products = useMemo(() => {
    const active = productCatalog.filter((p) => p.status === "Active" || p.id === form.productId);
    const withCurrent =
      form.productId && form.productName && !active.some((p) => p.id === form.productId)
        ? [
            {
              id: form.productId,
              productName: form.productName,
              productCode: form.productCode,
              status: "Active" as const,
            } as Product,
            ...active,
          ]
        : active;
    const q = productQuery.trim().toLowerCase();
    if (!q) return withCurrent;
    return withCurrent.filter((p) =>
      `${p.productName} ${p.productCode || ""} ${p.genericName || ""}`.toLowerCase().includes(q)
    );
  }, [form.productCode, form.productId, form.productName, productCatalog, productQuery]);

  const batches = useMemo(() => {
    const matched = batchCatalog.filter(
      (b) => b.productId === form.productId && (b.status === "Active" || b.id === form.batchId)
    );
    if (form.batchId && form.batchNumber && !matched.some((b) => b.id === form.batchId)) {
      return [
        {
          id: form.batchId,
          productId: form.productId,
          productName: form.productName,
          batchNumber: form.batchNumber,
          batchSize: form.batchSize,
          manufacturingDate: form.manufacturingDate,
          expiryDate: form.expiryDate,
          status: "Active" as const,
        } as Batch,
        ...matched,
      ];
    }
    return matched;
  }, [batchCatalog, form.batchId, form.batchNumber, form.batchSize, form.expiryDate, form.manufacturingDate, form.productId, form.productName]);

  const marketOptions = useMemo(
    () =>
      uniqueNames([
        ...catalog.markets.filter((m) => m.status === "Active" || m.id === form.marketId).map((m) => m.name),
        form.market,
      ]),
    [catalog.markets, form.market, form.marketId]
  );

  const packOptions = useMemo(
    () =>
      uniqueNames([
        ...catalog.packSizes.filter((p) => p.status === "Active" || p.id === form.packSizeId).map((p) => p.name),
        ...catalog.packaging.map((p) => p.packSize),
        form.packSize,
      ]),
    [catalog.packSizes, catalog.packaging, form.packSize, form.packSizeId]
  );

  const matchingControls = useMemo(
    () =>
      catalog.controlSamples.filter(
        (s) => (!form.productId || s.productId === form.productId) && (!form.batchId || s.batchId === form.batchId)
      ),
    [catalog.controlSamples, form.batchId, form.productId]
  );

  const matchingCollections = useMemo(
    () =>
      catalog.collections.filter(
        (s) => (!form.productId || s.productId === form.productId) && (!form.batchId || s.batchId === form.batchId)
      ),
    [catalog.collections, form.batchId, form.productId]
  );

  const matchingStudies = useMemo(
    () =>
      catalog.studies.filter(
        (s) => (!form.productId || s.productId === form.productId) && (!form.batchId || s.batchId === form.batchId)
      ),
    [catalog.studies, form.batchId, form.productId]
  );

  const collectors = useMemo(() => {
    const q = collectorQuery.trim().toLowerCase();
    return catalog.users.filter((u) => {
      if (!u.active && u.uid !== form.collectedByUserId) return false;
      if (!q) return true;
      return `${u.displayName} ${u.employeeId} ${u.email}`.toLowerCase().includes(q);
    });
  }, [catalog.users, collectorQuery, form.collectedByUserId]);

  function patch(next: Partial<DailyCollectionInput>) {
    setForm((prev) => ({ ...prev, ...next }));
    setError("");
  }

  function onProduct(productId: string) {
    const product = productCatalog.find((p) => p.id === productId);
    const marketMatch = catalog.markets.find(
      (m) => m.status === "Active" && m.name.trim().toLowerCase() === (product?.market || "").trim().toLowerCase()
    );
    patch({
      productId,
      productName: product?.productName || "",
      productCode: product?.productCode || "",
      batchId: "",
      batchNumber: "",
      batchSize: "",
      manufacturingDate: "",
      expiryDate: "",
      market: product?.market || form.market,
      marketId: marketMatch?.id || form.marketId,
      controlSampleId: "",
      controlSampleDocId: "",
      controlCollectionId: "",
      stabilityStudyId: "",
      stabilitySampleId: "",
    });
  }

  function onBatch(batchId: string) {
    const batch = batches.find((b) => b.id === batchId);
    patch({
      batchId,
      batchNumber: batch?.batchNumber || "",
      batchSize: batch?.batchSize || "",
      manufacturingDate: batch?.manufacturingDate || "",
      expiryDate: batch?.expiryDate || "",
      controlSampleId: "",
      controlSampleDocId: "",
      controlCollectionId: "",
      stabilityStudyId: "",
      stabilitySampleId: "",
    });
  }

  function onMarket(name: string) {
    const match = catalog.markets.find((m) => m.name === name);
    patch({ market: name, marketId: match?.id });
  }

  function onPack(name: string) {
    const match = catalog.packSizes.find((p) => p.name === name);
    patch({ packSize: name, packSizeId: match?.id });
  }

  function onCollector(uid: string) {
    const user = catalog.users.find((u) => u.uid === uid) || profile;
    patch({
      collectedByUserId: user.uid,
      collectedByName: user.displayName || user.email,
      collectedByEmployeeCode: user.employeeId,
    });
  }

  function onControlSample(id: string) {
    const sample = catalog.controlSamples.find((s) => s.id === id);
    patch({
      controlSampleDocId: id || undefined,
      controlSampleId: sample?.controlSampleId,
      productId: form.productId || sample?.productId || "",
      productName: form.productName || sample?.productName || "",
      batchId: form.batchId || sample?.batchId || "",
      batchNumber: form.batchNumber || sample?.batchNumber || "",
      batchSize: form.batchSize || sample?.batchSize || "",
      manufacturingDate: form.manufacturingDate || sample?.manufacturingDate || "",
      expiryDate: form.expiryDate || sample?.expiryDate || "",
      packSize: form.packSize || sample?.packSize || "",
    });
  }

  function onCollection(id: string) {
    const row = catalog.collections.find((s) => s.id === id);
    patch({
      controlCollectionId: id || undefined,
      productId: form.productId || row?.productId || "",
      productName: form.productName || row?.productName || "",
      batchId: form.batchId || row?.batchId || "",
      batchNumber: form.batchNumber || row?.batchNumber || "",
      batchSize: form.batchSize || row?.batchSize || "",
      manufacturingDate: form.manufacturingDate || row?.manufacturingDate || "",
      expiryDate: form.expiryDate || row?.expiryDate || "",
    });
  }

  function onStudy(id: string) {
    const study = catalog.studies.find((s) => s.id === id);
    patch({
      stabilityStudyId: id || undefined,
      productId: form.productId || study?.productId || "",
      productName: form.productName || study?.productName || "",
      batchId: form.batchId || study?.batchId || "",
      batchNumber: form.batchNumber || study?.batchNumber || "",
      batchSize: form.batchSize || study?.batchSize || "",
      manufacturingDate: form.manufacturingDate || study?.manufacturingDate || "",
      expiryDate: form.expiryDate || study?.expiryDate || "",
    });
  }

  function payload(acknowledge?: boolean): DailyCollectionInput {
    return {
      ...form,
      quantityCollected: Number(qty),
      productName: form.productName.trim(),
      batchNumber: form.batchNumber.trim(),
      market: form.market.trim(),
      packSize: form.packSize.trim(),
      quantityUnit: form.quantityUnit.trim(),
      remarks: form.remarks?.trim() || undefined,
      duplicateAcknowledged: acknowledge || form.duplicateAcknowledged,
      duplicateReason: form.duplicateReason,
      backdatedReason: form.backdatedReason,
    };
  }

  async function save(action: "draft" | "submit" | "correct", acknowledge = false) {
    const next = payload(acknowledge);
    if (action === "correct" && !correctionReason.trim()) {
      setError("A reason is required to correct a finalized record.");
      return;
    }
    const validation = validateDailyCollectionInput(next, { allowFutureDate });
    if (validation) {
      setError(validation);
      return;
    }
    const duplicates = findDuplicateRecords(existing, next, initial?.id);
    if (duplicates.length && !next.duplicateAcknowledged) {
      setPendingAction(action);
      setDuplicateOpen(true);
      return;
    }
    await onSave(next, action, action === "correct" ? correctionReason.trim() : undefined);
  }

  async function continueDuplicate() {
    if (!form.duplicateReason?.trim() || !pendingAction) {
      setError("A reason is required to continue with a similar existing record.");
      return;
    }
    setDuplicateOpen(false);
    await save(pendingAction, true);
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Date" type="date" required value={form.date} max={allowFutureDate ? undefined : todayISO()} onChange={(e) => patch({ date: e.target.value })} disabled={readOnly} />
        <Select
          label="Sample Type"
          required
          value={form.sampleType}
          onChange={(e) =>
            patch({
              sampleType: e.target.value as DailyCollectionInput["sampleType"],
              productId: "",
              productName: "",
              productCode: "",
              batchId: "",
              batchNumber: "",
              batchSize: "",
              manufacturingDate: "",
              expiryDate: "",
              controlSampleId: "",
              controlSampleDocId: "",
              controlCollectionId: "",
              stabilityStudyId: "",
              stabilitySampleId: "",
            })
          }
          disabled={readOnly}
        >
          {DAILY_COLLECTION_SAMPLE_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </Select>
        {form.date < todayISO() ? (
          <Textarea label="Backdated entry reason" required value={form.backdatedReason || ""} onChange={(e) => patch({ backdatedReason: e.target.value })} disabled={readOnly} hint="Collection date is earlier than today. Entered by is captured automatically." />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Input label="Find product" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} disabled={readOnly} placeholder="Search name or code" uppercase={false} />
          <Select label="Product Name" required value={form.productId} onChange={(e) => onProduct(e.target.value)} disabled={readOnly}>
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.productName}{p.productCode ? ` (${p.productCode})` : ""}</option>
            ))}
          </Select>
          {!productCatalog.length ? (
            <p className="text-xs text-slate-500">
              {form.sampleType === "Control Sample"
                ? "Add products in Control Samples → Products. They are not shared with stability inventory."
                : "Add products in Admin → Stability Products. They are not shared with control samples."}{" "}
              <Link href={productMasterHref} className="font-medium underline">Open product master</Link>
            </p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Select label="Batch No." required value={form.batchId} onChange={(e) => onBatch(e.target.value)} disabled={readOnly || !form.productId}>
            <option value="">{form.productId ? "Select batch" : "Select a product first"}</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>{b.batchNumber}</option>
            ))}
          </Select>
          {form.productId && !batchCatalog.some((b) => b.productId === form.productId) ? (
            <p className="text-xs text-slate-500">
              No batches for this product.{" "}
              <Link href={batchMasterHref} className="font-medium underline">Open batch master</Link>
            </p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Batch Size" value={form.batchSize || ""} onChange={(e) => patch({ batchSize: e.target.value })} disabled={readOnly} />
        <Input label="Mfg. Date" type="date" required value={form.manufacturingDate} onChange={(e) => patch({ manufacturingDate: e.target.value })} disabled={readOnly} />
        <Input label="Expiry Date" type="date" required value={form.expiryDate} onChange={(e) => patch({ expiryDate: e.target.value })} disabled={readOnly} />
        <Input label="Product Code" value={form.productCode || ""} disabled hint="Copied from Product Master at the time of entry." />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Select
          label="Market"
          required
          value={form.market}
          onChange={(e) => onMarket(e.target.value)}
          disabled={readOnly}
          hint={!catalog.markets.some((m) => m.status === "Active") ? "Add markets in Admin → Markets." : undefined}
        >
          <option value="">Select market</option>
          {marketOptions.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </Select>
        {packOptions.length ? (
          <Select label="Pack Size" required value={form.packSize} onChange={(e) => onPack(e.target.value)} disabled={readOnly}>
            <option value="">Select pack size</option>
            {packOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </Select>
        ) : (
          <Input label="Pack Size" required value={form.packSize} onChange={(e) => patch({ packSize: e.target.value, packSizeId: undefined })} disabled={readOnly} hint="Add selectable pack sizes in Masters → Pack Sizes." />
        )}
        <Input label="Quantity Collected" type="number" required min="0" step="any" value={qty} onChange={(e) => setQty(e.target.value)} disabled={readOnly} />
        <Select label="Unit" required value={form.quantityUnit} onChange={(e) => patch({ quantityUnit: e.target.value })} disabled={readOnly}>
          <option value="">Select unit</option>
          {catalog.units.filter((u) => u.status === "Active" || u.abbreviation === form.quantityUnit || u.name === form.quantityUnit).map((u) => (
            <option key={u.id} value={u.abbreviation || u.name}>{u.abbreviation || u.name}</option>
          ))}
        </Select>
      </div>

      {allowCollectorSelect ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Find employee" value={collectorQuery} onChange={(e) => setCollectorQuery(e.target.value)} disabled={readOnly} placeholder="Search name or employee ID" uppercase={false} />
          <Select label="Collected By" required value={form.collectedByUserId} onChange={(e) => onCollector(e.target.value)} disabled={readOnly}>
            {collectors.map((u) => (
              <option key={u.uid} value={u.uid}>{u.displayName}{u.employeeId ? ` (${u.employeeId})` : ""}</option>
            ))}
          </Select>
        </div>
      ) : (
        <Input label="Collected By" value={`${form.collectedByName}${form.collectedByEmployeeCode ? ` (${form.collectedByEmployeeCode})` : ""}`} disabled hint="Collected By is the signed-in employee. Impersonation is not allowed." />
      )}

      <div>
        <Textarea label="Remarks" value={form.remarks || ""} onChange={(e) => patch({ remarks: e.target.value })} disabled={readOnly} />
        {!readOnly ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {DAILY_COLLECTION_REMARK_PRESETS.map((preset) => (
              <Button key={preset} type="button" size="sm" variant="outline" onClick={() => patch({ remarks: preset === "Other" ? "" : preset })}>
                {preset}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {form.sampleType === "Control Sample" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Link Control Sample (optional)" value={form.controlSampleDocId || ""} onChange={(e) => onControlSample(e.target.value)} disabled={readOnly}>
            <option value="">Not linked</option>
            {matchingControls.map((s) => (
              <option key={s.id} value={s.id}>{s.controlSampleId} — {s.productName} / {s.batchNumber}</option>
            ))}
          </Select>
          <Select label="Link Control Collection (optional)" value={form.controlCollectionId || ""} onChange={(e) => onCollection(e.target.value)} disabled={readOnly}>
            <option value="">Not linked</option>
            {matchingCollections.map((s) => (
              <option key={s.id} value={s.id}>{s.collectionId} — {s.productName} / {s.batchNumber}</option>
            ))}
          </Select>
        </div>
      ) : (
        <Select label="Link Stability Study (optional)" value={form.stabilityStudyId || ""} onChange={(e) => onStudy(e.target.value)} disabled={readOnly} hint="This register does not create a new stability study.">
          <option value="">Not linked</option>
          {matchingStudies.map((s) => (
            <option key={s.id} value={s.id}>{s.studyId} — {s.productName} / {s.batchNumber}</option>
          ))}
        </Select>
      )}

      {mode === "correct" ? (
        <Textarea label="Correction reason" required value={correctionReason} onChange={(e) => setCorrectionReason(e.target.value)} hint="Finalized values are not overwritten silently. Old and new values are audited." />
      ) : null}

      {duplicateOpen ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">{DUPLICATE_WARNING}</p>
          <Textarea className="mt-2" label="Reason to continue" required value={form.duplicateReason || ""} onChange={(e) => patch({ duplicateReason: e.target.value, duplicateAcknowledged: true })} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { setDuplicateOpen(false); setPendingAction(null); }}>Back</Button>
            <Button size="sm" onClick={() => void continueDuplicate()} loading={saving}>Continue with reason</Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>{readOnly ? "Close" : "Cancel"}</Button>
        {mode === "create" || mode === "edit" ? (
          <>
            <Button variant="outline" onClick={() => void save("draft")} loading={saving}>Save Draft</Button>
            <Button onClick={() => void save("submit")} loading={saving}>Save & Submit</Button>
          </>
        ) : null}
        {mode === "correct" ? <Button onClick={() => void save("correct")} loading={saving}>Record correction</Button> : null}
      </div>
    </div>
  );
}
