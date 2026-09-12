import { addDays, differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import type { OrganizationSettings, PullPointStatus, SampleOrientation } from "@/types";

export const DEFAULT_ORG_SETTINGS: OrganizationSettings = {
  companyName: "",
  plantCode: "",
  departmentCode: "",
  documentPrefix: "",
  chargingWindowDays: 30,
  withdrawalWindowDays: 7,
  analysisDaysAccelerated: 21,
  analysisDaysLongTerm: 30,
  invertedPercentDefault: 25,
  waterLossLimitPercent: 5,
  requireReceiptBeforeCharging: false,
  requireLateChargingReason: true,
  requireDestructionApproval: true,
  allowMultiOccupancy: false,
  hardwareIntegrationEnabled: false,
  simulationEnabled: false,
  passwordMinLength: 8,
  passwordMaxLength: 12,
  failedLoginLockout: 5,
  controlDestructionMonthsAfterExpiry: 12,
  controlObservationIntervalMonths: 6,
  controlObservationAfterExpiryMonths: 12,
  controlConversionBatchQuantity: 1,
  controlRequireWithdrawalApproval: true,
  controlAllowDuplicateBoxOccupancy: false,
  labelColors: {
    accelerated: "#dc2626",
    longTerm: "#16a34a",
    intermediate: "#ca8a04",
  },
};

export const STUDY_REASON_DEFAULTS = [
  "First three commercial batches",
  "Subsequent / ongoing stability batches",
  "New manufacturing process",
  "Change in API source",
  "Change in primary packing material",
  "Change in secondary packing material",
  "Pharmacopoeia grade change",
  "Changes in component/composition",
  "Changes unlikely to have detectable impact",
  "Changes that could significantly impact formulation quality/performance",
  "Change in batch size",
  "Other protocol-defined reason",
];

export const ALARM_TYPE_DEFAULTS = [
  "Temperature High",
  "Temperature Low",
  "Humidity High",
  "Humidity Low",
  "Temperature Safety Controller High",
  "Temperature Safety Controller Low",
  "Humidity Safety Controller High",
  "Humidity Safety Controller Low",
  "Temperature Undershoot",
  "Temperature Overshoot",
  "Standby Water Level Low",
  "Both Refrigeration Systems Failed",
  "Door Open",
  "Power Resume",
  "Chamber Start",
  "Sensor Fault",
  "System Fault",
];

export const PROTOCOL_SECTIONS = [
  "Protocol Approval",
  "Objective",
  "Scope",
  "Reason for Stability Study",
  "Responsibility",
  "Training Details",
  "Specification & Test Methodology",
  "Product Details",
  "Stability Study Methodology",
  "Study Design & Condition",
  "Testing Parameters & Acceptance Criteria",
  "Data Analysis",
  "Other Details",
  "OOS",
  "Deviations",
  "Conclusion",
  "Abbreviations",
  "Revision History",
  "Annexures",
];

export function parseDate(iso: string) {
  return startOfDay(parseISO(iso.length === 10 ? `${iso}T00:00:00` : iso));
}

export function daysFromToday(iso: string) {
  return differenceInCalendarDays(parseDate(iso), startOfDay(new Date()));
}

export function addDaysISO(iso: string, days: number) {
  return addDays(parseDate(iso), days).toISOString().slice(0, 10);
}

/** Available = Initial − Withdrawn + Returned − Disposed */
export function calcAvailableQuantity(
  total: number,
  withdrawn: number,
  disposed: number,
  returned = 0
) {
  return Math.max(0, Number(total || 0) - Number(withdrawn || 0) + Number(returned || 0) - Number(disposed || 0));
}

export function splitOrientation(total: number, invertedPercent = 25) {
  const pct = Math.min(100, Math.max(0, Number(invertedPercent) || 0));
  const invertedQuantity = Math.round((total * pct) / 100);
  const uprightQuantity = Math.max(0, total - invertedQuantity);
  return { uprightQuantity, invertedQuantity, invertedPercent: pct };
}

export function isChargingBeyondWindow(releaseDate: string | undefined, chargingDate: string, windowDays: number) {
  if (!releaseDate) return false;
  try {
    const limit = addDays(parseDate(releaseDate), windowDays);
    return parseDate(chargingDate) > limit;
  } catch {
    return false;
  }
}

export function analysisDueDays(studyType: string, settings: OrganizationSettings) {
  const name = (studyType || "").toLowerCase();
  if (name.includes("accel") || name.includes("acc")) return settings.analysisDaysAccelerated;
  return settings.analysisDaysLongTerm;
}

export function analysisDueDate(withdrawalDate: string, studyType: string, settings: OrganizationSettings) {
  return addDaysISO(withdrawalDate, analysisDueDays(studyType, settings));
}

export function studyTypeColorKey(studyType: string): keyof OrganizationSettings["labelColors"] {
  const name = (studyType || "").toLowerCase();
  if (name.includes("accel") || name === "acc") return "accelerated";
  if (name.includes("inter")) return "intermediate";
  return "longTerm";
}

export function labelColor(studyType: string, settings: OrganizationSettings) {
  return settings.labelColors[studyTypeColorKey(studyType)];
}

export function percentWaterLoss(initialWeight: number, observedWeight: number) {
  if (!initialWeight) return 0;
  return ((initialWeight - observedWeight) / initialWeight) * 100;
}

/**
 * Proposed shelf life helper from SOP:
 * Y up to 2X, but not exceeding X + 12 months.
 * Result is a calculation aid — not automatic approval.
 */
export function proposedShelfLifeMonths(longTermDataMonths: number) {
  const x = Math.max(0, Number(longTermDataMonths) || 0);
  const twoX = 2 * x;
  const xPlus12 = x + 12;
  return Math.min(twoX, xPlus12);
}

/**
 * USP Mean Kinetic Temperature (°C).
 * ΔH = 83.144 kJ/mol, R = 8.314462618e-3 kJ/mol·K
 * Returns null when data is insufficient.
 */
export function meanKineticTemperature(celsiusReadings: number[]) {
  const values = celsiusReadings.filter((v) => Number.isFinite(v));
  if (values.length < 2) return null;
  const deltaH = 83.144;
  const R = 0.008314462618;
  const n = values.length;
  const sum = values.reduce((acc, c) => acc + Math.exp(-deltaH / (R * (c + 273.15))), 0);
  const mktKelvin = (deltaH / R) / -Math.log(sum / n);
  if (!Number.isFinite(mktKelvin)) return null;
  return mktKelvin - 273.15;
}

export function derivePullStatus(
  plannedDate: string,
  actualQuantity: number,
  plannedQuantity: number,
  windowDays = 7
): PullPointStatus {
  if (actualQuantity > 0 && actualQuantity >= plannedQuantity) return "Withdrawn";
  if (actualQuantity > 0 && actualQuantity < plannedQuantity) return "Partially Withdrawn";
  if (!plannedDate) return "Upcoming";
  const days = daysFromToday(plannedDate);
  if (Number.isNaN(days)) return "Upcoming";
  if (days > 7) return "Upcoming";
  if (days > 0) return "Due Soon";
  if (days === 0) return "Due Today";
  if (Math.abs(days) <= windowDays) return "Within Window";
  return "Overdue";
}

export function pullWindowEnd(plannedDate: string, windowDays = 7) {
  return addDaysISO(plannedDate, windowDays);
}

export function orientationLabel(value?: SampleOrientation | null) {
  return value || "Upright";
}

export function documentNumber(parts: {
  prefix?: string;
  plantCode?: string;
  departmentCode?: string;
  docType: string;
  serial: string;
}) {
  return [parts.prefix, parts.plantCode, parts.departmentCode, parts.docType, parts.serial]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join("/");
}
