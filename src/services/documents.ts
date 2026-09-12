import { addDoc, collection } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { listDocs } from "@/lib/firebase/list-docs";
import { documentNumber, percentWaterLoss, proposedShelfLifeMonths } from "@/lib/sop";
import { nowISO } from "@/lib/utils";
import { nextSequentialId } from "@/services/ids";
import { getOrganizationSettings } from "@/services/organization";
import { writeAuditLog } from "@/services/audit";
import type {
  AppUser,
  ElectronicSignature,
  StabilityProtocol,
  StabilityStudyReport,
  WaterLossStudy,
} from "@/types";

function omitUndefined<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

async function nextDocNumber(docType: string) {
  const org = await getOrganizationSettings();
  const serial = await nextSequentialId(docType);
  return documentNumber({
    prefix: org.documentPrefix,
    plantCode: org.plantCode,
    departmentCode: org.departmentCode,
    docType,
    serial,
  });
}

export async function listProtocols() {
  return listDocs<StabilityProtocol>(COLLECTIONS.stabilityProtocols);
}

export async function listStudyReports() {
  return listDocs<StabilityStudyReport>(COLLECTIONS.stabilityReports);
}

export async function listWaterLossStudies() {
  return listDocs<WaterLossStudy>(COLLECTIONS.waterLossStudies);
}

export async function createProtocol(input: {
  studyDocId?: string;
  productName: string;
  batchNumber?: string;
  sections: Record<string, string>;
  user: AppUser;
}) {
  const protocolNumber = await nextDocNumber("SSP");
  const stamp = nowISO();
  const payload: Omit<StabilityProtocol, "id"> = {
    protocolNumber,
    studyDocId: input.studyDocId,
    productName: input.productName,
    batchNumber: input.batchNumber,
    status: "Draft",
    sections: input.sections,
    createdBy: input.user.uid,
    createdByName: input.user.displayName || input.user.email,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const ref = await addDoc(collection(getDb(), COLLECTIONS.stabilityProtocols), omitUndefined(payload as unknown as Record<string, unknown>));
  await writeAuditLog({
    action: "Create",
    module: "Stability Protocol",
    recordId: protocolNumber,
    recordType: "stabilityProtocol",
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email,
    userEmail: input.user.email,
    userRole: input.user.role,
  });
  return { id: ref.id, ...payload };
}

export async function createStudyReport(input: Omit<StabilityStudyReport, "id" | "reportNumber" | "createdBy" | "createdByName" | "createdAt" | "updatedAt" | "status"> & { user: AppUser; longTermMonths?: number }) {
  const reportNumber = await nextDocNumber("SSR");
  const stamp = nowISO();
  const { user, longTermMonths, ...rest } = input;
  const proposed =
    rest.proposedShelfLife ||
    (longTermMonths != null ? `${proposedShelfLifeMonths(longTermMonths)} months (calculation aid)` : undefined);
  const payload: Omit<StabilityStudyReport, "id"> = {
    ...rest,
    reportNumber,
    proposedShelfLife: proposed,
    status: "Draft",
    createdBy: user.uid,
    createdByName: user.displayName || user.email,
    createdAt: stamp,
    updatedAt: stamp,
  };
  const ref = await addDoc(collection(getDb(), COLLECTIONS.stabilityReports), omitUndefined(payload as unknown as Record<string, unknown>));
  await writeAuditLog({
    action: "Create",
    module: "Stability Report",
    recordId: reportNumber,
    recordType: "stabilityReport",
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
  return { id: ref.id, ...payload };
}

export async function createWaterLossStudy(input: {
  productName: string;
  genericName?: string;
  batchNumber: string;
  protocolNumber?: string;
  chamberName?: string;
  storageCondition?: string;
  studyType: string;
  filledVolume?: string;
  initialWeight: number;
  observedWeight: number;
  interval?: string;
  remark?: string;
  user: AppUser;
}) {
  if (input.initialWeight <= 0) throw new Error("Initial weight must be greater than zero.");
  const org = await getOrganizationSettings();
  const studyRef = await nextDocNumber("WLS");
  const pct = percentWaterLoss(input.initialWeight, input.observedWeight);
  const payload: Omit<WaterLossStudy, "id"> = {
    studyRef,
    productName: input.productName,
    genericName: input.genericName,
    batchNumber: input.batchNumber,
    protocolNumber: input.protocolNumber,
    chamberName: input.chamberName,
    storageCondition: input.storageCondition,
    studyType: input.studyType,
    filledVolume: input.filledVolume,
    initialWeight: input.initialWeight,
    observedWeight: input.observedWeight,
    interval: input.interval,
    percentWaterLoss: Number(pct.toFixed(4)),
    acceptanceLimit: org.waterLossLimitPercent,
    remark: input.remark,
    status: "Draft",
    createdBy: input.user.uid,
    createdByName: input.user.displayName || input.user.email,
    createdAt: nowISO(),
  };
  const ref = await addDoc(collection(getDb(), COLLECTIONS.waterLossStudies), omitUndefined(payload as unknown as Record<string, unknown>));
  await writeAuditLog({
    action: "Create",
    module: "Water Loss Study",
    recordId: studyRef,
    recordType: "waterLossStudy",
    newValue: { percentWaterLoss: payload.percentWaterLoss },
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email,
    userEmail: input.user.email,
    userRole: input.user.role,
  });
  return { id: ref.id, ...payload };
}

export async function recordSignature(input: Omit<ElectronicSignature, "id" | "signedAt">) {
  const payload: Omit<ElectronicSignature, "id"> = { ...input, signedAt: nowISO() };
  await addDoc(collection(getDb(), COLLECTIONS.electronicSignatures), omitUndefined(payload as unknown as Record<string, unknown>));
  await writeAuditLog({
    action: "Approve",
    module: "Electronic Signature",
    recordId: input.recordId,
    recordType: input.recordType,
    newValue: { meaning: input.meaning, userName: input.userName },
    userId: input.userId,
    userName: input.userName,
    userEmail: "",
    userRole: input.userRole,
  });
  return payload;
}
