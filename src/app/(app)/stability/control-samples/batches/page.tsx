"use client";

import { MasterPage } from "@/components/masters/master-page";
import { Button, EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui";
import { COLLECTIONS } from "@/lib/firebase/config";
import { useAsync } from "@/hooks/useAsync";
import { listControlBatches, listControlProducts } from "@/services/masters";
import type { Batch } from "@/types";

export default function ControlSampleBatchesPage() {
  const products = useAsync(listControlProducts, []);

  if (products.loading) return <LoadingSkeleton rows={6} />;
  if (products.error) return <ErrorState message={products.error} onRetry={products.reload} />;

  const activeProducts = (products.data || []).filter((p) => p.status === "Active");
  if (!activeProducts.length) {
    return (
      <EmptyState
        title="Add a control sample product first"
        description="Control sample batches belong to a control sample product. They are not linked to stability inventory products."
        action={
          <Button href="/stability/control-samples/products">Go to Control Sample Products</Button>
        }
      />
    );
  }

  return (
    <MasterPage<Batch>
      title="Control Sample Batch Master"
      description="Batches used only for control sample collection. These are not shared with stability inventory."
      collectionName={COLLECTIONS.controlSampleBatches}
      recordType="controlSampleBatch"
      managePermission={["control.perform", "masters.manage"]}
      loader={listControlBatches}
      fields={[
        {
          key: "productId",
          label: "Product",
          type: "select",
          required: true,
          options: activeProducts.map((p) => ({ label: p.productName, value: p.id })),
        },
        { key: "batchNumber", label: "Batch Number", required: true },
        { key: "manufacturingDate", label: "Manufacturing Date", type: "date", required: true },
        { key: "expiryDate", label: "Expiry Date", type: "date", required: true },
        { key: "releaseDate", label: "Release Date", type: "date" },
        { key: "batchSize", label: "Batch Size" },
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
        Product: item.productName,
        Batch: item.batchNumber,
        Mfg: item.manufacturingDate,
        Expiry: item.expiryDate,
        Status: item.status,
      })}
      buildPayload={(values) => {
        const product = (products.data || []).find((p) => p.id === values.productId);
        return {
          productId: values.productId,
          productName: product?.productName || "",
          batchNumber: values.batchNumber.trim(),
          manufacturingDate: values.manufacturingDate.trim(),
          expiryDate: values.expiryDate.trim(),
          releaseDate: values.releaseDate.trim() || undefined,
          batchSize: values.batchSize.trim() || undefined,
          status: values.status,
        };
      }}
    />
  );
}
