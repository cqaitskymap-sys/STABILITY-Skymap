"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardHeader, Input, PageHeader } from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { DEFAULT_ORG_SETTINGS } from "@/lib/sop";
import { friendlyError } from "@/lib/utils";
import { getOrganizationSettings, saveOrganizationSettings } from "@/services/organization";
import type { OrganizationSettings } from "@/types";

export default function OrganizationSettingsPage() {
  const { profile, hasPermission } = useAuth();
  const can = hasPermission("users.manage");
  const current = useAsync(getOrganizationSettings, []);
  const [form, setForm] = useState<OrganizationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const data = form || current.data || DEFAULT_ORG_SETTINGS;

  function set<K extends keyof OrganizationSettings>(key: K, value: OrganizationSettings[K]) {
    setForm({ ...data, [key]: value });
  }

  async function save() {
    if (!profile || !can) return;
    setSaving(true);
    try {
      const saved = await saveOrganizationSettings(data, profile);
      setForm(saved);
      toast.success("Organization settings saved. These are configuration values, not a compliance certificate.");
      await current.reload();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Organization / SOP configuration"
        description="Windows, numbering, label colors, and hardware flags. Empty plant codes stay empty — SMH is not hard-coded."
      />
      <Card>
        <CardHeader title="Configurable controls" />
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          <Input label="Company name" value={data.companyName} onChange={(e) => set("companyName", e.target.value)} disabled={!can} />
          <Input label="Plant code" value={data.plantCode} onChange={(e) => set("plantCode", e.target.value)} disabled={!can} />
          <Input label="Department code" value={data.departmentCode} onChange={(e) => set("departmentCode", e.target.value)} disabled={!can} />
          <Input label="Document prefix" value={data.documentPrefix} onChange={(e) => set("documentPrefix", e.target.value)} disabled={!can} />
          <Input label="Charging window (days from release)" type="number" value={String(data.chargingWindowDays)} onChange={(e) => set("chargingWindowDays", Number(e.target.value) || 0)} disabled={!can} />
          <Input label="Withdrawal window (days after due)" type="number" value={String(data.withdrawalWindowDays)} onChange={(e) => set("withdrawalWindowDays", Number(e.target.value) || 0)} disabled={!can} />
          <Input label="Accelerated analysis days" type="number" value={String(data.analysisDaysAccelerated)} onChange={(e) => set("analysisDaysAccelerated", Number(e.target.value) || 0)} disabled={!can} />
          <Input label="Long-term analysis days" type="number" value={String(data.analysisDaysLongTerm)} onChange={(e) => set("analysisDaysLongTerm", Number(e.target.value) || 0)} disabled={!can} />
          <Input label="Default inverted %" type="number" value={String(data.invertedPercentDefault)} onChange={(e) => set("invertedPercentDefault", Number(e.target.value) || 0)} disabled={!can} />
          <Input label="Water-loss limit %" type="number" value={String(data.waterLossLimitPercent)} onChange={(e) => set("waterLossLimitPercent", Number(e.target.value) || 0)} disabled={!can} />
          <Input label="Accelerated label color" value={data.labelColors.accelerated} onChange={(e) => set("labelColors", { ...data.labelColors, accelerated: e.target.value })} disabled={!can} />
          <Input label="Long term label color" value={data.labelColors.longTerm} onChange={(e) => set("labelColors", { ...data.labelColors, longTerm: e.target.value })} disabled={!can} />
          <Input label="Intermediate label color" value={data.labelColors.intermediate} onChange={(e) => set("labelColors", { ...data.labelColors, intermediate: e.target.value })} disabled={!can} />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={data.requireReceiptBeforeCharging} onChange={(e) => set("requireReceiptBeforeCharging", e.target.checked)} disabled={!can} />
            Require inward/COA before charging
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={data.requireLateChargingReason} onChange={(e) => set("requireLateChargingReason", e.target.checked)} disabled={!can} />
            Require reason when charging beyond the window
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={data.requireDestructionApproval} onChange={(e) => set("requireDestructionApproval", e.target.checked)} disabled={!can} />
            Require QA approval before destruction
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={data.allowMultiOccupancy} onChange={(e) => set("allowMultiOccupancy", e.target.checked)} disabled={!can} />
            Allow more than one sample in the same location
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={data.hardwareIntegrationEnabled} onChange={(e) => set("hardwareIntegrationEnabled", e.target.checked)} disabled={!can} />
            Hardware integration enabled (do not enable unless a gateway exists)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={data.simulationEnabled} onChange={(e) => set("simulationEnabled", e.target.checked)} disabled={!can} />
            Allow separated simulation/test data
          </label>
          <Input label="Control sample destruction months after expiry" type="number" value={String(data.controlDestructionMonthsAfterExpiry)} onChange={(e) => set("controlDestructionMonthsAfterExpiry", Number(e.target.value) || 0)} disabled={!can} hint="SOP default is 12 months (one year after expiry)." />
          <Input label="Control sample observation interval (months)" type="number" value={String(data.controlObservationIntervalMonths)} onChange={(e) => set("controlObservationIntervalMonths", Number(e.target.value) || 0)} disabled={!can} />
          <Input label="Observation window after expiry (months)" type="number" value={String(data.controlObservationAfterExpiryMonths)} onChange={(e) => set("controlObservationAfterExpiryMonths", Number(e.target.value) || 0)} disabled={!can} />
          <Input label="Conversion batch default quantity" type="number" value={String(data.controlConversionBatchQuantity)} onChange={(e) => set("controlConversionBatchQuantity", Number(e.target.value) || 0)} disabled={!can} hint="SOP example is 1 shrink pack or 1 pack. Override per product in Quantity Master." />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={data.controlRequireWithdrawalApproval} onChange={(e) => set("controlRequireWithdrawalApproval", e.target.checked)} disabled={!can} />
            Require QA Manager approval before control sample issue
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={data.controlAllowDuplicateBoxOccupancy} onChange={(e) => set("controlAllowDuplicateBoxOccupancy", e.target.checked)} disabled={!can} />
            Allow duplicate active box occupancy
          </label>
        </div>
        {can ? (
          <div className="px-4 pb-4">
            <Button onClick={() => void save()} loading={saving}>Save configuration</Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
