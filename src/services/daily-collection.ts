import { addDoc, collection, doc, getDoc, updateDoc } from "firebase/firestore";
import { listDocs } from "@/lib/firebase/list-docs";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import {
  findDuplicateRecords,
  snapshotChanges,
  toDailyCollectionInput,
  validateDailyCollectionInput,
} from "@/lib/daily-collection";
import { nowISO, todayISO } from "@/lib/utils";
import { nextYearSerial } from "@/services/ids";
import { writeAuditLog } from "@/services/audit";
import type { AppUser } from "@/types";
import type {
  DailyCollectionInput,
  DailyCollectionRecord,
  DailyCollectionStatus,
} from "@/types/daily-collection";

function omitUndefined<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

function actor(user: AppUser) {
  return {
    id: user.uid,
    name: user.displayName || user.email,
  };
}

async function audit(input: {
  action: string;
  recordId?: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  user: AppUser;
}) {
  await writeAuditLog({
    action: input.action,
    module: "Daily Collection Record",
    recordId: input.recordId,
    recordType: "dailyCollectionRecord",
    previousValue: input.previousValue,
    newValue: input.newValue,
    reason: input.reason,
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email,
    userEmail: input.user.email,
    userRole: input.user.role,
  });
}

function snapshotFields(input: DailyCollectionInput) {
  return omitUndefined({
    date: input.date,
    sampleType: input.sampleType,
    productId: input.productId,
    productName: input.productName,
    productCode: input.productCode,
    batchId: input.batchId,
    batchNumber: input.batchNumber,
    batchSize: input.batchSize,
    manufacturingDate: input.manufacturingDate,
    expiryDate: input.expiryDate,
    marketId: input.marketId,
    market: input.market.trim(),
    packSizeId: input.packSizeId,
    packSize: input.packSize.trim(),
    quantityCollected: input.quantityCollected,
    quantityUnit: input.quantityUnit.trim(),
    collectedByUserId: input.collectedByUserId,
    collectedByName: input.collectedByName.trim(),
    collectedByEmployeeCode: input.collectedByEmployeeCode,
    remarks: input.remarks?.trim() || undefined,
    controlSampleId: input.controlSampleId,
    controlSampleDocId: input.controlSampleDocId,
    controlCollectionId: input.controlCollectionId,
    stabilityStudyId: input.stabilityStudyId,
    stabilitySampleId: input.stabilitySampleId,
    duplicateAcknowledged: input.duplicateAcknowledged,
    duplicateReason: input.duplicateReason?.trim() || undefined,
  });
}

function backdateFields(input: DailyCollectionInput, user: AppUser, stamp: string) {
  const today = todayISO();
  if (input.date >= today) return {};
  return {
    backdatedEntry: true,
    backdatedReason: input.backdatedReason?.trim(),
    enteredBy: user.uid,
    enteredByName: user.displayName || user.email,
    enteredAt: stamp,
  };
}

export async function listDailyCollectionRecords() {
  return listDocs<DailyCollectionRecord>(COLLECTIONS.dailyCollectionRecords);
}

export async function getDailyCollectionRecord(id: string) {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.dailyCollectionRecords, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as DailyCollectionRecord;
}

async function requireRecord(id: string) {
  const row = await getDailyCollectionRecord(id);
  if (!row) throw new Error("Daily collection record was not found.");
  return row;
}

function assertStatus(row: DailyCollectionRecord, allowed: DailyCollectionStatus[], action: string) {
  if (!allowed.includes(row.status)) {
    throw new Error(`This record cannot be ${action} from status ${row.status}.`);
  }
}

export async function createDailyCollectionRecord(
  input: DailyCollectionInput & { user: AppUser; allowFutureDate?: boolean }
) {
  const { user, allowFutureDate, ...fields } = input;
  const error = validateDailyCollectionInput(fields, { allowFutureDate });
  if (error) throw new Error(error);
  const existing = await listDailyCollectionRecords();
  const duplicates = findDuplicateRecords(existing, fields);
  if (duplicates.length && !fields.duplicateAcknowledged) {
    throw new Error("DUPLICATE_COLLECTION");
  }
  const serial = await nextYearSerial("DCR", fields.date);
  const stamp = nowISO();
  const who = actor(user);
  const payload: Omit<DailyCollectionRecord, "id"> = {
    recordId: serial.recordId,
    serialNumber: serial.serialNumber,
    serialDisplay: serial.serialDisplay,
    serialYear: serial.year,
    ...snapshotFields(fields),
    ...backdateFields(fields, user, stamp),
    status: "Draft",
    createdBy: who.id,
    createdByName: who.name,
    createdAt: stamp,
    updatedBy: who.id,
    updatedByName: who.name,
    updatedAt: stamp,
  } as Omit<DailyCollectionRecord, "id">;
  const ref = await addDoc(
    collection(getDb(), COLLECTIONS.dailyCollectionRecords),
    omitUndefined(payload as unknown as Record<string, unknown>)
  );
  await audit({
    action: "Created",
    recordId: serial.recordId,
    newValue: { serial: serial.serialDisplay, product: fields.productName, batch: fields.batchNumber },
    user,
  });
  return { id: ref.id, ...payload };
}

export async function updateDailyCollectionDraft(
  id: string,
  input: DailyCollectionInput & { user: AppUser; allowFutureDate?: boolean }
) {
  const row = await requireRecord(id);
  assertStatus(row, ["Draft"], "edited");
  const { user, allowFutureDate, ...fields } = input;
  const error = validateDailyCollectionInput(fields, { allowFutureDate });
  if (error) throw new Error(error);
  const existing = await listDailyCollectionRecords();
  const duplicates = findDuplicateRecords(existing, fields, id);
  if (duplicates.length && !fields.duplicateAcknowledged) {
    throw new Error("DUPLICATE_COLLECTION");
  }
  const stamp = nowISO();
  const who = actor(user);
  const patch = omitUndefined({
    ...snapshotFields(fields),
    ...backdateFields(fields, user, stamp),
    updatedBy: who.id,
    updatedByName: who.name,
    updatedAt: stamp,
  });
  await updateDoc(doc(getDb(), COLLECTIONS.dailyCollectionRecords, id), patch);
  await audit({
    action: "Edited",
    recordId: row.recordId,
    previousValue: snapshotFields(toDailyCollectionInput(row)),
    newValue: snapshotFields(fields),
    user,
  });
}

export async function submitDailyCollectionRecord(id: string, user: AppUser) {
  const row = await requireRecord(id);
  assertStatus(row, ["Draft"], "submitted");
  const stamp = nowISO();
  const who = actor(user);
  await updateDoc(doc(getDb(), COLLECTIONS.dailyCollectionRecords, id), {
    status: "Submitted",
    submittedBy: who.id,
    submittedByName: who.name,
    submittedAt: stamp,
    updatedBy: who.id,
    updatedByName: who.name,
    updatedAt: stamp,
  });
  await audit({
    action: "Submitted",
    recordId: row.recordId,
    previousValue: { status: row.status },
    newValue: { status: "Submitted" },
    user,
  });
}

export async function reviewDailyCollectionRecord(id: string, user: AppUser, remarks?: string) {
  const row = await requireRecord(id);
  assertStatus(row, ["Submitted"], "reviewed");
  const stamp = nowISO();
  const who = actor(user);
  await updateDoc(
    doc(getDb(), COLLECTIONS.dailyCollectionRecords, id),
    omitUndefined({
      status: "Reviewed",
      reviewedBy: who.id,
      reviewedByName: who.name,
      reviewedAt: stamp,
      updatedBy: who.id,
      updatedByName: who.name,
      updatedAt: stamp,
      remarks: remarks?.trim() ? remarks.trim() : row.remarks,
    })
  );
  await audit({
    action: "Reviewed",
    recordId: row.recordId,
    previousValue: { status: row.status },
    newValue: { status: "Reviewed" },
    reason: remarks,
    user,
  });
}

export async function finalizeDailyCollectionRecord(id: string, user: AppUser, reason?: string) {
  const row = await requireRecord(id);
  assertStatus(row, ["Reviewed"], "finalized");
  const stamp = nowISO();
  const who = actor(user);
  await updateDoc(doc(getDb(), COLLECTIONS.dailyCollectionRecords, id), {
    status: "Finalized",
    finalizedBy: who.id,
    finalizedByName: who.name,
    finalizedAt: stamp,
    updatedBy: who.id,
    updatedByName: who.name,
    updatedAt: stamp,
  });
  await audit({
    action: "Finalized",
    recordId: row.recordId,
    previousValue: { status: row.status },
    newValue: { status: "Finalized" },
    reason,
    user,
  });
}

export async function cancelDailyCollectionRecord(id: string, user: AppUser, reason: string) {
  const row = await requireRecord(id);
  assertStatus(row, ["Draft", "Submitted"], "cancelled");
  if (!reason.trim()) throw new Error("A reason is required to cancel a collection record.");
  const stamp = nowISO();
  const who = actor(user);
  await updateDoc(doc(getDb(), COLLECTIONS.dailyCollectionRecords, id), {
    status: "Cancelled",
    cancelledBy: who.id,
    cancelledByName: who.name,
    cancelledAt: stamp,
    cancelReason: reason.trim(),
    updatedBy: who.id,
    updatedByName: who.name,
    updatedAt: stamp,
  });
  await audit({
    action: "Cancelled",
    recordId: row.recordId,
    previousValue: { status: row.status },
    newValue: { status: "Cancelled" },
    reason,
    user,
  });
}

export async function correctDailyCollectionRecord(
  id: string,
  input: DailyCollectionInput & { user: AppUser; reason: string; allowFutureDate?: boolean }
) {
  const row = await requireRecord(id);
  assertStatus(row, ["Finalized"], "corrected");
  const { user, allowFutureDate, reason, ...fields } = input;
  if (!reason.trim()) throw new Error("A reason is required to correct a finalized collection record.");
  const error = validateDailyCollectionInput(fields, { allowFutureDate });
  if (error) throw new Error(error);
  const changes = snapshotChanges(row, fields);
  if (!changes.length) throw new Error("No changes were made to correct.");
  const stamp = nowISO();
  const who = actor(user);
  const correction = {
    correctedAt: stamp,
    correctedBy: who.id,
    correctedByName: who.name,
    reason: reason.trim(),
    changes,
  };
  const patch = omitUndefined({
    ...snapshotFields(fields),
    corrections: [...(row.corrections || []), correction],
    updatedBy: who.id,
    updatedByName: who.name,
    updatedAt: stamp,
  });
  await updateDoc(doc(getDb(), COLLECTIONS.dailyCollectionRecords, id), patch);
  await audit({
    action: "Corrected",
    recordId: row.recordId,
    previousValue: changes.reduce<Record<string, string>>((acc, change) => {
      acc[change.field] = change.oldValue;
      return acc;
    }, {}),
    newValue: changes.reduce<Record<string, string>>((acc, change) => {
      acc[change.field] = change.newValue;
      return acc;
    }, {}),
    reason,
    user,
  });
}
