import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { formatDateTime } from "@/lib/utils";

export type BootstrapStatus = {
  open: boolean;
  completedAt?: string;
  completedBy?: string;
  completedAtLabel?: string;
};

/** Public bootstrap lock document under settings/bootstrap. */
export async function getBootstrapStatus(): Promise<BootstrapStatus> {
  const snap = await getDoc(doc(getDb(), COLLECTIONS.settings, "bootstrap"));
  if (!snap.exists()) {
    return { open: true };
  }
  const data = snap.data() as { completedAt?: string; completedBy?: string };
  return {
    open: false,
    completedAt: data.completedAt,
    completedBy: data.completedBy,
    completedAtLabel: data.completedAt ? formatDateTime(data.completedAt) : undefined,
  };
}
