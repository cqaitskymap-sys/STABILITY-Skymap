"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { STUDY_REASON_DEFAULTS } from "@/lib/sop";
import { listStudyReasons } from "@/services/masters";
import type { StudyReason } from "@/types";

export default function StudyReasonsPage() {
  return (
    <MasterPage<StudyReason>
      title="Stability Study Reason"
      description="Configurable reasons for initiating a stability study. Do not hard-code only routine stability."
      collectionName={COLLECTIONS.studyReasons}
      recordType="studyReason"
      loader={listStudyReasons}
      fields={[
        {
          key: "name",
          label: "Reason",
          required: true,
          hint: `Examples: ${STUDY_REASON_DEFAULTS.slice(0, 3).join("; ")}`,
        },
        { key: "description", label: "Description" },
        { key: "sortOrder", label: "Sort order", type: "number" },
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
        Reason: item.name,
        Description: item.description || "—",
        Order: item.sortOrder,
        Status: item.status,
      })}
      getCreateDefaults={(items) => ({
        status: "Active",
        sortOrder: String((items.at(-1)?.sortOrder || 0) + 1),
      })}
      buildPayload={(values) => ({
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        sortOrder: Number(values.sortOrder) || 0,
        status: values.status,
      })}
    />
  );
}
