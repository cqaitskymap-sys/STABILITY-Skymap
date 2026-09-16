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

/** SOP Annexure-VI: DCN/MM/YY/001 */
export async function nextDcnNumber() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const counterId = `DCN_${mm}${yy}`;
  const ref = doc(getDb(), COLLECTIONS.counters, counterId);
  const value = await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? Number(snap.data().value || 0) : 0;
    const next = current + 1;
    tx.set(ref, { prefix: "DCN", mm, yy, value: next }, { merge: true });
    return next;
  });
  return `DCN/${mm}/${yy}/${String(value).padStart(3, "0")}`;
}

/** Sequential register serial for a calendar year. Never decrements — cancelled numbers stay consumed. */
export async function nextYearSerial(prefix: string, isoDate?: string, pad = 3) {
  const year =
    isoDate && /^\d{4}/.test(isoDate) ? Number(isoDate.slice(0, 4)) : new Date().getFullYear();
  const counterId = `${prefix}_${year}`;
  const ref = doc(getDb(), COLLECTIONS.counters, counterId);
  const value = await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? Number(snap.data().value || 0) : 0;
    const next = current + 1;
    tx.set(ref, { prefix, year, value: next }, { merge: true });
    return next;
  });
  return {
    year,
    serialNumber: value,
    serialDisplay: String(value).padStart(pad, "0"),
    recordId: `${prefix}-${year}-${String(value).padStart(4, "0")}`,
  };
}

export async function ensureCounter(prefix: string, value = 0) {
  const year = new Date().getFullYear();
  const counterId = `${prefix}_${year}`;
  await setDoc(doc(getDb(), COLLECTIONS.counters, counterId), { prefix, year, value }, { merge: true });
}
