import { collection, getDocs } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { derivePullStatus, roundPct } from "@/lib/utils";
import type { Chamber, DashboardStats, StabilitySample, StabilityStudy, StudyPullPoint } from "@/types";
import { listPullPoints, listSamples, listStudies, listTransactions } from "@/services/inventory";

export async function getDashboardStats(): Promise<DashboardStats> {
  const [studies, samples, pulls, chamberSnap] = await Promise.all([
    listStudies(),
    listSamples(),
    listPullPoints(),
    getDocs(collection(getDb(), COLLECTIONS.chambers)),
  ]);

  const chambers = chamberSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Chamber));
  const activeStudies = studies.filter((s) => s.status === "Active" || s.status === "Partially Withdrawn");
  const activeChambers = chambers.filter((c) => c.status === "Active");

  const totalCapacity = activeChambers.reduce((s, c) => s + (c.capacity || 0), 0);
  const usedCapacity = activeChambers.reduce((s, c) => s + (c.usedCapacity || 0), 0);

  const enrichedPulls = pulls.map((p) => ({
    ...p,
    status: derivePullStatus(p.plannedDate, p.actualQuantity, p.plannedQuantity),
  }));

  const studyTypes = ["Accelerated", "Intermediate", "Long Term / Real-Time"];
  const studyTypeOverview = studyTypes.map((studyType) => {
    const typeStudies = activeStudies.filter((s) => s.studyType === studyType);
    const typeSamples = samples.filter((s) => s.studyType === studyType);
    const typePulls = enrichedPulls.filter(
      (p) =>
        p.studyType === studyType &&
        ["Upcoming", "Due Soon", "Due Today", "Overdue"].includes(p.status)
    );
    return {
      studyType,
      activeStudies: typeStudies.length,
      totalSamples: typeSamples.reduce((s, x) => s + x.totalQuantity, 0),
      availableSamples: typeSamples.reduce((s, x) => s + x.availableQuantity, 0),
      upcomingWithdrawals: typePulls.length,
    };
  });

  return {
    totalActiveStudies: activeStudies.length,
    totalSamples: samples.reduce((s, x) => s + x.totalQuantity, 0),
    availableSamples: samples.reduce((s, x) => s + x.availableQuantity, 0),
    samplesWithdrawn: samples.reduce((s, x) => s + x.withdrawnQuantity, 0),
    samplesDueSoon: enrichedPulls.filter((p) => p.status === "Due Soon" || p.status === "Due Today").length,
    overdueSamples: enrichedPulls.filter((p) => p.status === "Overdue").length,
    activeChambers: activeChambers.length,
    chamberUtilization: roundPct(usedCapacity, totalCapacity),
    studyTypeOverview,
  };
}

export async function getRecentActivity(limitCount = 10) {
  const txs = await listTransactions();
  return txs.slice(0, limitCount);
}

export async function getChamberUtilization() {
  const snap = await getDocs(collection(getDb(), COLLECTIONS.chambers));
  return snap.docs.map((d) => {
    const c = { id: d.id, ...d.data() } as Chamber;
    const used = c.usedCapacity || 0;
    const capacity = c.capacity || 0;
    return {
      ...c,
      available: Math.max(0, capacity - used),
      utilization: roundPct(used, capacity),
    };
  });
}

export type { StabilityStudy, StabilitySample, StudyPullPoint };
