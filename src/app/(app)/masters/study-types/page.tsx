"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listStudyTypes } from "@/services/masters";
import type { StudyType } from "@/types";

export default function StudyTypesPage() {
  return (
    <MasterPage<StudyType>
      title="Study Type Master"
      description="Configure stability study types used across charging and withdrawals."
      collectionName={COLLECTIONS.studyTypes}
      recordType="studyType"
      loader={listStudyTypes}
      fields={[
        { key: "name", label: "Name", required: true },
        { key: "code", label: "Code", required: true },
        { key: "description", label: "Description" },
        { key: "sortOrder", label: "Sort Order", type: "number", required: true },
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
        "Sort Order": item.sortOrder,
        Status: item.status,
      })}
      buildPayload={(values, isCreate) => ({
        name: values.name.trim(),
        code: values.code.trim(),
        description: values.description.trim(),
        sortOrder: Number(values.sortOrder) || 0,
        status: values.status,
        ...(isCreate ? { defaultPullPointIds: [] } : {}),
      })}
    />
  );
}
