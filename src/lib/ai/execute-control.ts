import type { Permission } from "@/lib/permissions";
import { COLLECTIONS } from "@/lib/firebase/config";
import { DEFAULT_OBSERVATION_TEMPLATES } from "@/lib/control-samples";
import { friendlyError, fromMonthInput, todayISO } from "@/lib/utils";
import { writeAuditLog } from "@/services/audit";
import {
  createCollection,
  createDestructionNote,
  createQuantityMasterRevision,
  finalizeCollection,
  getActiveQuantityMaster,
  listBoxes,
  listCollections,
  listControlSamples,
  listObservationParameters,
  listQuantityMasters,
  listRacks,
  listRequisitions,
  receiveCollection,
  recordObservation,
  recordVerificationException,
  storeControlSample,
  submitCollection,
  verifyAndLogCollection,
  createRequisition,
} from "@/services/control-samples";
import { createMaster, listControlBatches, listControlProducts, listMarkets, listUnits } from "@/services/masters";
import type { AppUser, MasterStatus } from "@/types";
import type { CollectionStage } from "@/types/control-samples";
import type { ToolResult } from "@/lib/ai/execute-tool";

type PermFn = (permission: Permission) => boolean;
type Fail = { ok: false; error: string };

function fail(error: string): Fail {
  return { ok: false, error };
}

function ok(data: Record<string, unknown> = {}): ToolResult {
  return { ok: true, ...data };
}

function eq(a: string | undefined, b: string | undefined) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

function includesQ(row: unknown, query?: string) {
  if (!query?.trim()) return true;
  const q = query.trim().toLowerCase();
  return JSON.stringify(row).toLowerCase().includes(q);
}

function pick<T>(items: T[], matcher: (item: T) => boolean, label: string, format: (item: T) => string): T | Fail {
  const hits = items.filter(matcher);
  if (hits.length === 0) return fail(`${label} not found.`);
  if (hits.length > 1) {
    return fail(`Multiple ${label} matches: ${hits.slice(0, 8).map(format).join("; ")}. Be more specific.`);
  }
  return hits[0];
}

function isFail<T>(value: T | Fail): value is Fail {
  return Boolean(value && typeof value === "object" && "ok" in value && (value as Fail).ok === false);
}

function need(hasPermission: PermFn, permission: Permission, label: string): ToolResult | null {
  if (hasPermission(permission)) return null;
  return fail(`You do not have ${label} permission. Ask an Admin to grant that module.`);
}

function str(input: Record<string, unknown>, key: string) {
  return String(input[key] ?? "").trim();
}

function num(input: Record<string, unknown>, key: string) {
  return Number(input[key]);
}

const CONTROL_TOOLS = new Set([
  "createControlProduct",
  "createControlBatch",
  "collectControlSample",
  "advanceControlCollection",
  "storeControlSample",
  "recordControlObservation",
  "createControlRequisition",
  "setControlQuantity",
  "createControlDestructionNote",
]);

const CONTROL_CATALOG = new Set([
  "controlSamples",
  "controlCollections",
  "controlRequisitions",
  "controlRacks",
  "controlBoxes",
  "controlQuantityMasters",
]);

export function isControlTool(name: string) {
  return CONTROL_TOOLS.has(name);
}

export function isControlCatalog(kind: string) {
  return CONTROL_CATALOG.has(kind);
}

function needAny(hasPermission: PermFn, permissions: Permission[], label: string): ToolResult | null {
  if (permissions.some((permission) => hasPermission(permission))) return null;
  return fail(`You do not have ${label} permission. Ask an Admin to grant that module.`);
}

async function audit(profile: AppUser, recordType: string, recordId: string, payload: unknown) {
  await writeAuditLog({
    action: "Master Data Changed",
    recordType,
    recordId,
    newValue: payload,
    userId: profile.uid,
    userName: profile.displayName || profile.email,
    userEmail: profile.employeeId || profile.email,
  });
}

async function findControlSample(key: string) {
  const rows = await listControlSamples();
  return pick(
    rows,
    (s) => eq(s.controlSampleId, key) || eq(s.id, key),
    "controlled sample",
    (s) => `${s.controlSampleId} — ${s.productName} / ${s.batchNumber}`
  );
}

export async function listControlCatalog(kind: string, query?: string): Promise<ToolResult> {
  switch (kind) {
    case "controlSamples": {
      const rows = (await listControlSamples())
        .filter((s) => includesQ(s, query))
        .slice(0, 40)
        .map((s) => ({
          id: s.id,
          controlSampleId: s.controlSampleId,
          productName: s.productName,
          batchNumber: s.batchNumber,
          availableQuantity: s.availableQuantity,
          unit: s.unit,
          status: s.status,
          locationLabel: s.locationLabel || "",
          nextObservationDate: s.nextObservationDate || "",
          destructionEligibleDate: s.destructionEligibleDate || "",
          expiryDate: s.expiryDate,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "controlCollections": {
      const rows = (await listCollections())
        .filter((c) => includesQ(c, query))
        .slice(0, 40)
        .map((c) => ({
          id: c.id,
          collectionId: c.collectionId,
          productName: c.productName,
          batchNumber: c.batchNumber,
          actualQuantity: c.actualQuantity,
          unit: c.unit,
          stage: c.collectionStage,
          status: c.status,
          date: c.date,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "controlRequisitions": {
      const rows = (await listRequisitions())
        .filter((r) => includesQ(r, query))
        .slice(0, 40)
        .map((r) => ({
          id: r.id,
          requisitionNumber: r.requisitionNumber,
          controlSampleId: r.controlSampleId,
          productName: r.productName,
          batchNumber: r.batchNumber,
          quantityRequired: r.quantityRequired,
          quantityIssued: r.quantityIssued,
          fromDepartment: r.fromDepartment,
          status: r.status,
          reason: r.reason,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "controlRacks": {
      const rows = (await listRacks())
        .filter((r) => includesQ(r, query))
        .map((r) => ({
          id: r.id,
          rackNumber: r.rackNumber,
          partitionNumber: r.partitionNumber || "",
          area: r.area,
          status: r.status,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "controlBoxes": {
      const rows = (await listBoxes())
        .filter((b) => includesQ(b, query))
        .slice(0, 40)
        .map((b) => ({
          id: b.id,
          boxNumber: b.boxNumber,
          rackNumber: b.rackNumber,
          partitionNumber: b.partitionNumber || "",
          category: b.category || "",
          status: b.status,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "controlQuantityMasters": {
      const rows = (await listQuantityMasters())
        .filter((q) => includesQ(q, query))
        .slice(0, 40)
        .map((q) => ({
          id: q.id,
          productName: q.productName,
          quantity: q.quantity,
          unit: q.unit,
          revisionNumber: q.revisionNumber,
          effectiveDate: q.effectiveDate,
          status: q.status,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    default:
      return fail(`Unknown catalog: ${kind}`);
  }
}

export async function runControlTool(
  name: string,
  args: Record<string, unknown>,
  profile: AppUser,
  hasPermission: PermFn
): Promise<ToolResult> {
  try {
    switch (name) {
      case "createControlProduct":
        return createControlProduct(args, profile, hasPermission);
      case "createControlBatch":
        return createControlBatch(args, profile, hasPermission);
      case "collectControlSample":
        return collectControlSample(args, profile, hasPermission);
      case "advanceControlCollection":
        return advanceControlCollection(args, profile, hasPermission);
      case "storeControlSample":
        return storeSample(args, profile, hasPermission);
      case "recordControlObservation":
        return observe(args, profile, hasPermission);
      case "createControlRequisition":
        return requisition(args, profile, hasPermission);
      case "setControlQuantity":
        return setQuantity(args, profile, hasPermission);
      case "createControlDestructionNote":
        return destructionNote(args, profile, hasPermission);
      default:
        return fail(`Unknown action: ${name}`);
    }
  } catch (error) {
    return fail(friendlyError(error, error instanceof Error ? error.message : "Action failed."));
  }
}

async function createControlProduct(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = needAny(hasPermission, ["control.perform", "masters.manage"], "Controlled Sample or Masters");
  if (blocked) return blocked;
  const productName = str(args, "productName");
  if (productName.length < 2) return fail("Product name is required.");
  const existing = (await listControlProducts()).find((p) => eq(p.productName, productName));
  if (existing) {
    return ok({
      alreadyExists: true,
      id: existing.id,
      productName: existing.productName,
      message: "Controlled sample product already exists.",
      href: "/stability/control-samples/products",
    });
  }
  const payload = {
    productName,
    genericName: str(args, "genericName") || undefined,
    strength: str(args, "strength") || undefined,
    dosageForm: str(args, "dosageForm") || undefined,
    status: (str(args, "status") || "Active") as MasterStatus,
  };
  const created = await createMaster(COLLECTIONS.controlSampleProducts, payload);
  await audit(profile, "controlSampleProduct", created.id, payload);
  return ok({ id: created.id, productName, href: "/stability/control-samples/products" });
}

async function createControlBatch(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = needAny(hasPermission, ["control.perform", "masters.manage"], "Controlled Sample or Masters");
  if (blocked) return blocked;
  const productName = str(args, "productName");
  const batchNumber = str(args, "batchNumber");
  const manufacturingDate = fromMonthInput(str(args, "manufacturingDate"));
  const expiryDate = fromMonthInput(str(args, "expiryDate"), "end");
  if (!productName || !batchNumber || !manufacturingDate || !expiryDate) {
    return fail("Product name, batch number, manufacturing date, and expiry date are required.");
  }
  if (expiryDate < manufacturingDate) return fail("Expiry date cannot be before manufacturing date.");
  const product = pick(
    (await listControlProducts()).filter((p) => p.status === "Active"),
    (p) => eq(p.productName, productName) || eq(p.productCode, productName),
    "controlled sample product",
    (p) => p.productName
  );
  if (isFail(product)) return product;
  const dup = (await listControlBatches(product.id)).find((b) => eq(b.batchNumber, batchNumber));
  if (dup) {
    return ok({
      alreadyExists: true,
      id: dup.id,
      batchNumber: dup.batchNumber,
      href: "/stability/control-samples/batches",
    });
  }
  const payload = {
    productId: product.id,
    productName: product.productName,
    batchNumber,
    manufacturingDate,
    expiryDate,
    releaseDate: str(args, "releaseDate") || undefined,
    batchSize: str(args, "batchSize") || undefined,
    status: (str(args, "status") || "Active") as MasterStatus,
  };
  const created = await createMaster(COLLECTIONS.controlSampleBatches, payload);
  await audit(profile, "controlSampleBatch", created.id, payload);
  return ok({
    id: created.id,
    productName: product.productName,
    batchNumber,
    href: "/stability/control-samples/batches",
  });
}

async function collectControlSample(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = needAny(hasPermission, ["control.collect", "control.perform"], "Controlled Sample Collection");
  if (blocked) return blocked;
  const productName = str(args, "productName");
  const batchNumber = str(args, "batchNumber");
  const actualQuantity = num(args, "actualQuantity");
  const marketName = str(args, "market");
  const stage = (str(args, "collectionStage") || "Initial") as CollectionStage;
  if (!productName || !batchNumber) return fail("Product name and batch number are required.");
  if (!["Initial", "Middle", "End"].includes(stage)) return fail("Collection stage must be Initial, Middle, or End.");
  if (!Number.isFinite(actualQuantity) || actualQuantity <= 0) {
    return fail("Actual quantity collected must be greater than zero.");
  }
  if (!marketName) return fail("Market is required.");

  const product = pick(
    (await listControlProducts()).filter((p) => p.status === "Active"),
    (p) => eq(p.productName, productName) || eq(p.productCode, productName),
    "controlled sample product",
    (p) => p.productName
  );
  if (isFail(product)) return product;
  const batch = pick(
    (await listControlBatches(product.id)).filter((b) => b.status === "Active"),
    (b) => eq(b.batchNumber, batchNumber),
    "controlled sample batch",
    (b) => b.batchNumber
  );
  if (isFail(batch)) return batch;
  if (!batch.manufacturingDate || !batch.expiryDate) {
    return fail("This batch is missing manufacturing or expiry date. Update the batch master first.");
  }
  if (batch.manufacturingDate > batch.expiryDate) {
    return fail("Manufacturing date must be on or before expiry date.");
  }

  const markets = (await listMarkets()).filter((m) => m.status === "Active");
  const market = markets.find((m) => eq(m.name, marketName));
  const qtyMaster = await getActiveQuantityMaster(product.id);
  const unitKey = str(args, "unit") || qtyMaster?.unit || "";
  if (!unitKey) return fail("Unit is required when the product has no active quantity master.");
  const units = (await listUnits()).filter((u) => u.status === "Active");
  const unit = units.find((u) => eq(u.name, unitKey) || eq(u.abbreviation, unitKey));

  const created = await createCollection({
    date: str(args, "collectionDate") || todayISO(),
    productId: product.id,
    productName: product.productName,
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    batchSize: batch.batchSize,
    manufacturingDate: batch.manufacturingDate,
    expiryDate: batch.expiryDate,
    marketId: market?.id,
    market: market?.name || marketName,
    requiredQuantity: qtyMaster?.quantity ?? 0,
    actualQuantity,
    unit: unit?.abbreviation || unitKey,
    collectionStage: stage,
    collectedBy: profile.displayName || profile.email,
    physicalAppearanceCheck: args.physicalAppearanceCheck !== false,
    codingDetailsCheck: args.codingDetailsCheck !== false,
    batchKind: "Standard",
    remarks: str(args, "remarks") || undefined,
    user: profile,
    finalize: true,
  });
  return ok({
    collectionId: created.collectionId,
    status: created.status,
    productName: product.productName,
    batchNumber: batch.batchNumber,
    href: "/stability/control-samples/collection",
    next: "Submit this collection to the Controlled Sample Room, then QA receives and verifies it.",
  });
}

async function advanceControlCollection(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const action = str(args, "action");
  const key = str(args, "collectionId");
  if (!key) return fail("Collection ID is required.");
  if (!["submit", "receive", "verify", "exception"].includes(action)) {
    return fail("Action must be submit, receive, verify, or exception.");
  }
  if (action === "submit") {
    const blocked = needAny(hasPermission, ["control.collect", "control.perform"], "Controlled Sample Collection");
    if (blocked) return blocked;
  } else {
    const blocked = need(hasPermission, "control.perform", "Controlled Sample (QA)");
    if (blocked) return blocked;
  }

  const row = pick(
    await listCollections(),
    (c) => eq(c.collectionId, key) || eq(c.id, key),
    "collection",
    (c) => `${c.collectionId} — ${c.productName} / ${c.batchNumber} (${c.status})`
  );
  if (isFail(row)) return row;

  if (action === "submit") {
    if (row.status === "Draft") await finalizeCollection(row.id, profile);
    await submitCollection(row.id, profile);
    return ok({ collectionId: row.collectionId, status: "Submitted", href: "/stability/control-samples/collection" });
  }
  if (action === "receive") {
    await receiveCollection(row.id, profile);
    return ok({ collectionId: row.collectionId, status: "Received", href: "/stability/control-samples/collection" });
  }
  if (action === "exception") {
    const discrepancy = str(args, "discrepancy");
    const remarks = str(args, "remarks");
    if (!discrepancy || !remarks) return fail("Discrepancy and remarks are required for a verification exception.");
    await recordVerificationException(row.id, { discrepancy, remarks, user: profile });
    return ok({ collectionId: row.collectionId, status: "Verification Exception", href: "/stability/control-samples/collection" });
  }
  const created = await verifyAndLogCollection(row.id, profile);
  return ok({
    collectionId: row.collectionId,
    controlSampleId: created.controlSampleId,
    status: "Verified",
    href: "/stability/control-samples/register",
    next: "Store the sample in a rack and box.",
  });
}

async function storeSample(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "control.perform", "Controlled Sample (QA)");
  if (blocked) return blocked;
  const sampleKey = str(args, "controlSampleId");
  const storageArea = str(args, "storageArea");
  const rackNumber = str(args, "rackNumber");
  const boxNumber = str(args, "boxNumber");
  if (!sampleKey || !storageArea || !rackNumber || !boxNumber) {
    return fail("Controlled sample ID, storage area, rack, and box are required.");
  }
  const sample = await findControlSample(sampleKey);
  if (isFail(sample)) return sample;
  await storeControlSample({
    id: sample.id,
    storageArea,
    rackNumber,
    partitionNumber: str(args, "partitionNumber") || undefined,
    boxNumber,
    position: str(args, "position") || undefined,
    user: profile,
  });
  return ok({
    controlSampleId: sample.controlSampleId,
    location: [storageArea, rackNumber, str(args, "partitionNumber"), boxNumber].filter(Boolean).join(" / "),
    href: "/stability/control-samples/register",
  });
}

async function observe(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "control.perform", "Controlled Sample (QA)");
  if (blocked) return blocked;
  const sampleKey = str(args, "controlSampleId");
  const result = str(args, "result") as "OK" | "Abnormal Observation";
  if (!sampleKey) return fail("Controlled sample ID is required.");
  if (result !== "OK" && result !== "Abnormal Observation") {
    return fail("Result must be OK or Abnormal Observation.");
  }
  const sample = await findControlSample(sampleKey);
  if (isFail(sample)) return sample;
  const productType = str(args, "productType") || DEFAULT_OBSERVATION_TEMPLATES[0].productType;
  const configured = (await listObservationParameters()).filter((p) => p.productType === productType && p.status === "Active");
  const template = DEFAULT_OBSERVATION_TEMPLATES.find((t) => t.productType === productType);
  const params = configured.length ? configured.map((p) => p.parameter) : template?.parameters || [];
  const given = Array.isArray(args.checklist)
    ? (args.checklist as { parameter?: string; result?: string }[])
    : [];
  const checklist = given.length
    ? given.map((row) => ({ parameter: String(row.parameter || ""), result: String(row.result || "") }))
    : params.map((parameter) => ({ parameter, result }));
  const discardedQuantity = Number.isFinite(num(args, "discardedQuantity")) ? num(args, "discardedQuantity") : 0;
  const other = str(args, "otherObservation");
  if (result === "Abnormal Observation" && !other) {
    return fail("Describe the abnormal observation before saving.");
  }
  const saved = await recordObservation({
    controlSampleDocId: sample.id,
    productType,
    checklist,
    otherObservation: other || undefined,
    result,
    discardedQuantity,
    natureOfObservation: other || undefined,
    remarks: str(args, "remarks") || undefined,
    user: profile,
  });
  return ok({
    observationId: saved.observationId,
    controlSampleId: sample.controlSampleId,
    result,
    href: "/stability/control-samples/observation",
  });
}

async function requisition(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "control.perform", "Controlled Sample (QA)");
  if (blocked) return blocked;
  const sampleKey = str(args, "controlSampleId");
  const fromDepartment = str(args, "fromDepartment");
  const reason = str(args, "reason");
  const quantityRequired = num(args, "quantityRequired");
  if (!sampleKey || !fromDepartment || !reason) {
    return fail("Controlled sample ID, department, and reason are required.");
  }
  if (!Number.isFinite(quantityRequired) || quantityRequired <= 0) {
    return fail("Quantity required must be greater than zero.");
  }
  const sample = await findControlSample(sampleKey);
  if (isFail(sample)) return sample;
  const created = await createRequisition({
    fromDepartment,
    controlSampleDocId: sample.id,
    quantityRequired,
    reason,
    remarks: str(args, "remarks") || undefined,
    user: profile,
  });
  return ok({
    requisitionNumber: created.requisitionNumber,
    status: created.status,
    href: "/stability/control-samples/withdrawal",
    next: "Issue stays blocked until a QA Manager approves the requisition.",
  });
}

async function setQuantity(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = needAny(hasPermission, ["control.perform", "masters.manage"], "Controlled Sample or Masters");
  if (blocked) return blocked;
  const productName = str(args, "productName");
  const quantity = num(args, "quantity");
  const unit = str(args, "unit");
  const effectiveDate = str(args, "effectiveDate") || todayISO();
  if (!productName || !unit) return fail("Product name and unit are required.");
  if (!Number.isFinite(quantity) || quantity <= 0) return fail("Required quantity must be greater than zero.");
  const product = pick(
    (await listControlProducts()).filter((p) => p.status === "Active"),
    (p) => eq(p.productName, productName) || eq(p.productCode, productName),
    "controlled sample product",
    (p) => p.productName
  );
  if (isFail(product)) return product;
  const created = await createQuantityMasterRevision({
    productId: product.id,
    productName: product.productName,
    quantity,
    unit,
    effectiveDate,
    user: profile,
  });
  return ok({
    productName: product.productName,
    quantity,
    unit,
    revisionNumber: created.revisionNumber,
    href: "/stability/control-samples/quantity-master",
  });
}

async function destructionNote(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = needAny(hasPermission, ["control.perform", "disposal.perform"], "Controlled Sample or Disposal");
  if (blocked) return blocked;
  const sampleKey = str(args, "controlSampleId");
  const quantity = num(args, "quantity");
  const reason = str(args, "reason");
  if (!sampleKey || !reason) return fail("Controlled sample ID and reason are required.");
  if (!Number.isFinite(quantity) || quantity <= 0) return fail("Destruction quantity must be greater than zero.");
  const sample = await findControlSample(sampleKey);
  if (isFail(sample)) return sample;
  const created = await createDestructionNote({
    controlSampleDocId: sample.id,
    quantity,
    reason,
    modeOfDestruction: str(args, "modeOfDestruction") || undefined,
    remarks: str(args, "remarks") || undefined,
    user: profile,
  });
  return ok({
    dcnNumber: created.dcnNumber,
    controlSampleId: sample.controlSampleId,
    status: created.status,
    href: "/stability/control-samples/destruction/new",
    next: "QA Head still checks, completes the destruction checklist, and verifies the note on the Destruction screen.",
  });
}
