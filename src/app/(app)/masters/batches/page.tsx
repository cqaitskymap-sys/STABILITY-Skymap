"use client";

import Link from "next/link";
import { MasterPage } from "@/components/masters/master-page";
import { Button, EmptyState, ErrorState, LoadingSkeleton } from "@/components/ui";
import { COLLECTIONS } from "@/lib/firebase/config";
import { useAsync } from "@/hooks/useAsync";
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
        description="Batches belong to a product. Create an active product before adding batches."
        action={
          <Link href="/masters/products">
            <Button>Go to Products</Button>
          </Link>
        }
      />
    );
  }

  return (
    <MasterPage<Batch>
      title="Batch Master"
      description="Maintain product batches used for stability study charging."
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
        { key: "expiryDate", label: "Expiry Date", type: "date", required: true },
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
        const product = activeProducts.find((p) => p.id === values.productId);
        return {
          productId: values.productId,
          productName: product?.productName || "",
          batchNumber: values.batchNumber.trim(),
          manufacturingDate: values.manufacturingDate.trim(),
          expiryDate: values.expiryDate.trim(),
          status: values.status,
        };
      }}
    />
  );
}
