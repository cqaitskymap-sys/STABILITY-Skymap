const STORAGE_KEY = "skymap.remember-login.v2";
const LEGACY_KEY = "skymap.remember-login.v1";

export type RememberedLogin = {
  employeeId: string;
};

function readEmployeeId(raw: string | null): string {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as { employeeId?: unknown };
    return typeof parsed?.employeeId === "string" ? parsed.employeeId.trim() : "";
  } catch {
    return "";
  }
}

/** Drop legacy reversible password storage; keep Employee ID only. */
export function migrateRememberedLogin() {
  if (typeof window === "undefined") return;
  try {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const employeeId = readEmployeeId(localStorage.getItem(LEGACY_KEY));
      if (employeeId) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, employeeId }));
      }
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Private mode or storage blocked.
  }
}

export function subscribeRememberedLogin(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  migrateRememberedLogin();
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function loadRememberedLogin(): RememberedLogin | null {
  if (typeof window === "undefined") return null;
  try {
    const employeeId =
      readEmployeeId(localStorage.getItem(STORAGE_KEY)) ||
      readEmployeeId(localStorage.getItem(LEGACY_KEY));
    return employeeId ? { employeeId } : null;
  } catch {
    return null;
  }
}

export function saveRememberedLogin(employeeId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ v: 2, employeeId: employeeId.trim() })
    );
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Private mode or storage blocked — skip remember.
  }
}

export function clearRememberedLogin() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Ignore storage errors.
  }
}
