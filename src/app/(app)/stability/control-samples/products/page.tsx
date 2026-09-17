"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listControlProducts } from "@/services/masters";
import type { Product } from "@/types";

export default function ControlSampleProductsPage() {
  return (
    <MasterPage<Product>
      title="Control Sample Product Master"
      description="Products used only for control sample collection, register, and quantity master. These are not shared with stability inventory."
      collectionName={COLLECTIONS.controlSampleProducts}
      recordType="controlSampleProduct"
      managePermission={["control.perform", "masters.manage"]}
      loader={listControlProducts}
      fields={[
        { key: "productName", label: "Product Name", required: true },
        { key: "genericName", label: "Generic Name" },
        { key: "strength", label: "Strength" },
        { key: "dosageForm", label: "Dosage Form" },
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
        Name: item.productName,
        Strength: item.strength || "—",
        Form: item.dosageForm || "—",
        Status: item.status,
      })}
      buildPayload={(values) => ({
        productName: values.productName.trim(),
        genericName: values.genericName.trim() || undefined,
        strength: values.strength.trim() || undefined,
        dosageForm: values.dosageForm.trim() || undefined,
        status: values.status,
      })}
    />
  );
}
