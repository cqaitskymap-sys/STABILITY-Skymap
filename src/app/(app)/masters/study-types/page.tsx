"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listStudyTypes } from "@/services/masters";
import type { StudyType } from "@/types";

export default function StudyTypesPage() {
  return (
    <MasterPage<StudyType>
      title="Study Type Master"
      description="Configure stability study types used across charging, studies, and reports."
      collectionName={COLLECTIONS.studyTypes}
      recordType="studyType"
      loader={listStudyTypes}
      fields={[
        {
          key: "name",
          label: "Name",
          required: true,
          placeholder: "e.g. Accelerated",
        },
        {
          key: "code",
          label: "Code",
          required: true,
          placeholder: "e.g. ACC",
          hint: "Short unique code (letters, numbers, hyphen).",
        },
        { key: "description", label: "Description", placeholder: "Optional notes" },
        {
          key: "sortOrder",
          label: "Sort Order",
          type: "number",
          required: true,
          hint: "Lower numbers appear first in selectors.",
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
        Code: item.code,
        Description: item.description || "—",
        "Sort Order": item.sortOrder,
        Status: item.status,
      })}
      getCreateDefaults={(items) => {
        const maxSort = items.reduce((m, i) => Math.max(m, Number(i.sortOrder) || 0), 0);
        return { sortOrder: String(maxSort + 1), status: "Active" };
      }}
      validate={({ values, items, editing }) => {
        const name = values.name.trim();
        const code = values.code.trim().toUpperCase();
        const sortOrder = Number(values.sortOrder);

        if (!/^[A-Z0-9][A-Z0-9_-]{0,15}$/i.test(code)) {
          return "Code must be 1–16 characters: letters, numbers, hyphen, or underscore.";
        }
        if (!Number.isFinite(sortOrder) || sortOrder < 0) {
          return "Sort order must be zero or a positive number.";
        }
        const duplicateName = items.some(
          (i) => i.id !== editing?.id && i.name.trim().toLowerCase() === name.toLowerCase()
        );
        if (duplicateName) return "A study type with this name already exists.";
        const duplicateCode = items.some(
          (i) => i.id !== editing?.id && i.code.trim().toUpperCase() === code
        );
        if (duplicateCode) return "A study type with this code already exists.";
        return null;
      }}
      buildPayload={(values, isCreate) => ({
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        description: values.description.trim() || undefined,
        sortOrder: Number(values.sortOrder) || 0,
        status: values.status,
        ...(isCreate ? { defaultPullPointIds: [] } : {}),
      })}
    />
  );
}
