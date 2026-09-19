import { todayISO } from "@/lib/utils";
import type { DailyCollectionInput, DailyCollectionRecord, DailyCollectionSampleType } from "@/types/daily-collection";

export const DAILY_COLLECTION_SAMPLE_TYPES: DailyCollectionSampleType[] = [
  "Control Sample",
  "Stability Sample",
];

export const DAILY_COLLECTION_REMARK_PRESETS = ["Control", "Stability", "Other"] as const;

export const DUPLICATE_WARNING =
  "Similar collection record already exists for this Product + Batch + Date.";

const SNAPSHOT_FIELDS: (keyof DailyCollectionInput)[] = [
  "date",
  "sampleType",
  "productId",
  "productName",
  "productCode",
  "batchId",
  "batchNumber",
  "batchSize",
  "manufacturingDate",
  "expiryDate",
  "marketId",
  "market",
  "packSizeId",
  "packSize",
  "quantityCollected",
  "quantityUnit",
  "collectedByUserId",
  "collectedByName",
  "collectedByEmployeeCode",
  "remarks",
  "controlSampleId",
  "controlSampleDocId",
  "controlCollectionId",
  "stabilityStudyId",
  "stabilitySampleId",
];

export function isSameDuplicateKey(
  a: Pick<DailyCollectionRecord, "date" | "productId" | "batchId" | "market" | "packSize" | "sampleType" | "status">,
  b: Pick<DailyCollectionInput, "date" | "productId" | "batchId" | "market" | "packSize" | "sampleType">
) {
  return (
    a.date === b.date &&
    a.productId === b.productId &&
    a.batchId === b.batchId &&
    (a.market || "").trim().toUpperCase() === (b.market || "").trim().toUpperCase() &&
    (a.packSize || "").trim().toUpperCase() === (b.packSize || "").trim().toUpperCase() &&
    a.sampleType === b.sampleType &&
    a.status !== "Cancelled"
  );
}

export function findDuplicateRecords(
  rows: DailyCollectionRecord[],
  input: Pick<DailyCollectionInput, "date" | "productId" | "batchId" | "market" | "packSize" | "sampleType">,
  excludeId?: string
) {
  return rows.filter((row) => row.id !== excludeId && isSameDuplicateKey(row, input));
}

export function validateDailyCollectionInput(
  input: DailyCollectionInput,
  options?: { allowFutureDate?: boolean; today?: string }
) {
  const today = options?.today ?? todayISO();
  if (!input.date) return "Date is required.";
  if (!input.sampleType) return "Sample type is required.";
  if (!input.productId || !input.productName.trim()) return "Product is required.";
  if (!input.batchId || !input.batchNumber.trim()) return "Batch is required.";
  if (!input.manufacturingDate) return "Manufacturing date is required.";
  if (!input.expiryDate) return "Expiry date is required.";
  if (input.manufacturingDate > input.expiryDate) return "Manufacturing date must be on or before expiry date.";
  if (!input.market.trim()) return "Market is required.";
  if (!input.packSize.trim()) return "Pack size is required.";
  if (!Number.isFinite(input.quantityCollected) || input.quantityCollected <= 0) {
    return "Quantity collected must be greater than zero.";
  }
  if (!input.quantityUnit.trim()) return "Unit is required.";
  if (!input.collectedByUserId || !input.collectedByName.trim()) return "Collected by is required.";
  if (input.date > today && !options?.allowFutureDate) {
    return "Future collection dates are not permitted.";
  }
  if (input.manufacturingDate && input.date < input.manufacturingDate) {
    return "Collection date cannot be before the manufacturing date.";
  }
  if (input.date < today && !input.backdatedReason?.trim()) {
    return "A reason is required for a backdated collection entry.";
  }
  if (input.duplicateAcknowledged && !input.duplicateReason?.trim()) {
    return "A reason is required to continue with a similar existing collection record.";
  }
  return null;
}

export function snapshotChanges(
  previous: DailyCollectionRecord,
  next: DailyCollectionInput
): { field: string; oldValue: string; newValue: string }[] {
  const changes: { field: string; oldValue: string; newValue: string }[] = [];
  for (const field of SNAPSHOT_FIELDS) {
    const oldValue = stringifyValue(previous[field as keyof DailyCollectionRecord]);
    const newValue = stringifyValue(next[field]);
    if (oldValue !== newValue) {
      changes.push({ field, oldValue, newValue });
    }
  }
  return changes;
}

function stringifyValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  return String(value);
}

export function formatQuantity(quantity: number, unit: string) {
  return `${quantity} ${unit}`.trim();
}

export function monthKey(isoDate: string) {
  return isoDate.slice(0, 7);
}

export function monthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export function registerTitle() {
  return "DAILY COLLECTION RECORD OF CONTROL SAMPLE";
}

export function toDailyCollectionInput(row: DailyCollectionRecord): DailyCollectionInput {
  return {
    date: row.date,
    sampleType: row.sampleType,
    productId: row.productId,
    productName: row.productName,
    productCode: row.productCode,
    batchId: row.batchId,
    batchNumber: row.batchNumber,
    batchSize: row.batchSize,
    manufacturingDate: row.manufacturingDate,
    expiryDate: row.expiryDate,
    marketId: row.marketId,
    market: row.market,
    packSizeId: row.packSizeId,
    packSize: row.packSize,
    quantityCollected: row.quantityCollected,
    quantityUnit: row.quantityUnit,
    collectedByUserId: row.collectedByUserId,
    collectedByName: row.collectedByName,
    collectedByEmployeeCode: row.collectedByEmployeeCode,
    remarks: row.remarks,
    controlSampleId: row.controlSampleId,
    controlSampleDocId: row.controlSampleDocId,
    controlCollectionId: row.controlCollectionId,
    stabilityStudyId: row.stabilityStudyId,
    stabilitySampleId: row.stabilitySampleId,
    duplicateAcknowledged: row.duplicateAcknowledged,
    duplicateReason: row.duplicateReason,
    backdatedReason: row.backdatedReason,
  };
}
