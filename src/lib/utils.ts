import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  addMonths,
  differenceInCalendarDays,
  format,
  isToday,
  isValid,
  parseISO,
  startOfDay,
} from "date-fns";
import type { PullPointStatus, ReconciliationStatus } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | Date | null, pattern = "dd/MM/yyyy") {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return "—";
  return format(date, pattern);
}

export function formatDateTime(value?: string | Date | null) {
  return formatDate(value, "dd/MM/yyyy HH:mm");
}

export function toISODate(value: string | Date) {
  const date = typeof value === "string" ? parseISO(value.length === 10 ? `${value}T00:00:00` : value) : value;
  return format(date, "yyyy-MM-dd");
}

export function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

export function nowISO() {
  return new Date().toISOString();
}

export function addMonthsToDate(isoDate: string, months: number) {
  const base = parseISO(`${isoDate}T00:00:00`);
  return format(addMonths(base, months), "yyyy-MM-dd");
}

export function calcAvailableQuantity(
  total: number,
  withdrawn: number,
  disposed: number
) {
  return Math.max(0, total - withdrawn - disposed);
}

export function clampNonNegative(value: number) {
  return Math.max(0, Number.isFinite(value) ? value : 0);
}

export function roundPct(used: number, capacity: number) {
  if (!capacity || capacity <= 0) return 0;
  return Math.min(100, Math.round((used / capacity) * 100));
}

export function derivePullStatus(plannedDate: string, actualQuantity: number, plannedQuantity: number): PullPointStatus {
  if (actualQuantity > 0 && actualQuantity >= plannedQuantity) return "Withdrawn";
  if (actualQuantity > 0 && actualQuantity < plannedQuantity) return "Partially Withdrawn";

  const urgency = pullDueUrgency(plannedDate);
  if (urgency) return urgency;
  return "Upcoming";
}

/** Date-only urgency for open pulls (including partially withdrawn remaining qty). */
export function pullDueUrgency(plannedDate: string): "Overdue" | "Due Today" | "Due Soon" | null {
  if (!plannedDate) return null;
  try {
    const today = startOfDay(new Date());
    const due = startOfDay(parseISO(`${plannedDate}T00:00:00`));
    const days = differenceInCalendarDays(due, today);
    if (Number.isNaN(days)) return null;
    if (days < 0) return "Overdue";
    if (isToday(due)) return "Due Today";
    if (days <= 7) return "Due Soon";
    return null;
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
