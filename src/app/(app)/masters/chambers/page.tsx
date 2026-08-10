"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { roundPct } from "@/lib/utils";
import { listChambers } from "@/services/masters";
import type { Chamber } from "@/types";

export default function ChambersPage() {
  return (
    <MasterPage<Chamber>
      title="Chamber Master"
      description="Manage stability chambers, capacity, and operating conditions."
      collectionName={COLLECTIONS.chambers}
      recordType="chamber"
      loader={listChambers}
      fields={[
        { key: "chamberId", label: "Chamber ID", required: true, placeholder: "CH-001" },
        { key: "chamberName", label: "Chamber Name", required: true },
        { key: "chamberType", label: "Chamber Type", required: true, placeholder: "Walk-in" },
        { key: "temperature", label: "Temperature", required: true, placeholder: "25°C" },
        { key: "relativeHumidity", label: "Relative Humidity", required: true, placeholder: "60%" },
        { key: "capacity", label: "Capacity", type: "number", required: true },
        { key: "location", label: "Location", required: true },
        {
          key: "status",
          label: "Status",
          type: "select",
          required: true,
          options: [
            { label: "Active", value: "Active" },
            { label: "Under Maintenance", value: "Under Maintenance" },
            { label: "Inactive", value: "Inactive" },
          ],
        },
      ]}
      mapRow={(item) => ({
        "Chamber ID": item.chamberId,
        Name: item.chamberName,
        Condition: `${item.temperature} / ${item.relativeHumidity}`,
        Capacity: item.capacity,
        Used: item.usedCapacity ?? 0,
        "Utilization %": roundPct(item.usedCapacity ?? 0, item.capacity),
        Status: item.status,
      })}
      buildPayload={(values, isCreate) => ({
        chamberId: values.chamberId.trim(),
        chamberName: values.chamberName.trim(),
        chamberType: values.chamberType.trim(),
        temperature: values.temperature.trim(),
        relativeHumidity: values.relativeHumidity.trim(),
        capacity: Number(values.capacity) || 0,
        location: values.location.trim(),
        status: values.status,
        ...(isCreate ? { usedCapacity: 0 } : {}),
      })}
    />
  );
}
