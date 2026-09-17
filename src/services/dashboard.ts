import { collection, getDocs } from "firebase/firestore";
import { COLLECTIONS, getDb } from "@/lib/firebase/config";
import { effectiveDueDate, roundPct, todayISO } from "@/lib/utils";
import type { Chamber, DashboardStats, StabilitySample, StabilityStudy, StudyPullPoint } from "@/types";
import { listPullPoints, listSamples, listStudies, listTransactions } from "@/services/inventory";
import { listStudyTypes } from "@/services/masters";
import { listSampleReceipts } from "@/services/receipts";
import { listControlSamples } from "@/services/control-samples";
import { listAnalysisRequests } from "@/services/analysis";
import { listChamberAlarms, listChamberExcursions, listChamberCalibration, listTemperatureMappings } from "@/services/chamber-ops";

export async function getDashboardStats(): Promise<DashboardStats> {
  const [studies, samples, pulls, chamberSnap, studyTypeMasters] = await Promise.all([
    listStudies(),
    listSamples(),
    listPullPoints(),
    getDocs(collection(getDb(), COLLECTIONS.chambers)),
    listStudyTypes(),
  ]);

  const chambers = chamberSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Chamber));
  const activeStudies = studies.filter((s) => s.status === "Active" || s.status === "Partially Withdrawn");
  const activeChambers = chambers.filter((c) => c.status === "Active");

  const totalCapacity = activeChambers.reduce((s, c) => s + (c.capacity || 0), 0);
  const usedCapacity = activeChambers.reduce((s, c) => s + (c.usedCapacity || 0), 0);

  const enrichedPulls = pulls;

  const fromMaster = studyTypeMasters
    .filter((t) => t.status === "Active")
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((t) => t.name);
  const fromData = [...new Set(activeStudies.map((s) => s.studyType).filter(Boolean))];
  const studyTypes = fromMaster.length
    ? [...fromMaster, ...fromData.filter((n) => !fromMaster.includes(n))]
    : fromData.length
      ? fromData
      : ["Accelerated", "Intermediate", "Long Term / Real-Time"];

  const studyTypeOverview = studyTypes.map((studyType) => {
    const typeStudies = activeStudies.filter((s) => s.studyType === studyType);
    const typeSamples = samples.filter((s) => s.studyType === studyType);
    const typePulls = enrichedPulls.filter(
      (p) =>
        p.studyType === studyType &&
        ["Upcoming", "Due Soon", "Due Today", "Due", "Within Window", "Overdue", "Partially Withdrawn"].includes(p.status)
    );
    return {
      studyType,
      activeStudies: typeStudies.length,
      totalSamples: typeSamples.reduce((s, x) => s + x.totalQuantity, 0),
      availableSamples: typeSamples.reduce((s, x) => s + x.availableQuantity, 0),
      upcomingWithdrawals: typePulls.length,
    };
  });

  const extras = await Promise.allSettled([
    listSampleReceipts(),
    listControlSamples(),
    listAnalysisRequests(),
    listChamberAlarms(),
    listChamberExcursions(),
    listChamberCalibration(),
    listTemperatureMappings(),
  ]);
  const receipts = extras[0].status === "fulfilled" ? extras[0].value : [];
  const controls = extras[1].status === "fulfilled" ? extras[1].value : [];
  const analysis = extras[2].status === "fulfilled" ? extras[2].value : [];
  const alarms = extras[3].status === "fulfilled" ? extras[3].value : [];
  const excursions = extras[4].status === "fulfilled" ? extras[4].value : [];
  const calibration = extras[5].status === "fulfilled" ? extras[5].value : [];
  const mappings = extras[6].status === "fulfilled" ? extras[6].value : [];
  const today = todayISO();

  return {
    totalActiveStudies: activeStudies.length,
    totalSamples: samples.reduce((s, x) => s + x.totalQuantity, 0),
    availableSamples: samples.reduce((s, x) => s + x.availableQuantity, 0),
    samplesWithdrawn: samples.reduce((s, x) => s + x.withdrawnQuantity, 0),
    samplesDueSoon: enrichedPulls.filter((p) => p.status === "Due Soon" || p.status === "Due Today" || p.status === "Due").length,
    overdueSamples: enrichedPulls.filter((p) => p.status === "Overdue").length,
    activeChambers: activeChambers.length,
    chamberUtilization: roundPct(usedCapacity, totalCapacity),
    samplesAwaitingCoa: receipts.filter((r) => r.status === "Received - Awaiting COA").length,
    samplesReadyForCharging: receipts.filter((r) => r.status === "COA Received - Ready for Charging").length,
    controlSampleCount: controls.length,
    pendingReconciliation: samples.filter((s) => s.status === "Under Reconciliation").length,
    activeChamberAlarms: alarms.filter((a) => a.status === "Active").length,
    chamberExcursions: excursions.filter((e) => e.status !== "Closed").length,
    calibrationDue: calibration.filter((c) => (effectiveDueDate(c.dueDate) || c.dueDate) <= today).length,
    mappingDue: mappings.filter((m) => (effectiveDueDate(m.nextDueDate) || m.nextDueDate) <= today).length,
    cleaningDue: 0,
    analysisPending: analysis.filter((a) => a.status !== "Completed" && a.status !== "Cancelled").length,
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
