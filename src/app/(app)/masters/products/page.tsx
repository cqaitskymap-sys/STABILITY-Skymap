"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listProducts } from "@/services/masters";
import type { Product } from "@/types";

export default function ProductsPage() {
  return (
    <MasterPage<Product>
      title="Product Master"
      description="Maintain products used when creating stability studies and charging samples."
      collectionName={COLLECTIONS.products}
      recordType="product"
      loader={listProducts}
      fields={[
        { key: "productName", label: "Product Name", required: true },
        { key: "productCode", label: "Product Code" },
        { key: "genericName", label: "Generic Name" },
        { key: "labelClaim", label: "Label Claim" },
        { key: "stpNumber", label: "STP Number" },
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
        Code: item.productCode || "—",
        Strength: item.strength || "—",
        Form: item.dosageForm || "—",
        Status: item.status,
      })}
      buildPayload={(values) => ({
        productName: values.productName.trim(),
        productCode: values.productCode.trim() || undefined,
        genericName: values.genericName.trim() || undefined,
        labelClaim: values.labelClaim.trim() || undefined,
        stpNumber: values.stpNumber.trim() || undefined,
        strength: values.strength.trim() || undefined,
        dosageForm: values.dosageForm.trim() || undefined,
        status: values.status,
      })}
    />
  );
}
