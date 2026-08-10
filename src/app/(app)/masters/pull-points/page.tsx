"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listPullPoints } from "@/services/masters";
import type { PullPointMaster } from "@/types";

export default function PullPointsPage() {
  return (
    <MasterPage<PullPointMaster>
      title="Pull Point Master"
      description="Maintain standard pull intervals used when charging studies."
      collectionName={COLLECTIONS.pullPoints}
      recordType="pullPoint"
      loader={listPullPoints}
      fields={[
        { key: "code", label: "Code", required: true, placeholder: "3M" },
        { key: "label", label: "Label", required: true, placeholder: "3 Months" },
        { key: "months", label: "Months", type: "number", required: true },
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
        Code: item.code,
        Label: item.label,
        Months: item.months,
        "Sort Order": item.sortOrder,
        Status: item.status,
      })}
      buildPayload={(values, isCreate) => ({
        code: values.code.trim(),
        label: values.label.trim(),
        months: Number(values.months) || 0,
        sortOrder: Number(values.sortOrder) || 0,
        status: values.status,
        ...(isCreate ? { studyTypeIds: [] } : {}),
      })}
    />
  );
}
