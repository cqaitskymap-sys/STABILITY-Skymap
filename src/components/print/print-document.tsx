"use client";

import type { ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function PrintDocument({
  title,
  documentNumber,
  revision = "00",
  companyName,
  department,
  children,
}: {
  title: string;
  documentNumber?: string;
  revision?: string;
  companyName?: string;
  department?: string;
  children: ReactNode;
}) {
  const company = companyName || process.env.NEXT_PUBLIC_COMPANY_NAME || "Stability Management";
  const generated = new Date().toLocaleString();

  return (
    <div className="print-document">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-500">Print-friendly controlled document layout.</p>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
        <header className="border-b border-slate-200 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">{company}</p>
          {department ? <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{department}</p> : null}
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
            {documentNumber ? <span>Document No.: {documentNumber}</span> : null}
            <span>Revision: {revision}</span>
            <span>Generated: {generated}</span>
          </div>
        </header>
        <div className="px-6 py-5">{children}</div>
        <footer className="border-t border-slate-200 px-6 py-3 text-xs text-slate-500 print:fixed print:bottom-0 print:left-0 print:right-0">
          Controlled document — for internal QA use. Page numbers apply when printed.
        </footer>
      </div>
    </div>
  );
}

export function PrintFieldGrid({ rows }: { rows: { label: string; value?: string | number | null }[] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-900">{row.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
