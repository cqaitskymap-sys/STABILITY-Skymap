"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listStorageConditions } from "@/services/masters";
import type { StorageCondition } from "@/types";

function buildDisplayLabel(temperature: string, relativeHumidity: string) {
  return `${temperature} / ${relativeHumidity}`;
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
          required: true,
          placeholder: "e.g. Long Term 25/60",
        },
        {
          key: "temperature",
          label: "Temperature",
          required: true,
          placeholder: "25°C ± 2°C",
          hint: "As shown on chamber / protocol labels.",
        },
        {
          key: "relativeHumidity",
          label: "Relative Humidity",
          required: true,
          placeholder: "60% ± 5% RH",
        },
        {
          key: "displayLabel",
          label: "Display Label",
          placeholder: "Auto: Temperature / RH",
          hint: "Leave blank to auto-build from temperature and RH.",
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
      validate={({ values, items, editing }) => {
        const name = values.name.trim();
        const temperature = values.temperature.trim();
        const relativeHumidity = values.relativeHumidity.trim();
        const displayLabel =
          values.displayLabel.trim() || buildDisplayLabel(temperature, relativeHumidity);

        if (name.length < 2) return "Name must be at least 2 characters.";
        if (!temperature) return "Temperature is required.";
        if (!relativeHumidity) return "Relative humidity is required.";

        const duplicateName = items.some(
          (i) => i.id !== editing?.id && i.name.trim().toLowerCase() === name.toLowerCase()
        );
        if (duplicateName) return "A storage condition with this name already exists.";

        const duplicateLabel = items.some(
          (i) =>
            i.id !== editing?.id &&
            (i.displayLabel || "").trim().toLowerCase() === displayLabel.toLowerCase()
        );
        if (duplicateLabel) {
          return "A storage condition with this display label already exists.";
        }

        return null;
      }}
      buildPayload={(values) => {
        const temperature = values.temperature.trim();
        const relativeHumidity = values.relativeHumidity.trim();
        const displayLabel =
          values.displayLabel.trim() || buildDisplayLabel(temperature, relativeHumidity);
        return {
          name: values.name.trim(),
          temperature,
          relativeHumidity,
          displayLabel,
          status: values.status,
        };
      }}
    />
  );
}
