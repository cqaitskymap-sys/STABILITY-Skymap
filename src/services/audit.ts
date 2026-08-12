import { addDoc, collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { nowISO } from "@/lib/utils";
import type { AuditLog } from "@/types";

export async function writeAuditLog(input: {
  action: string;
  recordId?: string;
  recordType?: string;
  previousValue?: unknown;
  newValue?: unknown;
  userId: string;
  userName: string;
  userEmail: string;
}) {
  const payload: Record<string, unknown> = {
    action: input.action,
    userId: input.userId,
    userName: input.userName,
    userEmail: input.userEmail,
    createdAt: nowISO(),
  };
  if (input.recordId !== undefined) payload.recordId = input.recordId;
  if (input.recordType !== undefined) payload.recordType = input.recordType;
  if (input.previousValue !== undefined) payload.previousValue = input.previousValue;
  if (input.newValue !== undefined) payload.newValue = input.newValue;

  const ref = await addDoc(collection(getDb(), COLLECTIONS.auditLogs), payload);
  return { id: ref.id, ...payload } as AuditLog;
}

export async function listAuditLogs(max = 100) {
  const q = query(
    collection(getDb(), COLLECTIONS.auditLogs),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
}
