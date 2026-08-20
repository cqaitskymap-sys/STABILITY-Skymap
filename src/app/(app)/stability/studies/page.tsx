"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, MoreHorizontal, Plus, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingSkeleton,
  PageHeader,
  Select,
  StatusBadge,
} from "@/components/ui";
import { useAuth } from "@/contexts/auth-context";
import { useAsync } from "@/hooks/useAsync";
import { formatDate, paginate } from "@/lib/utils";
import { listStudies } from "@/services/inventory";

export default function StudiesPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("studies.create") || hasPermission("charging.perform");
  const { data, loading, error, reload } = useAsync(listStudies, []);
  const [search, setSearch] = useState("");
  const [studyType, setStudyType] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);

  const studyTypeOptions = useMemo(() => {
    const set = new Set((data || []).map((s) => s.studyType).filter(Boolean));
    // Keep common defaults visible even before data exists.
    ["Accelerated", "Intermediate", "Long Term / Real-Time"].forEach((name) => set.add(name));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data || []).filter((s) => {
      if (studyType !== "all" && s.studyType !== studyType) return false;
      if (status !== "all" && s.status !== status) return false;
      if (!q) return true;
      return [s.studyId, s.productName, s.batchNumber, s.studyType, s.storageCondition]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [data, search, studyType, status]);

  const paged = paginate(filtered, page, 10);
  const filtersActive = search.trim() !== "" || studyType !== "all" || status !== "all";

  function clearFilters() {
    setSearch("");
    setStudyType("all");
    setStatus("all");
    setPage(1);
  }

  return (
    <div>
      <PageHeader
        title="Stability Studies"
        description="Search, filter, and manage stability studies across all study types."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => void reload()}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            {canCreate ? (
              <Link href="/stability/studies/new">
                <Button>
                  <Plus className="h-4 w-4" />
                  Create Stability Study
                </Button>
              </Link>
            ) : null}
          </div>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-100/90 bg-slate-50/40 p-4 md:grid-cols-4">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search study, product, batch..."
          />
          <Select
            value={studyType}
            onChange={(e) => {
              setStudyType(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Study Types</option>
            {studyTypeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Partially Withdrawn">Partially Withdrawn</option>
            <option value="Fully Withdrawn">Fully Withdrawn</option>
            <option value="Completed">Completed</option>
            <option value="Disposed">Disposed</option>
            <option value="Draft">Draft</option>
          </Select>
          <Button variant="outline" onClick={clearFilters} disabled={!filtersActive}>
            Clear filters
          </Button>
        </div>

        {loading ? <LoadingSkeleton /> : null}
        {error ? <ErrorState message={error} onRetry={reload} /> : null}

        {!loading && !error && (data || []).length === 0 ? (
          <EmptyState
            title="No stability studies found"
            description="Create a study and charge samples to begin inventory tracking. Masters (product, study type, chamber, location) must be configured first."
            action={
              canCreate ? (
                <Link href="/stability/studies/new">
                  <Button>Create Stability Study</Button>
                </Link>
              ) : undefined
            }
          />
        ) : null}

        {!loading && !error && (data || []).length > 0 && paged.items.length === 0 ? (
          <EmptyState
            title="No studies match your filters"
            description="Try clearing search or filter selections."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : null}

        {!loading && !error && paged.items.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Study ID</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Study Type</th>
                    <th className="px-4 py-3">Condition</th>
                    <th className="px-4 py-3">Start Date</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Available</th>
                    <th className="px-4 py-3">Next Pull</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-teal-800">{s.studyId}</td>
                      <td className="px-4 py-3">{s.productName}</td>
                      <td className="px-4 py-3">{s.batchNumber}</td>
                      <td className="px-4 py-3">{s.studyType}</td>
                      <td className="px-4 py-3">{s.storageCondition}</td>
                      <td className="px-4 py-3">{formatDate(s.chargingDate)}</td>
                      <td className="px-4 py-3">{s.duration}</td>
                      <td className="px-4 py-3">{s.totalQuantity}</td>
                      <td className="px-4 py-3">{s.availableQuantity}</td>
                      <td className="px-4 py-3">{formatDate(s.nextPullDate)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/stability/studies/${s.id}`}>
                          <Button size="sm" variant="outline">
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {paged.items.map((s) => (
                <div key={s.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{s.productName}</p>
                      <p className="text-sm text-slate-500">
                        {s.studyId} · {s.batchNumber}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <p className="text-slate-500">Study Type</p>
                    <p className="text-right font-medium">{s.studyType}</p>
                    <p className="text-slate-500">Condition</p>
                    <p className="text-right font-medium">{s.storageCondition}</p>
                    <p className="text-slate-500">Available</p>
                    <p className="text-right font-medium">{s.availableQuantity}</p>
                    <p className="text-slate-500">Next Pull</p>
                    <p className="text-right font-medium">{formatDate(s.nextPullDate)}</p>
                  </div>
                  <Link href={`/stability/studies/${s.id}`} className="mt-3 block">
                    <Button className="w-full" variant="outline" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                      View Details
                    </Button>
                  </Link>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
              <p className="text-slate-500">
                Showing {paged.items.length} of {paged.total}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={paged.page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={paged.page >= paged.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}
