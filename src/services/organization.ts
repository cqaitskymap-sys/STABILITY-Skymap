import { doc, getDoc, setDoc } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { DEFAULT_ORG_SETTINGS } from "@/lib/sop";
import { nowISO } from "@/lib/utils";
import { writeAuditLog } from "@/services/audit";
import type { AppUser, OrganizationSettings } from "@/types";

const ORG_DOC = "organization";

function requireNumber(name: string, value: number, min: number, max?: number) {
  if (!Number.isFinite(value) || value < min || (max != null && value > max)) {
    throw new Error(
      max == null
        ? `${name} must be ${min} or greater.`
        : `${name} must be between ${min} and ${max}.`
    );
  }
}

export async function getOrganizationSettings(): Promise<OrganizationSettings> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.settings, ORG_DOC));
  if (!snap.exists()) return { ...DEFAULT_ORG_SETTINGS };
  const data = snap.data() as Partial<OrganizationSettings>;
  return {
    ...DEFAULT_ORG_SETTINGS,
    ...data,
    labelColors: {
      ...DEFAULT_ORG_SETTINGS.labelColors,
      ...(data.labelColors || {}),
    },
  };
}

export async function saveOrganizationSettings(
  updates: Partial<OrganizationSettings>,
  user: AppUser
) {
  const current = await getOrganizationSettings();
  const next: OrganizationSettings = {
    ...current,
    ...updates,
    labelColors: {
      ...current.labelColors,
      ...(updates.labelColors || {}),
    },
    updatedAt: nowISO(),
    updatedBy: user.displayName || user.email,
  };
  requireNumber("Charging window", next.chargingWindowDays, 0);
  requireNumber("Withdrawal window", next.withdrawalWindowDays, 0);
  requireNumber("Accelerated analysis days", next.analysisDaysAccelerated, 0);
  requireNumber("Long-term analysis days", next.analysisDaysLongTerm, 0);
  requireNumber("Default inverted percent", next.invertedPercentDefault, 0, 100);
  requireNumber("Water-loss limit percent", next.waterLossLimitPercent, 0, 100);
  requireNumber("Password minimum length", next.passwordMinLength, 6, 128);
  requireNumber("Password maximum length", next.passwordMaxLength, next.passwordMinLength, 128);
  requireNumber("Failed login lockout", next.failedLoginLockout, 1, 20);
  requireNumber("Controlled sample destruction months", next.controlDestructionMonthsAfterExpiry, 0);
  requireNumber("Observation interval", next.controlObservationIntervalMonths, 1);
  requireNumber("Observation window after expiry", next.controlObservationAfterExpiryMonths, 0);
  requireNumber("Conversion batch quantity", next.controlConversionBatchQuantity, 0);
  if (
    !next.labelColors.accelerated.trim() ||
    !next.labelColors.longTerm.trim() ||
    !next.labelColors.intermediate.trim()
  ) {
    throw new Error("Each label color is required.");
  }
  await setDoc(doc(getDb(), COLLECTIONS.settings, ORG_DOC), next, { merge: true });
  await writeAuditLog({
    action: "Configuration Change",
    module: "Organization",
    recordType: "organizationSettings",
    recordId: ORG_DOC,
    previousValue: current,
    newValue: updates,
    userId: user.uid,
    userName: user.displayName || user.email,
    userEmail: user.email,
    userRole: user.role,
  });
  return next;
}
