import { addDoc, collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { nowISO } from "@/lib/utils";
import type { AuditLog } from "@/types";

function clientMeta() {
  if (typeof window === "undefined") return { ipAddress: undefined as string | undefined, userAgent: undefined as string | undefined };
  return {
    ipAddress: undefined as string | undefined,
    userAgent: window.navigator?.userAgent,
  };
}

export async function writeAuditLog(input: {
  action: string;
  module?: string;
  recordId?: string;
  recordType?: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole?: string;
}) {
  const meta = clientMeta();
  const payload: Record<string, unknown> = {
    action: input.action,
    userId: input.userId,
    userName: input.userName,
    userEmail: input.userEmail,
    createdAt: nowISO(),
  };
  if (input.module !== undefined) payload.module = input.module;
  if (input.recordId !== undefined) payload.recordId = input.recordId;
  if (input.recordType !== undefined) payload.recordType = input.recordType;
  if (input.previousValue !== undefined) payload.previousValue = input.previousValue;
  if (input.newValue !== undefined) payload.newValue = input.newValue;
  if (input.reason !== undefined) payload.reason = input.reason;
  if (input.userRole !== undefined) payload.userRole = input.userRole;
  if (meta.userAgent) payload.userAgent = meta.userAgent;
  if (meta.ipAddress) payload.ipAddress = meta.ipAddress;

  const ref = await addDoc(collection(getDb(), COLLECTIONS.auditLogs), payload);
  return { id: ref.id, ...payload } as AuditLog;
}

export async function listAuditLogs(max = 200) {
  const q = query(
    collection(getDb(), COLLECTIONS.auditLogs),
    orderBy("createdAt", "desc"),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog));
}

export async function listAuditLogsForRecord(recordType: string, recordId: string, max = 50) {
  const q = query(
    collection(getDb(), COLLECTIONS.auditLogs),
    where("recordType", "==", recordType),
    where("recordId", "==", recordId),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as AuditLog))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}
