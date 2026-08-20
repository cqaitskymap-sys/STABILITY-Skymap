import type { Permission } from "@/lib/permissions";
import { COLLECTIONS } from "@/lib/firebase/config";
import { friendlyError, todayISO } from "@/lib/utils";
import { writeAuditLog } from "@/services/audit";
import { invalidateInventoryContext } from "@/lib/ai/inventory-context";
import {
  acknowledgeAlert,
  createStudyAndCharge,
  disposeSample,
  listAlerts,
  listPullPoints as listStudyPulls,
  listSamples,
  moveSample,
  reconcileSample,
  withdrawSample,
} from "@/services/inventory";
import {
  buildLocationLabel,
  createMaster,
  listBatches,
  listChambers,
  listLocations,
  listProducts,
  listPullPoints,
  listStorageConditions,
  listStudyTypes,
  listUnits,
} from "@/services/masters";
import type { AppUser, Chamber, MasterStatus } from "@/types";

type PermFn = (permission: Permission) => boolean;

export type ToolResult = { ok: true; [key: string]: unknown } | Fail;

const WRITE_TOOLS = new Set([
  "createProduct",
  "createBatch",
  "createStudyType",
  "createStorageCondition",
  "createPullPoint",
  "createChamber",
  "createLocation",
  "createUnit",
  "chargeStudy",
  "withdrawSample",
  "moveSample",
  "disposeSample",
  "reconcileSample",
  "acknowledgeAlert",
]);

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

type Fail = { ok: false; error: string };

function pick<T>(
  items: T[],
  matcher: (item: T) => boolean,
  label: string,
  format: (item: T) => string
): T | Fail {
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

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function str(input: Record<string, unknown>, key: string) {
  return String(input[key] ?? "").trim();
}

function num(input: Record<string, unknown>, key: string) {
  return Number(input[key]);
}

export async function executeSkymapTool(input: {
  name: string;
  input: unknown;
  profile: AppUser | null;
  hasPermission: PermFn;
}): Promise<ToolResult> {
  const { name, profile, hasPermission } = input;
  const args = asRecord(input.input);

  try {
    if (WRITE_TOOLS.has(name) && !profile?.active) {
      return fail("Sign in with an active account to make changes.");
    }

    const result = await runTool(name, args, profile, hasPermission);
    if (result.ok && WRITE_TOOLS.has(name)) invalidateInventoryContext();
    return result;
  } catch (error) {
    return fail(friendlyError(error, error instanceof Error ? error.message : "Action failed."));
  }
}

async function runTool(
  name: string,
  args: Record<string, unknown>,
  profile: AppUser | null,
  hasPermission: PermFn
): Promise<ToolResult> {
  switch (name) {
    case "listCatalog":
      return listCatalog(str(args, "kind"), str(args, "query") || undefined);
    case "createProduct":
      return createProduct(args, profile!, hasPermission);
    case "createBatch":
      return createBatch(args, profile!, hasPermission);
    case "createStudyType":
      return createStudyType(args, profile!, hasPermission);
    case "createStorageCondition":
      return createStorageCondition(args, profile!, hasPermission);
    case "createPullPoint":
      return createPullPoint(args, profile!, hasPermission);
    case "createChamber":
      return createChamber(args, profile!, hasPermission);
    case "createLocation":
      return createLocation(args, profile!, hasPermission);
    case "createUnit":
      return createUnit(args, profile!, hasPermission);
    case "chargeStudy":
      return chargeStudy(args, profile!, hasPermission);
    case "withdrawSample":
      return withdraw(args, profile!, hasPermission);
    case "moveSample":
      return move(args, profile!, hasPermission);
    case "disposeSample":
      return dispose(args, profile!, hasPermission);
    case "reconcileSample":
      return reconcile(args, profile!, hasPermission);
    case "acknowledgeAlert":
      return ackAlert(args, hasPermission);
    default:
      return fail(`Unknown action: ${name}`);
  }
}

async function listCatalog(kind: string, query?: string): Promise<ToolResult> {
  switch (kind) {
    case "products": {
      const rows = (await listProducts())
        .filter((p) => includesQ(p, query))
        .slice(0, 40)
        .map((p) => ({
          id: p.id,
          productName: p.productName,
          productCode: p.productCode || "",
          strength: p.strength || "",
          dosageForm: p.dosageForm || "",
          status: p.status,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "batches": {
      const rows = (await listBatches())
        .filter((b) => includesQ(b, query))
        .slice(0, 40)
        .map((b) => ({
          id: b.id,
          productName: b.productName,
          batchNumber: b.batchNumber,
          manufacturingDate: b.manufacturingDate,
          expiryDate: b.expiryDate,
          status: b.status,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "studyTypes": {
      const rows = (await listStudyTypes())
        .filter((s) => includesQ(s, query))
        .map((s) => ({ id: s.id, name: s.name, code: s.code, status: s.status }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "storageConditions": {
      const rows = (await listStorageConditions())
        .filter((c) => includesQ(c, query))
        .map((c) => ({
          id: c.id,
          name: c.name,
          displayLabel: c.displayLabel,
          temperature: c.temperature,
          relativeHumidity: c.relativeHumidity,
          status: c.status,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "pullPoints": {
      const rows = (await listPullPoints())
        .filter((p) => includesQ(p, query))
        .map((p) => ({ id: p.id, code: p.code, label: p.label, months: p.months, status: p.status }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "chambers": {
      const rows = (await listChambers())
        .filter((c) => includesQ(c, query))
        .map((c) => ({
          id: c.id,
          chamberId: c.chamberId,
          chamberName: c.chamberName,
          capacity: c.capacity,
          usedCapacity: c.usedCapacity,
          status: c.status,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "locations": {
      const rows = (await listLocations())
        .filter((l) => includesQ(l, query))
        .slice(0, 50)
        .map((l) => ({
          id: l.id,
          label: l.label,
          chamberName: l.chamberName,
          rack: l.rack,
          shelf: l.shelf,
          position: l.position,
          status: l.status,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "units": {
      const rows = (await listUnits())
        .filter((u) => includesQ(u, query))
        .map((u) => ({ id: u.id, name: u.name, abbreviation: u.abbreviation, status: u.status }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "samples": {
      const rows = (await listSamples())
        .filter((s) => includesQ(s, query))
        .slice(0, 40)
        .map((s) => ({
          id: s.id,
          sampleId: s.sampleId,
          productName: s.productName,
          batchNumber: s.batchNumber,
          availableQuantity: s.availableQuantity,
          chamberName: s.chamberName,
          locationLabel: s.locationLabel,
          status: s.status,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "duePulls": {
      const open = ["Upcoming", "Due Soon", "Due Today", "Overdue", "Partially Withdrawn"];
      const rows = (await listStudyPulls())
        .filter((p) => open.includes(p.status))
        .filter((p) => includesQ(p, query))
        .slice(0, 40)
        .map((p) => ({
          pullPointDocId: p.id,
          sampleId: p.sampleId,
          productName: p.productName,
          batchNumber: p.batchNumber,
          pullPoint: p.pullPoint,
          plannedDate: p.plannedDate,
          plannedQuantity: p.plannedQuantity,
          actualQuantity: p.actualQuantity,
          status: p.status,
        }));
      return ok({ kind, count: rows.length, records: rows });
    }
    case "alerts": {
      const rows = (await listAlerts())
        .filter((a) => !a.acknowledged)
        .filter((a) => includesQ(a, query))
        .slice(0, 30)
        .map((a) => ({ id: a.id, title: a.title, severity: a.severity, message: a.message }));
      return ok({ kind, count: rows.length, records: rows });
    }
    default:
      return fail(`Unknown catalog: ${kind}`);
  }
}

async function createProduct(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "masters.manage", "Masters");
  if (blocked) return blocked;
  const productName = str(args, "productName");
  if (productName.length < 2) return fail("Product name is required.");
  const existing = (await listProducts()).find((p) => eq(p.productName, productName));
  if (existing) {
    return ok({
      alreadyExists: true,
      id: existing.id,
      productName: existing.productName,
      message: "Product already exists.",
    });
  }
  const payload = {
    productName,
    productCode: str(args, "productCode") || undefined,
    strength: str(args, "strength") || undefined,
    dosageForm: str(args, "dosageForm") || undefined,
    status: (str(args, "status") || "Active") as MasterStatus,
  };
  const created = await createMaster(COLLECTIONS.products, payload);
  await audit(profile, "product", created.id, payload);
  return ok({ id: created.id, productName, href: "/masters/products" });
}

async function createBatch(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "masters.manage", "Masters");
  if (blocked) return blocked;
  const productName = str(args, "productName");
  const batchNumber = str(args, "batchNumber");
  const manufacturingDate = str(args, "manufacturingDate");
  const expiryDate = str(args, "expiryDate");
  if (!productName || !batchNumber || !manufacturingDate || !expiryDate) {
    return fail("Product name, batch number, manufacturing date, and expiry date are required.");
  }
  if (expiryDate < manufacturingDate) return fail("Expiry date cannot be before manufacturing date.");
  const product = pick(
    (await listProducts()).filter((p) => p.status === "Active"),
    (p) => eq(p.productName, productName) || eq(p.productCode, productName),
    "product",
    (p) => p.productName
  );
  if (isFail(product)) return product;
  const dup = (await listBatches(product.id)).find((b) => eq(b.batchNumber, batchNumber));
  if (dup) return ok({ alreadyExists: true, id: dup.id, batchNumber: dup.batchNumber });
  const payload = {
    productId: product.id,
    productName: product.productName,
    batchNumber,
    manufacturingDate,
    expiryDate,
    status: (str(args, "status") || "Active") as MasterStatus,
  };
  const created = await createMaster(COLLECTIONS.batches, payload);
  await audit(profile, "batch", created.id, payload);
  return ok({ id: created.id, productName: product.productName, batchNumber, href: "/masters/batches" });
}

async function createStudyType(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "masters.manage", "Masters");
  if (blocked) return blocked;
  const name = str(args, "name");
  const code = str(args, "code").toUpperCase();
  if (!name || !code) return fail("Name and code are required.");
  if (!/^[A-Z0-9][A-Z0-9_-]{0,15}$/.test(code)) {
    return fail("Code must be 1–16 characters: letters, numbers, hyphen, or underscore.");
  }
  const items = await listStudyTypes();
  if (items.some((i) => eq(i.name, name))) return fail("A study type with this name already exists.");
  if (items.some((i) => i.code.toUpperCase() === code)) return fail("A study type with this code already exists.");
  const maxSort = items.reduce((m, i) => Math.max(m, Number(i.sortOrder) || 0), 0);
  const payload = {
    name,
    code,
    description: str(args, "description") || undefined,
    sortOrder: Number.isFinite(num(args, "sortOrder")) ? num(args, "sortOrder") : maxSort + 1,
    status: (str(args, "status") || "Active") as MasterStatus,
    defaultPullPointIds: [] as string[],
  };
  const created = await createMaster(COLLECTIONS.studyTypes, payload);
  await audit(profile, "studyType", created.id, payload);
  return ok({ id: created.id, name, code, href: "/masters/study-types" });
}

async function createStorageCondition(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "masters.manage", "Masters");
  if (blocked) return blocked;
  const name = str(args, "name");
  const temperature = str(args, "temperature");
  const relativeHumidity = str(args, "relativeHumidity");
  if (!name || !temperature || !relativeHumidity) {
    return fail("Name, temperature, and relative humidity are required.");
  }
  const displayLabel = str(args, "displayLabel") || `${temperature} / ${relativeHumidity}`;
  const items = await listStorageConditions();
  if (items.some((i) => eq(i.name, name))) return fail("A storage condition with this name already exists.");
  const payload = {
    name,
    temperature,
    relativeHumidity,
    displayLabel,
    status: (str(args, "status") || "Active") as MasterStatus,
  };
  const created = await createMaster(COLLECTIONS.storageConditions, payload);
  await audit(profile, "storageCondition", created.id, payload);
  return ok({ id: created.id, name, displayLabel, href: "/masters/storage-conditions" });
}

async function createPullPoint(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "masters.manage", "Masters");
  if (blocked) return blocked;
  const code = str(args, "code").toUpperCase();
  const label = str(args, "label");
  const months = num(args, "months");
  if (!code || !label || !Number.isFinite(months) || months <= 0) {
    return fail("Code, label, and months (> 0) are required.");
  }
  if (!/^[A-Z0-9][A-Z0-9_-]{0,15}$/.test(code)) {
    return fail("Code must be 1–16 characters: letters, numbers, hyphen, or underscore.");
  }
  const items = await listPullPoints();
  if (items.some((i) => i.code.toUpperCase() === code)) return fail("A pull point with this code already exists.");
  const studyTypes = await listStudyTypes();
  const names = Array.isArray(args.studyTypeNames) ? (args.studyTypeNames as unknown[]).map(String) : [];
  const studyTypeIds: string[] = [];
  for (const n of names) {
    const st = pick(
      studyTypes.filter((s) => s.status === "Active"),
      (s) => eq(s.name, n) || eq(s.code, n),
      `study type ${n}`,
      (s) => `${s.name} (${s.code})`
    );
    if (isFail(st)) return st;
    studyTypeIds.push(st.id);
  }
  const maxSort = items.reduce((m, i) => Math.max(m, Number(i.sortOrder) || 0), 0);
  const payload = {
    code,
    label,
    months,
    sortOrder: Number.isFinite(num(args, "sortOrder")) ? num(args, "sortOrder") : maxSort + 1,
    studyTypeIds,
    status: (str(args, "status") || "Active") as MasterStatus,
  };
  const created = await createMaster(COLLECTIONS.pullPoints, payload);
  await audit(profile, "pullPoint", created.id, payload);
  return ok({ id: created.id, code, label, href: "/masters/pull-points" });
}

async function createChamber(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "masters.manage", "Masters");
  if (blocked) return blocked;
  const chamberId = str(args, "chamberId").toUpperCase();
  const chamberName = str(args, "chamberName");
  const temperature = str(args, "temperature");
  const relativeHumidity = str(args, "relativeHumidity");
  const capacity = num(args, "capacity");
  const location = str(args, "location");
  if (!chamberId || chamberName.length < 2 || !temperature || !relativeHumidity || !location) {
    return fail("Chamber ID, name, temperature, RH, and physical location are required.");
  }
  if (!/^[A-Z0-9][A-Z0-9_-]{1,23}$/.test(chamberId)) {
    return fail("Chamber ID must be 2–24 characters: letters, numbers, hyphen, or underscore.");
  }
  if (!Number.isFinite(capacity) || capacity <= 0) return fail("Capacity must be greater than zero.");
  const items = await listChambers();
  if (items.some((i) => i.chamberId.trim().toUpperCase() === chamberId)) {
    return fail("A chamber with this Chamber ID already exists.");
  }
  if (items.some((i) => eq(i.chamberName, chamberName))) return fail("A chamber with this name already exists.");
  const payload = {
    chamberId,
    chamberName,
    chamberType: str(args, "chamberType") || "Walk-in",
    temperature,
    relativeHumidity,
    capacity,
    location,
    status: (str(args, "status") || "Active") as Chamber["status"],
    usedCapacity: 0,
  };
  const created = await createMaster(COLLECTIONS.chambers, payload);
  await audit(profile, "chamber", created.id, payload);
  return ok({ id: created.id, chamberId, chamberName, href: "/masters/chambers" });
}

async function createLocation(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "masters.manage", "Masters");
  if (blocked) return blocked;
  const chamberKey = str(args, "chamber");
  const rack = str(args, "rack");
  const shelf = str(args, "shelf");
  const position = str(args, "position");
  if (!chamberKey || !rack || !shelf || !position) {
    return fail("Chamber, rack, shelf, and position are required.");
  }
  const chamber = pick(
    await listChambers(),
    (c) => eq(c.chamberName, chamberKey) || eq(c.chamberId, chamberKey),
    "chamber",
    (c) => `${c.chamberId} — ${c.chamberName}`
  );
  if (isFail(chamber)) return chamber;
  if (chamber.status === "Inactive") return fail("Cannot create locations in an inactive chamber.");
  const items = await listLocations();
  const dup = items.some(
    (i) =>
      i.chamberId === chamber.id &&
      eq(i.rack, rack) &&
      eq(i.shelf, shelf) &&
      eq(i.position, position)
  );
  if (dup) return fail("This rack / shelf / position already exists in the selected chamber.");
  const label = buildLocationLabel(chamber.chamberName, rack, shelf, position);
  const payload = {
    chamberId: chamber.id,
    chamberName: chamber.chamberName,
    rack,
    shelf,
    position,
    label,
    status: (str(args, "status") || "Active") as MasterStatus,
  };
  const created = await createMaster(COLLECTIONS.storageLocations, payload);
  await audit(profile, "storageLocation", created.id, payload);
  return ok({ id: created.id, label, href: "/masters/locations" });
}

async function createUnit(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "masters.manage", "Masters");
  if (blocked) return blocked;
  const name = str(args, "name");
  const abbreviation = str(args, "abbreviation");
  if (!name || !abbreviation) return fail("Name and abbreviation are required.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,11}$/.test(abbreviation)) {
    return fail("Abbreviation must start with a letter/number; max 12 chars.");
  }
  const items = await listUnits();
  if (items.some((i) => eq(i.name, name))) return fail("A unit with this name already exists.");
  if (items.some((i) => eq(i.abbreviation, abbreviation))) {
    return fail("A unit with this abbreviation already exists.");
  }
  const payload = {
    name,
    abbreviation,
    status: (str(args, "status") || "Active") as MasterStatus,
  };
  const created = await createMaster(COLLECTIONS.units, payload);
  await audit(profile, "unit", created.id, payload);
  return ok({ id: created.id, name, abbreviation, href: "/masters/units" });
}

async function chargeStudy(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  if (!hasPermission("studies.create") && !hasPermission("charging.perform")) {
    return fail("You do not have Create Studies or Sample Charging permission.");
  }
  const productName = str(args, "productName");
  const batchNumber = str(args, "batchNumber");
  const studyTypeKey = str(args, "studyType");
  const conditionKey = str(args, "storageCondition");
  const chamberKey = str(args, "chamber");
  const rack = str(args, "rack");
  const shelf = str(args, "shelf");
  const position = str(args, "position");
  const unitKey = str(args, "unit");
  const totalQuantity = num(args, "totalQuantity");
  const reservedQuantity = Number.isFinite(num(args, "reservedQuantity")) ? num(args, "reservedQuantity") : 0;
  const chargingDate = str(args, "chargingDate") || todayISO();
  const allocations = Array.isArray(args.pullAllocations)
    ? (args.pullAllocations as { code?: string; quantity?: number }[])
    : [];

  if (!productName || !batchNumber || !studyTypeKey || !conditionKey || !chamberKey) {
    return fail("Product, batch, study type, storage condition, and chamber are required.");
  }
  if (!rack || !shelf || !position) return fail("Rack, shelf, and position are required for the storage slot.");
  if (!unitKey) return fail("Unit is required.");
  if (!Number.isFinite(totalQuantity) || totalQuantity <= 0) return fail("Total quantity must be greater than zero.");
  if (!allocations.length) return fail("Provide at least one pull allocation, e.g. 3M = 10.");

  const product = pick(
    (await listProducts()).filter((p) => p.status === "Active"),
    (p) => eq(p.productName, productName) || eq(p.productCode, productName),
    "product",
    (p) => p.productName
  );
  if (isFail(product)) return product;

  const batch = pick(
    (await listBatches(product.id)).filter((b) => b.status === "Active"),
    (b) => eq(b.batchNumber, batchNumber),
    "batch",
    (b) => b.batchNumber
  );
  if (isFail(batch)) return batch;

  const studyType = pick(
    (await listStudyTypes()).filter((s) => s.status === "Active"),
    (s) => eq(s.name, studyTypeKey) || eq(s.code, studyTypeKey),
    "study type",
    (s) => `${s.name} (${s.code})`
  );
  if (isFail(studyType)) return studyType;

  const condition = pick(
    (await listStorageConditions()).filter((c) => c.status === "Active"),
    (c) => eq(c.name, conditionKey) || eq(c.displayLabel, conditionKey),
    "storage condition",
    (c) => c.displayLabel || c.name
  );
  if (isFail(condition)) return condition;

  const chamber = pick(
    await listChambers(),
    (c) => eq(c.chamberName, chamberKey) || eq(c.chamberId, chamberKey),
    "chamber",
    (c) => `${c.chamberId} — ${c.chamberName}`
  );
  if (isFail(chamber)) return chamber;

  const location = pick(
    (await listLocations()).filter((l) => l.status === "Active" && l.chamberId === chamber.id),
    (l) => eq(l.rack, rack) && eq(l.shelf, shelf) && eq(l.position, position),
    "location",
    (l) => l.label
  );
  if (isFail(location)) return location;

  const unit = pick(
    (await listUnits()).filter((u) => u.status === "Active"),
    (u) => eq(u.name, unitKey) || eq(u.abbreviation, unitKey),
    "unit",
    (u) => `${u.name} (${u.abbreviation})`
  );
  if (isFail(unit)) return unit;

  const pullMasters = (await listPullPoints()).filter(
    (p) =>
      p.status === "Active" &&
      (!p.studyTypeIds?.length || p.studyTypeIds.includes(studyType.id))
  );
  const pullAllocations: { code: string; months: number; quantity: number }[] = [];
  for (const row of allocations) {
    const code = String(row.code || "").trim();
    const quantity = Number(row.quantity);
    if (!code || !Number.isFinite(quantity) || quantity <= 0) {
      return fail("Each pull allocation needs a code and quantity > 0.");
    }
    const pull = pick(
      pullMasters,
      (p) => eq(p.code, code) || eq(p.label, code),
      `pull point ${code}`,
      (p) => p.code
    );
    if (isFail(pull)) return pull;
    pullAllocations.push({ code: pull.code, months: pull.months, quantity });
  }

  const created = await createStudyAndCharge({
    productId: product.id,
    productName: product.productName,
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    manufacturingDate: batch.manufacturingDate,
    expiryDate: batch.expiryDate,
    chargingDate,
    studyTypeId: studyType.id,
    studyType: studyType.name,
    storageConditionId: condition.id,
    storageCondition: condition.displayLabel || condition.name,
    chamberId: chamber.id,
    chamberName: chamber.chamberName,
    locationId: location.id,
    locationLabel: location.label,
    totalQuantity,
    reservedQuantity,
    unit: unit.abbreviation || unit.name,
    notes: str(args, "notes") || undefined,
    duration: `${Math.max(...pullAllocations.map((p) => p.months))}M`,
    pullAllocations,
    user: profile,
  });

  return ok({
    studyId: created.studyId,
    sampleId: created.sampleId,
    href: `/stability/studies/${created.studyDocId}`,
  });
}

async function withdraw(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "withdrawal.perform", "Withdrawals");
  if (blocked) return blocked;
  const actualQuantity = num(args, "actualQuantity");
  if (!Number.isFinite(actualQuantity) || actualQuantity <= 0) {
    return fail("Withdrawal quantity must be greater than zero.");
  }

  let pullPointDocId = str(args, "pullPointDocId");
  if (!pullPointDocId) {
    const sampleId = str(args, "sampleId");
    const productName = str(args, "productName");
    const batchNumber = str(args, "batchNumber");
    const pullPoint = str(args, "pullPoint");
    const open = ["Upcoming", "Due Soon", "Due Today", "Overdue", "Partially Withdrawn"];
    const pulls = (await listStudyPulls()).filter((p) => open.includes(p.status));
    const match = pick(
      pulls,
      (p) =>
        (sampleId ? eq(p.sampleId, sampleId) : true) &&
        (productName ? eq(p.productName, productName) : true) &&
        (batchNumber ? eq(p.batchNumber, batchNumber) : true) &&
        (pullPoint ? eq(p.pullPoint, pullPoint) || String(p.pullPoint).toLowerCase().includes(pullPoint.toLowerCase()) : true),
      "due pull",
      (p) => `${p.productName} / ${p.batchNumber} / ${p.pullPoint} (${p.id})`
    );
    if (isFail(match)) return match;
    pullPointDocId = match.id;
  }

  const result = await withdrawSample({
    pullPointDocId,
    actualQuantity,
    withdrawalDate: str(args, "withdrawalDate") || todayISO(),
    withdrawnBy: profile.displayName || profile.email,
    receivedBy: str(args, "receivedBy") || profile.displayName || profile.email,
    remarks: str(args, "remarks") || undefined,
    user: profile,
  });
  return ok({ withdrawalId: result.withdrawalId });
}

async function move(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "movement.perform", "Movement");
  if (blocked) return blocked;
  const sampleId = str(args, "sampleId");
  const toChamberKey = str(args, "toChamber");
  const rack = str(args, "rack");
  const shelf = str(args, "shelf");
  const position = str(args, "position");
  const reason = str(args, "reason");
  if (!sampleId || !toChamberKey || !rack || !shelf || !position || !reason) {
    return fail("Sample ID, destination chamber, rack, shelf, position, and reason are required.");
  }
  const sample = pick(
    await listSamples(),
    (s) => eq(s.sampleId, sampleId) || eq(s.id, sampleId),
    "sample",
    (s) => s.sampleId
  );
  if (isFail(sample)) return sample;
  const chamber = pick(
    await listChambers(),
    (c) => eq(c.chamberName, toChamberKey) || eq(c.chamberId, toChamberKey),
    "chamber",
    (c) => `${c.chamberId} — ${c.chamberName}`
  );
  if (isFail(chamber)) return chamber;
  const location = pick(
    (await listLocations()).filter((l) => l.chamberId === chamber.id && l.status === "Active"),
    (l) => eq(l.rack, rack) && eq(l.shelf, shelf) && eq(l.position, position),
    "location",
    (l) => l.label
  );
  if (isFail(location)) return location;

  const result = await moveSample({
    sampleDocId: sample.id,
    toChamberId: chamber.id,
    toChamberName: chamber.chamberName,
    toLocationId: location.id,
    toLocationLabel: location.label,
    movementDate: str(args, "movementDate") || todayISO(),
    movedBy: profile.displayName || profile.email,
    reason,
    remarks: str(args, "remarks") || undefined,
    user: profile,
  });
  return ok({ movementId: result.movementId, location: location.label });
}

async function dispose(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "disposal.perform", "Disposal");
  if (blocked) return blocked;
  const sampleId = str(args, "sampleId");
  const quantity = num(args, "quantity");
  const reason = str(args, "reason") as
    | "Study Completed"
    | "Expired"
    | "Damaged"
    | "Excess Sample"
    | "Other";
  if (!sampleId || !Number.isFinite(quantity) || quantity <= 0 || !reason) {
    return fail("Sample ID, quantity, and reason are required.");
  }
  const sample = pick(
    await listSamples(),
    (s) => eq(s.sampleId, sampleId) || eq(s.id, sampleId),
    "sample",
    (s) => s.sampleId
  );
  if (isFail(sample)) return sample;
  const result = await disposeSample({
    sampleDocId: sample.id,
    quantity,
    disposalDate: str(args, "disposalDate") || todayISO(),
    reason,
    disposedBy: profile.displayName || profile.email,
    remarks: str(args, "remarks") || undefined,
    user: profile,
  });
  return ok({ disposalId: result.disposalId, remaining: result.remainingAvailable, status: result.status });
}

async function reconcile(args: Record<string, unknown>, profile: AppUser, hasPermission: PermFn) {
  const blocked = need(hasPermission, "reconciliation.perform", "Reconciliation");
  if (blocked) return blocked;
  const sampleId = str(args, "sampleId");
  const physicalQuantity = num(args, "physicalQuantity");
  if (!sampleId || !Number.isFinite(physicalQuantity) || physicalQuantity < 0) {
    return fail("Sample ID and physical quantity are required.");
  }
  const sample = pick(
    await listSamples(),
    (s) => eq(s.sampleId, sampleId) || eq(s.id, sampleId),
    "sample",
    (s) => s.sampleId
  );
  if (isFail(sample)) return sample;
  const result = await reconcileSample({
    sampleDocId: sample.id,
    physicalQuantity,
    adjust: Boolean(args.adjust),
    reason: str(args, "reason") || undefined,
    remarks: str(args, "remarks") || undefined,
    user: profile,
  });
  return ok({
    reconciliationId: result.reconciliationId,
    variance: result.variance,
    adjusted: Boolean(args.adjust),
  });
}

async function ackAlert(args: Record<string, unknown>, hasPermission: PermFn) {
  const blocked = need(hasPermission, "reports.view", "Reports & Alerts");
  if (blocked) return blocked;
  const title = str(args, "title");
  if (!title) return fail("Alert title is required.");
  const alerts = (await listAlerts()).filter((a) => !a.acknowledged);
  const match = pick(
    alerts,
    (a) => eq(a.title, title) || a.title.toLowerCase().includes(title.toLowerCase()) || eq(a.id, title),
    "alert",
    (a) => a.title
  );
  if (isFail(match)) return match;
  await acknowledgeAlert(match.id);
  return ok({ id: match.id, title: match.title });
}
