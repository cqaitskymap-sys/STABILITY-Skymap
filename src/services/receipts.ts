import { addDoc, collection, doc, getDoc, updateDoc } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { listDocs } from "@/lib/firebase/list-docs";
import { nowISO, todayISO } from "@/lib/utils";
import { nextSequentialId } from "@/services/ids";
import { writeAuditLog } from "@/services/audit";
import type { AppUser, ReceiptStatus, SampleReceipt } from "@/types";

function omitUndefined<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

export async function listSampleReceipts() {
  return listDocs<SampleReceipt>(COLLECTIONS.sampleReceipts);
}

export async function getSampleReceipt(id: string) {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.sampleReceipts, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SampleReceipt;
}

export async function createSampleReceipt(input: {
  productId: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  sampleQuantity: number;
  unit: string;
  sampleReceivedBy: string;
  dateReceived: string;
  remarks?: string;
  user: AppUser;
}) {
  if (input.sampleQuantity <= 0) throw new Error("Sample quantity must be greater than zero.");
  if (input.expiryDate && input.manufacturingDate && input.expiryDate < input.manufacturingDate) {
    throw new Error("Expiry date cannot be before manufacturing date.");
  }

  const receiptId = await nextSequentialId("RCV");
  const stamp = nowISO();
  const payload: Omit<SampleReceipt, "id"> = {
    receiptId,
    date: todayISO(),
    productId: input.productId,
    productName: input.productName,
    batchId: input.batchId,
    batchNumber: input.batchNumber,
    manufacturingDate: input.manufacturingDate,
    expiryDate: input.expiryDate,
    sampleQuantity: input.sampleQuantity,
    unit: input.unit,
    sampleReceivedBy: input.sampleReceivedBy,
    dateReceived: input.dateReceived,
    status: "Received - Awaiting COA",
    coaStatus: "Pending",
    chargingEligibility: false,
    remarks: input.remarks,
    createdBy: input.user.uid,
    createdByName: input.user.displayName || input.user.email,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const ref = await addDoc(collection(getDb(), COLLECTIONS.sampleReceipts), omitUndefined(payload as unknown as Record<string, unknown>));
  await writeAuditLog({
    action: "Create",
    module: "Sample Inward",
    recordId: receiptId,
    recordType: "sampleReceipt",
    newValue: { receiptId, productName: input.productName, batchNumber: input.batchNumber, sampleQuantity: input.sampleQuantity },
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email,
    userEmail: input.user.email,
    userRole: input.user.role,
  });
  return { id: ref.id, ...payload };
}

export async function markCoaReceived(
  receiptDocId: string,
  user: AppUser,
  checkedBy?: string
) {
  const existing = await getSampleReceipt(receiptDocId);
  if (!existing) throw new Error("Inward record not found.");
  if (existing.status === "Charged") throw new Error("This receipt has already been charged.");
  if (existing.status === "Voided") throw new Error("This receipt has been voided.");

  const status: ReceiptStatus = "COA Received - Ready for Charging";
  await updateDoc(doc(getDb(), COLLECTIONS.sampleReceipts, receiptDocId), {
    coaStatus: "Received",
    status,
    chargingEligibility: true,
    checkedBy: checkedBy || user.displayName || user.email,
    checkedDate: todayISO(),
    updatedAt: nowISO(),
  });
  await writeAuditLog({
    action: "Edit",
    module: "Sample Inward",
    recordId: existing.receiptId,
    recordType: "sampleReceipt",
    previousValue: { status: existing.status, coaStatus: existing.coaStatus },
    newValue: { status, coaStatus: "Received" },
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
}

export async function markReceiptCharged(receiptDocId: string, studyId: string, user: AppUser) {
  const existing = await getSampleReceipt(receiptDocId);
  if (!existing) throw new Error("Inward record not found.");
  await updateDoc(doc(getDb(), COLLECTIONS.sampleReceipts, receiptDocId), {
    status: "Charged" satisfies ReceiptStatus,
    chargedStudyId: studyId,
    chargedAt: nowISO(),
    updatedAt: nowISO(),
  });
  await writeAuditLog({
    action: "Charge",
    module: "Sample Inward",
    recordId: existing.receiptId,
    recordType: "sampleReceipt",
    newValue: { studyId },
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
}

export async function voidSampleReceipt(receiptDocId: string, reason: string, user: AppUser) {
  const existing = await getSampleReceipt(receiptDocId);
  if (!existing) throw new Error("Inward record not found.");
  if (existing.status === "Charged") throw new Error("Charged inward records cannot be voided.");
  if (!reason.trim()) throw new Error("A reason is required to void this record.");
  await updateDoc(doc(getDb(), COLLECTIONS.sampleReceipts, receiptDocId), {
    status: "Voided" satisfies ReceiptStatus,
    chargingEligibility: false,
    remarks: [existing.remarks, `VOIDED: ${reason.trim()}`].filter(Boolean).join(" | "),
    updatedAt: nowISO(),
  });
  await writeAuditLog({
    action: "Void",
    module: "Sample Inward",
    recordId: existing.receiptId,
    recordType: "sampleReceipt",
    reason,
    previousValue: { status: existing.status },
    newValue: { status: "Voided" },
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
}
