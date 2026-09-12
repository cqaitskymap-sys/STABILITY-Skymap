"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listPackagingMaterials } from "@/services/masters";
import type { PackagingMaterial } from "@/types";

export default function PackagingPage() {
  return (
    <MasterPage<PackagingMaterial>
      title="Packaging / Container Closure"
      description="Primary, secondary, and container-closure materials used on stability studies."
      collectionName={COLLECTIONS.packagingMaterials}
      recordType="packagingMaterial"
      loader={listPackagingMaterials}
      fields={[
        {
          key: "kind",
          label: "Type",
          type: "select",
          required: true,
          options: [
            { label: "Primary", value: "Primary" },
            { label: "Secondary", value: "Secondary" },
            { label: "Container Closure", value: "Container Closure" },
          ],
        },
        { key: "material", label: "Material", required: true },
        { key: "supplier", label: "Supplier" },
        { key: "arNumber", label: "AR No." },
        { key: "approvedAr", label: "Approved AR" },
        { key: "packSize", label: "Pack Size" },
        { key: "description", label: "Packaging description" },
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
        Type: item.kind,
        Material: item.material,
        Supplier: item.supplier || "—",
        "AR No.": item.arNumber || "—",
        "Pack Size": item.packSize || "—",
        Status: item.status,
      })}
      getCreateDefaults={() => ({ status: "Active", kind: "Primary" })}
      buildPayload={(values) => ({
        kind: values.kind,
        material: values.material.trim(),
        supplier: values.supplier.trim() || undefined,
        arNumber: values.arNumber.trim() || undefined,
        approvedAr: values.approvedAr.trim() || undefined,
        packSize: values.packSize.trim() || undefined,
        description: values.description.trim() || undefined,
        status: values.status,
      })}
    />
  );
}
