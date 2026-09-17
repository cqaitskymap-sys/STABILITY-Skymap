import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { listDocs } from "@/lib/firebase/list-docs";
import { effectiveDueDate, nowISO, todayISO } from "@/lib/utils";
import { addDaysISO } from "@/lib/sop";
import { nextSequentialId } from "@/services/ids";
import { writeAuditLog } from "@/services/audit";
import type {
  AlarmStatus,
  AppUser,
  CalibrationStatus,
  ChamberAlarm,
  ChamberCalibrationRecord,
  ChamberCleaningRecord,
  ChamberExcursion,
  ChamberMaintenanceRecord,
  ChamberEvent,
  TemperatureMappingRecord,
} from "@/types";

function omitUndefined<T extends Record<string, unknown>>(input: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) out[key] = value;
  }
  return out as T;
}

async function listCol<T>(name: string) {
  return listDocs<T>(name);
}

function actor(user: AppUser) {
  return {
    createdBy: user.uid,
    createdByName: user.displayName || user.email,
  };
}

export async function listChamberAlarms() {
  return listCol<ChamberAlarm>(COLLECTIONS.chamberAlarms);
}
export async function listChamberExcursions() {
  return listCol<ChamberExcursion>(COLLECTIONS.chamberExcursions);
}
export async function listChamberCleaning() {
  return listCol<ChamberCleaningRecord>(COLLECTIONS.chamberCleaning);
}
export async function listChamberCalibration() {
  return listCol<ChamberCalibrationRecord>(COLLECTIONS.chamberCalibration);
}
export async function listTemperatureMappings() {
  return listCol<TemperatureMappingRecord>(COLLECTIONS.temperatureMappings);
}
export async function listChamberMaintenance() {
  return listCol<ChamberMaintenanceRecord>(COLLECTIONS.chamberMaintenance);
}
export async function listChamberEvents() {
  return listCol<ChamberEvent>(COLLECTIONS.chamberEvents);
}

export async function createChamberAlarm(input: {
  chamberId: string;
  chamberName: string;
  alarmType: string;
  startTime: string;
  remark?: string;
  user: AppUser;
}) {
  const alarmId = await nextSequentialId("ALM");
  const stamp = nowISO();
  const payload: Omit<ChamberAlarm, "id"> = {
    alarmId,
    chamberId: input.chamberId,
    chamberName: input.chamberName,
    alarmType: input.alarmType,
    startTime: input.startTime,
    status: "Active",
    remark: input.remark,
    createdAt: stamp,
    updatedAt: stamp,
    ...actor(input.user),
  };
  await addDoc(collection(getDb(), COLLECTIONS.chamberAlarms), omitUndefined(payload as unknown as Record<string, unknown>));
  await writeAuditLog({
    action: "Create",
    module: "Chamber Alarm",
    recordId: alarmId,
    recordType: "chamberAlarm",
    newValue: { alarmId, alarmType: input.alarmType },
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email,
    userEmail: input.user.email,
    userRole: input.user.role,
  });
  return payload;
}

export async function acknowledgeAlarm(id: string, remark: string, user: AppUser) {
  await updateDoc(
    doc(getDb(), COLLECTIONS.chamberAlarms, id),
    omitUndefined({
      status: "Acknowledged" satisfies AlarmStatus,
      acknowledgedBy: user.displayName || user.email,
      acknowledgedAt: nowISO(),
      remark: remark || undefined,
      updatedAt: nowISO(),
    } as Record<string, unknown>)
  );
  await writeAuditLog({
    action: "Alarm Acknowledge",
    module: "Chamber Alarm",
    recordId: id,
    recordType: "chamberAlarm",
    reason: remark,
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
}

export async function rectifyAlarm(id: string, remark: string, user: AppUser) {
  await updateDoc(
    doc(getDb(), COLLECTIONS.chamberAlarms, id),
    omitUndefined({
      status: "Rectified" satisfies AlarmStatus,
      rectifiedBy: user.displayName || user.email,
      rectifiedAt: nowISO(),
      endTime: nowISO(),
      remark: remark || undefined,
      updatedAt: nowISO(),
    } as Record<string, unknown>)
  );
  await writeAuditLog({
    action: "Alarm Rectify",
    module: "Chamber Alarm",
    recordId: id,
    recordType: "chamberAlarm",
    reason: remark,
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
}

export async function closeAlarm(id: string, user: AppUser) {
  await updateDoc(doc(getDb(), COLLECTIONS.chamberAlarms, id), {
    status: "Closed" satisfies AlarmStatus,
    updatedAt: nowISO(),
  });
  await writeAuditLog({
    action: "Edit",
    module: "Chamber Alarm",
    recordId: id,
    recordType: "chamberAlarm",
    newValue: { status: "Closed" },
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
}

export async function createExcursion(input: Omit<ChamberExcursion, "id" | "excursionId" | "createdBy" | "createdByName" | "createdAt" | "updatedAt"> & { user: AppUser }) {
  const excursionId = await nextSequentialId("EXC");
  const stamp = nowISO();
  const { user, ...rest } = input;
  const payload: Omit<ChamberExcursion, "id"> = {
    ...rest,
    excursionId,
    createdAt: stamp,
    updatedAt: stamp,
    ...actor(user),
  };
  await addDoc(collection(getDb(), COLLECTIONS.chamberExcursions), omitUndefined(payload as unknown as Record<string, unknown>));
  await writeAuditLog({
    action: "Create",
    module: "Chamber Excursion",
    recordId: excursionId,
    recordType: "chamberExcursion",
    newValue: { excursionId, beyond48Hours: rest.beyond48Hours },
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
  return payload;
}

export async function createCleaningRecord(input: Omit<ChamberCleaningRecord, "id" | "recordId" | "createdBy" | "createdByName" | "createdAt"> & { user: AppUser }) {
  const recordId = await nextSequentialId("CLN");
  const { user, ...rest } = input;
  const payload: Omit<ChamberCleaningRecord, "id"> = {
    ...rest,
    recordId,
    createdAt: nowISO(),
    ...actor(user),
  };
  await addDoc(collection(getDb(), COLLECTIONS.chamberCleaning), omitUndefined(payload as unknown as Record<string, unknown>));
  await writeAuditLog({
    action: "Create",
    module: "Chamber Cleaning",
    recordId,
    recordType: "chamberCleaning",
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
  return payload;
}

function calibrationStatus(dueDate: string): CalibrationStatus {
  const today = todayISO();
  const due = effectiveDueDate(dueDate) || dueDate;
  if (due < today) return "Expired";
  if (due <= addDaysISO(today, 30)) return "Due Soon";
  return "Valid";
}

export async function createCalibrationRecord(input: Omit<ChamberCalibrationRecord, "id" | "recordId" | "status" | "createdBy" | "createdByName" | "createdAt"> & { user: AppUser }) {
  const recordId = await nextSequentialId("CAL");
  const { user, ...rest } = input;
  const payload: Omit<ChamberCalibrationRecord, "id"> = {
    ...rest,
    recordId,
    status: calibrationStatus(rest.dueDate),
    createdAt: nowISO(),
    ...actor(user),
  };
  await addDoc(collection(getDb(), COLLECTIONS.chamberCalibration), omitUndefined(payload as unknown as Record<string, unknown>));
  await writeAuditLog({
    action: "Create",
    module: "Calibration",
    recordId,
    recordType: "chamberCalibration",
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
  return payload;
}

export async function createMappingRecord(input: Omit<TemperatureMappingRecord, "id" | "recordId" | "createdBy" | "createdByName" | "createdAt"> & { user: AppUser }) {
  const recordId = await nextSequentialId("MAP");
  const { user, ...rest } = input;
  const payload: Omit<TemperatureMappingRecord, "id"> = {
    ...rest,
    recordId,
    createdAt: nowISO(),
    ...actor(user),
  };
  await addDoc(collection(getDb(), COLLECTIONS.temperatureMappings), omitUndefined(payload as unknown as Record<string, unknown>));
  await writeAuditLog({
    action: "Create",
    module: "Temperature Mapping",
    recordId,
    recordType: "temperatureMapping",
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
  return payload;
}

export async function createMaintenanceRecord(input: Omit<ChamberMaintenanceRecord, "id" | "recordId" | "createdBy" | "createdByName" | "createdAt"> & { user: AppUser }) {
  const recordId = await nextSequentialId("MNT");
  const { user, ...rest } = input;
  const payload: Omit<ChamberMaintenanceRecord, "id"> = {
    ...rest,
    recordId,
    createdAt: nowISO(),
    ...actor(user),
  };
  await addDoc(collection(getDb(), COLLECTIONS.chamberMaintenance), omitUndefined(payload as unknown as Record<string, unknown>));
  await writeAuditLog({
    action: "Create",
    module: "Chamber Maintenance",
    recordId,
    recordType: "chamberMaintenance",
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
  return payload;
}

export async function createChamberEvent(input: Omit<ChamberEvent, "id" | "eventId" | "createdAt">) {
  const eventId = await nextSequentialId("EVT");
  const payload: Omit<ChamberEvent, "id"> = { ...input, eventId, createdAt: nowISO() };
  await addDoc(collection(getDb(), COLLECTIONS.chamberEvents), omitUndefined(payload as unknown as Record<string, unknown>));
  return payload;
}

export { calibrationStatus };
