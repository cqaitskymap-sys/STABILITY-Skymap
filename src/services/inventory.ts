import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import {
  addMonthsToDate,
  calcAvailableQuantity,
  derivePullStatus,
  nowISO,
  todayISO,
} from "@/lib/utils";
import { nextSequentialId } from "@/services/ids";
import { writeAuditLog } from "@/services/audit";
import type {
  AppUser,
  DisposalReason,
  InventoryAlert,
  InventoryReconciliation,
  InventoryTransaction,
  SampleDisposal,
  SampleMovement,
  SampleStatus,
  SampleWithdrawal,
  StabilitySample,
  StabilityStudy,
  StudyPullPoint,
  StudyStatus,
  TransactionType,
} from "@/types";

function actor(user: AppUser) {
  return {
    createdBy: user.uid,
    createdByName: user.displayName || user.email,
    performedBy: user.uid,
    performedByName: user.displayName || user.email,
  };
}

async function createTransaction(input: Omit<InventoryTransaction, "id">) {
  const ref = await addDoc(collection(getDb(), COLLECTIONS.inventoryTransactions), input);
  return { id: ref.id, ...input };
}

function sampleStatusFromQty(sample: Pick<StabilitySample, "availableQuantity" | "withdrawnQuantity" | "disposedQuantity" | "totalQuantity">): SampleStatus {
  if (sample.disposedQuantity >= sample.totalQuantity && sample.availableQuantity === 0) return "Disposed";
  if (sample.availableQuantity === 0 && sample.withdrawnQuantity > 0) return "Fully Withdrawn";
  if (sample.availableQuantity === 0) return "Depleted";
  if (sample.withdrawnQuantity > 0) return "Partially Withdrawn";
  return "Available";
}

function studyStatusFromSample(sampleStatus: SampleStatus): StudyStatus {
  switch (sampleStatus) {
    case "Partially Withdrawn":
      return "Partially Withdrawn";
    case "Fully Withdrawn":
      return "Fully Withdrawn";
    case "Disposed":
      return "Disposed";
    case "Depleted":
      return "Completed";
    default:
      return "Active";
  }
}

export async function listStudies() {
  const snap = await getDocs(query(collection(getDb(), COLLECTIONS.stabilityStudies), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StabilityStudy));
}

export async function getStudy(id: string) {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.stabilityStudies, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as StabilityStudy;
}

export async function listSamples() {
  const snap = await getDocs(query(collection(getDb(), COLLECTIONS.stabilitySamples), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StabilitySample));
}

export async function getSample(id: string) {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.stabilitySamples, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as StabilitySample;
}

export async function listPullPoints(filters?: { studyDocId?: string; sampleDocId?: string }) {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.studyPullPoints));
  return snap.docs
    .map((d) => {
      const data = d.data() as Omit<StudyPullPoint, "id">;
      return {
        id: d.id,
        ...data,
        status: derivePullStatus(data.plannedDate, data.actualQuantity, data.plannedQuantity),
      } as StudyPullPoint;
    })
    .filter((p) => {
      if (filters?.studyDocId && p.studyDocId !== filters.studyDocId) return false;
      if (filters?.sampleDocId && p.sampleDocId !== filters.sampleDocId) return false;
      return true;
    })
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
}

export async function listWithdrawals() {
  const snap = await getDocs(query(collection(getDb(), COLLECTIONS.sampleWithdrawals), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SampleWithdrawal));
}

export async function getWithdrawal(id: string) {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.sampleWithdrawals, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as SampleWithdrawal;
}

export async function listMovements() {
  const snap = await getDocs(query(collection(getDb(), COLLECTIONS.sampleMovements), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SampleMovement));
}

export async function listDisposals() {
  const snap = await getDocs(query(collection(getDb(), COLLECTIONS.sampleDisposals), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as SampleDisposal));
}

export async function listReconciliations() {
  const snap = await getDocs(query(collection(getDb(), COLLECTIONS.inventoryReconciliations), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryReconciliation));
}

export async function listTransactions() {
  const snap = await getDocs(query(collection(getDb(), COLLECTIONS.inventoryTransactions), orderBy("performedAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryTransaction));
}

export async function listAlerts() {
  const snap = await getDocs(query(collection(getDb(), COLLECTIONS.inventoryAlerts), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as InventoryAlert));
}

export async function createStudyAndCharge(input: {
  productId: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  chargingDate: string;
  studyTypeId: string;
  studyType: string;
  storageConditionId: string;
  storageCondition: string;
  chamberId: string;
  chamberName: string;
  locationId: string;
  locationLabel: string;
  totalQuantity: number;
  reservedQuantity: number;
  unit: string;
  notes?: string;
  duration: string;
  pullAllocations: { code: string; months: number; quantity: number }[];
  user: AppUser;
}) {
  if (input.totalQuantity <= 0) throw new Error("Total quantity must be greater than zero.");
  if (input.manufacturingDate && input.expiryDate && input.expiryDate < input.manufacturingDate) {
    throw new Error("Expiry date cannot be before manufacturing date.");
  }

  const allocated = input.pullAllocations.reduce((s, p) => s + p.quantity, 0) + input.reservedQuantity;
  if (allocated > input.totalQuantity) {
    throw new Error("Allocated pull points plus reserve cannot exceed total charged quantity.");
  }

  const chamberSnap = await getDoc(doc(getDb(), COLLECTIONS.chambers, input.chamberId));
  if (!chamberSnap.exists()) throw new Error("Selected chamber was not found.");
  const chamber = chamberSnap.data();
  if (chamber.status === "Inactive") throw new Error("Cannot allocate samples to an inactive chamber.");
  if (Number(chamber.usedCapacity || 0) + input.totalQuantity > Number(chamber.capacity || 0)) {
    throw new Error("Chamber capacity is insufficient for this charge quantity.");
  }

  const studyId = await nextSequentialId("STB");
  const sampleId = await nextSequentialId("SMP");
  const txId = await nextSequentialId("TRX");
  const stamp = nowISO();
  const availableQuantity = calcAvailableQuantity(input.totalQuantity, 0, 0);

  const nextPullDate =
    input.pullAllocations.length > 0
      ? addMonthsToDate(
          input.chargingDate,
          Math.min(...input.pullAllocations.map((p) => p.months))
        )
      : null;

  const studyPayload: Omit<StabilityStudy, "id"> = {
    studyId,
    productId: input.productId,
    batchId: input.batchId,
    productName: input.productName,
    batchNumber: input.batchNumber,
    manufacturingDate: input.manufacturingDate,
    expiryDate: input.expiryDate,
    chargingDate: input.chargingDate,
    studyTypeId: input.studyTypeId,
    studyType: input.studyType,
    storageConditionId: input.storageConditionId,
    storageCondition: input.storageCondition,
    chamberId: input.chamberId,
    chamberName: input.chamberName,
    locationId: input.locationId,
    locationLabel: input.locationLabel,
    duration: input.duration,
    totalQuantity: input.totalQuantity,
    reservedQuantity: input.reservedQuantity,
    availableQuantity,
    withdrawnQuantity: 0,
    disposedQuantity: 0,
    unit: input.unit,
    notes: input.notes,
    status: "Active",
    nextPullDate,
    createdBy: input.user.uid,
    createdByName: input.user.displayName || input.user.email,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const batch = writeBatch(getDb());
  const studyRef = doc(collection(getDb(), COLLECTIONS.stabilityStudies));
  batch.set(studyRef, studyPayload);

  const samplePayload: Omit<StabilitySample, "id"> = {
    sampleId,
    studyId,
    studyDocId: studyRef.id,
    productId: input.productId,
    batchId: input.batchId,
    productName: input.productName,
    batchNumber: input.batchNumber,
    manufacturingDate: input.manufacturingDate,
    expiryDate: input.expiryDate,
    chargingDate: input.chargingDate,
    studyType: input.studyType,
    studyTypeId: input.studyTypeId,
    storageCondition: input.storageCondition,
    storageConditionId: input.storageConditionId,
    chamberId: input.chamberId,
    chamberName: input.chamberName,
    locationId: input.locationId,
    locationLabel: input.locationLabel,
    totalQuantity: input.totalQuantity,
    reservedQuantity: input.reservedQuantity,
    withdrawnQuantity: 0,
    disposedQuantity: 0,
    availableQuantity,
    unit: input.unit,
    status: "Available",
    nextPullDate,
    notes: input.notes,
    createdBy: input.user.uid,
    createdByName: input.user.displayName || input.user.email,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const sampleRef = doc(collection(getDb(), COLLECTIONS.stabilitySamples));
  batch.set(sampleRef, samplePayload);

  for (const pull of input.pullAllocations) {
    const pullRef = doc(collection(getDb(), COLLECTIONS.studyPullPoints));
    const plannedDate = addMonthsToDate(input.chargingDate, pull.months);
    const pullPayload: Omit<StudyPullPoint, "id"> = {
      pullPointId: `${sampleId}-${pull.code}`,
      studyId,
      studyDocId: studyRef.id,
      sampleId,
      sampleDocId: sampleRef.id,
      productName: input.productName,
      batchNumber: input.batchNumber,
      studyType: input.studyType,
      storageCondition: input.storageCondition,
      chamberId: input.chamberId,
      chamberName: input.chamberName,
      pullPoint: pull.code,
      months: pull.months,
      plannedDate,
      plannedQuantity: pull.quantity,
      actualQuantity: 0,
      status: derivePullStatus(plannedDate, 0, pull.quantity),
      withdrawalId: null,
      completedDate: null,
      createdAt: stamp,
      updatedAt: stamp,
    };
    batch.set(pullRef, pullPayload);
  }

  const txPayload: Omit<InventoryTransaction, "id"> = {
    transactionId: txId,
    sampleId,
    sampleDocId: sampleRef.id,
    studyId,
    productName: input.productName,
    batchNumber: input.batchNumber,
    transactionType: "SAMPLE_CHARGED",
    quantity: input.totalQuantity,
    toLocation: input.locationLabel,
    reason: "Initial sample charging",
    performedBy: input.user.uid,
    performedByName: input.user.displayName || input.user.email,
    performedAt: stamp,
  };
  batch.set(doc(collection(getDb(), COLLECTIONS.inventoryTransactions)), txPayload);

  batch.update(doc(getDb(), COLLECTIONS.chambers, input.chamberId), {
    usedCapacity: Number(chamber.usedCapacity || 0) + input.totalQuantity,
    updatedAt: stamp,
  });

  await batch.commit();

  await writeAuditLog({
    action: "Sample Charged / Study Created",
    recordId: studyId,
    recordType: "stabilityStudy",
    newValue: { studyId, sampleId, totalQuantity: input.totalQuantity },
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email,
    userEmail: input.user.email,
  });

  return { studyDocId: studyRef.id, sampleDocId: sampleRef.id, studyId, sampleId };
}

export async function updateStudy(
  studyDocId: string,
  updates: Partial<StabilityStudy>,
  user: AppUser
) {
  const existing = await getStudy(studyDocId);
  if (!existing) throw new Error("Study not found.");
  await updateDoc(doc(getDb(), COLLECTIONS.stabilityStudies, studyDocId), {
    ...updates,
    updatedAt: nowISO(),
  });
  await writeAuditLog({
    action: "Study Updated",
    recordId: existing.studyId,
    recordType: "stabilityStudy",
    previousValue: existing,
    newValue: updates,
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
  });
}

export async function withdrawSample(input: {
  pullPointDocId: string;
  actualQuantity: number;
  withdrawalDate: string;
  withdrawnBy: string;
  receivedBy: string;
  remarks?: string;
  user: AppUser;
}) {
  if (input.actualQuantity <= 0) throw new Error("Withdrawn quantity must be greater than zero.");

  const pullSnap = await getDoc(doc(getDb(), COLLECTIONS.studyPullPoints, input.pullPointDocId));
  if (!pullSnap.exists()) throw new Error("Pull point not found.");
  const pull = { id: pullSnap.id, ...pullSnap.data() } as StudyPullPoint;

  const sampleSnap = await getDoc(doc(getDb(), COLLECTIONS.stabilitySamples, pull.sampleDocId));
  if (!sampleSnap.exists()) throw new Error("Sample inventory not found.");
  const sample = { id: sampleSnap.id, ...sampleSnap.data() } as StabilitySample;

  if (input.actualQuantity > sample.availableQuantity) {
    throw new Error("Actual quantity cannot exceed available quantity.");
  }

  const remainingPlanned = Math.max(0, pull.plannedQuantity - pull.actualQuantity);
  if (input.actualQuantity > remainingPlanned && remainingPlanned > 0) {
    // allow withdrawing up to available, but warn via validation only on available
  }

  const withdrawalId = await nextSequentialId("WDR");
  const txId = await nextSequentialId("TRX");
  const stamp = nowISO();
  const newWithdrawn = sample.withdrawnQuantity + input.actualQuantity;
  const newAvailable = calcAvailableQuantity(sample.totalQuantity, newWithdrawn, sample.disposedQuantity);
  const newActual = pull.actualQuantity + input.actualQuantity;
  const pullStatus = derivePullStatus(pull.plannedDate, newActual, pull.plannedQuantity);
  const newSampleStatus = sampleStatusFromQty({
    ...sample,
    withdrawnQuantity: newWithdrawn,
    availableQuantity: newAvailable,
  });

  const batch = writeBatch(getDb());
  const withdrawalRef = doc(collection(getDb(), COLLECTIONS.sampleWithdrawals));
  const withdrawalPayload: Omit<SampleWithdrawal, "id"> = {
    withdrawalId,
    sampleId: sample.sampleId,
    sampleDocId: sample.id,
    studyId: sample.studyId,
    studyDocId: sample.studyDocId,
    pullPointDocId: pull.id,
    productName: sample.productName,
    batchNumber: sample.batchNumber,
    studyType: sample.studyType,
    storageCondition: sample.storageCondition,
    chamberName: sample.chamberName,
    locationLabel: sample.locationLabel,
    pullPoint: pull.pullPoint,
    plannedQuantity: pull.plannedQuantity,
    actualQuantity: input.actualQuantity,
    withdrawalDate: input.withdrawalDate,
    withdrawnBy: input.withdrawnBy,
    receivedBy: input.receivedBy,
    remarks: input.remarks,
    createdBy: input.user.uid,
    createdByName: input.user.displayName || input.user.email,
    createdAt: stamp,
  };
  batch.set(withdrawalRef, withdrawalPayload);

  batch.update(doc(getDb(), COLLECTIONS.studyPullPoints, pull.id), {
    actualQuantity: newActual,
    status: pullStatus,
    withdrawalId,
    completedDate: pullStatus === "Withdrawn" ? input.withdrawalDate : null,
    updatedAt: stamp,
  });

  const remainingPulls = (await listPullPoints({ sampleDocId: sample.id }))
    .filter((p) => p.id !== pull.id)
    .concat([{ ...pull, actualQuantity: newActual, status: pullStatus }]);
  const nextOpen = remainingPulls
    .filter((p) => p.status !== "Withdrawn")
    .sort((a, b) => a.plannedDate.localeCompare(b.plannedDate))[0];

  batch.update(doc(getDb(), COLLECTIONS.stabilitySamples, sample.id), {
    withdrawnQuantity: newWithdrawn,
    availableQuantity: newAvailable,
    status: newSampleStatus,
    nextPullDate: nextOpen?.plannedDate ?? null,
    updatedAt: stamp,
  });

  batch.update(doc(getDb(), COLLECTIONS.stabilityStudies, sample.studyDocId), {
    withdrawnQuantity: newWithdrawn,
    availableQuantity: newAvailable,
    status: studyStatusFromSample(newSampleStatus),
    nextPullDate: nextOpen?.plannedDate ?? null,
    updatedAt: stamp,
  });

  batch.update(doc(getDb(), COLLECTIONS.chambers, sample.chamberId), {
    usedCapacity: Math.max(0, Number((await getDoc(doc(getDb(), COLLECTIONS.chambers, sample.chamberId))).data()?.usedCapacity || 0) - input.actualQuantity),
    updatedAt: stamp,
  });

  batch.set(doc(collection(getDb(), COLLECTIONS.inventoryTransactions)), {
    transactionId: txId,
    sampleId: sample.sampleId,
    sampleDocId: sample.id,
    studyId: sample.studyId,
    productName: sample.productName,
    batchNumber: sample.batchNumber,
    transactionType: "SAMPLE_WITHDRAWN" as TransactionType,
    quantity: input.actualQuantity,
    fromLocation: sample.locationLabel,
    reason: `Withdrawal ${pull.pullPoint}`,
    remarks: input.remarks,
    performedBy: input.user.uid,
    performedByName: input.user.displayName || input.user.email,
    performedAt: stamp,
  } satisfies Omit<InventoryTransaction, "id">);

  await batch.commit();

  await writeAuditLog({
    action: "Sample Withdrawn",
    recordId: withdrawalId,
    recordType: "sampleWithdrawal",
    newValue: withdrawalPayload,
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email,
    userEmail: input.user.email,
  });

  return { withdrawalDocId: withdrawalRef.id, withdrawalId };
}

export async function moveSample(input: {
  sampleDocId: string;
  toChamberId: string;
  toChamberName: string;
  toLocationId: string;
  toLocationLabel: string;
  movementDate: string;
  movedBy: string;
  reason: string;
  remarks?: string;
  user: AppUser;
}) {
  const sample = await getSample(input.sampleDocId);
  if (!sample) throw new Error("Sample not found.");

  const chamberSnap = await getDoc(doc(getDb(), COLLECTIONS.chambers, input.toChamberId));
  if (!chamberSnap.exists()) throw new Error("Destination chamber not found.");
  const chamber = chamberSnap.data();
  if (chamber.status === "Inactive") throw new Error("Cannot move samples to an inactive chamber.");

  const movementId = await nextSequentialId("MOV");
  const txId = await nextSequentialId("TRX");
  const stamp = nowISO();
  const batch = writeBatch(getDb());

  const movementPayload: Omit<SampleMovement, "id"> = {
    movementId,
    sampleId: sample.sampleId,
    sampleDocId: sample.id,
    studyId: sample.studyId,
    productName: sample.productName,
    batchNumber: sample.batchNumber,
    fromChamberId: sample.chamberId,
    fromChamberName: sample.chamberName,
    fromLocationId: sample.locationId,
    fromLocationLabel: sample.locationLabel,
    toChamberId: input.toChamberId,
    toChamberName: input.toChamberName,
    toLocationId: input.toLocationId,
    toLocationLabel: input.toLocationLabel,
    movementDate: input.movementDate,
    movedBy: input.movedBy,
    reason: input.reason,
    remarks: input.remarks,
    createdBy: input.user.uid,
    createdByName: input.user.displayName || input.user.email,
    createdAt: stamp,
  };
  batch.set(doc(collection(getDb(), COLLECTIONS.sampleMovements)), movementPayload);

  batch.update(doc(getDb(), COLLECTIONS.stabilitySamples, sample.id), {
    chamberId: input.toChamberId,
    chamberName: input.toChamberName,
    locationId: input.toLocationId,
    locationLabel: input.toLocationLabel,
    updatedAt: stamp,
  });

  batch.update(doc(getDb(), COLLECTIONS.stabilityStudies, sample.studyDocId), {
    chamberId: input.toChamberId,
    chamberName: input.toChamberName,
    locationId: input.toLocationId,
    locationLabel: input.toLocationLabel,
    updatedAt: stamp,
  });

  if (sample.chamberId !== input.toChamberId) {
    const fromSnap = await getDoc(doc(getDb(), COLLECTIONS.chambers, sample.chamberId));
    if (fromSnap.exists()) {
      batch.update(doc(getDb(), COLLECTIONS.chambers, sample.chamberId), {
        usedCapacity: Math.max(0, Number(fromSnap.data().usedCapacity || 0) - sample.availableQuantity),
        updatedAt: stamp,
      });
    }
    batch.update(doc(getDb(), COLLECTIONS.chambers, input.toChamberId), {
      usedCapacity: Number(chamber.usedCapacity || 0) + sample.availableQuantity,
      updatedAt: stamp,
    });
  }

  batch.set(doc(collection(getDb(), COLLECTIONS.inventoryTransactions)), {
    transactionId: txId,
    sampleId: sample.sampleId,
    sampleDocId: sample.id,
    studyId: sample.studyId,
    productName: sample.productName,
    batchNumber: sample.batchNumber,
    transactionType: "SAMPLE_TRANSFERRED",
    quantity: sample.availableQuantity,
    fromLocation: sample.locationLabel,
    toLocation: input.toLocationLabel,
    reason: input.reason,
    remarks: input.remarks,
    performedBy: input.user.uid,
    performedByName: input.user.displayName || input.user.email,
    performedAt: stamp,
  } satisfies Omit<InventoryTransaction, "id">);

  await batch.commit();
  await writeAuditLog({
    action: "Sample Moved",
    recordId: movementId,
    recordType: "sampleMovement",
    previousValue: { location: sample.locationLabel },
    newValue: { location: input.toLocationLabel },
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email,
    userEmail: input.user.email,
  });

  return { movementId };
}

export async function reconcileSample(input: {
  sampleDocId: string;
  physicalQuantity: number;
  reason?: string;
  remarks?: string;
  adjust: boolean;
  user: AppUser;
}) {
  if (input.physicalQuantity < 0) throw new Error("Physical quantity cannot be negative.");
  const sample = await getSample(input.sampleDocId);
  if (!sample) throw new Error("Sample not found.");

  const variance = input.physicalQuantity - sample.availableQuantity;
  let status: InventoryReconciliation["status"] = "Matched";
  if (variance !== 0) status = Math.abs(variance) > 0 ? "Investigation Required" : "Matched";
  if (variance !== 0 && !input.adjust) status = "Variance Found";
  if (input.adjust && variance !== 0) status = "Adjusted";

  const reconciliationId = await nextSequentialId("REC");
  const stamp = nowISO();
  const batch = writeBatch(getDb());

  const payload: Omit<InventoryReconciliation, "id"> = {
    reconciliationId,
    sampleId: sample.sampleId,
    sampleDocId: sample.id,
    studyId: sample.studyId,
    productName: sample.productName,
    batchNumber: sample.batchNumber,
    studyType: sample.studyType,
    systemQuantity: sample.availableQuantity,
    physicalQuantity: input.physicalQuantity,
    variance,
    status,
    adjustmentQuantity: input.adjust ? variance : undefined,
    reason: input.reason,
    remarks: input.remarks,
    performedBy: input.user.uid,
    performedByName: input.user.displayName || input.user.email,
    reconciliationDate: todayISO(),
    createdAt: stamp,
    updatedAt: stamp,
  };
  batch.set(doc(collection(getDb(), COLLECTIONS.inventoryReconciliations)), payload);

  if (input.adjust && variance !== 0) {
    if (!input.reason) throw new Error("Adjustment reason is required.");
    const newAvailable = input.physicalQuantity;
    const delta = sample.availableQuantity - newAvailable;
    const newWithdrawn = sample.withdrawnQuantity; // keep withdrawn
    // Adjust total so available formula holds: available = total - withdrawn - disposed
    const newTotal = newAvailable + newWithdrawn + sample.disposedQuantity;
    const newStatus = sampleStatusFromQty({
      totalQuantity: newTotal,
      withdrawnQuantity: newWithdrawn,
      disposedQuantity: sample.disposedQuantity,
      availableQuantity: newAvailable,
    });

    batch.update(doc(getDb(), COLLECTIONS.stabilitySamples, sample.id), {
      totalQuantity: newTotal,
      availableQuantity: newAvailable,
      status: newStatus,
      updatedAt: stamp,
    });
    batch.update(doc(getDb(), COLLECTIONS.stabilityStudies, sample.studyDocId), {
      totalQuantity: newTotal,
      availableQuantity: newAvailable,
      status: studyStatusFromSample(newStatus),
      updatedAt: stamp,
    });

    const txId = await nextSequentialId("TRX");
    batch.set(doc(collection(getDb(), COLLECTIONS.inventoryTransactions)), {
      transactionId: txId,
      sampleId: sample.sampleId,
      sampleDocId: sample.id,
      studyId: sample.studyId,
      productName: sample.productName,
      batchNumber: sample.batchNumber,
      transactionType: "SAMPLE_ADJUSTED",
      quantity: Math.abs(delta),
      reason: input.reason,
      remarks: input.remarks,
      performedBy: input.user.uid,
      performedByName: input.user.displayName || input.user.email,
      performedAt: stamp,
    } satisfies Omit<InventoryTransaction, "id">);
  } else if (variance !== 0) {
    batch.update(doc(getDb(), COLLECTIONS.stabilitySamples, sample.id), {
      status: "Under Reconciliation",
      updatedAt: stamp,
    });
  }

  await batch.commit();
  await writeAuditLog({
    action: "Reconciliation Completed",
    recordId: reconciliationId,
    recordType: "inventoryReconciliation",
    newValue: payload,
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email,
    userEmail: input.user.email,
  });

  return { reconciliationId, variance, status };
}

export async function disposeSample(input: {
  sampleDocId: string;
  quantity: number;
  disposalDate: string;
  reason: DisposalReason;
  disposedBy: string;
  remarks?: string;
  user: AppUser;
}) {
  if (input.quantity <= 0) throw new Error("Disposal quantity must be greater than zero.");
  const sample = await getSample(input.sampleDocId);
  if (!sample) throw new Error("Sample not found.");
  if (input.quantity > sample.availableQuantity) {
    throw new Error("Cannot dispose more than available quantity.");
  }

  const disposalId = await nextSequentialId("DSP");
  const txId = await nextSequentialId("TRX");
  const stamp = nowISO();
  const newDisposed = sample.disposedQuantity + input.quantity;
  const newAvailable = calcAvailableQuantity(sample.totalQuantity, sample.withdrawnQuantity, newDisposed);
  const newStatus = sampleStatusFromQty({
    ...sample,
    disposedQuantity: newDisposed,
    availableQuantity: newAvailable,
  });

  const batch = writeBatch(getDb());
  batch.set(doc(collection(getDb(), COLLECTIONS.sampleDisposals)), {
    disposalId,
    sampleId: sample.sampleId,
    sampleDocId: sample.id,
    studyId: sample.studyId,
    productName: sample.productName,
    batchNumber: sample.batchNumber,
    quantity: input.quantity,
    disposalDate: input.disposalDate,
    reason: input.reason,
    disposedBy: input.disposedBy,
    remarks: input.remarks,
    createdBy: input.user.uid,
    createdByName: input.user.displayName || input.user.email,
    createdAt: stamp,
  } satisfies Omit<SampleDisposal, "id">);

  batch.update(doc(getDb(), COLLECTIONS.stabilitySamples, sample.id), {
    disposedQuantity: newDisposed,
    availableQuantity: newAvailable,
    status: newStatus,
    updatedAt: stamp,
  });
  batch.update(doc(getDb(), COLLECTIONS.stabilityStudies, sample.studyDocId), {
    disposedQuantity: newDisposed,
    availableQuantity: newAvailable,
    status: studyStatusFromSample(newStatus),
    updatedAt: stamp,
  });

  const chamberSnap = await getDoc(doc(getDb(), COLLECTIONS.chambers, sample.chamberId));
  if (chamberSnap.exists()) {
    batch.update(doc(getDb(), COLLECTIONS.chambers, sample.chamberId), {
      usedCapacity: Math.max(0, Number(chamberSnap.data().usedCapacity || 0) - input.quantity),
      updatedAt: stamp,
    });
  }

  batch.set(doc(collection(getDb(), COLLECTIONS.inventoryTransactions)), {
    transactionId: txId,
    sampleId: sample.sampleId,
    sampleDocId: sample.id,
    studyId: sample.studyId,
    productName: sample.productName,
    batchNumber: sample.batchNumber,
    transactionType: "SAMPLE_DISPOSED",
    quantity: input.quantity,
    fromLocation: sample.locationLabel,
    reason: input.reason,
    remarks: input.remarks,
    performedBy: input.user.uid,
    performedByName: input.user.displayName || input.user.email,
    performedAt: stamp,
  } satisfies Omit<InventoryTransaction, "id">);

  await batch.commit();
  await writeAuditLog({
    action: "Sample Disposed",
    recordId: disposalId,
    recordType: "sampleDisposal",
    newValue: { disposalId, quantity: input.quantity, reason: input.reason },
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email,
    userEmail: input.user.email,
  });

  return { disposalId };
}

export async function refreshAlerts() {
  const [pulls, samples, chambers, reconciliations] = await Promise.all([
    listPullPoints(),
    listSamples(),
    getDocs(collection(getDb(), COLLECTIONS.chambers)).then((s) =>
      s.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }) as {
        id: string;
        capacity?: number;
        usedCapacity?: number;
        status?: string;
        chamberName?: string;
        chamberId?: string;
      })
    ),
    listReconciliations(),
  ]);

  const existing = await listAlerts();
  const batch = writeBatch(getDb());
  existing.forEach((a) => batch.delete(doc(getDb(), COLLECTIONS.inventoryAlerts, a.id)));

  const alerts: Omit<InventoryAlert, "id">[] = [];
  const stamp = nowISO();

  for (const p of pulls) {
    const status = derivePullStatus(p.plannedDate, p.actualQuantity, p.plannedQuantity);
    if (status === "Due Soon") {
      alerts.push({
        alertType: "WITHDRAWAL_DUE_7_DAYS",
        title: "Withdrawal due within 7 days",
        message: `${p.productName} / ${p.batchNumber} — ${p.pullPoint} due ${p.plannedDate}`,
        severity: "warning",
        relatedId: p.id,
        relatedType: "studyPullPoint",
        acknowledged: false,
        createdAt: stamp,
      });
    }
    if (status === "Due Today") {
      alerts.push({
        alertType: "WITHDRAWAL_DUE_TODAY",
        title: "Withdrawal due today",
        message: `${p.productName} / ${p.batchNumber} — ${p.pullPoint}`,
        severity: "warning",
        relatedId: p.id,
        relatedType: "studyPullPoint",
        acknowledged: false,
        createdAt: stamp,
      });
    }
    if (status === "Overdue") {
      alerts.push({
        alertType: "WITHDRAWAL_OVERDUE",
        title: "Overdue withdrawal",
        message: `${p.productName} / ${p.batchNumber} — ${p.pullPoint} was due ${p.plannedDate}`,
        severity: "critical",
        relatedId: p.id,
        relatedType: "studyPullPoint",
        acknowledged: false,
        createdAt: stamp,
      });
    }
  }

  for (const s of samples) {
    if (s.availableQuantity <= 0 && s.status !== "Disposed") {
      alerts.push({
        alertType: "SAMPLE_DEPLETED",
        title: "Sample depleted",
        message: `${s.sampleId} — ${s.productName} has no available quantity`,
        severity: "info",
        relatedId: s.id,
        relatedType: "stabilitySample",
        acknowledged: false,
        createdAt: stamp,
      });
    }
    if (s.availableQuantity > 0 && s.availableQuantity < 5) {
      alerts.push({
        alertType: "INSUFFICIENT_QUANTITY",
        title: "Insufficient sample quantity",
        message: `${s.sampleId} — only ${s.availableQuantity} ${s.unit} available`,
        severity: "warning",
        relatedId: s.id,
        relatedType: "stabilitySample",
        acknowledged: false,
        createdAt: stamp,
      });
    }
  }

  for (const c of chambers) {
    const capacity = Number(c.capacity || 0);
    const used = Number(c.usedCapacity || 0);
    if (c.status === "Inactive") {
      alerts.push({
        alertType: "CHAMBER_INACTIVE",
        title: "Chamber inactive",
        message: `${c.chamberName || c.chamberId} is inactive`,
        severity: "warning",
        relatedId: c.id,
        relatedType: "chamber",
        acknowledged: false,
        createdAt: stamp,
      });
    }
    if (capacity > 0 && used / capacity >= 0.9) {
      alerts.push({
        alertType: "CHAMBER_NEAR_FULL",
        title: "Chamber capacity near full",
        message: `${c.chamberName} is ${Math.round((used / capacity) * 100)}% utilized`,
        severity: "warning",
        relatedId: c.id,
        relatedType: "chamber",
        acknowledged: false,
        createdAt: stamp,
      });
    }
  }

  for (const r of reconciliations.filter((x) => x.status === "Variance Found" || x.status === "Investigation Required")) {
    alerts.push({
      alertType: "RECONCILIATION_VARIANCE",
      title: "Reconciliation variance",
      message: `${r.productName} / ${r.batchNumber} variance ${r.variance}`,
      severity: "critical",
      relatedId: r.id,
      relatedType: "inventoryReconciliation",
      acknowledged: false,
      createdAt: stamp,
    });
  }

  for (const a of alerts) {
    batch.set(doc(collection(getDb(), COLLECTIONS.inventoryAlerts)), a);
  }
  await batch.commit();
  return alerts.length;
}

export { actor, createTransaction };
