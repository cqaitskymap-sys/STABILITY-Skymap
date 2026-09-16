"use client";

import { MasterPage } from "@/components/masters/master-page";
import { COLLECTIONS } from "@/lib/firebase/config";
import { listMarkets } from "@/services/masters";
import type { Market } from "@/types";

export default function MarketsPage() {
  return (
    <MasterPage<Market>
      title="Market Master"
      description="Configurable markets used on the Daily Collection Record. Do not hard-code a fixed market list."
      collectionName={COLLECTIONS.markets}
      recordType="market"
      loader={listMarkets}
      fields={[
        { key: "name", label: "Market Name", required: true, placeholder: "e.g. India, Export" },
        { key: "code", label: "Code", required: true, placeholder: "e.g. IN, EXP" },
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
        Market: item.name,
        Code: item.code,
        Status: item.status,
      })}
      getCreateDefaults={() => ({ status: "Active" })}
      validate={({ values, items, editing }) => {
        const name = values.name.trim();
        const code = values.code.trim();
        if (!name) return "Market name is required.";
        if (!code) return "Code is required.";
        if (items.some((item) => item.id !== editing?.id && item.name.trim().toLowerCase() === name.toLowerCase())) {
          return "A market with this name already exists.";
        }
        if (items.some((item) => item.id !== editing?.id && item.code.trim().toLowerCase() === code.toLowerCase())) {
          return "A market with this code already exists.";
        }
        return null;
      }}
      buildPayload={(values) => ({
        name: values.name.trim(),
        code: values.code.trim(),
        status: values.status,
      })}
    />
  );
}
