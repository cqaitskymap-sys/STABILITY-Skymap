import { collection, getDocs } from "firebase/firestore";
import { getDb } from "@/lib/firebase/config";

function errorCode(err: unknown) {
  if (typeof err === "object" && err && "code" in err) {
    return String((err as { code?: string }).code || "").toLowerCase();
  }
  return err instanceof Error ? err.message.toLowerCase() : String(err || "").toLowerCase();
}

/** List a collection; missing rules or empty permissions return [] instead of crashing the page. */
export async function listDocs<T>(name: string, sortField = "createdAt"): Promise<T[]> {
  try {
    const snap = await getDocs(collection(getDb(), name));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as T))
      .sort((a, b) =>
        String((b as Record<string, unknown>)[sortField] || "").localeCompare(
          String((a as Record<string, unknown>)[sortField] || "")
        )
      );
  } catch (err) {
    const code = errorCode(err);
    if (code.includes("not-found")) {
      console.warn(`[firestore] Collection ${name} was not found. Showing an empty list.`);
      return [];
    }
    throw err;
  }
}
