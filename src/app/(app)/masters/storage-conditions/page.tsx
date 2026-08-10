"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listStorageConditions } from "@/services/masters";
import type { StorageCondition } from "@/types";

export default function StorageConditionsPage() {
  return (
    <MasterPage<StorageCondition>
      title="Storage Condition Master"
      description="Define temperature and humidity conditions for stability storage."
      collectionName={COLLECTIONS.storageConditions}
      recordType="storageCondition"
      loader={listStorageConditions}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "temperature", label: "Temperature", required: true, placeholder: "25°C" },
        { key: "relativeHumidity", label: "Relative Humidity", required: true, placeholder: "60%" },
        { key: "displayLabel", label: "Display Label", placeholder: "Auto from temperature / RH" },
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
      buildPayload={(values) => {
        const temperature = values.temperature.trim();
        const relativeHumidity = values.relativeHumidity.trim();
        const displayLabel =
          values.displayLabel.trim() || `${temperature} / ${relativeHumidity}`;
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
