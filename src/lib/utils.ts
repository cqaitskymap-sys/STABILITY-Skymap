import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  addMonths,
  differenceInCalendarDays,
  format,
  isValid,
  parseISO,
  startOfDay,
} from "date-fns";
import type { PullPointStatus, ReconciliationStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SKIP_UPPERCASE_INPUT_TYPES = new Set([
  "password",
  "email",
  "number",
  "date",
  "datetime-local",
  "time",
  "month",
  "week",
  "file",
  "checkbox",
  "radio",
  "hidden",
  "range",
  "color",
  "url",
]);

export function shouldUppercaseInput(type?: string) {
  return !SKIP_UPPERCASE_INPUT_TYPES.has((type || "text").toLowerCase());
}

function parseAppDate(value: string | Date) {
  if (value instanceof Date) return value;
  const s = value.trim();
  if (/^\d{4}-\d{2}$/.test(s)) return parseISO(`${s}-01T00:00:00`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return parseISO(`${s}T00:00:00`);
  return parseISO(s);
}

/** Display dates as month/year unless a full-day pattern is passed. */
export function formatDate(value?: string | Date | null, pattern = "MM/yyyy") {
  if (!value) return "—";
  const date = parseAppDate(value);
  if (!isValid(date)) return "—";
  return format(date, pattern);
}

/** Control Sample Collection date — the only date that keeps the day. */
export function formatFullDate(value?: string | Date | null) {
  return formatDate(value, "dd/MM/yyyy");
}

export function formatDateTime(value?: string | Date | null) {
  return formatDate(value, "dd/MM/yyyy HH:mm");
}

export function toMonthInput(value?: string | Date | null) {
  if (!value) return "";
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
  }
  const date = parseAppDate(value);
  if (!isValid(date)) return "";
  return format(date, "yyyy-MM");
}

export function endOfMonthISO(value: string) {
  const month = toMonthInput(value);
  if (!month) return "";
  const [year, monthIndex] = month.split("-").map(Number);
  const last = new Date(year, monthIndex, 0).getDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

export function fromMonthInput(value: string, bound: "start" | "end" = "start") {
  const month = toMonthInput(value);
  if (!month) return "";
  return bound === "end" ? endOfMonthISO(month) : `${month}-01`;
}

export function toISODate(value: string | Date) {
  const date = parseAppDate(value);
  if (!isValid(date)) return "";
  return format(date, "yyyy-MM-dd");
}

/** Month-picker start-bound dates (`YYYY-MM-01`) stay valid through month-end. */
export function effectiveDueDate(value?: string | Date | null) {
  if (!value) return "";
  const iso = typeof value === "string" ? value.trim() : toISODate(value);
  if (!iso) return "";
  const day = iso.length >= 10 ? iso.slice(0, 10) : "";
  if (/^\d{4}-\d{2}-01$/.test(day)) return endOfMonthISO(day);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  return endOfMonthISO(iso) || day;
}

export function isPastDue(value?: string | Date | null, today = todayISO()) {
  const due = effectiveDueDate(value);
  return Boolean(due && due < today);
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export function nowISO() {
  return new Date().toISOString();
}

export function addMonthsToDate(isoDate: string, months: number) {
  const base = parseAppDate(isoDate);
  if (!isValid(base)) return "";
  return format(addMonths(base, months), "yyyy-MM-dd");
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

export function clampNonNegative(value: number) {
  return Math.max(0, Number.isFinite(value) ? value : 0);
}

export function roundPct(used: number, capacity: number) {
  if (!capacity || capacity <= 0) return 0;
  return Math.min(100, Math.round((used / capacity) * 100));
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

  const dueEnd = effectiveDueDate(plannedDate);
  if (!dueEnd) return "Upcoming";
  const dueMonth = dueEnd.slice(0, 7);
  const nowMonth = format(new Date(), "yyyy-MM");
  if (nowMonth < dueMonth) {
    const nextMonth = format(addMonths(startOfDay(new Date()), 1), "yyyy-MM");
    return nextMonth === dueMonth ? "Due Soon" : "Upcoming";
  }
  if (nowMonth === dueMonth) return "Due";
  try {
    const today = startOfDay(new Date());
    const end = startOfDay(parseISO(`${dueEnd}T00:00:00`));
    const daysPast = differenceInCalendarDays(today, end);
    if (Number.isNaN(daysPast)) return "Upcoming";
    if (daysPast <= windowDays) return "Within Window";
    return "Overdue";
  } catch {
    return "Upcoming";
  }
}

/** Month-aware urgency for open pulls (including partially withdrawn remaining qty). */
export function pullDueUrgency(
  plannedDate: string,
  windowDays = 7
): "Overdue" | "Due Today" | "Due Soon" | null {
  if (!plannedDate) return null;
  const dueEnd = effectiveDueDate(plannedDate);
  if (!dueEnd) return null;
  const dueMonth = dueEnd.slice(0, 7);
  const nowMonth = format(new Date(), "yyyy-MM");
  if (nowMonth < dueMonth) {
    const nextMonth = format(addMonths(startOfDay(new Date()), 1), "yyyy-MM");
    return nextMonth === dueMonth ? "Due Soon" : null;
  }
  if (nowMonth === dueMonth) return "Due Today";
  try {
    const today = startOfDay(new Date());
    const end = startOfDay(parseISO(`${dueEnd}T00:00:00`));
    const daysPast = differenceInCalendarDays(today, end);
    if (Number.isNaN(daysPast)) return null;
    if (daysPast <= windowDays) return null;
    return "Overdue";
  } catch {
    return null;
  }
}

/** Shared UI + backend reconciliation status (threshold ≥ 5 → Investigation Required). */
export function resolveReconciliationStatus(
  variance: number,
  adjust: boolean
): ReconciliationStatus {
  if (variance === 0) return "Matched";
  if (adjust) return "Adjusted";
  return Math.abs(variance) >= 5 ? "Investigation Required" : "Variance Found";
}

export function friendlyError(error: unknown, fallback = "Unable to complete action. Please try again.") {
  if (!error) return fallback;

  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: string }).code || "").toLowerCase()
      : "";
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const msg = message.toLowerCase();

  if (code.includes("permission-denied") || msg.includes("permission-denied")) {
    return "You do not have permission to perform this action.";
  }
  if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")) {
    return "Invalid Employee ID or password.";
  }
  if (msg.includes("auth/user-not-found")) return "User account not found.";
  if (msg.includes("auth/email-already-in-use")) {
    return "An account with this Employee ID already exists.";
  }
  if (msg.includes("invalid employee id")) {
    return "Invalid Employee ID. Use 2–32 letters, numbers, hyphen, or underscore.";
  }
  if (msg.includes("offline") || msg.includes("network") || code.includes("unavailable")) {
    return "Network issue. Please check your connection and try again.";
  }
  if (msg.includes("unsupported field value: undefined")) {
    return "Some required fields are missing. Please review the form and try again.";
  }

  // Prefer clear application / validation messages over the generic fallback.
  if (message && !msg.startsWith("firebaseerror:") && message.length <= 240) {
    // Strip Firebase SDK prefixes when present but keep the useful part.
    const cleaned = message.replace(/^Firebase:\s*/i, "").replace(/\s*\([^)]*\)\.?\s*$/, "").trim();
    if (cleaned && !cleaned.toLowerCase().includes("permission-denied")) {
      return cleaned.length >= 8 ? cleaned : message;
    }
    return message;
  }

  return fallback;
}

export function downloadBlob(filename: string, content: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

export function paginate<T>(items: T[], page: number, pageSize: number) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);
  const start = (current - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    pageSize,
    total,
    totalPages,
  };
}

export function debounce<T extends (...args: never[]) => void>(fn: T, wait = 300) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
