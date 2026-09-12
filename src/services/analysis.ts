import { addDoc, collection, doc, getDoc, updateDoc } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { listDocs } from "@/lib/firebase/list-docs";
import { analysisDueDate, DEFAULT_ORG_SETTINGS, daysFromToday } from "@/lib/sop";
import { nowISO, todayISO } from "@/lib/utils";
import { nextSequentialId } from "@/services/ids";
import { getOrganizationSettings } from "@/services/organization";
import { writeAuditLog } from "@/services/audit";
import type { AnalysisRequest, AnalysisRequestStatus, AppUser, SampleWithdrawal } from "@/types";

function omitUndefined<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

export function analysisTimelineStatus(analysisDue: string, completedDate?: string): AnalysisRequestStatus {
  if (completedDate) return "Completed";
  const days = daysFromToday(analysisDue);
  if (days < 0) return "Overdue";
  if (days <= 3) return "Due Soon";
  return "Within Timeline";
}

export async function listAnalysisRequests() {
  const rows = await listDocs<AnalysisRequest>(COLLECTIONS.analysisRequests);
  return rows
    .map((data) => {
      if (data.status === "Cancelled" || data.status === "Completed") return data;
      return { ...data, status: analysisTimelineStatus(data.analysisDueDate, data.completedDate) };
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function getAnalysisRequest(id: string) {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.analysisRequests, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as AnalysisRequest;
}

export async function createAnalysisRequestFromWithdrawal(
  withdrawal: SampleWithdrawal,
  input: { analysisRequired?: string; qcOfficer?: string; user: AppUser }
) {
  const settings = await getOrganizationSettings().catch(() => DEFAULT_ORG_SETTINGS);
  const requestId = await nextSequentialId("ANL");
  const stamp = nowISO();
  const analysisDue = analysisDueDate(withdrawal.withdrawalDate, withdrawal.studyType, settings);
  const sampleSnap = withdrawal.sampleDocId
    ? await getDoc(doc(getDb(), COLLECTIONS.stabilitySamples, withdrawal.sampleDocId))
    : null;
  const sample = sampleSnap?.exists()
    ? (sampleSnap.data() as { unit?: string; manufacturingDate?: string; expiryDate?: string })
    : null;
  const payload: Omit<AnalysisRequest, "id"> = {
    requestId,
    date: todayISO(),
    withdrawalId: withdrawal.withdrawalId,
    sampleId: withdrawal.sampleId,
    sampleDocId: withdrawal.sampleDocId,
    studyId: withdrawal.studyId,
    studyDocId: withdrawal.studyDocId,
    productName: withdrawal.productName,
    batchNumber: withdrawal.batchNumber,
    sampleQuantity: withdrawal.actualQuantity,
    unit: sample?.unit || "",
    manufacturingDate: sample?.manufacturingDate || "",
    expiryDate: sample?.expiryDate || "",
    studyType: withdrawal.studyType,
    stage: withdrawal.pullPoint,
    dueDate: withdrawal.scheduledDate || withdrawal.withdrawalDate,
    analysisDueDate: analysisDue,
    analysisRequired: input.analysisRequired,
    qaOfficer: input.user.displayName || input.user.email,
    qcOfficer: input.qcOfficer,
    status: "Sent to QC",
    createdBy: input.user.uid,
    createdByName: input.user.displayName || input.user.email,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const ref = await addDoc(
    collection(getDb(), COLLECTIONS.analysisRequests),
    omitUndefined(payload as unknown as Record<string, unknown>)
  );
  await writeAuditLog({
    action: "Create",
    module: "Analysis Request",
    recordId: requestId,
    recordType: "analysisRequest",
    newValue: { requestId, withdrawalId: withdrawal.withdrawalId },
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email,
    userEmail: input.user.email,
    userRole: input.user.role,
  });
  return { id: ref.id, ...payload };
}

export async function completeAnalysisRequest(id: string, user: AppUser) {
  const existing = await getAnalysisRequest(id);
  if (!existing) throw new Error("Analysis request not found.");
  await updateDoc(doc(getDb(), COLLECTIONS.analysisRequests, id), {
    status: "Completed",
    completedDate: todayISO(),
    updatedAt: nowISO(),
  });
  await writeAuditLog({
    action: "Edit",
    module: "Analysis Request",
    recordId: existing.requestId,
    recordType: "analysisRequest",
    newValue: { status: "Completed" },
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
}
