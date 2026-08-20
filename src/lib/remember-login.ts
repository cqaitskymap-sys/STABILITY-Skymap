const STORAGE_KEY = "skymap.remember-login.v1";

export type RememberedLogin = {
  employeeId: string;
  password: string;
};

type StoredLogin = {
  v: 1;
  employeeId: string;
  secret: string;
};

function encodeSecret(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeSecret(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function loadRememberedLogin(): RememberedLogin | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLogin;
    if (parsed?.v !== 1 || !parsed.employeeId || !parsed.secret) return null;
    return {
      employeeId: parsed.employeeId,
      password: decodeSecret(parsed.secret),
    };
  } catch {
    return null;
  }
}

export function saveRememberedLogin(employeeId: string, password: string) {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredLogin = {
      v: 1,
      employeeId: employeeId.trim(),
      secret: encodeSecret(password),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode or storage blocked — skip remember.
  }
}

export function clearRememberedLogin() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}
