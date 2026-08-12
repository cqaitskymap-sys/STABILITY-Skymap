"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MasterPage } from "@/components/masters/master-page";
import { Button, Card, ErrorState, LoadingSkeleton, PageHeader } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listPullPoints, listStudyTypes } from "@/services/masters";
import type { PullPointMaster, StudyType } from "@/types";

function parseIds(raw: string) {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function studyTypeLabel(ids: string[] | undefined, studyTypes: StudyType[]) {
  if (!ids?.length) return "All study types";
  const names = ids
    .map((id) => studyTypes.find((s) => s.id === id)?.name || id)
    .filter(Boolean);
  return names.length ? names.join(", ") : "All study types";
}

export default function PullPointsPage() {
  const studyTypes = useAsync(listStudyTypes, []);

  const activeStudyTypeOptions = useMemo(
    () =>
      (studyTypes.data || [])
        .filter((s) => s.status === "Active")
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name))
        .map((s) => ({ label: `${s.name} (${s.code})`, value: s.id })),
    [studyTypes.data]
  );

  const allStudyTypes = studyTypes.data || [];

  if (studyTypes.loading) {
    return (
      <div>
        <PageHeader
          title="Pull Point Master"
          description="Maintain standard pull intervals used when charging studies."
        />
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  if (studyTypes.error) {
    return (
      <div>
        <PageHeader
          title="Pull Point Master"
          description="Maintain standard pull intervals used when charging studies."
        />
        <Card>
          <ErrorState message={studyTypes.error} onRetry={studyTypes.reload} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      {activeStudyTypeOptions.length === 0 ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No active study types found. Pull points will apply to all types until you configure{" "}
          <Link href="/masters/study-types" className="font-medium underline">
            Study Type Master
          </Link>
          .
          <div className="mt-2">
            <Link href="/masters/study-types">
              <Button size="sm" variant="outline">
                Open Study Types
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}

      <MasterPage<PullPointMaster>
        title="Pull Point Master"
        description="Maintain standard pull intervals used when charging studies. Leave Study Types empty to apply to all."
        collectionName={COLLECTIONS.pullPoints}
        recordType="pullPoint"
        loader={listPullPoints}
        fields={[
          {
            key: "code",
            label: "Code",
            required: true,
            placeholder: "e.g. 3M",
            hint: "Short unique code shown in charging allocations.",
          },
          {
            key: "label",
            label: "Label",
            required: true,
            placeholder: "e.g. 3 Months",
          },
          {
            key: "months",
            label: "Months",
            type: "number",
            required: true,
            hint: "Months after charging date for this pull.",
          },
          {
            key: "sortOrder",
            label: "Sort Order",
            type: "number",
            required: true,
            hint: "Lower numbers appear first.",
          },
          {
            key: "studyTypeIds",
            label: "Study Types",
            type: "multiselect",
            options: activeStudyTypeOptions,
            hint: "Leave all unchecked to allow this pull point for every study type.",
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
          Code: item.code,
          Label: item.label,
          Months: item.months,
          "Study Types": studyTypeLabel(item.studyTypeIds, allStudyTypes),
          "Sort Order": item.sortOrder,
          Status: item.status,
        })}
        getCreateDefaults={(items) => {
          const maxSort = items.reduce((m, i) => Math.max(m, Number(i.sortOrder) || 0), 0);
          return {
            sortOrder: String(maxSort + 1),
            status: "Active",
            months: "1",
            studyTypeIds: "",
          };
        }}
        validate={({ values, items, editing }) => {
          const code = values.code.trim().toUpperCase();
          const label = values.label.trim();
          const months = Number(values.months);
          const sortOrder = Number(values.sortOrder);

          if (!/^[A-Z0-9][A-Z0-9_-]{0,15}$/i.test(code)) {
            return "Code must be 1–16 characters: letters, numbers, hyphen, or underscore.";
          }
          if (label.length < 1) return "Label is required.";
          if (!Number.isFinite(months) || months <= 0) {
            return "Months must be greater than zero.";
          }
          if (!Number.isFinite(sortOrder) || sortOrder < 0) {
            return "Sort order must be zero or a positive number.";
          }
          const duplicateCode = items.some(
            (i) => i.id !== editing?.id && i.code.trim().toUpperCase() === code
          );
          if (duplicateCode) return "A pull point with this code already exists.";
          return null;
        }}
        buildPayload={(values) => ({
          code: values.code.trim().toUpperCase(),
          label: values.label.trim(),
          months: Number(values.months) || 0,
          sortOrder: Number(values.sortOrder) || 0,
          status: values.status,
          studyTypeIds: parseIds(values.studyTypeIds || ""),
        })}
      />
    </div>
  );
}
