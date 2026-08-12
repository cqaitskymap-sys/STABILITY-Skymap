"use client";

import Link from "next/link";
import { useMemo } from "react";
import { MasterPage } from "@/components/masters/master-page";
import { Button, Card, ErrorState, LoadingSkeleton, PageHeader } from "@/components/ui";
import { COLLECTIONS } from "@/lib/firebase/config";
import { useAsync } from "@/hooks/useAsync";
import { buildLocationLabel, listChambers, listLocations } from "@/services/masters";
import type { StorageLocation } from "@/types";

export default function LocationsPage() {
  const chambers = useAsync(listChambers, []);

  const allChambers = chambers.data || [];

  const chamberOptions = useMemo(
    () =>
      allChambers.map((c) => ({
        label: `${c.chamberId} — ${c.chamberName}${
          c.status === "Inactive"
            ? " (Inactive)"
            : c.status === "Under Maintenance"
              ? " (Maintenance)"
              : ""
        }`,
        value: c.id,
      })),
    [allChambers]
  );

  const firstActiveChamberId =
    allChambers.find((c) => c.status === "Active")?.id ||
    allChambers.find((c) => c.status !== "Inactive")?.id ||
    "";

  if (chambers.loading) {
    return (
      <div>
        <PageHeader
          title="Storage Location Master"
          description="Define rack, shelf, and position slots within chambers."
        />
        <LoadingSkeleton rows={4} />
      </div>
    );
  }

  if (chambers.error) {
    return (
      <div>
        <PageHeader
          title="Storage Location Master"
          description="Define rack, shelf, and position slots within chambers."
        />
        <Card>
          <ErrorState message={chambers.error} onRetry={chambers.reload} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      {allChambers.filter((c) => c.status !== "Inactive").length === 0 ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No active chambers available. Create a chamber first, then add storage locations.
          <div className="mt-2">
            <Link href="/masters/chambers">
              <Button size="sm" variant="outline">
                Open Chamber Master
              </Button>
            </Link>
          </div>
        </Card>
      ) : null}

      <MasterPage<StorageLocation>
        title="Storage Location Master"
        description="Define rack, shelf, and position slots within chambers for sample placement and movement."
        collectionName={COLLECTIONS.storageLocations}
        recordType="storageLocation"
        loader={listLocations}
        fields={[
          {
            key: "chamberId",
            label: "Chamber",
            type: "select",
            required: true,
            options: chamberOptions.length
              ? chamberOptions
              : [{ label: "No chambers available — create one first", value: "" }],
            hint: "Prefer Active chambers. Inactive chambers remain selectable only to edit existing slots.",
          },
          {
            key: "rack",
            label: "Rack",
            required: true,
            placeholder: "e.g. R1",
          },
          {
            key: "shelf",
            label: "Shelf",
            required: true,
            placeholder: "e.g. S2",
          },
          {
            key: "position",
            label: "Position",
            required: true,
            placeholder: "e.g. P3",
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
          Label: item.label,
          Chamber: item.chamberName,
          Rack: item.rack,
          Shelf: item.shelf,
          Position: item.position,
          Status: item.status,
        })}
        getCreateDefaults={() => ({
          status: "Active",
          chamberId: firstActiveChamberId,
        })}
        validate={({ values, items, editing }) => {
          const chamberId = values.chamberId.trim();
          const rack = values.rack.trim();
          const shelf = values.shelf.trim();
          const position = values.position.trim();

          if (!chamberId) return "Select a chamber.";
          const chamber = allChambers.find((c) => c.id === chamberId);
          if (!chamber) return "Selected chamber was not found.";
          if (!editing && chamber.status === "Inactive") {
            return "Cannot create locations in an inactive chamber.";
          }

          if (!rack || !shelf || !position) {
            return "Rack, shelf, and position are all required.";
          }

          const duplicateSlot = items.some(
            (i) =>
              i.id !== editing?.id &&
              i.chamberId === chamberId &&
              i.rack.trim().toLowerCase() === rack.toLowerCase() &&
              i.shelf.trim().toLowerCase() === shelf.toLowerCase() &&
              i.position.trim().toLowerCase() === position.toLowerCase()
          );
          if (duplicateSlot) {
            return "This rack / shelf / position already exists in the selected chamber.";
          }

          return null;
        }}
        buildPayload={(values) => {
          const chamber = allChambers.find((c) => c.id === values.chamberId);
          const chamberName = chamber?.chamberName || "";
          const rack = values.rack.trim();
          const shelf = values.shelf.trim();
          const position = values.position.trim();
          return {
            chamberId: values.chamberId,
            chamberName,
            rack,
            shelf,
            position,
            label: buildLocationLabel(chamberName, rack, shelf, position),
            status: values.status,
          };
        }}
      />
    </div>
  );
}
