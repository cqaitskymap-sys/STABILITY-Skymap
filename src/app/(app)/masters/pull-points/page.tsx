"use client";

import { useMemo } from "react";
import Link from "next/link";
import { MasterPage } from "@/components/masters/master-page";
import { Button, Card, ErrorState, LoadingSkeleton, PageHeader } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listPullPoints, listStudyTypes } from "@/services/masters";
import type { PullPointMaster, StudyType } from "@/types";

const PULL_POINT_PRESETS = [
  { code: "0M", months: 0, label: "Initial (0 Month)" },
  { code: "1M", months: 1, label: "1 Month" },
  { code: "3M", months: 3, label: "3 Months" },
  { code: "6M", months: 6, label: "6 Months" },
  { code: "9M", months: 9, label: "9 Months" },
  { code: "12M", months: 12, label: "12 Months" },
  { code: "18M", months: 18, label: "18 Months" },
  { code: "24M", months: 24, label: "24 Months" },
  { code: "36M", months: 36, label: "36 Months" },
] as const;

const STUDY_TYPE_CODES = ["ACC", "LT", "INT"] as const;

function parseIds(raw: string) {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function presetForCode(code: string) {
  return PULL_POINT_PRESETS.find((p) => p.code === code.toUpperCase());
}

function matchesStudyTypeCode(studyType: StudyType, code: string) {
  const sc = (studyType.code || "").trim().toUpperCase();
  const name = (studyType.name || "").trim().toUpperCase();
  if (sc === code) return true;
  if (code === "ACC") return sc === "ACC" || name.includes("ACCELERATED");
  if (code === "LT") return sc === "LT" || name.includes("LONG TERM");
  if (code === "INT") return sc === "INT" || name.includes("INTERMEDIATE");
  return false;
}

function resolveStudyType(code: string, studyTypes: StudyType[]) {
  const active = studyTypes.filter((s) => s.status === "Active");
  return active.find((s) => matchesStudyTypeCode(s, code)) || studyTypes.find((s) => matchesStudyTypeCode(s, code));
}

function displayCodeForStudyType(studyType: StudyType) {
  return STUDY_TYPE_CODES.find((code) => matchesStudyTypeCode(studyType, code)) || studyType.code || studyType.name;
}

function studyTypeLabel(ids: string[] | undefined, studyTypes: StudyType[]) {
  if (!ids?.length) return "All study types";
  const names = ids
    .map((id) => {
      const st = studyTypes.find((s) => s.id === id);
      return st ? displayCodeForStudyType(st) : id;
    })
    .filter(Boolean);
  return names.length ? names.join(", ") : "All study types";
}

export default function PullPointsPage() {
  const studyTypes = useAsync(listStudyTypes, []);
  const allStudyTypes = useMemo(() => studyTypes.data || [], [studyTypes.data]);

  const studyTypeOptions = useMemo(
    () =>
      STUDY_TYPE_CODES.flatMap((code) => {
        const match = resolveStudyType(code, allStudyTypes);
        return match ? [{ label: code, value: match.id }] : [];
      }),
    [allStudyTypes]
  );

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
      {studyTypeOptions.length === 0 ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No ACC, LT, or INT study types found. Pull points will apply to all types until you configure{" "}
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
            type: "select",
            required: true,
            options: [
              { label: "Select code", value: "" },
              ...PULL_POINT_PRESETS.map((p) => ({ label: p.code, value: p.code })),
            ],
            hint: "Interval shown in charging allocations.",
          },
          {
            key: "studyTypeIds",
            label: "Study Types",
            type: "multiselect",
            options: studyTypeOptions,
            hint: "ACC, LT, or INT. Leave all unchecked to allow this pull point for every study type.",
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
          Status: item.status,
        })}
        getCreateDefaults={() => ({
          status: "Active",
          studyTypeIds: "",
        })}
        validate={({ values, items, editing }) => {
          const code = values.code.trim().toUpperCase();
          const preset = presetForCode(code);
          const legacyMatch = !!editing && editing.code.trim().toUpperCase() === code;

          if (!preset && !legacyMatch) return "Select a pull point code.";

          const duplicateCode = items.some(
            (i) => i.id !== editing?.id && i.code.trim().toUpperCase() === code
          );
          if (duplicateCode) return "A pull point with this code already exists.";
          return null;
        }}
        buildPayload={(values) => {
          const code = values.code.trim().toUpperCase();
          const preset = presetForCode(code);
          return {
            code: preset?.code || code,
            label: preset?.label || `${code}`,
            months: preset?.months || Number(code.replace(/\D/g, "")) || 0,
            sortOrder: preset?.months || 0,
            status: values.status,
            studyTypeIds: parseIds(values.studyTypeIds || ""),
          };
        }}
      />
    </div>
  );
}
