"use client";

import type { ReactNode } from "react";
import { Pager } from "@/components/ui";
import { paginate } from "@/lib/utils";

export function CsTable({
  columns,
  rows,
  page,
  pageSize = 15,
  onPage,
  empty,
  rowKey,
}: {
  columns: { key: string; header: string; className?: string }[];
  rows: Record<string, ReactNode>[];
  page: number;
  pageSize?: number;
  onPage: (page: number) => void;
  empty?: ReactNode;
  rowKey: (row: Record<string, ReactNode>, index: number) => string;
}) {
  const paged = paginate(rows, page, pageSize);
  if (!rows.length) return <>{empty}</>;
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={`px-4 py-3 font-semibold ${c.className || ""}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.items.map((row, i) => (
              <tr key={rowKey(row, i)} className="hover:bg-slate-50/70">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 text-slate-700 ${c.className || ""}`}>{row[c.key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pager
        showing={paged.items.length}
        total={rows.length}
        page={paged.page}
        totalPages={paged.totalPages}
        onPrev={() => onPage(paged.page - 1)}
        onNext={() => onPage(paged.page + 1)}
      />
    </div>
  );
}
