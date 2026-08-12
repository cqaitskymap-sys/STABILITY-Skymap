/** Employee ID is the login ID. Firebase Auth still needs an email-shaped credential. */

const AUTH_EMAIL_DOMAIN = "emp.stability-skymap.local";

export function normalizeEmployeeId(employeeId: string) {
  return employeeId.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidEmployeeId(employeeId: string) {
  const id = normalizeEmployeeId(employeeId);
  // Letters, digits, hyphen, underscore; 2–32 chars
  return /^[A-Z0-9_-]{2,32}$/.test(id);
}

export function employeeIdToAuthEmail(employeeId: string) {
  const id = normalizeEmployeeId(employeeId);
  if (!isValidEmployeeId(id)) {
    throw new Error("Invalid Employee ID. Use 2–32 letters, numbers, hyphen, or underscore.");
  }
  return `${id.toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}

export function authEmailToEmployeeId(email: string | null | undefined) {
  if (!email) return "";
  const trimmed = email.trim().toLowerCase();
  const suffix = `@${AUTH_EMAIL_DOMAIN}`;
  if (trimmed.endsWith(suffix)) {
    return normalizeEmployeeId(trimmed.slice(0, -suffix.length));
  }
  // Legacy email logins: use local-part as a readable fallback id
  const at = trimmed.indexOf("@");
  return at > 0 ? normalizeEmployeeId(trimmed.slice(0, at)) : "";
}
