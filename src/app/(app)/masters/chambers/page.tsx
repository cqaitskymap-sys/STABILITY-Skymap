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
          key: "presetId",
          label: "Apply chamber preset",
          type: "select",
          options: [
            { label: "None — enter Chamber ID manually", value: "" },
            ...CHAMBER_PRESETS.map((p) => ({ label: chamberOptionLabel(p), value: p.chamberId })),
          ],
          hint: "Optional shortcut. Presets fill ID and set points; they are not a hard-coded plant code.",
          syncOnChange: (value): Record<string, string> => {
            const preset = presetForId(value);
            if (!preset) return {};
            return {
              chamberId: preset.chamberId,
              temperature: preset.temperature,
              relativeHumidity: preset.relativeHumidity,
              chamberType: preset.studyType,
            };
          },
        },
        {
          key: "chamberId",
          label: "Chamber ID",
          required: true,
          hint: "Unique business ID. Presets are optional shortcuts, not a hard-coded plant code.",
        },
        { key: "chamberName", label: "Chamber Name" },
        {
          key: "chamberType",
          label: "Chamber Type",
        },
        { key: "location", label: "Location" },
        { key: "temperature", label: "Set Temperature" },
        { key: "relativeHumidity", label: "Set RH" },
        { key: "temperatureChannels", label: "Temperature channels", type: "number" },
        { key: "humidityChannels", label: "Humidity channels", type: "number" },
        { key: "calibrationDueDate", label: "Calibration due", type: "date", monthBound: "end" },
        { key: "mappingDueDate", label: "Mapping due", type: "date", monthBound: "end" },
        { key: "capacity", label: "Capacity", type: "number", required: true },
        {
          key: "status",
          label: "Status",
          type: "select",
          required: true,
          options: [
            { label: "Active", value: "Active" },
            { label: "Under Maintenance", value: "Under Maintenance" },
            { label: "Inactive", value: "Inactive" },
            { label: "Out of Service", value: "Out of Service" },
          ],
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
          Status: item.status || "Active",
        };
      }}
      getCreateDefaults={() => ({
        capacity: "100",
        status: "Active",
      })}
      validate={({ values, items, editing }) => {
        const chamberId = values.chamberId.trim();
        const capacity = Number(values.capacity);
        const used = Number(editing?.usedCapacity) || 0;

        if (!chamberId) return "Chamber ID is required.";
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
        const temperature = values.temperature.trim() || preset?.temperature || "";
        const relativeHumidity = values.relativeHumidity.trim() || preset?.relativeHumidity || "";
        return {
          chamberId,
          chamberName: values.chamberName.trim() || chamberId,
          chamberType: values.chamberType.trim() || preset?.studyType || "",
          location: values.location.trim(),
          temperature,
          relativeHumidity,
          temperatureChannels: Number(values.temperatureChannels) || 0,
          humidityChannels: Number(values.humidityChannels) || 0,
          calibrationDueDate: values.calibrationDueDate || undefined,
          mappingDueDate: values.mappingDueDate || undefined,
          capacity: Number(values.capacity) || 0,
          status: values.status || "Active",
          ...(isCreate
            ? {
                usedCapacity: 0,
              }
            : {}),
        };
      }}
    />
  );
}
