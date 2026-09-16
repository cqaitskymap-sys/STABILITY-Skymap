"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listPackSizes } from "@/services/masters";
import type { PackSize } from "@/types";

export default function PackSizesPage() {
  return (
    <MasterPage<PackSize>
      title="Pack Size Master"
      description="Configurable pack sizes used on the Daily Collection Record (for example 40 MG, 10 ML). Do not hard-code a fixed list."
      collectionName={COLLECTIONS.packSizes}
      recordType="packSize"
      loader={listPackSizes}
      fields={[
        { key: "name", label: "Pack Size", required: true, placeholder: "e.g. 10 ML" },
        { key: "code", label: "Code" },
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
        "Pack Size": item.name,
        Code: item.code || "—",
        Status: item.status,
      })}
      getCreateDefaults={() => ({ status: "Active" })}
      validate={({ values, items, editing }) => {
        const name = values.name.trim();
        if (!name) return "Pack size is required.";
        if (items.some((item) => item.id !== editing?.id && item.name.trim().toLowerCase() === name.toLowerCase())) {
          return "This pack size already exists.";
        }
        return null;
      }}
      buildPayload={(values) => ({
        name: values.name.trim(),
        code: values.code.trim() || undefined,
        status: values.status,
      })}
    />
  );
}
