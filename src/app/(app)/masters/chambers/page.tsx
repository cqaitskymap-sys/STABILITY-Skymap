"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { roundPct } from "@/lib/utils";
import { listChambers } from "@/services/masters";
import type { Chamber } from "@/types";

const CHAMBER_PRESETS = [
  { chamberId: "SMH/QA/SC/001", temperature: "30°C", relativeHumidity: "35% RH", studyType: "LT" },
  { chamberId: "SMH/QA/SC/002", temperature: "40°C", relativeHumidity: "NMT 25% RH", studyType: "ACC" },
  { chamberId: "SMH/QA/SC/003", temperature: "25°C", relativeHumidity: "40%", studyType: "LT" },
  { chamberId: "SMH/QA/SC/004", temperature: "30°C", relativeHumidity: "75% RH", studyType: "LT" },
  { chamberId: "SMH/QA/SC/005", temperature: "30°C", relativeHumidity: "75% RH", studyType: "LT" },
  { chamberId: "SMH/QA/SC/006", temperature: "30°C", relativeHumidity: "75% RH", studyType: "LT" },
  { chamberId: "SMH/QC/SC/025", temperature: "25°C", relativeHumidity: "60% RH", studyType: "LT" },
  { chamberId: "SMH/QC/SC/026", temperature: "30°C", relativeHumidity: "65% RH", studyType: "LT" },
  { chamberId: "SMH/QC/SC/027", temperature: "40°C", relativeHumidity: "75% RH", studyType: "ACC" },
  { chamberId: "SMM/QA/PSC/007", temperature: "25°C", relativeHumidity: "", studyType: "LT" },
] as const;

function presetForId(chamberId: string) {
  return CHAMBER_PRESETS.find((p) => p.chamberId.toUpperCase() === chamberId.trim().toUpperCase());
}

function chamberOptionLabel(preset: (typeof CHAMBER_PRESETS)[number]) {
  const condition = preset.relativeHumidity
    ? `${preset.temperature} / ${preset.relativeHumidity}`
    : preset.temperature;
  return `${preset.chamberId} — ${condition} — ${preset.studyType}`;
}

function conditionFromPreset(preset: (typeof CHAMBER_PRESETS)[number]) {
  return {
    temperature: preset.temperature,
    relativeHumidity: preset.relativeHumidity,
  };
}

export default function ChambersPage() {
  return (
    <MasterPage<Chamber>
      title="Chamber Master"
      description="Manage stability chambers, capacity, and operating conditions."
      collectionName={COLLECTIONS.chambers}
      recordType="chamber"
      loader={listChambers}
      fields={[
        {
          key: "chamberId",
          label: "Chamber ID",
          type: "select",
          required: true,
          options: [
            { label: "Select chamber", value: "" },
            ...CHAMBER_PRESETS.map((p) => ({ label: chamberOptionLabel(p), value: p.chamberId })),
          ],
          hint: "Unique business ID used in reports and labels.",
          syncOnChange: (chamberId) => {
            const preset = presetForId(chamberId);
            return preset ? conditionFromPreset(preset) : { temperature: "", relativeHumidity: "" };
          },
        },
        {
          key: "temperature",
          label: "Temperature",
          required: true,
          readOnly: true,
        },
        {
          key: "relativeHumidity",
          label: "Relative Humidity",
          readOnly: true,
        },
        {
          key: "capacity",
          label: "Capacity",
          type: "number",
          required: true,
          hint: "Total sample units the chamber can hold. Used capacity is updated by charging/withdrawals.",
        },
      ]}
      mapRow={(item) => {
        const used = Number(item.usedCapacity) || 0;
        const capacity = Number(item.capacity) || 0;
        const free = Math.max(0, capacity - used);
        return {
          "Chamber ID": item.chamberId,
          Condition: `${item.temperature}${item.relativeHumidity ? ` / ${item.relativeHumidity}` : ""}`,
          Capacity: capacity,
          Used: used,
          Free: free,
          "Utilization %": roundPct(used, capacity),
        };
      }}
      getCreateDefaults={() => ({
        capacity: "100",
      })}
      validate={({ values, items, editing }) => {
        const chamberId = values.chamberId.trim();
        const preset = presetForId(chamberId);
        const capacity = Number(values.capacity);
        const used = Number(editing?.usedCapacity) || 0;
        const legacyMatch = !!editing && editing.chamberId.trim().toUpperCase() === chamberId.toUpperCase();

        if (!preset && !legacyMatch) return "Select a chamber ID.";
        if (!Number.isFinite(capacity) || capacity <= 0) {
          return "Capacity must be greater than zero.";
        }
        if (editing && capacity < used) {
          return `Capacity cannot be less than current used capacity (${used}).`;
        }

        const duplicateId = items.some(
          (i) => i.id !== editing?.id && i.chamberId.trim().toUpperCase() === chamberId.toUpperCase()
        );
        if (duplicateId) return "A chamber with this Chamber ID already exists.";

        return null;
      }}
      buildPayload={(values, isCreate) => {
        const chamberId = values.chamberId.trim();
        const preset = presetForId(chamberId);
        const temperature = preset?.temperature || values.temperature.trim();
        const relativeHumidity = preset ? preset.relativeHumidity : values.relativeHumidity.trim();
        return {
          chamberId: preset?.chamberId || chamberId,
          chamberName: preset?.chamberId || chamberId,
          temperature,
          relativeHumidity,
          capacity: Number(values.capacity) || 0,
          ...(isCreate
            ? {
                chamberType: preset?.studyType || "",
                location: "",
                status: "Active",
                usedCapacity: 0,
              }
            : preset
              ? { chamberType: preset.studyType }
              : {}),
        };
      }}
    />
  );
}
