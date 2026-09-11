"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listStudyTypes } from "@/services/masters";
import type { StudyType } from "@/types";

const STUDY_TYPE_PRESETS = [
  { name: "Accelerated", code: "Acc" },
  { name: "Long Term", code: "Lt" },
  { name: "Intermediate", code: "Int" },
] as const;

function codeForName(name: string) {
  return STUDY_TYPE_PRESETS.find((p) => p.name === name)?.code || "";
}

function nameForCode(code: string) {
  return STUDY_TYPE_PRESETS.find((p) => p.code === code)?.name || "";
}

function sortOrderForName(name: string) {
  const index = STUDY_TYPE_PRESETS.findIndex((p) => p.name === name);
  return index >= 0 ? index + 1 : 0;
}

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
          type: "select",
          required: true,
          options: [
            { label: "Select name", value: "" },
            ...STUDY_TYPE_PRESETS.map((p) => ({ label: p.name, value: p.name })),
          ],
          syncOnChange: (name) => ({ code: codeForName(name) }),
        },
        {
          key: "code",
          label: "Code",
          type: "select",
          required: true,
          options: [
            { label: "Select code", value: "" },
            ...STUDY_TYPE_PRESETS.map((p) => ({ label: p.code, value: p.code })),
          ],
          hint: "Acc, Lt, or Int — matches the selected name.",
          syncOnChange: (code) => ({ name: nameForCode(code) }),
        },
        { key: "description", label: "Description", placeholder: "Optional notes" },
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
        Status: item.status,
      })}
      getCreateDefaults={() => ({ status: "Active" })}
      validate={({ values, items, editing }) => {
        const name = values.name.trim();
        const code = values.code.trim();

        if (!/^[A-Z0-9][A-Z0-9_-]{0,15}$/i.test(code)) {
          return "Code must be 1–16 characters: letters, numbers, hyphen, or underscore.";
        }
        const duplicateName = items.some(
          (i) => i.id !== editing?.id && i.name.trim().toLowerCase() === name.toLowerCase()
        );
        if (duplicateName) return "A study type with this name already exists.";
        const duplicateCode = items.some(
          (i) => i.id !== editing?.id && i.code.trim().toUpperCase() === code.toUpperCase()
        );
        if (duplicateCode) return "A study type with this code already exists.";
        return null;
      }}
      buildPayload={(values, isCreate) => ({
        name: values.name.trim(),
        code: values.code.trim(),
        description: values.description.trim() || undefined,
        sortOrder: sortOrderForName(values.name.trim()),
        status: values.status,
        ...(isCreate ? { defaultPullPointIds: [] } : {}),
      })}
    />
  );
}
