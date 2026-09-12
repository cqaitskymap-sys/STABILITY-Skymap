"use client";

import { useMemo, useState } from "react";
import { Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { PrintDocument, PrintFieldGrid } from "@/components/print/print-document";
import { useAsync } from "@/hooks/useAsync";
import { meanKineticTemperature } from "@/lib/sop";
import { listChambers } from "@/services/masters";
import { getOrganizationSettings } from "@/services/organization";
import { collection, getDocs, query, where } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import type { ChamberDataLog } from "@/types";

export default function MktPage() {
  const chambers = useAsync(listChambers, []);
  const org = useAsync(getOrganizationSettings, []);
  const [chamberId, setChamberId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const logs = useAsync(async () => {
    if (!chamberId || !startDate || !endDate) return [] as ChamberDataLog[];
    const snap = await getDocs(
      query(collection(getDb(), COLLECTIONS.chamberDataLogs), where("chamberId", "==", chamberId))
    );
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as ChamberDataLog))
      .filter((d) => d.timestamp >= startDate && d.timestamp <= `${endDate}T23:59:59`)
      .filter((d) => d.source !== "simulation" || org.data?.simulationEnabled);
  }, [chamberId, startDate, endDate, org.data?.simulationEnabled]);

  const chamber = (chambers.data || []).find((c) => c.id === chamberId);
  const temps = useMemo(
    () => (logs.data || []).map((d) => d.temperature).filter((v): v is number => Number.isFinite(v)),
    [logs.data]
  );
  const mkt = meanKineticTemperature(temps);
  const sufficient = temps.length >= 2 && Boolean(org.data?.hardwareIntegrationEnabled || (logs.data || []).some((d) => d.source === "imported"));

  return (
    <div>
      <PageHeader
        title="Mean Kinetic Temperature Report"
        description="Weekly MKT is calculated only from imported or integrated chamber data. Incomplete data is not invented."
      />
      {!org.data?.hardwareIntegrationEnabled ? (
        <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Hardware Integration Not Connected. Import approved chamber logs before generating MKT. Simulated values are not mixed with official records.
        </Card>
      ) : null}
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Select label="Chamber" value={chamberId} onChange={(e) => setChamberId(e.target.value)}>
            <option value="">Select chamber</option>
            {(chambers.data || []).map((c) => <option key={c.id} value={c.id}>{c.chamberId}</option>)}
          </Select>
          <Input label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="End date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </Card>
      {!temps.length ? (
        <EmptyState title="Insufficient / incomplete data" description="No imported temperature readings in this range. MKT will not be calculated from empty or fake data." />
      ) : (
        <PrintDocument title="MKT Report" documentNumber={chamber?.chamberId}>
          <PrintFieldGrid
            rows={[
              { label: "Chamber", value: chamber?.chamberName || chamber?.chamberId },
              { label: "Start", value: startDate },
              { label: "End", value: endDate },
              { label: "Data points", value: temps.length },
              { label: "Lowest temperature", value: Math.min(...temps).toFixed(2) },
              { label: "Highest temperature", value: Math.max(...temps).toFixed(2) },
              { label: "Average temperature", value: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(2) },
              {
                label: "MKT",
                value: sufficient && mkt != null ? `${mkt.toFixed(2)} °C` : "Insufficient / incomplete data",
              },
            ]}
          />
        </PrintDocument>
      )}
    </div>
  );
}
