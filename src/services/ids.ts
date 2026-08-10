import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";

export async function nextSequentialId(prefix: string) {
  const year = new Date().getFullYear();
  const counterId = `${prefix}_${year}`;
  const ref = doc(getDb(), COLLECTIONS.counters, counterId);

  const value = await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? Number(snap.data().value || 0) : 0;
    const next = current + 1;
    tx.set(ref, { prefix, year, value: next }, { merge: true });
    return next;
  });

  return `${prefix}-${year}-${String(value).padStart(4, "0")}`;
}

export async function peekNextId(prefix: string) {
  const year = new Date().getFullYear();
  const counterId = `${prefix}_${year}`;
  const snap = await getDoc(doc(getDb(), COLLECTIONS.counters, counterId));
  const current = snap.exists() ? Number(snap.data().value || 0) : 0;
  return `${prefix}-${year}-${String(current + 1).padStart(4, "0")}`;
}

export async function ensureCounter(prefix: string, value = 0) {
  const year = new Date().getFullYear();
  const counterId = `${prefix}_${year}`;
  await setDoc(doc(getDb(), COLLECTIONS.counters, counterId), { prefix, year, value }, { merge: true });
}
