import type {
  AppUser,
  Batch,
  Chamber,
  Product,
  PullPointMaster,
  StorageCondition,
  StorageLocation,
  StudyType,
  Unit,
} from "@/types";

export type PullAllocationMap = Record<string, number>;

export interface ChargeFormState {
  productId: string;
  batchId: string;
  manufacturingDate: string;
  expiryDate: string;
  chargingDate: string;
  studyTypeId: string;
  storageConditionId: string;
  chamberId: string;
  locationId: string;
  totalQuantity: string;
  reservedQuantity: string;
  unit: string;
  notes: string;
  pullAllocations: PullAllocationMap;
}

export function emptyChargeForm(chargingDate: string): ChargeFormState {
  return {
    productId: "",
    batchId: "",
    manufacturingDate: "",
    expiryDate: "",
    chargingDate,
    studyTypeId: "",
    storageConditionId: "",
    chamberId: "",
    locationId: "",
    totalQuantity: "",
    reservedQuantity: "0",
    unit: "",
    notes: "",
    pullAllocations: {},
  };
}

export function activePullPointsForStudy(
  pullPoints: PullPointMaster[],
  studyTypeId: string
): PullPointMaster[] {
  if (!studyTypeId) return [];
  return pullPoints
    .filter((p) => p.status === "Active")
    .filter((p) => !p.studyTypeIds?.length || p.studyTypeIds.includes(studyTypeId))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.months - b.months);
}

export function sumAllocations(allocations: PullAllocationMap): number {
  return Object.values(allocations).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
}

export function deriveDuration(allocations: PullAllocationMap, pullPoints: PullPointMaster[]): string {
  const selected = pullPoints.filter((p) => (allocations[p.id] || 0) > 0);
  if (!selected.length) return "";
  const maxMonths = Math.max(...selected.map((p) => p.months));
  return `${maxMonths}M`;
}

export function buildPullAllocations(
  allocations: PullAllocationMap,
  pullPoints: PullPointMaster[]
): { code: string; months: number; quantity: number }[] {
  return pullPoints
    .filter((p) => (allocations[p.id] || 0) > 0)
    .map((p) => ({
      code: p.code,
      months: p.months,
      quantity: Number(allocations[p.id]) || 0,
    }));
}

export type ChargeFormErrors = Partial<Record<keyof ChargeFormState | "allocations" | "chamber", string>>;

export function getMissingChargeMasters(masters: {
  products: Product[];
  batches: Batch[];
  studyTypes: StudyType[];
  conditions: StorageCondition[];
  chambers: Chamber[];
  locations: StorageLocation[];
  units: Unit[];
  pullPoints: PullPointMaster[];
}): { label: string; href: string }[] {
  const missing: { label: string; href: string }[] = [];
  if (!masters.products.some((p) => p.status === "Active")) {
    missing.push({ label: "Products", href: "/masters/products" });
  }
  if (!masters.batches.some((b) => b.status === "Active")) {
    missing.push({ label: "Batches", href: "/masters/batches" });
  }
  if (!masters.studyTypes.some((s) => s.status === "Active")) {
    missing.push({ label: "Study Types", href: "/masters/study-types" });
  }
  if (!masters.conditions.some((c) => c.status === "Active")) {
    missing.push({ label: "Storage Conditions", href: "/masters/storage-conditions" });
  }
  if (!masters.chambers.some((c) => c.status !== "Inactive")) {
    missing.push({ label: "Chambers", href: "/masters/chambers" });
  }
  if (!masters.locations.some((l) => l.status === "Active")) {
    missing.push({ label: "Locations", href: "/masters/locations" });
  }
  if (!masters.units.some((u) => u.status === "Active")) {
    missing.push({ label: "Units", href: "/masters/units" });
  }
  if (!masters.pullPoints.some((p) => p.status === "Active")) {
    missing.push({ label: "Pull Points", href: "/masters/pull-points" });
  }
  return missing;
}

export function validateChargeForm(
  form: ChargeFormState,
  opts: {
    chamber?: Chamber | null;
    requireAllocations?: boolean;
  } = {}
): ChargeFormErrors {
  const errors: ChargeFormErrors = {};
  const total = Number(form.totalQuantity);
  const reserved = Number(form.reservedQuantity || 0);
  const allocated = sumAllocations(form.pullAllocations);

  if (!form.productId) errors.productId = "Product is required.";
  if (!form.batchId) errors.batchId = "Batch is required.";
  if (!form.manufacturingDate) errors.manufacturingDate = "Manufacturing date is required.";
  if (!form.expiryDate) errors.expiryDate = "Expiry date is required.";
  if (
    form.manufacturingDate &&
    form.expiryDate &&
    form.expiryDate < form.manufacturingDate
  ) {
    errors.expiryDate = "Expiry date cannot be before manufacturing date.";
  }
  if (!form.chargingDate) errors.chargingDate = "Date of charging is required.";
  if (!form.studyTypeId) errors.studyTypeId = "Study type is required.";
  if (!form.storageConditionId) errors.storageConditionId = "Storage condition is required.";
  if (!form.chamberId) errors.chamberId = "Chamber is required.";
  if (!form.locationId) errors.locationId = "Location is required.";
  if (!form.unit) errors.unit = "Unit is required.";
  if (!Number.isFinite(total) || total <= 0) errors.totalQuantity = "Total quantity must be greater than zero.";
  if (!Number.isFinite(reserved) || reserved < 0) errors.reservedQuantity = "Reserve quantity cannot be negative.";
  if (allocated + reserved > total) {
    errors.allocations = "Allocated pull points plus reserve cannot exceed total quantity.";
  }
  if (opts.requireAllocations !== false && allocated <= 0) {
    errors.allocations = "Allocate quantity to at least one pull point.";
  }
  if (opts.chamber?.status === "Inactive") {
    errors.chamber = "Cannot allocate samples to an inactive chamber.";
  }
  if (opts.chamber && Number.isFinite(total) && total > 0) {
    const used = Number(opts.chamber.usedCapacity || 0);
    const capacity = Number(opts.chamber.capacity || 0);
    if (capacity > 0 && used + total > capacity) {
      errors.totalQuantity = `Chamber capacity insufficient (available ${Math.max(0, capacity - used)}, requested ${total}).`;
    }
  }
  return errors;
}

export function resolveChargePayload(
  form: ChargeFormState,
  masters: {
    products: Product[];
    batches: Batch[];
    studyTypes: StudyType[];
    conditions: StorageCondition[];
    chambers: Chamber[];
    locations: StorageLocation[];
    units: Unit[];
    pullPoints: PullPointMaster[];
  },
  user: AppUser
) {
  const product = masters.products.find((p) => p.id === form.productId);
  const batch = masters.batches.find((b) => b.id === form.batchId);
  const studyType = masters.studyTypes.find((s) => s.id === form.studyTypeId);
  const condition = masters.conditions.find((c) => c.id === form.storageConditionId);
  const chamber = masters.chambers.find((c) => c.id === form.chamberId);
  const location = masters.locations.find((l) => l.id === form.locationId);
  const unit =
    masters.units.find((u) => u.id === form.unit || u.abbreviation === form.unit || u.name === form.unit) ||
    null;
  const relevantPulls = activePullPointsForStudy(masters.pullPoints, form.studyTypeId);
  const pullAllocations = buildPullAllocations(form.pullAllocations, relevantPulls);

  if (!product) throw new Error("Product is required. Select a product in Study Information.");
  if (!batch) throw new Error("Batch is required. Select a batch in Study Information.");
  if (!studyType) throw new Error("Study type is required.");
  if (!condition) throw new Error("Storage condition is required.");
  if (!chamber) throw new Error("Chamber is required.");
  if (!location) throw new Error("Storage location is required.");
  if (!form.unit?.trim()) throw new Error("Unit is required.");
  if (!product.productName?.trim()) {
    throw new Error("Selected product has no name. Fix it in Product Master, then try again.");
  }

  const unitLabel = unit?.abbreviation || unit?.name || form.unit;

  return {
    productId: product.id,
    productName: product.productName,
    batchId: batch.id,
    batchNumber: batch.batchNumber,
    manufacturingDate: form.manufacturingDate,
    expiryDate: form.expiryDate,
    chargingDate: form.chargingDate,
    studyTypeId: studyType.id,
    studyType: studyType.name,
    storageConditionId: condition.id,
    storageCondition: condition.displayLabel || condition.name,
    chamberId: chamber.id,
    chamberName: chamber.chamberName,
    locationId: location.id,
    locationLabel: location.label,
    totalQuantity: Number(form.totalQuantity),
    reservedQuantity: Number(form.reservedQuantity || 0),
    unit: unitLabel,
    notes: form.notes.trim() || undefined,
    duration: deriveDuration(form.pullAllocations, relevantPulls) || studyType.code || "N/A",
    pullAllocations,
    user,
  };
}
