import { doc, getDoc, setDoc } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { DEFAULT_ORG_SETTINGS } from "@/lib/sop";
import { nowISO } from "@/lib/utils";
import { writeAuditLog } from "@/services/audit";
import type { AppUser, OrganizationSettings } from "@/types";

const ORG_DOC = "organization";

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
