import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { nowISO } from "@/lib/utils";
import type {
  Chamber,
  MasterStatus,
  Product,
  PullPointMaster,
  StorageCondition,
  StorageLocation,
  StudyType,
  Unit,
  Batch,
} from "@/types";

async function listCollection<T>(name: string, orderField = "createdAt") {
  const q = query(collection(getDb(), name), orderBy(orderField, "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

export async function listStudyTypes() {
  return listCollection<StudyType>(COLLECTIONS.studyTypes, "sortOrder");
}

export async function listStorageConditions() {
  return listCollection<StorageCondition>(COLLECTIONS.storageConditions);
}

export async function listPullPoints() {
  return listCollection<PullPointMaster>(COLLECTIONS.pullPoints, "sortOrder");
}

export async function listChambers() {
  return listCollection<Chamber>(COLLECTIONS.chambers);
}

export async function listLocations() {
  return listCollection<StorageLocation>(COLLECTIONS.storageLocations);
}

export async function listUnits() {
  return listCollection<Unit>(COLLECTIONS.units);
}

export async function listProducts() {
  return listCollection<Product>(COLLECTIONS.products);
}

export async function listBatches(productId?: string) {
  if (productId) {
    const q = query(
      collection(getDb(), COLLECTIONS.batches),
      where("productId", "==", productId)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Batch));
  }
  return listCollection<Batch>(COLLECTIONS.batches);
}

export async function createMaster<T extends Record<string, unknown>>(
  collectionName: string,
  data: T
) {
  const payload = { ...data, createdAt: nowISO(), updatedAt: nowISO() };
  const ref = await addDoc(collection(getDb(), collectionName), payload);
  return { id: ref.id, ...payload };
}

export async function updateMaster(collectionName: string, id: string, data: Record<string, unknown>) {
  await updateDoc(doc(getDb(), collectionName, id), { ...data, updatedAt: nowISO() });
}

export async function deleteMaster(collectionName: string, id: string) {
  await deleteDoc(doc(getDb(), collectionName, id));
}

export async function setMasterStatus(
  collectionName: string,
  id: string,
  status: MasterStatus | Chamber["status"]
) {
  await updateDoc(doc(getDb(), collectionName, id), { status, updatedAt: nowISO() });
}

export function buildLocationLabel(chamberName: string, rack: string, shelf: string, position: string) {
  return `${chamberName} / ${rack} / ${shelf} / ${position}`;
}
