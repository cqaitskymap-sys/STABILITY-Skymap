import { addMonths, format, isValid, parseISO, startOfDay } from "date-fns";
import { effectiveDueDate, todayISO } from "@/lib/utils";
import { DEFAULT_ORG_SETTINGS } from "@/lib/sop";
import type { ControlSample, OrganizationSettings } from "@/types";

/**
 * SOP annexure mapping (developer/admin reference):
 * Annexure-I   → Control Sample Quantity Master
 * Annexure-II  → Daily Collection Record
 * Annexure-III → Control Sample Stamp
 * Annexure-IV  → Control Sample Log Book
 * Annexure-V   → Withdrawal / Requisition
 * Annexure-VI  → Destruction Note + Verification
 * Annexure-VII → Destruction Log Book
 * Annexure-VIII→ Location & Box Management
 * Annexure-IX  → Destruction Due List
 */
export const CONTROL_SAMPLE_ANNEXURES = [
  { annexure: "Annexure-I", feature: "Control Sample Quantity Master", href: "/stability/control-samples/quantity-master" },
      { annexure: "Annexure-II", feature: "Daily Collection Record", href: "/stability/control-samples/daily-collection" },
  { annexure: "Annexure-III", feature: "Control Sample Stamp", href: "/stability/control-samples/register" },
  { annexure: "Annexure-IV", feature: "Control Sample Log Book", href: "/stability/control-samples/register" },
  { annexure: "Annexure-V", feature: "Withdrawal / Requisition", href: "/stability/control-samples/withdrawal" },
  { annexure: "Annexure-VI", feature: "Destruction Note + Verification", href: "/stability/control-samples/destruction/new" },
  { annexure: "Annexure-VII", feature: "Destruction Log Book", href: "/stability/control-samples/destruction-log" },
  { annexure: "Annexure-VIII", feature: "Location & Box Management", href: "/stability/control-samples/locations" },
  { annexure: "Annexure-IX", feature: "Destruction Due List", href: "/stability/control-samples/destruction-due" },
] as const;

export const DEFAULT_DESTRUCTION_STEPS = [
  "Scratch vial/ampoule label with permanent marker",
  "Open vial/ampoule using seal opener",
  "Dissolve powder/solution in water",
  "Send solution to ETP Plant",
  "Transfer empty vials to scrap area along with caps",
];

export const DEFAULT_OBSERVATION_TEMPLATES: { productType: string; parameters: string[]; procedure?: string }[] = [
  {
    productType: "Glass Ampoules",
    parameters: ["Visible Particles", "Black particles", "Glass particles", "White particles", "Fiber"],
    procedure: "Clear: 2000–3750 lux; Amber: 8000–10000 lux. Observe ~5 seconds against white then black panel. Two samples. This is a recording checklist — the application does not perform inspection.",
  },
  {
    productType: "Glass Vials",
    parameters: ["Visible Particles", "Black", "Glass", "White", "Fiber"],
    procedure: "Clear: 2000–3750 lux; Amber: 8000–10000 lux. Observe ~5 seconds against white then black panel. Two samples.",
  },
  {
    productType: "Dry Powder",
    parameters: ["Visible Particles", "Colour variation"],
  },
  {
    productType: "Eye/Ear/Nasal Drops",
    parameters: ["Visible Particles", "Colour variation", "Broken Seal"],
    procedure: "Transfer contents individually into clean 20 mL glass test tubes. Observe ~5 seconds against white then black panel. Two bottles.",
  },
];

export const COLLECTION_STAGES = ["Initial", "Middle", "End"] as const;

export function controlOrg(settings?: Partial<OrganizationSettings> | null): OrganizationSettings {
  return { ...DEFAULT_ORG_SETTINGS, ...(settings || {}) };
}

/** Available = Initial − Issued + Returned − Destroyed − Verification discarded ± Approved adjustment */
export function calcControlAvailable(input: {
  initialQuantity: number;
  issuedQuantity: number;
  returnedQuantity: number;
  destroyedQuantity: number;
  verificationDiscardedQuantity?: number;
  adjustedQuantity?: number;
}) {
  const available =
    Number(input.initialQuantity || 0) -
    Number(input.issuedQuantity || 0) +
    Number(input.returnedQuantity || 0) -
    Number(input.destroyedQuantity || 0) -
    Number(input.verificationDiscardedQuantity || 0) +
    Number(input.adjustedQuantity || 0);
  if (available < 0) {
    throw new Error("Quantity change would result in a negative available quantity.");
  }
  return available;
}

export function initialQty(row: Pick<ControlSample, "quantity" | "initialQuantity">) {
  return Number(row.initialQuantity ?? row.quantity ?? 0);
}

export function destroyedQty(row: Pick<ControlSample, "disposedQuantity" | "destroyedQuantity">) {
  return Number(row.destroyedQuantity ?? row.disposedQuantity ?? 0);
}

export function destructionEligibleDate(expiryDate: string, monthsAfterExpiry = 12) {
  const end = effectiveDueDate(expiryDate);
  if (!end) return "";
  const parsed = parseISO(`${end}T00:00:00`);
  if (!isValid(parsed)) return "";
  return format(addMonths(startOfDay(parsed), monthsAfterExpiry), "yyyy-MM-dd");
}

export function nextObservationDate(fromDate: string, intervalMonths = 6) {
  const parsed = parseISO(fromDate.length === 10 ? `${fromDate}T00:00:00` : fromDate);
  if (!isValid(parsed)) return "";
  return format(addMonths(startOfDay(parsed), intervalMonths), "yyyy-MM-dd");
}

export function isObservationWindowOpen(row: Pick<ControlSample, "expiryDate">, settings?: OrganizationSettings | null) {
  const cfg = controlOrg(settings);
  if (!row.expiryDate) return true;
  const end = destructionEligibleDate(row.expiryDate, cfg.controlObservationAfterExpiryMonths);
  return !end || todayISO() <= end;
}

export function isDestructionEligible(row: Pick<ControlSample, "expiryDate" | "destructionEligibleDate" | "availableQuantity" | "destructionHold" | "status">, settings?: OrganizationSettings | null) {
  if (row.destructionHold || row.status === "Destroyed" || row.status === "Disposed") return false;
  if ((row.availableQuantity || 0) <= 0) return false;
  const eligible = effectiveDueDate(
    row.destructionEligibleDate || (row.expiryDate ? destructionEligibleDate(row.expiryDate, controlOrg(settings).controlDestructionMonthsAfterExpiry) : "")
  );
  return Boolean(eligible && eligible <= todayISO());
}

export function isDestructionOverdue(eligibleDate?: string) {
  if (!eligibleDate) return false;
  const due = effectiveDueDate(eligibleDate);
  return Boolean(due && due < todayISO());
}

export function isRetentionReviewDue(destroyedOn?: string, years = 2) {
  if (!destroyedOn) return false;
  const parsed = parseISO(destroyedOn.length === 10 ? `${destroyedOn}T00:00:00` : destroyedOn);
  if (!isValid(parsed)) return false;
  return format(addMonths(parsed, years * 12), "yyyy-MM-dd") <= todayISO();
}

export function deriveControlInventoryStatus(row: ControlSample): ControlSample["status"] {
  if (row.status === "Disposed") return row.status;
  if (row.destructionHold) return "Destruction Hold";
  const available = row.availableQuantity || 0;
  if (available === 0 && destroyedQty(row) > 0) return "Destroyed";
  if (available === 0) return "Depleted";
  const eligibleEnd = effectiveDueDate(row.destructionEligibleDate);
  if (eligibleEnd && eligibleEnd <= todayISO()) return "Destruction Eligible";
  if ((row.issuedQuantity || 0) > (row.returnedQuantity || 0)) return "Partially Issued";
  if (row.rackNumber || row.boxNumber) return "Stored";
  return row.status === "Stored" ? "Stored" : "Available";
}
