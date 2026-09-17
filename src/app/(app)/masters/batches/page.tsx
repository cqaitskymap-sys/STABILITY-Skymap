"use client";

import { MasterPage } from "@/components/masters/master-page";
import { Button, EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui";
import { COLLECTIONS } from "@/lib/firebase/config";
import { useAsync } from "@/hooks/useAsync";
import { formatDate } from "@/lib/utils";
import { listBatches, listProducts } from "@/services/masters";
import type { Batch } from "@/types";

export default function BatchesPage() {
  const products = useAsync(listProducts, []);

  if (products.loading) return <LoadingSkeleton rows={6} />;
  if (products.error) return <ErrorState message={products.error} onRetry={products.reload} />;

  const activeProducts = (products.data || []).filter((p) => p.status === "Active");
  if (!activeProducts.length) {
    return (
      <EmptyState
        title="Add a product first"
        description="Batches belong to a stability product. Create an active stability product before adding batches."
        action={
          <Button href="/masters/products">Go to Products</Button>
        }
      />
    );
  }

  return (
    <MasterPage<Batch>
      title="Batch Master"
      description="Maintain product batches used only for stability study charging. Control samples have a separate batch master."
      collectionName={COLLECTIONS.batches}
      recordType="batch"
      loader={listBatches}
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
        { key: "expiryDate", label: "Expiry Date", type: "date", required: true, monthBound: "end" },
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
        Mfg: formatDate(item.manufacturingDate),
        Expiry: formatDate(item.expiryDate),
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
