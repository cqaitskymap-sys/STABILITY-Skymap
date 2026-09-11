"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listStorageConditions } from "@/services/masters";
import type { StorageCondition } from "@/types";

const CONDITION_NAMES = ["Long Term", "ACC"] as const;

const STORAGE_CONDITION_PRESETS = [
  { name: "Long Term", temperature: "30°C", relativeHumidity: "75%" },
  { name: "Long Term", temperature: "30°C", relativeHumidity: "65%" },
  { name: "Long Term", temperature: "30°C", relativeHumidity: "35%" },
  { name: "Long Term", temperature: "20°C", relativeHumidity: "10%" },
  { name: "Long Term", temperature: "25°C", relativeHumidity: "60%" },
  { name: "ACC", temperature: "40°C", relativeHumidity: "75%" },
  { name: "ACC", temperature: "40°C", relativeHumidity: "NMT 25%" },
] as const;

function conditionKey(temperature: string, relativeHumidity: string) {
  return `${temperature} / ${relativeHumidity}`;
}

function findPreset(name: string, key: string) {
  return STORAGE_CONDITION_PRESETS.find(
    (p) => p.name === name && conditionKey(p.temperature, p.relativeHumidity) === key
  );
}

function temperatureOptions(name: string) {
  const presets = STORAGE_CONDITION_PRESETS.filter((p) => p.name === name);
  return [
    { label: name ? "Select temperature" : "Select name first", value: "" },
    ...presets.map((p) => {
      const value = conditionKey(p.temperature, p.relativeHumidity);
      return { label: value, value };
    }),
  ];
}

export default function StorageConditionsPage() {
  return (
    <MasterPage<StorageCondition>
      title="Storage Condition Master"
      description="Define temperature and humidity conditions for stability storage and charging."
      collectionName={COLLECTIONS.storageConditions}
      recordType="storageCondition"
      loader={listStorageConditions}
      fields={[
        {
          key: "name",
          label: "Name",
          type: "select",
          required: true,
          options: [
            { label: "Select name", value: "" },
            ...CONDITION_NAMES.map((name) => ({ label: name, value: name })),
          ],
          syncOnChange: () => ({ temperature: "" }),
        },
        {
          key: "temperature",
          label: "Temperature",
          type: "select",
          required: true,
          optionsFor: (values) => temperatureOptions(values.name),
          hint: "ICH condition for the selected name.",
        },
        {
          key: "status",
          label: "Status",
          type: "select",
          required: true,
          options: [
            { label: "Active", value: "Active" },
            { label: "Inactive", value: "Inactive" },
          ],
        },
      ]}
      mapRow={(item) => ({
        Name: item.name,
        Temperature: item.temperature,
        "Relative Humidity": item.relativeHumidity,
        Label: item.displayLabel,
        Status: item.status,
      })}
      getCreateDefaults={() => ({ status: "Active" })}
      getEditValues={(item) => ({
        temperature: conditionKey(item.temperature, item.relativeHumidity),
      })}
      validate={({ values, items, editing }) => {
        const name = values.name.trim();
        const key = values.temperature.trim();
        const preset = findPreset(name, key);
        const legacyMatch =
          !!editing &&
          editing.name.trim() === name &&
          conditionKey(editing.temperature, editing.relativeHumidity) === key;

        if (!preset && !legacyMatch) return "Select a name and a matching temperature condition.";

        const displayLabel = preset
          ? conditionKey(preset.temperature, preset.relativeHumidity)
          : key;
        const duplicate = items.some(
          (i) =>
            i.id !== editing?.id &&
            i.name.trim().toLowerCase() === name.toLowerCase() &&
            (i.displayLabel || conditionKey(i.temperature, i.relativeHumidity)).trim().toLowerCase() ===
              displayLabel.toLowerCase()
        );
        if (duplicate) return "This name and temperature combination already exists.";
        return null;
      }}
      buildPayload={(values) => {
        const name = values.name.trim();
        const key = values.temperature.trim();
        const preset = findPreset(name, key);
        if (preset) {
          return {
            name,
            temperature: preset.temperature,
            relativeHumidity: preset.relativeHumidity,
            displayLabel: conditionKey(preset.temperature, preset.relativeHumidity),
            status: values.status,
          };
        }
        const [temperature = key, relativeHumidity = ""] = key.split(" / ").map((part) => part.trim());
        return {
          name,
          temperature,
          relativeHumidity,
          displayLabel: key,
          status: values.status,
        };
      }}
    />
  );
}
