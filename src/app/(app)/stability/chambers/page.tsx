"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  LineChart,
  ShieldAlert,
  Thermometer,
  Wrench,
} from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { useAsync } from "@/hooks/useAsync";
import { getOrganizationSettings } from "@/services/organization";
import { listChambers } from "@/services/masters";
import {
  listChamberAlarms,
  listChamberCalibration,
  listChamberCleaning,
  listChamberExcursions,
  listTemperatureMappings,
} from "@/services/chamber-ops";

const LINKS = [
  { href: "/stability/chambers/status", label: "Current Status / Integration", icon: Activity },
  { href: "/stability/chambers/alarms", label: "Alarm Management", icon: AlertTriangle },
  { href: "/stability/chambers/excursions", label: "Excursion Management", icon: ShieldAlert },
  { href: "/stability/chambers/cleaning", label: "Cleaning Records", icon: ClipboardCheck },
  { href: "/stability/chambers/calibration", label: "Calibration Records", icon: Thermometer },
  { href: "/stability/chambers/mapping", label: "Temperature Mapping", icon: CalendarClock },
  { href: "/stability/chambers/maintenance", label: "Maintenance", icon: Wrench },
  { href: "/stability/chambers/mkt", label: "MKT Report", icon: LineChart },
];

export default function ChamberDashboardPage() {
  const org = useAsync(getOrganizationSettings, []);
  const chambers = useAsync(listChambers, []);
  const ops = useAsync(async () => {
    const [alarms, excursions, cleaning, calibration, mapping] = await Promise.all([
      listChamberAlarms(),
      listChamberExcursions(),
      listChamberCleaning(),
      listChamberCalibration(),
      listTemperatureMappings(),
    ]);
    return { alarms, excursions, cleaning, calibration, mapping };
  }, []);

  const hardware = org.data?.hardwareIntegrationEnabled;
  const today = new Date().toISOString().slice(0, 10);
  const activeAlarms = (ops.data?.alarms || []).filter((a) => a.status === "Active").length;
  const openExcursions = (ops.data?.excursions || []).filter((e) => e.status !== "Closed").length;
  const calDue = (ops.data?.calibration || []).filter((c) => c.dueDate <= today && c.status !== "Valid").length;
  const mapDue = (ops.data?.mapping || []).filter((m) => m.nextDueDate <= today).length;

  return (
    <div>
      <PageHeader
        title="Stability Chamber"
        description="Chamber master, operational records, and a hardware integration boundary. Live PLC values are not simulated."
      />
      <Card className="mb-4 border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {hardware
          ? "Hardware integration is enabled in organization settings. Confirm the gateway is connected before treating process values as official records."
          : "Hardware Integration Not Connected. Chamber temperature/RH live data is not received from PLC/HMI. Simulation/test data is disabled unless an administrator explicitly enables it."}
      </Card>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><p className="text-xs text-slate-500">Chambers</p><p className="text-2xl font-semibold">{chambers.data?.length || 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Active alarms</p><p className="text-2xl font-semibold">{activeAlarms}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Open excursions</p><p className="text-2xl font-semibold">{openExcursions}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Cal / mapping due</p><p className="text-2xl font-semibold">{calDue + mapDue}</p></Card>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-200 hover:shadow-md">
              <Icon className="h-5 w-5 text-teal-700" />
              <p className="mt-2 font-semibold text-slate-900">{item.label}</p>
            </Link>
          );
        })}
        <Link href="/masters/chambers" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-200">
          <Thermometer className="h-5 w-5 text-teal-700" />
          <p className="mt-2 font-semibold text-slate-900">Chamber Master</p>
        </Link>
      </div>
    </div>
  );
}
