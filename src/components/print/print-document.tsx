"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import { getOrganizationSettings } from "@/services/organization";

export const COMPANY_LOGO_SRC = "/brand/skymap-logo.png";
const COMPANY_FALLBACK = "SKYMAP PHARMACEUTICALS PVT. LTD.";

type PrintIdentity = {
  companyName: string;
  plantCode: string;
  departmentCode: string;
};

let cachedIdentity: PrintIdentity | null = null;
let identityRequest: Promise<PrintIdentity> | null = null;

function fallbackIdentity(): PrintIdentity {
  return {
    companyName: process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || COMPANY_FALLBACK,
    plantCode: "",
    departmentCode: "",
  };
}

function loadPrintIdentity() {
  if (cachedIdentity) return Promise.resolve(cachedIdentity);
  if (!identityRequest) {
    identityRequest = getOrganizationSettings()
      .then((settings) => {
        const base = fallbackIdentity();
        cachedIdentity = {
          companyName: settings.companyName?.trim() || base.companyName,
          plantCode: settings.plantCode?.trim() || "",
          departmentCode: settings.departmentCode?.trim() || "",
        };
        return cachedIdentity;
      })
      .catch(() => {
        cachedIdentity = fallbackIdentity();
        return cachedIdentity;
      });
  }
  return identityRequest;
}

function usePrintIdentity(companyName?: string) {
  const [identity, setIdentity] = useState<PrintIdentity>(cachedIdentity || fallbackIdentity());

  useEffect(() => {
    let live = true;
    loadPrintIdentity().then((next) => {
      if (live) setIdentity(next);
    });
    return () => {
      live = false;
    };
  }, []);

  return {
    company: companyName?.trim() || identity.companyName,
    plantCode: identity.plantCode,
    departmentCode: identity.departmentCode,
  };
}

function formatPrintedAt(date = new Date()) {
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PrintLogo({ className }: { className?: string }) {
  return (
    // Plain img so the logo is in the printed page, including cloned print sheets.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={COMPANY_LOGO_SRC} alt="SKYMAP" className={cn("h-14 w-auto max-w-[148px] object-contain", className)} />
  );
}

export function PrintMasthead({
  title,
  documentNumber,
  revision = "00",
  companyName,
  department,
  printedAt,
}: {
  title: string;
  documentNumber?: string;
  revision?: string;
  companyName?: string;
  department?: string;
  printedAt?: string;
}) {
  const identity = usePrintIdentity(companyName);
  const dept = department?.trim() || identity.departmentCode || "Quality Assurance";
  const when = printedAt || formatPrintedAt();

  return (
    <div className="print-masthead border-b-2 border-slate-900">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
        <PrintLogo className="mx-auto h-12 sm:mx-0 sm:h-14" />
        <div className="min-w-0 flex-1 text-center">
          <p className="text-[13px] font-bold uppercase leading-5 tracking-[0.04em] text-slate-900">{identity.company}</p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">{dept}</p>
          {identity.plantCode ? <p className="mt-0.5 text-[11px] text-slate-500">Plant: {identity.plantCode}</p> : null}
        </div>
        <dl className="space-y-0.5 text-center text-[11px] leading-4 text-slate-600 sm:w-[9.5rem] sm:shrink-0 sm:text-right">
          {documentNumber ? (
            <div>
              <dt className="inline font-semibold text-slate-800">Doc No. </dt>
              <dd className="inline">{documentNumber}</dd>
            </div>
          ) : null}
          <div>
            <dt className="inline font-semibold text-slate-800">Revision </dt>
            <dd className="inline">{revision}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-slate-800">Printed </dt>
            <dd className="inline">{when}</dd>
          </div>
        </dl>
      </div>
      <h2 className="border-t border-slate-300 px-5 py-2 text-center text-[15px] font-semibold uppercase tracking-wide text-slate-900">
        {title}
      </h2>
    </div>
  );
}

export function PrintSheetFooter({ companyName }: { companyName?: string }) {
  const identity = usePrintIdentity(companyName);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 px-5 py-2 text-[10px] text-slate-500">
      <span>Controlled document — for internal QA use. Retain with the study record.</span>
      <span>{identity.company}</span>
    </div>
  );
}

function printSheet(node: HTMLElement | null) {
  if (!node || typeof window === "undefined") return;
  document.getElementById("print-root")?.remove();
  const root = document.createElement("div");
  root.id = "print-root";
  root.appendChild(node.cloneNode(true));
  document.body.appendChild(root);
  document.body.classList.add("printing-sheet");

  const cleanup = () => {
    document.body.classList.remove("printing-sheet");
    root.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

export function PrintDocument({
  title,
  documentNumber,
  revision = "00",
  companyName,
  department,
  orientation = "portrait",
  children,
}: {
  title: string;
  documentNumber?: string;
  revision?: string;
  companyName?: string;
  department?: string;
  orientation?: "portrait" | "landscape";
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  return (
    <div className="print-document">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 print:hidden">
        <p className="text-sm text-slate-500">Print-ready controlled document. The company logo and document details are included on the page.</p>
        <Button variant="outline" onClick={() => printSheet(sheetRef.current)}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>
      <div
        ref={sheetRef}
        className={cn(
          "print-sheet overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm print:rounded-none print:border-0 print:shadow-none",
          orientation === "landscape" && "print-sheet-landscape"
        )}
      >
        <PrintMasthead
          title={title}
          documentNumber={documentNumber}
          revision={revision}
          companyName={companyName}
          department={department}
        />
        <div className="px-5 py-4">{children}</div>
        <PrintSheetFooter companyName={companyName} />
      </div>
    </div>
  );
}

export function PrintPageBanner({
  title,
  documentNumber,
  revision,
  companyName,
  department,
}: {
  title: string;
  documentNumber?: string;
  revision?: string;
  companyName?: string;
  department?: string;
}) {
  return (
    <div className="print-only mb-4 overflow-hidden border border-slate-900 bg-white">
      <PrintMasthead
        title={title}
        documentNumber={documentNumber}
        revision={revision}
        companyName={companyName}
        department={department}
      />
    </div>
  );
}

export function PrintPageFooter({ companyName }: { companyName?: string }) {
  const identity = usePrintIdentity(companyName);
  return (
    <p className="print-only mt-4 border-t border-slate-300 pt-2 text-[10px] text-slate-500">
      Controlled document — for internal QA use. Printed {formatPrintedAt()} · {identity.company}
    </p>
  );
}

export function PrintFieldGrid({ rows }: { rows: { label: string; value?: string | number | null }[] }) {
  return (
    <dl className="grid border border-slate-400 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="border border-slate-300 px-3 py-2 break-inside-avoid">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</dt>
          <dd className="mt-0.5 text-sm font-medium text-slate-900">{row.value || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
