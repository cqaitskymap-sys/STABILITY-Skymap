import { addDoc, collection, deleteField, doc, getDoc, getDocs, query, runTransaction, updateDoc, where } from "firebase/firestore";
import { listDocs } from "@/lib/firebase/list-docs";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { invalidateReadCache } from "@/lib/firebase/read-cache";
import { can, type Permission } from "@/lib/permissions";
import {
  calcControlAvailable,
  controlOrg,
  DEFAULT_DESTRUCTION_STEPS,
  deriveControlInventoryStatus,
  destroyedQty,
  destructionEligibleDate,
  initialQty,
  isDestructionOverdue,
  nextObservationDate,
} from "@/lib/control-samples";
import { effectiveDueDate, nowISO, todayISO } from "@/lib/utils";
import { nextDcnNumber, nextSequentialId } from "@/services/ids";
import { writeAuditLog } from "@/services/audit";
import { getOrganizationSettings } from "@/services/organization";
import type { AppUser, ControlSample } from "@/types";
import type {
  CollectionStage,
  ControlHoldType,
  ControlObservationParameter,
  ControlSampleBox,
  ControlSampleBoxCategory,
  ControlSampleCollection,
  ControlSampleDestruction,
  ControlSampleHold,
  ControlSampleObservation,
  ControlSampleQuantityMaster,
  ControlSampleRack,
  ControlSampleRequisition,
  ControlSampleTx,
  ControlTxType,
} from "@/types/control-samples";

function finiteNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const STOCK_RESERVING_DESTRUCTION = new Set([
  "QA Initiated",
  "Note Created",
  "Approved",
  "Destroyed Pending Verification",
]);

function destructionReserved(notes: ControlSampleDestruction[], sampleDocId: string) {
  return notes
    .filter(
      (note) =>
        note.controlSampleDocId === sampleDocId &&
        !note.quantityPosted &&
        STOCK_RESERVING_DESTRUCTION.has(note.status)
    )
    .reduce((sum, note) => sum + finiteNumber(note.quantity), 0);
}

function requisitionHeld(rows: ControlSampleRequisition[], sampleDocId: string) {
  return rows
    .filter(
      (req) =>
        req.controlSampleDocId === sampleDocId &&
        (req.status === "Submitted" || req.status === "Approved" || req.status === "Partially Returned")
    )
    .reduce(
      (sum, req) => sum + Math.max(0, finiteNumber(req.quantityRequired) - finiteNumber(req.quantityIssued)),
      0
    );
}

function isLinkedControlSample(controlSampleDocId?: string) {
  return Boolean(controlSampleDocId && controlSampleDocId !== "pending");
}

async function uncommittedQuantity(row: ControlSample) {
  const [requisitions, notes] = await Promise.all([listRequisitions(), listDestructions()]);
  return (
    finiteNumber(row.availableQuantity) -
    requisitionHeld(requisitions, row.id) -
    destructionReserved(notes, row.id)
  );
}

function requisitionStatusAfterQuantities(
  required: number,
  issued: number,
  returned: number
): ControlSampleRequisition["status"] {
  if (returned > 0 && returned < issued) return "Partially Returned";
  if (issued >= required && returned >= issued && issued > 0) return "Returned";
  if (issued >= required && issued > 0) return "Issued";
  return "Approved";
}

function requirePermission(user: AppUser, permission: Permission, message: string) {
  if (!can(user, permission)) throw new Error(message);
}

function omitUndefined<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

async function listAll<T>(name: string, sortField = "createdAt") {
  return listDocs<T>(name, sortField);
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
    module: "Controlled Sample",
    recordId: input.recordId,
    recordType: "controlSample",
    previousValue: input.previousValue,
    newValue: input.newValue,
    reason: input.reason,
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email,
    userEmail: input.user.email,
    userRole: input.user.role,
  });
  invalidateReadCache();
}

async function writeControlTx(input: Omit<ControlSampleTx, "id">) {
  await addDoc(
    collection(getDb(), COLLECTIONS.controlSampleTransactions),
    omitUndefined(input as unknown as Record<string, unknown>)
  );
  invalidateReadCache();
}

async function findSampleLinkedToCollection(collectionDocId: string) {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.controlSamples));
  const match = snap.docs.find((d) => d.data().collectionDocId === collectionDocId);
  if (!match) return null;
  return { id: match.id, ...match.data() } as ControlSample;
}

function qtySnapshot(row: ControlSample) {
  return {
    initialQuantity: initialQty(row),
    issuedQuantity: row.issuedQuantity || 0,
    returnedQuantity: row.returnedQuantity || 0,
    destroyedQuantity: destroyedQty(row),
    verificationDiscardedQuantity: row.verificationDiscardedQuantity || 0,
    adjustedQuantity: row.adjustedQuantity || 0,
  };
}

function applyQty(row: ControlSample, patch: Partial<ReturnType<typeof qtySnapshot>>) {
  const next = { ...qtySnapshot(row), ...patch };
  const availableQuantity = calcControlAvailable(next);
  const updated: Pick<ControlSample, "quantity" | "initialQuantity" | "issuedQuantity" | "returnedQuantity" | "disposedQuantity" | "destroyedQuantity" | "verificationDiscardedQuantity" | "adjustedQuantity" | "availableQuantity"> = {
    quantity: next.initialQuantity,
    initialQuantity: next.initialQuantity,
    issuedQuantity: next.issuedQuantity,
    returnedQuantity: next.returnedQuantity,
    disposedQuantity: next.destroyedQuantity,
    destroyedQuantity: next.destroyedQuantity,
    verificationDiscardedQuantity: next.verificationDiscardedQuantity,
    adjustedQuantity: next.adjustedQuantity,
    availableQuantity,
  };
  return updated;
}

async function persistSample(
  row: ControlSample,
  patch: Record<string, unknown>,
  tx: {
    type: ControlTxType;
    quantity: number;
    previous: number;
    next: number;
    reason?: string;
    reference?: string;
    remarks?: string;
    fromLocation?: string;
    toLocation?: string;
    user: AppUser;
  }
) {
  const stamp = nowISO();
  const merged = { ...row, ...patch } as ControlSample;
  const status = deriveControlInventoryStatus(merged);
  await updateDoc(
    doc(getDb(), COLLECTIONS.controlSamples, row.id),
    omitUndefined({ ...patch, status, updatedAt: stamp })
  );
  await writeControlTx({
    transactionId: await nextSequentialId("CTX"),
    controlSampleId: row.controlSampleId,
    controlSampleDocId: row.id,
    productName: row.productName,
    batchNumber: row.batchNumber,
    transactionType: tx.type,
    quantity: tx.quantity,
    previousQuantity: tx.previous,
    newQuantity: tx.next,
    fromLocation: tx.fromLocation,
    toLocation: tx.toLocation,
    reason: tx.reason,
    reference: tx.reference,
    remarks: tx.remarks,
    performedBy: tx.user.uid,
    performedByName: tx.user.displayName || tx.user.email,
    performedAt: stamp,
  });
  return { ...merged, status, updatedAt: stamp };
}

export async function listControlSamples() {
  return listAll<ControlSample>(COLLECTIONS.controlSamples);
}

export async function getControlSample(id: string) {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.controlSamples, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ControlSample;
}

export async function listControlTransactions() {
  return listAll<ControlSampleTx>(COLLECTIONS.controlSampleTransactions, "performedAt");
}

export async function listQuantityMasters() {
  return listAll<ControlSampleQuantityMaster>(COLLECTIONS.controlSampleQuantityMasters);
}

export async function getActiveQuantityMaster(productId: string) {
  const rows = await listQuantityMasters();
  return rows.find((r) => r.productId === productId && r.status === "Active") || null;
}

export async function createQuantityMasterRevision(input: {
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  effectiveDate: string;
  preparedBy?: string;
  checkedBy?: string;
  approvedBy?: string;
  conversionBatchQuantity?: number;
  conversionBatchUnit?: string;
  user: AppUser;
}) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("Required quantity must be greater than zero.");
  const stamp = nowISO();
  const masters = collection(getDb(), COLLECTIONS.controlSampleQuantityMasters);
  const known = await getDocs(query(masters, where("productId", "==", input.productId)));
  const pointerRef = doc(getDb(), COLLECTIONS.counters, `CSQ_${input.productId}`);
  const saved = await runTransaction(getDb(), async (tx) => {
    const pointerSnap = await tx.get(pointerRef);
    const knownSnaps = [];
    for (const entry of known.docs) knownSnaps.push(await tx.get(entry.ref));
    const pointerId = pointerSnap.exists() ? String(pointerSnap.data().activeId || "") : "";
    const pointerMaster = pointerId && !known.docs.some((entry) => entry.id === pointerId)
      ? await tx.get(doc(masters, pointerId))
      : null;

    let revision = pointerSnap.exists() ? Number(pointerSnap.data().revision || 0) : 0;
    let previousRevisionId: string | undefined;
    for (const snap of [...knownSnaps, pointerMaster].filter((snap) => snap?.exists())) {
      if (!snap) continue;
      const rev = Number(snap.data()?.revisionNumber || 0);
      if (rev > revision) revision = rev;
      if (snap.data()?.status === "Active") {
        previousRevisionId = snap.id;
        tx.update(snap.ref, { status: "Inactive", updatedAt: stamp });
      }
    }
    const ref = doc(masters);
    const payload: Omit<ControlSampleQuantityMaster, "id"> = {
      productId: input.productId,
      productName: input.productName,
      quantity: input.quantity,
      unit: input.unit,
      revisionNumber: revision + 1,
      previousRevisionId,
      effectiveDate: input.effectiveDate,
      preparedBy: input.preparedBy,
      checkedBy: input.checkedBy,
      approvedBy: input.approvedBy,
      conversionBatchQuantity: input.conversionBatchQuantity,
      conversionBatchUnit: input.conversionBatchUnit,
      status: "Active",
      createdBy: input.user.uid,
      createdByName: input.user.displayName || input.user.email,
      createdAt: stamp,
      updatedAt: stamp,
    };
    tx.set(ref, omitUndefined(payload as unknown as Record<string, unknown>));
    tx.set(pointerRef, { activeId: ref.id, revision: payload.revisionNumber, productId: input.productId }, { merge: true });
    return { id: ref.id, ...payload };
  });
  await audit({
    action: "Create",
    recordId: saved.id,
    newValue: { product: input.productName, revision: saved.revisionNumber, quantity: input.quantity },
    user: input.user,
    reason: "Annexure-I quantity master revision",
  });
  return saved;
}

export async function listCollections() {
  return listAll<ControlSampleCollection>(COLLECTIONS.controlSampleCollections);
}

export async function getCollection(id: string) {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.controlSampleCollections, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ControlSampleCollection;
}

export async function createCollection(input: Omit<ControlSampleCollection, "id" | "collectionId" | "status" | "createdBy" | "createdByName" | "createdAt" | "updatedAt"> & { user: AppUser; finalize?: boolean }) {
  if (!Number.isFinite(input.actualQuantity) || input.actualQuantity <= 0) throw new Error("Actual quantity collected must be greater than zero.");
  const collectionId = await nextSequentialId("CSC");
  const stamp = nowISO();
  const { user, finalize, ...fields } = input;
  const payload: Omit<ControlSampleCollection, "id"> = {
    ...fields,
    collectionId,
    status: finalize ? "Collected" : "Draft",
    createdBy: user.uid,
    createdByName: user.displayName || user.email,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const ref = await addDoc(collection(getDb(), COLLECTIONS.controlSampleCollections), omitUndefined(payload as unknown as Record<string, unknown>));
  await audit({
    action: "Create",
    recordId: collectionId,
    newValue: payload,
    user,
    reason: "Controlled sample collection",
  });
  return { id: ref.id, ...payload };
}

export async function updateCollectionDraft(id: string, patch: Partial<ControlSampleCollection>, user: AppUser) {
  const row = await getCollection(id);
  if (!row) throw new Error("Collection record not found.");
  if (row.status !== "Draft") throw new Error("Only draft collection records can be edited.");
  const stamp = nowISO();
  await updateDoc(doc(getDb(), COLLECTIONS.controlSampleCollections, id), omitUndefined({ ...patch, updatedAt: stamp } as Record<string, unknown>));
  await audit({ action: "Edit", recordId: row.collectionId, previousValue: row, newValue: patch, user });
}

export async function finalizeCollection(id: string, user: AppUser) {
  const row = await getCollection(id);
  if (!row) throw new Error("Collection record not found.");
  if (row.status !== "Draft") throw new Error("Record is already finalized.");
  await updateDoc(doc(getDb(), COLLECTIONS.controlSampleCollections, id), { status: "Collected", updatedAt: nowISO() });
  await audit({ action: "Submission", recordId: row.collectionId, newValue: { status: "Collected" }, user });
}

export async function submitCollection(id: string, user: AppUser) {
  const row = await getCollection(id);
  if (!row) throw new Error("Collection record not found.");
  if (row.status !== "Collected" && row.status !== "Draft") {
    throw new Error("Only collected records can be submitted to the Controlled Sample Room.");
  }
  const stamp = nowISO();
  await updateDoc(doc(getDb(), COLLECTIONS.controlSampleCollections, id), {
    status: "Submitted",
    submittedAt: stamp,
    updatedAt: stamp,
  });
  await audit({ action: "Submission", recordId: row.collectionId, newValue: { status: "Submitted" }, user });
}

export async function receiveCollection(id: string, user: AppUser) {
  requirePermission(user, "control.perform", "QA Controlled Sample permission is required to receive a collection.");
  const row = await getCollection(id);
  if (!row) throw new Error("Collection record not found.");
  if (row.status !== "Submitted") throw new Error("Sample must be submitted before QA receipt.");
  const stamp = nowISO();
  await updateDoc(doc(getDb(), COLLECTIONS.controlSampleCollections, id), {
    status: "Received",
    receivedBy: user.displayName || user.email,
    receivedAt: stamp,
    updatedAt: stamp,
  });
  await audit({ action: "Verification", recordId: row.collectionId, newValue: { status: "Received" }, user });
}

export async function recordVerificationException(id: string, input: { discrepancy: string; remarks: string; user: AppUser }) {
  requirePermission(input.user, "control.perform", "QA Controlled Sample permission is required to record a verification exception.");
  const row = await getCollection(id);
  if (!row) throw new Error("Collection record not found.");
  if (row.status !== "Received" && row.status !== "Verification Pending") {
    throw new Error("Exception can be recorded only during QA verification.");
  }
  const stamp = nowISO();
  await updateDoc(doc(getDb(), COLLECTIONS.controlSampleCollections, id), {
    status: "Verification Exception",
    discrepancy: input.discrepancy,
    exceptionRemarks: input.remarks,
    updatedAt: stamp,
  });
  await audit({
    action: "Verification",
    recordId: row.collectionId,
    previousValue: { status: row.status, actualQuantity: row.actualQuantity },
    newValue: { status: "Verification Exception", discrepancy: input.discrepancy },
    reason: input.remarks,
    user: input.user,
  });
}

export async function verifyAndLogCollection(id: string, user: AppUser) {
  requirePermission(user, "control.perform", "QA Controlled Sample permission is required to verify a collection.");
  const row = await getCollection(id);
  if (!row) throw new Error("Collection record not found.");
  if (isLinkedControlSample(row.controlSampleDocId)) throw new Error("This collection has already been verified.");
  const retryLink = row.status === "Verified";
  if (!retryLink && row.status !== "Received" && row.status !== "Verification Pending") {
    throw new Error("QA must receive the sample before verification.");
  }
  const settings = controlOrg(await getOrganizationSettings());
  const stamp = nowISO();
  const colRef = doc(getDb(), COLLECTIONS.controlSampleCollections, id);
  await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(colRef);
    if (!snap.exists()) throw new Error("Collection record not found.");
    const current = { id: snap.id, ...snap.data() } as ControlSampleCollection;
    if (isLinkedControlSample(current.controlSampleDocId)) throw new Error("This collection has already been verified.");
    if (current.status !== "Received" && current.status !== "Verification Pending" && current.status !== "Verified") {
      throw new Error("QA must receive the sample before verification.");
    }
    if (current.controlSampleDocId !== "pending") {
      tx.update(colRef, {
        status: "Verified",
        controlSampleDocId: "pending",
        verifiedBy: user.displayName || user.email,
        verifiedAt: stamp,
        updatedAt: stamp,
      });
    }
  });
  const alreadyLinked = await findSampleLinkedToCollection(id);
  if (alreadyLinked) {
    await updateDoc(colRef, { controlSampleDocId: alreadyLinked.id, status: "Verified", updatedAt: nowISO() });
    return alreadyLinked;
  }
  let created: Awaited<ReturnType<typeof createControlSample>> | null = null;
  try {
    created = await createControlSample({
      productId: row.productId,
      productName: row.productName,
      batchId: row.batchId,
      batchNumber: row.batchNumber,
      batchSize: row.batchSize,
      manufacturingDate: row.manufacturingDate,
      expiryDate: row.expiryDate,
      market: row.market,
      quantity: row.actualQuantity,
      unit: row.unit,
      collectionDate: row.date,
      collectionStage: row.collectionStage,
      collectionDocId: id,
      motherBatch: row.motherBatch,
      conversionBatch: row.conversionBatch,
      brand: row.brand,
      conversionNoteRef: row.conversionNoteRef,
      purpose: "Controlled sample",
      destructionEligibleDate: destructionEligibleDate(row.expiryDate, settings.controlDestructionMonthsAfterExpiry),
      nextObservationDate: nextObservationDate(row.date || todayISO(), settings.controlObservationIntervalMonths),
      user,
    });
    await updateDoc(colRef, {
      controlSampleDocId: created.id,
      updatedAt: nowISO(),
    });
    await writeControlTx({
      transactionId: await nextSequentialId("CTX"),
      controlSampleId: created.controlSampleId,
      controlSampleDocId: created.id,
      productName: row.productName,
      batchNumber: row.batchNumber,
      transactionType: "CONTROL_SAMPLE_VERIFIED",
      quantity: row.actualQuantity,
      previousQuantity: created.availableQuantity,
      newQuantity: created.availableQuantity,
      reason: "QA verification and log book entry",
      reference: row.collectionId,
      performedBy: user.uid,
      performedByName: user.displayName || user.email,
      performedAt: stamp,
    });
    await audit({ action: "Verification", recordId: created.controlSampleId, newValue: { collectionId: row.collectionId }, user });
    return created;
  } catch (err) {
    if (created) {
      await updateDoc(colRef, {
        status: "Verified",
        controlSampleDocId: created.id,
        verifiedBy: user.displayName || user.email,
        verifiedAt: stamp,
        updatedAt: nowISO(),
      }).catch(() => undefined);
    } else {
      await updateDoc(colRef, {
        status: row.status,
        controlSampleDocId: deleteField(),
        verifiedBy: deleteField(),
        verifiedAt: deleteField(),
        updatedAt: nowISO(),
      }).catch(() => undefined);
    }
    throw err;
  }
}

export async function createControlSample(
  input: Omit<
    ControlSample,
    "id" | "controlSampleId" | "issuedQuantity" | "returnedQuantity" | "disposedQuantity" | "availableQuantity" | "status" | "createdBy" | "createdByName" | "createdAt" | "updatedAt"
  > & { user: AppUser }
) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("Quantity must be greater than zero.");
  const settings = controlOrg(await getOrganizationSettings());
  const controlSampleId = await nextSequentialId("CTL");
  const stamp = nowISO();
  const eligible = input.destructionEligibleDate || destructionEligibleDate(input.expiryDate, settings.controlDestructionMonthsAfterExpiry);
  const { user, ...sampleFields } = input;
  const payload: Omit<ControlSample, "id"> = {
    ...sampleFields,
    controlSampleId,
    initialQuantity: input.quantity,
    issuedQuantity: 0,
    returnedQuantity: 0,
    disposedQuantity: 0,
    destroyedQuantity: 0,
    verificationDiscardedQuantity: 0,
    adjustedQuantity: 0,
    availableQuantity: input.quantity,
    destructionEligibleDate: eligible,
    nextObservationDate: input.nextObservationDate || nextObservationDate(input.collectionDate || todayISO(), settings.controlObservationIntervalMonths),
    status: "Available",
    createdBy: user.uid,
    createdByName: user.displayName || user.email,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const ref = await addDoc(collection(getDb(), COLLECTIONS.controlSamples), omitUndefined(payload as unknown as Record<string, unknown>));
  await writeControlTx({
    transactionId: await nextSequentialId("CTX"),
    controlSampleId,
    controlSampleDocId: ref.id,
    productName: input.productName,
    batchNumber: input.batchNumber,
    transactionType: "CONTROL_SAMPLE_CREATED",
    quantity: input.quantity,
    previousQuantity: 0,
    newQuantity: input.quantity,
    toLocation: input.locationLabel,
    reason: "Controlled sample created",
    performedBy: user.uid,
    performedByName: user.displayName || user.email,
    performedAt: stamp,
  });
  await audit({
    action: "Create",
    recordId: controlSampleId,
    newValue: { controlSampleId, quantity: input.quantity },
    user,
  });
  return { id: ref.id, ...payload };
}

export async function storeControlSample(input: {
  id: string;
  storageArea: string;
  rackNumber: string;
  partitionNumber?: string;
  boxNumber: string;
  position?: string;
  user: AppUser;
}) {
  requirePermission(input.user, "control.perform", "QA Controlled Sample permission is required to store a sample.");
  const row = await getControlSample(input.id);
  if (!row) throw new Error("Controlled sample not found.");
  if (!input.storageArea?.trim()) throw new Error("Storage area is required.");
  if (!input.rackNumber?.trim() || !input.boxNumber?.trim()) {
    throw new Error("Rack and box are required to store a controlled sample.");
  }
  const settings = controlOrg(await getOrganizationSettings());
  if (!settings.controlAllowDuplicateBoxOccupancy && input.boxNumber) {
    const all = await listControlSamples();
    const clash = all.find((s) => s.id !== row.id && s.boxNumber === input.boxNumber && s.status !== "Destroyed" && s.status !== "Disposed");
    if (clash) throw new Error(`Box ${input.boxNumber} is already assigned to ${clash.controlSampleId}. Duplicate occupancy is not enabled.`);
  }
  const fromLocation = [row.storageArea, row.rackNumber, row.partitionNumber, row.boxNumber].filter(Boolean).join(" / ");
  const toLocation = [input.storageArea, input.rackNumber, input.partitionNumber, input.boxNumber].filter(Boolean).join(" / ");
  await persistSample(
    row,
    {
      storageArea: input.storageArea,
      rackNumber: input.rackNumber,
      partitionNumber: input.partitionNumber,
      boxNumber: input.boxNumber,
      position: input.position,
      locationLabel: toLocation,
      status: "Stored",
    },
    {
      type: fromLocation ? "CONTROL_SAMPLE_MOVED" : "CONTROL_SAMPLE_STORED",
      quantity: row.availableQuantity,
      previous: row.availableQuantity,
      next: row.availableQuantity,
      fromLocation,
      toLocation,
      reason: "Storage assignment",
      user: input.user,
    }
  );
  await addDoc(
    collection(getDb(), COLLECTIONS.controlSampleMovements),
    omitUndefined({
      controlSampleId: row.controlSampleId,
      controlSampleDocId: row.id,
      fromLocation,
      toLocation,
      performedBy: input.user.displayName || input.user.email,
      performedAt: nowISO(),
    })
  );
  if (row.id) {
    const snap = await getDocs(collection(getDb(), COLLECTIONS.controlSampleCollections));
    const linked = snap.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }) as ControlSampleCollection)
      .find((c) => c.controlSampleDocId === row.id);
    if (linked && linked.status !== "Stored") {
      await updateDoc(doc(getDb(), COLLECTIONS.controlSampleCollections, linked.id), { status: "Stored", updatedAt: nowISO() });
      invalidateReadCache();
    }
  }
  await audit({ action: "Movement", recordId: row.controlSampleId, newValue: { toLocation }, user: input.user });
}

export async function listRacks() {
  return listAll<ControlSampleRack>(COLLECTIONS.controlSampleLocations);
}

export async function createRack(input: { rackNumber: string; partitionNumber?: string; area?: string; user: AppUser }) {
  const racks = await listRacks();
  const dup = racks.find((r) => r.status === "Active" && r.rackNumber === input.rackNumber && (r.partitionNumber || "") === (input.partitionNumber || ""));
  if (dup) throw new Error("An active rack/partition with this identifier already exists.");
  const payload: Omit<ControlSampleRack, "id"> = {
    rackNumber: input.rackNumber,
    partitionNumber: input.partitionNumber,
    area: input.area || "Controlled Sample Room",
    status: "Active",
    createdAt: nowISO(),
  };
  const ref = await addDoc(collection(getDb(), COLLECTIONS.controlSampleLocations), omitUndefined(payload as unknown as Record<string, unknown>));
  await audit({ action: "Create", recordId: ref.id, newValue: payload, user: input.user, reason: "Controlled sample rack" });
  return { id: ref.id, ...payload };
}

export async function listBoxes() {
  return listAll<ControlSampleBox>(COLLECTIONS.controlSampleBoxes);
}

export async function listBoxCategories() {
  return listAll<ControlSampleBoxCategory>(COLLECTIONS.controlSampleBoxCategories);
}

export async function saveBoxCategory(input: {
  id?: string;
  category: string;
  prefix: string;
  numberingPattern: string;
  currentSequence?: number;
  user: AppUser;
}) {
  const stamp = nowISO();
  if (input.id) {
    await updateDoc(doc(getDb(), COLLECTIONS.controlSampleBoxCategories, input.id), {
      category: input.category,
      prefix: input.prefix,
      numberingPattern: input.numberingPattern,
      updatedAt: stamp,
    });
    return;
  }
  const payload: Omit<ControlSampleBoxCategory, "id"> = {
    category: input.category,
    prefix: input.prefix,
    numberingPattern: input.numberingPattern,
    currentSequence: input.currentSequence || 0,
    status: "Active",
    createdAt: stamp,
    updatedAt: stamp,
  };
  await addDoc(collection(getDb(), COLLECTIONS.controlSampleBoxCategories), payload);
  await audit({ action: "Create", recordId: input.category, newValue: payload, user: input.user });
}

export async function createBox(input: {
  categoryId?: string;
  boxNumber?: string;
  category?: string;
  rackNumber: string;
  partitionNumber?: string;
  remarks?: string;
  user: AppUser;
}) {
  const requestedNumber = input.boxNumber?.trim();
  const boxes = await listBoxes();
  const taken = new Set(boxes.filter((b) => b.status === "Active").map((b) => b.boxNumber));
  if (requestedNumber && taken.has(requestedNumber)) {
    throw new Error("An active box with this number already exists.");
  }
  const created = await runTransaction(getDb(), async (tx) => {
    let boxNumber = requestedNumber;
    let categoryName = input.category;
    if (!boxNumber && input.categoryId) {
      const catRef = doc(getDb(), COLLECTIONS.controlSampleBoxCategories, input.categoryId);
      const snap = await tx.get(catRef);
      if (!snap.exists()) throw new Error("Box type not found. Save a box type first.");
      const cat = snap.data() as ControlSampleBoxCategory;
      let next = (cat.currentSequence || 0) + 1;
      boxNumber = `${cat.prefix}${String(next).padStart(3, "0")}`;
      while (taken.has(boxNumber)) {
        next += 1;
        boxNumber = `${cat.prefix}${String(next).padStart(3, "0")}`;
      }
      categoryName = input.category || cat.category;
      tx.update(catRef, { currentSequence: next, updatedAt: nowISO() });
    }
    if (!boxNumber) throw new Error("Choose a box type so a box number can be created.");
    const boxRef = doc(collection(getDb(), COLLECTIONS.controlSampleBoxes));
    const payload: Omit<ControlSampleBox, "id"> = {
      boxNumber,
      category: categoryName,
      rackNumber: input.rackNumber,
      partitionNumber: input.partitionNumber,
      remarks: input.remarks,
      status: "Active",
      createdAt: nowISO(),
    };
    tx.set(boxRef, omitUndefined(payload as unknown as Record<string, unknown>));
    return { id: boxRef.id, payload };
  });
  await audit({ action: "Create", recordId: created.payload.boxNumber, newValue: created.payload, user: input.user });
  return { id: created.id, ...created.payload };
}

export async function listObservationParameters() {
  return listAll<ControlObservationParameter>(COLLECTIONS.controlSampleObservationParameters, "sortOrder");
}

export async function saveObservationParameter(input: { productType: string; parameter: string; sortOrder?: number; user: AppUser }) {
  const payload: Omit<ControlObservationParameter, "id"> = {
    productType: input.productType,
    parameter: input.parameter,
    status: "Active",
    sortOrder: input.sortOrder || 0,
  };
  await addDoc(collection(getDb(), COLLECTIONS.controlSampleObservationParameters), payload);
  await audit({ action: "Create", recordId: input.parameter, newValue: payload, user: input.user });
}

export async function listObservations() {
  return listAll<ControlSampleObservation>(COLLECTIONS.controlSampleObservations, "observationDate");
}

export async function recordObservation(input: {
  controlSampleDocId: string;
  productType?: string;
  checklist: { parameter: string; result: string }[];
  productDescription?: string;
  physicalCondition?: string;
  packIntegrity?: string;
  leakage?: string;
  colour?: string;
  visibleParticles?: string;
  sealCondition?: string;
  otherObservation?: string;
  result: "OK" | "Abnormal Observation";
  discardedQuantity: number;
  natureOfObservation?: string;
  remarks?: string;
  user: AppUser;
}) {
  const row = await getControlSample(input.controlSampleDocId);
  if (!row) throw new Error("Controlled sample not found.");
  if (row.destructionHold) throw new Error("Cannot discard quantity from a sample that is on destruction hold.");
  if (input.discardedQuantity < 0) throw new Error("Discarded quantity cannot be negative.");
  const free = await uncommittedQuantity(row);
  if (input.discardedQuantity > free) {
    throw new Error(
      free > 0
        ? `Discarded quantity cannot exceed quantity that is not committed to a requisition or destruction note (${free}).`
        : "Available quantity is already committed to a requisition or destruction note."
    );
  }
  if (input.result === "Abnormal Observation" && !input.natureOfObservation && !input.otherObservation) {
    throw new Error("Nature of observation is required for an abnormal result.");
  }
  const settings = controlOrg(await getOrganizationSettings());
  const observationId = await nextSequentialId("CSO");
  const stamp = nowISO();
  const status = input.result === "OK" ? "OK" : "Abnormal Observation";
  const payload: Omit<ControlSampleObservation, "id"> = {
    observationId,
    controlSampleDocId: row.id,
    controlSampleId: row.controlSampleId,
    productName: row.productName,
    batchNumber: row.batchNumber,
    observationDate: todayISO(),
    observer: input.user.displayName || input.user.email,
    productType: input.productType,
    checklist: input.checklist,
    productDescription: input.productDescription,
    physicalCondition: input.physicalCondition,
    packIntegrity: input.packIntegrity,
    leakage: input.leakage,
    colour: input.colour,
    visibleParticles: input.visibleParticles,
    sealCondition: input.sealCondition,
    otherObservation: input.otherObservation || input.natureOfObservation,
    result: input.result,
    status,
    discardedQuantity: input.discardedQuantity,
    remarks: input.remarks,
    createdBy: input.user.uid,
    createdByName: input.user.displayName || input.user.email,
    createdAt: stamp,
  };
  await addDoc(collection(getDb(), COLLECTIONS.controlSampleObservations), omitUndefined(payload as unknown as Record<string, unknown>));
  if (input.discardedQuantity > 0) {
    const next = applyQty(row, { verificationDiscardedQuantity: (row.verificationDiscardedQuantity || 0) + input.discardedQuantity });
    await persistSample(row, next, {
      type: "CONTROL_SAMPLE_VERIFICATION_DISCARDED",
      quantity: input.discardedQuantity,
      previous: row.availableQuantity,
      next: next.availableQuantity,
      reason: "Physical verification — sample discarded",
      reference: observationId,
      user: input.user,
    });
  }
  await updateDoc(doc(getDb(), COLLECTIONS.controlSamples, row.id), {
    lastObservationDate: todayISO(),
    nextObservationDate: nextObservationDate(todayISO(), settings.controlObservationIntervalMonths),
    updatedAt: stamp,
  });
  await audit({
    action: "Observation",
    recordId: row.controlSampleId,
    newValue: { observationId, result: input.result, discardedQuantity: input.discardedQuantity },
    user: input.user,
  });
  return payload;
}

export async function reviewAbnormalObservation(id: string, input: { status: "QA Review" | "Investigation Required" | "Closed"; investigationRef?: string; qaReview: string; user: AppUser }) {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.controlSampleObservations, id));
  if (!snap.exists()) throw new Error("Observation not found.");
  const row = { id: snap.id, ...snap.data() } as ControlSampleObservation;
  if (row.result !== "Abnormal Observation" && row.status !== "QA Review" && row.status !== "Investigation Required") {
    throw new Error("Only abnormal observations require QA review.");
  }
  await updateDoc(doc(getDb(), COLLECTIONS.controlSampleObservations, id), omitUndefined({
    status: input.status,
    investigationRef: input.investigationRef,
    qaReview: input.qaReview,
  }));
  await audit({ action: "Approval", recordId: row.observationId, newValue: input, user: input.user });
}

export async function listRequisitions() {
  return listAll<ControlSampleRequisition>(COLLECTIONS.controlSampleWithdrawals);
}

export async function createRequisition(input: {
  fromDepartment: string;
  controlSampleDocId: string;
  quantityRequired: number;
  reason: string;
  remarks?: string;
  user: AppUser;
}) {
  if (!Number.isFinite(input.quantityRequired) || input.quantityRequired <= 0) {
    throw new Error("Quantity required must be greater than zero.");
  }
  const row = await getControlSample(input.controlSampleDocId);
  if (!row) throw new Error("Controlled sample not found.");
  if (row.destructionHold) throw new Error("Cannot withdraw a sample that is on destruction hold.");
  const [requisitions, notes] = await Promise.all([listRequisitions(), listDestructions()]);
  const free =
    finiteNumber(row.availableQuantity) - requisitionHeld(requisitions, row.id) - destructionReserved(notes, row.id);
  if (input.quantityRequired > free) {
    throw new Error(
      free > 0
        ? `Required quantity exceeds quantity that is not already committed (${free}).`
        : "Available quantity is already committed to another requisition or destruction note."
    );
  }
  const requisitionNumber = await nextSequentialId("CSR");
  const stamp = nowISO();
  const payload: Omit<ControlSampleRequisition, "id"> = {
    requisitionNumber,
    date: todayISO(),
    fromDepartment: input.fromDepartment,
    controlSampleDocId: row.id,
    controlSampleId: row.controlSampleId,
    productName: row.productName,
    batchNumber: row.batchNumber,
    quantityRequired: input.quantityRequired,
    quantityIssued: 0,
    quantityReturned: 0,
    reason: input.reason,
    requestedBy: input.user.displayName || input.user.email,
    requestedDate: todayISO(),
    status: "Submitted",
    remarks: input.remarks,
    createdBy: input.user.uid,
    createdByName: input.user.displayName || input.user.email,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const ref = await addDoc(collection(getDb(), COLLECTIONS.controlSampleWithdrawals), omitUndefined(payload as unknown as Record<string, unknown>));
  await audit({ action: "Create", recordId: requisitionNumber, newValue: payload, user: input.user });
  return { id: ref.id, ...payload };
}

export async function approveRequisition(id: string, user: AppUser, approved: boolean, remarks?: string) {
  requirePermission(user, "approve.records", "Electronic approval permission is required to approve or reject a requisition.");
  const snap = await getDoc(doc(getDb(), COLLECTIONS.controlSampleWithdrawals, id));
  if (!snap.exists()) throw new Error("Requisition not found.");
  const row = { id: snap.id, ...snap.data() } as ControlSampleRequisition;
  if (row.status !== "Submitted") throw new Error("Only submitted requisitions can be approved or rejected.");
  const stamp = nowISO();
  await updateDoc(doc(getDb(), COLLECTIONS.controlSampleWithdrawals, id), {
    status: approved ? "Approved" : "Rejected",
    approvedBy: user.displayName || user.email,
    approvedDate: todayISO(),
    remarks: remarks || row.remarks,
    updatedAt: stamp,
  });
  await audit({
    action: "Approval",
    recordId: row.requisitionNumber,
    newValue: { status: approved ? "Approved" : "Rejected" },
    reason: remarks,
    user,
  });
}

export async function issueApprovedRequisition(id: string, input: { quantity: number; issuedTo: string; user: AppUser }) {
  const settings = controlOrg(await getOrganizationSettings());
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("Issue quantity must be greater than zero.");
  const notes = await listDestructions();
  const stamp = nowISO();
  const result = await runTransaction(getDb(), async (tx) => {
    const reqRef = doc(getDb(), COLLECTIONS.controlSampleWithdrawals, id);
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error("Requisition not found.");
    const req = { id: reqSnap.id, ...reqSnap.data() } as ControlSampleRequisition;
    if (settings.controlRequireWithdrawalApproval && req.status === "Submitted") {
      throw new Error("QA Manager approval is required before issue.");
    }
    if (!["Approved", "Partially Returned", "Submitted"].includes(req.status)) {
      throw new Error("Requisition is not eligible for issue.");
    }
    const issuedSoFar = finiteNumber(req.quantityIssued);
    const required = finiteNumber(req.quantityRequired);
    if (input.quantity > required - issuedSoFar) {
      throw new Error("Cannot issue more than the approved requisition quantity.");
    }
    const sampleRef = doc(getDb(), COLLECTIONS.controlSamples, req.controlSampleDocId);
    const sampleSnap = await tx.get(sampleRef);
    if (!sampleSnap.exists()) throw new Error("Controlled sample not found.");
    const row = { id: sampleSnap.id, ...sampleSnap.data() } as ControlSample;
    if (row.destructionHold) throw new Error("Cannot issue a sample that is on destruction hold.");
    const reserved = destructionReserved(notes, row.id);
    const free = finiteNumber(row.availableQuantity) - reserved;
    if (input.quantity > free) {
      throw new Error(
        free > 0
          ? `Cannot issue more than quantity that is not reserved for destruction (${free}).`
          : "Available quantity is reserved for destruction."
      );
    }
    const next = applyQty(row, { issuedQuantity: finiteNumber(row.issuedQuantity) + input.quantity });
    const status = deriveControlInventoryStatus({ ...row, ...next });
    const issued = issuedSoFar + input.quantity;
    tx.update(sampleRef, omitUndefined({ ...next, status, updatedAt: stamp }));
    tx.update(reqRef, {
      quantityIssued: issued,
      issuedTo: input.issuedTo,
      issuedBy: input.user.displayName || input.user.email,
      issuedAt: stamp,
      status: requisitionStatusAfterQuantities(required, issued, finiteNumber(req.quantityReturned)),
      updatedAt: stamp,
    });
    return { req, row, next };
  });
  await writeControlTx({
    transactionId: await nextSequentialId("CTX"),
    controlSampleId: result.row.controlSampleId,
    controlSampleDocId: result.row.id,
    productName: result.row.productName,
    batchNumber: result.row.batchNumber,
    transactionType: "CONTROL_SAMPLE_ISSUED",
    quantity: input.quantity,
    previousQuantity: result.row.availableQuantity,
    newQuantity: result.next.availableQuantity,
    reason: result.req.reason,
    reference: result.req.requisitionNumber,
    performedBy: input.user.uid,
    performedByName: input.user.displayName || input.user.email,
    performedAt: stamp,
  });
  await audit({ action: "Issue", recordId: result.req.requisitionNumber, newValue: { issued: input.quantity }, user: input.user });
}

export async function returnRequisition(id: string, input: { quantity: number; returnedBy: string; condition?: string; remarks?: string; user: AppUser }) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error("Return quantity must be greater than zero.");
  const stamp = nowISO();
  const result = await runTransaction(getDb(), async (tx) => {
    const reqRef = doc(getDb(), COLLECTIONS.controlSampleWithdrawals, id);
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error("Requisition not found.");
    const req = { id: reqSnap.id, ...reqSnap.data() } as ControlSampleRequisition;
    const issuedSoFar = finiteNumber(req.quantityIssued);
    const returnedSoFar = finiteNumber(req.quantityReturned);
    const outstanding = Math.max(0, issuedSoFar - returnedSoFar);
    if (!["Approved", "Issued", "Partially Returned"].includes(req.status) || outstanding <= 0) {
      throw new Error("Only issued quantity can be returned.");
    }
    if (input.quantity > outstanding) {
      throw new Error(`Cannot return more than outstanding issued quantity (${outstanding}).`);
    }
    const sampleRef = doc(getDb(), COLLECTIONS.controlSamples, req.controlSampleDocId);
    const sampleSnap = await tx.get(sampleRef);
    if (!sampleSnap.exists()) throw new Error("Controlled sample not found.");
    const row = { id: sampleSnap.id, ...sampleSnap.data() } as ControlSample;
    const next = applyQty(row, { returnedQuantity: finiteNumber(row.returnedQuantity) + input.quantity });
    const status = deriveControlInventoryStatus({ ...row, ...next });
    const returned = returnedSoFar + input.quantity;
    tx.update(sampleRef, omitUndefined({ ...next, status, updatedAt: stamp }));
    tx.update(
      reqRef,
      omitUndefined({
        quantityReturned: returned,
        returnedBy: input.returnedBy,
        returnDate: todayISO(),
        returnCheckedBy: input.user.displayName || input.user.email,
        returnCondition: input.condition,
        remarks: input.remarks || req.remarks,
        status: requisitionStatusAfterQuantities(finiteNumber(req.quantityRequired), issuedSoFar, returned),
        updatedAt: stamp,
      })
    );
    return { req, row, next };
  });
  await writeControlTx({
    transactionId: await nextSequentialId("CTX"),
    controlSampleId: result.row.controlSampleId,
    controlSampleDocId: result.row.id,
    productName: result.row.productName,
    batchNumber: result.row.batchNumber,
    transactionType: "CONTROL_SAMPLE_RETURNED",
    quantity: input.quantity,
    previousQuantity: result.row.availableQuantity,
    newQuantity: result.next.availableQuantity,
    reason: "Controlled sample return",
    reference: result.req.requisitionNumber,
    remarks: input.remarks,
    performedBy: input.user.uid,
    performedByName: input.user.displayName || input.user.email,
    performedAt: stamp,
  });
  await audit({ action: "Return", recordId: result.req.requisitionNumber, newValue: { returned: input.quantity }, user: input.user });
}

/** Legacy helpers kept for existing records; new issues must use requisition approval. */
export async function issueControlSample(_args: {
  id: string;
  quantity: number;
  reason: string;
  remarks?: string;
  user: AppUser;
}): Promise<never> {
  void _args;
  throw new Error("Direct issue is not allowed. Create a withdrawal requisition and obtain QA Manager approval.");
}

export async function returnControlSample(_args: {
  id: string;
  quantity: number;
  reason: string;
  remarks?: string;
  user: AppUser;
}): Promise<never> {
  void _args;
  throw new Error("Direct return is not allowed. Record the return against the approved requisition.");
}

export async function disposeControlSample(_args: {
  id: string;
  quantity: number;
  reason: string;
  remarks?: string;
  user: AppUser;
}): Promise<never> {
  void _args;
  throw new Error("Direct disposal is not allowed. Use the destruction note workflow (Annexure-VI).");
}

export async function adjustControlSample(input: {
  id: string;
  quantityDelta: number;
  reason: string;
  remarks?: string;
  user: AppUser;
}) {
  if (!input.reason.trim()) throw new Error("A reason is required for an approved quantity adjustment.");
  if (!input.quantityDelta) throw new Error("Adjustment quantity cannot be zero.");
  const row = await getControlSample(input.id);
  if (!row) throw new Error("Controlled sample not found.");
  if (input.quantityDelta < 0) {
    const free = await uncommittedQuantity(row);
    if (-input.quantityDelta > free) {
      throw new Error(
        free > 0
          ? `Adjustment cannot reduce quantity committed to a requisition or destruction note. Free quantity is ${free}.`
          : "Available quantity is already committed to a requisition or destruction note."
      );
    }
  }
  const next = applyQty(row, { adjustedQuantity: (row.adjustedQuantity || 0) + input.quantityDelta });
  await persistSample(row, next, {
    type: "CONTROL_SAMPLE_ADJUSTED",
    quantity: Math.abs(input.quantityDelta),
    previous: row.availableQuantity,
    next: next.availableQuantity,
    reason: input.reason,
    remarks: input.remarks,
    user: input.user,
  });
  await audit({
    action: "Adjustment",
    recordId: row.controlSampleId,
    previousValue: { availableQuantity: row.availableQuantity, adjustedQuantity: row.adjustedQuantity || 0 },
    newValue: { availableQuantity: next.availableQuantity, adjustedQuantity: next.adjustedQuantity },
    reason: input.reason,
    user: input.user,
  });
}

export async function listHolds() {
  return listAll<ControlSampleHold>(COLLECTIONS.controlSampleHolds);
}

export async function applyDestructionHold(input: {
  controlSampleDocId: string;
  holdType: ControlHoldType;
  reason: string;
  referenceNumber?: string;
  remarks?: string;
  user: AppUser;
}) {
  const row = await getControlSample(input.controlSampleDocId);
  if (!row) throw new Error("Controlled sample not found.");
  const holdId = await nextSequentialId("CSH");
  const stamp = nowISO();
  const payload: Omit<ControlSampleHold, "id"> = {
    holdId,
    controlSampleDocId: row.id,
    controlSampleId: row.controlSampleId,
    holdType: input.holdType,
    reason: input.reason,
    referenceNumber: input.referenceNumber,
    holdDate: todayISO(),
    appliedBy: input.user.displayName || input.user.email,
    active: true,
    remarks: input.remarks,
    createdAt: stamp,
  };
  await addDoc(collection(getDb(), COLLECTIONS.controlSampleHolds), omitUndefined(payload as unknown as Record<string, unknown>));
  await persistSample(row, { destructionHold: true, status: "Destruction Hold" }, {
    type: "CONTROL_SAMPLE_DESTRUCTION_HOLD",
    quantity: row.availableQuantity,
    previous: row.availableQuantity,
    next: row.availableQuantity,
    reason: input.reason,
    reference: holdId,
    user: input.user,
  });
  await audit({ action: "Hold", recordId: row.controlSampleId, newValue: payload, user: input.user });
}

export async function releaseDestructionHold(holdDocId: string, user: AppUser, remarks?: string) {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.controlSampleHolds, holdDocId));
  if (!snap.exists()) throw new Error("Hold not found.");
  const hold = { id: snap.id, ...snap.data() } as ControlSampleHold;
  if (!hold.active) throw new Error("Hold is already released.");
  await updateDoc(doc(getDb(), COLLECTIONS.controlSampleHolds, holdDocId), {
    active: false,
    releasedBy: user.displayName || user.email,
    releaseDate: todayISO(),
    remarks: remarks || hold.remarks,
  });
  const remaining = (await listHolds()).filter((h) => h.controlSampleDocId === hold.controlSampleDocId && h.active && h.id !== hold.id);
  const row = await getControlSample(hold.controlSampleDocId);
  if (row) {
    await persistSample(row, { destructionHold: remaining.length > 0 }, {
      type: "CONTROL_SAMPLE_DESTRUCTION_RELEASED",
      quantity: row.availableQuantity,
      previous: row.availableQuantity,
      next: row.availableQuantity,
      reason: remarks || "Hold released",
      reference: hold.holdId,
      user,
    });
  }
  await audit({ action: "Hold release", recordId: hold.controlSampleId, user, reason: remarks });
}

export async function listDestructions() {
  return listAll<ControlSampleDestruction>(COLLECTIONS.controlSampleDestructions);
}

export async function createDestructionNote(input: {
  controlSampleDocId: string;
  quantity: number;
  reason: string;
  modeOfDestruction?: string;
  remarks?: string;
  user: AppUser;
}) {
  const row = await getControlSample(input.controlSampleDocId);
  if (!row) throw new Error("Controlled sample not found.");
  if (row.destructionHold) throw new Error("Cannot destroy a sample under an active destruction hold.");
  const settings = controlOrg(await getOrganizationSettings());
  if (!isEligibleNow(row, settings)) {
    throw new Error("Sample is not yet eligible for destruction (expiry + configured retention).");
  }
  const openReserved = destructionReserved(await listDestructions(), row.id);
  const held = requisitionHeld(await listRequisitions(), row.id);
  const remaining = finiteNumber(row.availableQuantity) - openReserved - held;
  if (!Number.isFinite(input.quantity) || input.quantity <= 0 || input.quantity > remaining) {
    throw new Error(
      remaining > 0
        ? `Destruction quantity must be greater than zero and not exceed the unreserved quantity (${remaining}).`
        : "This sample already has open destruction notes for the full available quantity."
    );
  }
  const dcnNumber = await nextDcnNumber();
  const stamp = nowISO();
  const payload: Omit<ControlSampleDestruction, "id"> = {
    dcnNumber,
    date: todayISO(),
    controlSampleDocId: row.id,
    controlSampleId: row.controlSampleId,
    productName: row.productName,
    batchNumber: row.batchNumber,
    quantity: input.quantity,
    reason: input.reason,
    modeOfDestruction: input.modeOfDestruction,
    checklist: DEFAULT_DESTRUCTION_STEPS.map((step) => ({ step, completed: false })),
    status: "QA Initiated",
    initiatedBy: input.user.displayName || input.user.email,
    remarks: input.remarks,
    createdBy: input.user.uid,
    createdByName: input.user.displayName || input.user.email,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const ref = await addDoc(collection(getDb(), COLLECTIONS.controlSampleDestructions), omitUndefined(payload as unknown as Record<string, unknown>));
  await persistSample(row, {}, {
    type: "CONTROL_SAMPLE_DESTRUCTION_INITIATED",
    quantity: input.quantity,
    previous: row.availableQuantity,
    next: row.availableQuantity,
    reason: input.reason,
    reference: dcnNumber,
    user: input.user,
  });
  await audit({ action: "Create", recordId: dcnNumber, newValue: payload, user: input.user });
  return { id: ref.id, ...payload };
}

function isEligibleNow(row: ControlSample, settings: ReturnType<typeof controlOrg>) {
  const eligible = effectiveDueDate(
    row.destructionEligibleDate || destructionEligibleDate(row.expiryDate, settings.controlDestructionMonthsAfterExpiry)
  );
  return Boolean(eligible && eligible <= todayISO() && row.availableQuantity > 0);
}

export async function approveDestruction(id: string, user: AppUser) {
  requirePermission(user, "approve.records", "Electronic approval permission is required to approve a destruction note.");
  const snap = await getDoc(doc(getDb(), COLLECTIONS.controlSampleDestructions, id));
  if (!snap.exists()) throw new Error("Destruction note not found.");
  const row = { id: snap.id, ...snap.data() } as ControlSampleDestruction;
  if (row.status !== "QA Initiated" && row.status !== "Note Created") {
    throw new Error("Destruction note is not awaiting QA Head check.");
  }
  await updateDoc(doc(getDb(), COLLECTIONS.controlSampleDestructions, id), {
    status: "Approved",
    checkedBy: user.displayName || user.email,
    updatedAt: nowISO(),
  });
  await audit({ action: "Approval", recordId: row.dcnNumber, newValue: { status: "Approved" }, user });
}

export async function completeDestructionChecklist(id: string, checklist: ControlSampleDestruction["checklist"], user: AppUser) {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.controlSampleDestructions, id));
  if (!snap.exists()) throw new Error("Destruction note not found.");
  const row = { id: snap.id, ...snap.data() } as ControlSampleDestruction;
  if (row.status !== "Approved") throw new Error("Destruction cannot be performed before QA Head approval.");
  const sample = await getControlSample(row.controlSampleDocId);
  if (sample?.destructionHold) throw new Error("Cannot destroy a sample under an active destruction hold.");
  const cleaned = (checklist || []).map((step) =>
    omitUndefined({
      step: step.step,
      completed: step.completed,
      completedBy: step.completedBy,
      completedAt: step.completedAt,
      remarks: step.remarks,
    } as Record<string, unknown>)
  ) as ControlSampleDestruction["checklist"];
  if (!cleaned.length || cleaned.some((step) => !step.completed)) {
    throw new Error("Complete every destruction checklist step before recording destruction.");
  }
  const stamp = nowISO();
  const posted = await runTransaction(getDb(), async (tx) => {
    const noteRef = doc(getDb(), COLLECTIONS.controlSampleDestructions, id);
    const noteSnap = await tx.get(noteRef);
    if (!noteSnap.exists()) throw new Error("Destruction note not found.");
    const note = { id: noteSnap.id, ...noteSnap.data() } as ControlSampleDestruction;
    if (note.status !== "Approved") throw new Error("Destruction cannot be performed before QA Head approval.");
    if (note.quantityPosted) throw new Error("Destruction quantity was already removed from stock.");
    const sampleRef = doc(getDb(), COLLECTIONS.controlSamples, note.controlSampleDocId);
    const sampleSnap = await tx.get(sampleRef);
    if (!sampleSnap.exists()) throw new Error("Controlled sample not found.");
    const sampleRow = { id: sampleSnap.id, ...sampleSnap.data() } as ControlSample;
    if (sampleRow.destructionHold) throw new Error("Cannot destroy a sample under an active destruction hold.");
    if (note.quantity > finiteNumber(sampleRow.availableQuantity)) {
      throw new Error(`Cannot destroy more than available quantity (${finiteNumber(sampleRow.availableQuantity)}).`);
    }
    const next = applyQty(sampleRow, { destroyedQuantity: destroyedQty(sampleRow) + note.quantity });
    const status = deriveControlInventoryStatus({ ...sampleRow, ...next });
    tx.update(sampleRef, omitUndefined({ ...next, status, updatedAt: stamp }));
    tx.update(noteRef, {
      checklist: cleaned,
      status: "Destroyed Pending Verification",
      quantityPosted: true,
      destroyedOn: todayISO(),
      destroyedBy: user.displayName || user.email,
      updatedAt: stamp,
    });
    return { note, sampleRow, next };
  });
  await writeControlTx({
    transactionId: await nextSequentialId("CTX"),
    controlSampleId: posted.sampleRow.controlSampleId,
    controlSampleDocId: posted.sampleRow.id,
    productName: posted.sampleRow.productName,
    batchNumber: posted.sampleRow.batchNumber,
    transactionType: "CONTROL_SAMPLE_DESTROYED",
    quantity: posted.note.quantity,
    previousQuantity: posted.sampleRow.availableQuantity,
    newQuantity: posted.next.availableQuantity,
    reason: posted.note.reason,
    reference: posted.note.dcnNumber,
    performedBy: user.uid,
    performedByName: user.displayName || user.email,
    performedAt: stamp,
  });
  await audit({ action: "Destruction", recordId: row.dcnNumber, newValue: { checklist: cleaned }, user });
}

export async function verifyDestruction(id: string, user: AppUser, remarks?: string) {
  const stamp = nowISO();
  const result = await runTransaction(getDb(), async (tx) => {
    const noteRef = doc(getDb(), COLLECTIONS.controlSampleDestructions, id);
    const noteSnap = await tx.get(noteRef);
    if (!noteSnap.exists()) throw new Error("Destruction note not found.");
    const note = { id: noteSnap.id, ...noteSnap.data() } as ControlSampleDestruction;
    if (note.status !== "Destroyed Pending Verification") {
      throw new Error("Verification is only allowed after destruction activity is recorded.");
    }
    const sampleRef = doc(getDb(), COLLECTIONS.controlSamples, note.controlSampleDocId);
    const sampleSnap = await tx.get(sampleRef);
    if (!sampleSnap.exists()) throw new Error("Controlled sample not found.");
    const row = { id: sampleSnap.id, ...sampleSnap.data() } as ControlSample;
    const alreadyPosted = Boolean(note.quantityPosted);
    if (!alreadyPosted && note.quantity > finiteNumber(row.availableQuantity)) {
      throw new Error(`Cannot destroy more than available quantity (${finiteNumber(row.availableQuantity)}).`);
    }
    const next = alreadyPosted
      ? applyQty(row, {})
      : applyQty(row, { destroyedQuantity: destroyedQty(row) + note.quantity });
    if (!alreadyPosted) {
      const status = deriveControlInventoryStatus({ ...row, ...next });
      tx.update(sampleRef, omitUndefined({ ...next, status, updatedAt: stamp }));
    }
    tx.update(
      noteRef,
      omitUndefined({
        status: "Destroyed",
        quantityPosted: true,
        verifiedBy: user.displayName || user.email,
        remarks: remarks || note.remarks,
        updatedAt: stamp,
      })
    );
    return { note, row, next, alreadyPosted };
  });
  const { note, row, next, alreadyPosted } = result;
  if (!alreadyPosted) {
    await writeControlTx({
      transactionId: await nextSequentialId("CTX"),
      controlSampleId: row.controlSampleId,
      controlSampleDocId: row.id,
      productName: row.productName,
      batchNumber: row.batchNumber,
      transactionType: "CONTROL_SAMPLE_DESTROYED",
      quantity: note.quantity,
      previousQuantity: row.availableQuantity,
      newQuantity: next.availableQuantity,
      reason: note.reason,
      reference: note.dcnNumber,
      performedBy: user.uid,
      performedByName: user.displayName || user.email,
      performedAt: stamp,
    });
  }
  await writeControlTx({
    transactionId: await nextSequentialId("CTX"),
    controlSampleId: row.controlSampleId,
    controlSampleDocId: row.id,
    productName: row.productName,
    batchNumber: row.batchNumber,
    transactionType: "CONTROL_SAMPLE_DESTRUCTION_VERIFIED",
    quantity: note.quantity,
    previousQuantity: next.availableQuantity,
    newQuantity: next.availableQuantity,
    reason: remarks || "Destruction verification",
    reference: note.dcnNumber,
    performedBy: user.uid,
    performedByName: user.displayName || user.email,
    performedAt: stamp,
  });
  const destroyedOn = note.destroyedOn || todayISO();
  await addDoc(collection(getDb(), COLLECTIONS.controlSampleDestructionLogs), {
    month: destroyedOn.slice(5, 7),
    year: destroyedOn.slice(0, 4),
    dcnNumber: note.dcnNumber,
    productName: note.productName,
    batchNumber: note.batchNumber,
    quantity: note.quantity,
    destructionDate: destroyedOn,
    initiatedBy: note.initiatedBy,
    checkedBy: note.checkedBy,
    verifiedBy: user.displayName || user.email,
    createdAt: nowISO(),
  });
  await audit({ action: "Destruction", recordId: note.dcnNumber, newValue: { status: "Destroyed" }, user });
}

export async function listDestructionLogs() {
  return listAll<{
    id: string;
    month: string;
    year: string;
    dcnNumber: string;
    productName: string;
    batchNumber: string;
    quantity: number;
    destructionDate: string;
    initiatedBy?: string;
    checkedBy?: string;
    verifiedBy?: string;
    createdAt: string;
  }>(COLLECTIONS.controlSampleDestructionLogs, "destructionDate");
}

export async function getControlDashboard() {
  const [samples, collections, observations, requisitions, txs, settings] = await Promise.all([
    listControlSamples(),
    listCollections(),
    listObservations(),
    listRequisitions(),
    listControlTransactions(),
    getOrganizationSettings(),
  ]);
  const cfg = controlOrg(settings);
  const openAbnormal = observations.filter((o) => o.result === "Abnormal Observation" && o.status !== "Closed");
  const dueObs = samples.filter((s) => {
    if (s.status === "Destroyed" || s.status === "Disposed") return false;
    return Boolean(s.nextObservationDate && s.nextObservationDate <= todayISO());
  });
  const dueDestroy = samples.filter((s) => isEligibleNow(s, cfg) && !s.destructionHold);
  const overdueDestroy = dueDestroy.filter((s) => {
    const eligible = s.destructionEligibleDate || destructionEligibleDate(s.expiryDate, cfg.controlDestructionMonthsAfterExpiry);
    return isDestructionOverdue(eligible);
  });
  const holds = samples.filter((s) => s.destructionHold);
  return {
    total: samples.length,
    available: samples.filter((s) => (s.availableQuantity || 0) > 0 && s.status !== "Destroyed").length,
    observationDue: dueObs.length,
    requiringAttention: openAbnormal.length + holds.length + dueObs.length,
    withdrawalRequests: requisitions.filter((r) => r.status === "Submitted" || r.status === "Approved").length,
    destructionDue: dueDestroy.length,
    destructionOverdue: overdueDestroy.length,
    recentlyDestroyed: samples.filter((s) => {
      if (s.status !== "Destroyed" && s.status !== "Disposed") return false;
      const when = (s.updatedAt || s.createdAt || "").slice(0, 10);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      return Boolean(when) && when >= cutoff.toISOString().slice(0, 10);
    }).length,
    recentCollections: collections.slice(0, 8),
    observationDueRows: dueObs.slice(0, 8),
    destructionDueRows: dueDestroy.slice(0, 8),
    recentActivity: txs.slice(0, 10),
    openAbnormal,
    samples,
  };
}

export function collectionStagesForBatch(rows: ControlSampleCollection[], batchId: string) {
  const stages = new Set(rows.filter((r) => r.batchId === batchId && r.status !== "Draft").map((r) => r.collectionStage));
  return {
    Initial: stages.has("Initial"),
    Middle: stages.has("Middle"),
    End: stages.has("End"),
    complete: stages.has("Initial") && stages.has("Middle") && stages.has("End"),
  };
}

export type { CollectionStage };
