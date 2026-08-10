"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, MoreHorizontal, PackageMinus, PackagePlus, Plus } from "lucide-react";
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
import { listSamples } from "@/services/inventory";
import { listChambers, listStudyTypes } from "@/services/masters";

export default function InventoryListPage() {
  const { hasPermission } = useAuth();
  const canCharge = hasPermission("charging.perform") || hasPermission("studies.create");

  const samples = useAsync(listSamples, []);
  const studyTypes = useAsync(listStudyTypes, []);
  const chambers = useAsync(listChambers, []);

  const [search, setSearch] = useState("");
  const [studyType, setStudyType] = useState("all");
  const [status, setStatus] = useState("all");
  const [chamberId, setChamberId] = useState("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (samples.data || []).filter((s) => {
      if (studyType !== "all" && s.studyType !== studyType) return false;
      if (status !== "all" && s.status !== status) return false;
      if (chamberId !== "all" && s.chamberId !== chamberId) return false;
      if (!q) return true;
      return [s.productName, s.batchNumber, s.studyId, s.sampleId, s.chamberName, s.locationLabel]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [samples.data, search, studyType, status, chamberId]);

  const paged = paginate(filtered, page, 10);
  const loading = samples.loading || studyTypes.loading || chambers.loading;
  const error = samples.error || studyTypes.error || chambers.error;

  return (
    <div>
      <PageHeader
        title="Sample Inventory"
        description="Track charged samples, availability, and next pull schedule across chambers."
        actions={
          <div className="flex flex-wrap gap-2">
            {canCharge ? (
              <>
                <Link href="/stability/studies/new">
                  <Button variant="outline">
                    <Plus className="h-4 w-4" />
                    New Study
                  </Button>
                </Link>
                <Link href="/stability/inventory/charging">
                  <Button>
                    <PackagePlus className="h-4 w-4" />
                    Charge Sample
                  </Button>
                </Link>
              </>
            ) : null}
          </div>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-2 xl:grid-cols-5">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search product, batch, study, sample..."
            className="xl:col-span-2"
          />
          <Select
            value={studyType}
            onChange={(e) => {
              setStudyType(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Study Types</option>
            {(studyTypes.data || []).map((s) => (
              <option key={s.id} value={s.name}>
                {s.name}
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
            <option value="Available">Available</option>
            <option value="Partially Withdrawn">Partially Withdrawn</option>
            <option value="Fully Withdrawn">Fully Withdrawn</option>
            <option value="Depleted">Depleted</option>
            <option value="Under Reconciliation">Under Reconciliation</option>
            <option value="Disposed">Disposed</option>
          </Select>
          <Select
            value={chamberId}
            onChange={(e) => {
              setChamberId(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Chambers</option>
            {(chambers.data || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.chamberName}
              </option>
            ))}
          </Select>
        </div>

        {loading ? <LoadingSkeleton /> : null}
        {error ? (
          <ErrorState
            message={error}
            onRetry={() => {
              void samples.reload();
              void studyTypes.reload();
              void chambers.reload();
            }}
          />
        ) : null}

        {!loading && !error && paged.items.length === 0 ? (
          <EmptyState
            title="No samples in inventory."
            description="Charge a sample to create study inventory and pull schedules."
            action={
              canCharge ? (
                <Link href="/stability/inventory/charging">
                  <Button>Charge Sample</Button>
                </Link>
              ) : undefined
            }
          />
        ) : null}

        {!loading && !error && paged.items.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Sample ID</th>
                    <th className="px-4 py-3">Study ID</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Study Type</th>
                    <th className="px-4 py-3">Condition</th>
                    <th className="px-4 py-3">Chamber</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Reserved</th>
                    <th className="px-4 py-3">Available</th>
                    <th className="px-4 py-3">Withdrawn</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Next Pull</th>
                    <th className="px-4 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.items.map((s) => (
                    <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-teal-800">{s.sampleId}</td>
                      <td className="px-4 py-3">{s.studyId}</td>
                      <td className="px-4 py-3">{s.productName}</td>
                      <td className="px-4 py-3">{s.batchNumber}</td>
                      <td className="px-4 py-3">{s.studyType}</td>
                      <td className="px-4 py-3">{s.storageCondition}</td>
                      <td className="px-4 py-3">{s.chamberName}</td>
                      <td className="px-4 py-3">{s.locationLabel}</td>
                      <td className="px-4 py-3">
                        {s.totalQuantity} {s.unit}
                      </td>
                      <td className="px-4 py-3">{s.reservedQuantity}</td>
                      <td className="px-4 py-3 font-medium">{s.availableQuantity}</td>
                      <td className="px-4 py-3">{s.withdrawnQuantity}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3">{formatDate(s.nextPullDate)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/stability/inventory/${s.id}`}>
                            <Button size="sm" variant="outline">
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                          </Link>
                          <Link href={`/stability/withdrawals?sample=${s.id}`}>
                            <Button size="sm" variant="ghost">
                              <PackageMinus className="h-3.5 w-3.5" />
                              Withdraw
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 xl:hidden">
              {paged.items.map((s) => (
                <div key={s.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{s.productName}</p>
                      <p className="text-sm text-slate-500">
                        {s.sampleId} · {s.batchNumber}
                      </p>
                    </div>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <p className="text-slate-500">Study</p>
                    <p className="text-right font-medium">{s.studyId}</p>
                    <p className="text-slate-500">Study Type</p>
                    <p className="text-right font-medium">{s.studyType}</p>
                    <p className="text-slate-500">Chamber</p>
                    <p className="text-right font-medium">{s.chamberName}</p>
                    <p className="text-slate-500">Available</p>
                    <p className="text-right font-medium">
                      {s.availableQuantity} {s.unit}
                    </p>
                    <p className="text-slate-500">Next Pull</p>
                    <p className="text-right font-medium">{formatDate(s.nextPullDate)}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link href={`/stability/inventory/${s.id}`}>
                      <Button className="w-full" variant="outline" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                        View
                      </Button>
                    </Link>
                    <Link href={`/stability/withdrawals?sample=${s.id}`}>
                      <Button className="w-full" variant="secondary" size="sm">
                        Withdraw
                      </Button>
                    </Link>
                  </div>
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
