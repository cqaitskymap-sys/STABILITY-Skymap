"use client";

import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";

const TASKS = [
  { cadence: "Daily", title: "Alarm review", href: "/stability/chambers/alarms" },
  { cadence: "Daily", title: "Chamber condition monitoring", href: "/stability/chambers/status" },
  { cadence: "Weekly", title: "Chamber cleaning record", href: "/stability/chambers/cleaning" },
  { cadence: "Weekly", title: "MKT report", href: "/stability/chambers/mkt" },
  { cadence: "Monthly", title: "Stability pull plan", href: "/stability/scheduler" },
  { cadence: "Monthly", title: "Upcoming withdrawal review", href: "/stability/withdrawals/upcoming" },
  { cadence: "Monthly", title: "Reconciliation", href: "/stability/reconciliation" },
  { cadence: "Bimonthly", title: "Condenser cleaning / maintenance tracking", href: "/stability/chambers/maintenance" },
  { cadence: "Annual", title: "Temperature mapping", href: "/stability/chambers/mapping" },
  { cadence: "Annual", title: "Calibration", href: "/stability/chambers/calibration" },
];

export default function TasksPage() {
  return (
    <div>
      <PageHeader
        title="SOP Task Reminders"
        description="Reminders only. Tasks are not marked complete automatically."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {TASKS.map((t) => (
          <Link key={t.title} href={t.href}>
            <Card className="p-4 transition hover:border-teal-200">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">{t.cadence}</p>
              <p className="mt-1 font-semibold text-slate-900">{t.title}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
