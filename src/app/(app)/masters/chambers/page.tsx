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
        {
          key: "chamberId",
          label: "Chamber ID",
          required: true,
          placeholder: "CH-001",
          hint: "Unique business ID used in reports and labels.",
        },
        {
          key: "chamberName",
          label: "Chamber Name",
          required: true,
          placeholder: "e.g. Chamber A – 25/60",
        },
        {
          key: "chamberType",
          label: "Chamber Type",
          required: true,
          placeholder: "Walk-in / Reach-in / Photostability",
        },
        {
          key: "temperature",
          label: "Temperature",
          required: true,
          placeholder: "25°C ± 2°C",
        },
        {
          key: "relativeHumidity",
          label: "Relative Humidity",
          required: true,
          placeholder: "60% ± 5% RH",
        },
        {
          key: "capacity",
          label: "Capacity",
          type: "number",
          required: true,
          hint: "Total sample units the chamber can hold. Used capacity is updated by charging/withdrawals.",
        },
        {
          key: "location",
          label: "Physical Location",
          required: true,
          placeholder: "e.g. Stability Area / Block B",
        },
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
      mapRow={(item) => {
        const used = Number(item.usedCapacity) || 0;
        const capacity = Number(item.capacity) || 0;
        const free = Math.max(0, capacity - used);
        return {
          "Chamber ID": item.chamberId,
          Name: item.chamberName,
          Type: item.chamberType,
          Condition: `${item.temperature} / ${item.relativeHumidity}`,
          Location: item.location,
          Capacity: capacity,
          Used: used,
          Free: free,
          "Utilization %": roundPct(used, capacity),
          Status: item.status,
        };
      }}
      getCreateDefaults={() => ({
        status: "Active",
        capacity: "100",
        chamberType: "Walk-in",
      })}
      validate={({ values, items, editing }) => {
        const chamberId = values.chamberId.trim().toUpperCase();
        const chamberName = values.chamberName.trim();
        const capacity = Number(values.capacity);
        const used = Number(editing?.usedCapacity) || 0;

        if (!/^[A-Z0-9][A-Z0-9_-]{1,23}$/i.test(chamberId)) {
          return "Chamber ID must be 2–24 characters: letters, numbers, hyphen, or underscore.";
        }
        if (chamberName.length < 2) return "Chamber name must be at least 2 characters.";
        if (!Number.isFinite(capacity) || capacity <= 0) {
          return "Capacity must be greater than zero.";
        }
        if (editing && capacity < used) {
          return `Capacity cannot be less than current used capacity (${used}).`;
        }

        const duplicateId = items.some(
          (i) => i.id !== editing?.id && i.chamberId.trim().toUpperCase() === chamberId
        );
        if (duplicateId) return "A chamber with this Chamber ID already exists.";

        const duplicateName = items.some(
          (i) =>
            i.id !== editing?.id &&
            i.chamberName.trim().toLowerCase() === chamberName.toLowerCase()
        );
        if (duplicateName) return "A chamber with this name already exists.";

        return null;
      }}
      buildPayload={(values, isCreate) => ({
        chamberId: values.chamberId.trim().toUpperCase(),
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
