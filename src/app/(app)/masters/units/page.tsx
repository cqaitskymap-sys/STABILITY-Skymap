"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listUnits } from "@/services/masters";
import type { Unit } from "@/types";

export default function UnitsPage() {
  return (
    <MasterPage<Unit>
      title="Unit Master"
      description="Maintain quantity units used for sample charging, withdrawals, and inventory."
      collectionName={COLLECTIONS.units}
      recordType="unit"
      loader={listUnits}
      fields={[
        {
          key: "name",
          label: "Name",
          required: true,
          placeholder: "e.g. Bottle",
          hint: "Full unit name shown in selectors.",
        },
        {
          key: "abbreviation",
          label: "Abbreviation",
          required: true,
          placeholder: "e.g. bot",
          hint: "Short form stored on samples (e.g. bot, tab, vial).",
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
        Abbreviation: item.abbreviation,
        Status: item.status,
      })}
      getCreateDefaults={() => ({ status: "Active" })}
      validate={({ values, items, editing }) => {
        const name = values.name.trim();
        const abbreviation = values.abbreviation.trim();

        if (name.length < 1) return "Name is required.";
        if (abbreviation.length < 1) return "Abbreviation is required.";
        if (abbreviation.length > 12) {
          return "Abbreviation must be 12 characters or fewer.";
        }
        if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,11}$/.test(abbreviation)) {
          return "Abbreviation must start with a letter/number; only letters, numbers, dot, hyphen, underscore.";
        }

        const duplicateName = items.some(
          (i) => i.id !== editing?.id && i.name.trim().toLowerCase() === name.toLowerCase()
        );
        if (duplicateName) return "A unit with this name already exists.";

        const duplicateAbbr = items.some(
          (i) =>
            i.id !== editing?.id &&
            i.abbreviation.trim().toLowerCase() === abbreviation.toLowerCase()
        );
        if (duplicateAbbr) return "A unit with this abbreviation already exists.";

        return null;
      }}
      buildPayload={(values) => ({
        name: values.name.trim(),
        abbreviation: values.abbreviation.trim(),
        status: values.status,
      })}
    />
  );
}
