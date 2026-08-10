"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listUnits } from "@/services/masters";
import type { Unit } from "@/types";

export default function UnitsPage() {
  return (
    <MasterPage<Unit>
      title="Unit Master"
      description="Maintain quantity units used for sample inventory."
      collectionName={COLLECTIONS.units}
      recordType="unit"
      loader={listUnits}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "abbreviation", label: "Abbreviation", required: true },
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
        Abbreviation: item.abbreviation,
        Status: item.status,
      })}
      buildPayload={(values) => ({
        name: values.name.trim(),
        abbreviation: values.abbreviation.trim(),
        status: values.status,
      })}
    />
  );
}
