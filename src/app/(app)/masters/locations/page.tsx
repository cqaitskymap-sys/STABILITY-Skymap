"use client";

import { MasterPage } from "@/components/masters/master-page";
import { ErrorState, LoadingSkeleton } from "@/components/ui";
import { COLLECTIONS } from "@/lib/firebase/config";
import { useAsync } from "@/hooks/useAsync";
import { buildLocationLabel, listChambers, listLocations } from "@/services/masters";
import type { StorageLocation } from "@/types";

export default function LocationsPage() {
  const { data: chambers, loading, error, reload } = useAsync(listChambers, []);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const chamberOptions = (chambers || []).map((c) => ({
    label: `${c.chamberId} — ${c.chamberName}`,
    value: c.id,
  }));

  return (
    <MasterPage<StorageLocation>
      title="Storage Location Master"
      description="Define rack, shelf, and position slots within chambers."
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
            : [{ label: "No chambers available", value: "" }],
        },
        { key: "rack", label: "Rack", required: true },
        { key: "shelf", label: "Shelf", required: true },
        { key: "position", label: "Position", required: true },
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
      buildPayload={(values) => {
        const chamber = (chambers || []).find((c) => c.id === values.chamberId);
        const chamberName = chamber?.chamberName || "";
        return {
          chamberId: values.chamberId,
          chamberName,
          rack: values.rack.trim(),
          shelf: values.shelf.trim(),
          position: values.position.trim(),
          label: buildLocationLabel(chamberName, values.rack.trim(), values.shelf.trim(), values.position.trim()),
          status: values.status,
        };
      }}
    />
  );
}
