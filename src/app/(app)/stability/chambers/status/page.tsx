"use client";

import { Card, PageHeader } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { getOrganizationSettings } from "@/services/organization";
import { listChambers } from "@/services/masters";

export default function ChamberStatusPage() {
  const org = useAsync(getOrganizationSettings, []);
  const chambers = useAsync(listChambers, []);
  const connected = Boolean(org.data?.hardwareIntegrationEnabled);

  return (
    <div>
      <PageHeader
        title="Chamber Current Status"
        description="Process values come only from an approved hardware integration. This screen does not invent live PLC data."
      />
      <Card className="mb-4 p-4 text-sm text-slate-700">
        <p className="font-semibold">{connected ? "Integration configured" : "Hardware Integration Not Connected"}</p>
        <p className="mt-1 text-slate-500">
          Future path: Chamber PLC → Gateway / Middleware → API → Next.js → Firebase → this dashboard. Simulation/test data stays separated and is off unless an administrator enables it.
        </p>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {(chambers.data || []).map((c) => (
          <Card key={c.id} className="p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{c.chamberId}</p>
            <p className="font-semibold text-slate-900">{c.chamberName || c.chamberId}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-slate-500">Type</dt><dd>{c.chamberType || "—"}</dd></div>
              <div><dt className="text-slate-500">Set temperature</dt><dd>{c.temperature || "—"}</dd></div>
              <div><dt className="text-slate-500">Set RH</dt><dd>{c.relativeHumidity || "—"}</dd></div>
              <div><dt className="text-slate-500">Chamber status</dt><dd>{c.status}</dd></div>
              <div><dt className="text-slate-500">Temperature PV</dt><dd>{connected ? "Awaiting gateway" : "Not connected"}</dd></div>
              <div><dt className="text-slate-500">RH PV</dt><dd>{connected ? "Awaiting gateway" : "Not connected"}</dd></div>
              <div><dt className="text-slate-500">Last data update</dt><dd>—</dd></div>
              <div><dt className="text-slate-500">Scanner channels</dt><dd>TEMP {c.temperatureChannels || "n/a"} / HUMI {c.humidityChannels || "n/a"}</dd></div>
            </dl>
          </Card>
        ))}
      </div>
    </div>
  );
}
