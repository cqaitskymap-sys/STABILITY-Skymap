"use client";

import { getChamberUtilization, getDashboardStats, getRecentActivity } from "@/services/dashboard";
import { listAlerts, listPullPoints, listReconciliations, listSamples, listStudies } from "@/services/inventory";

export type InventoryAiContext = {
  generatedAt: string;
  stats: Awaited<ReturnType<typeof getDashboardStats>>;
  chambers: {
    chamberName: string;
    temperature: string;
    relativeHumidity: string;
    capacity: number;
    usedCapacity: number;
    available: number;
    utilization: number;
    status: string;
    location: string;
  }[];
  duePulls: {
    id: string;
    productName: string;
    batchNumber: string;
    studyType: string;
    storageCondition: string;
    chamberName: string;
    pullPoint: string;
    plannedDate: string;
    plannedQuantity: number;
    actualQuantity: number;
    status: string;
  }[];
  alerts: {
    title: string;
    message: string;
    severity: string;
    alertType: string;
    createdAt: string;
  }[];
  samples: {
    sampleId: string;
    productName: string;
    batchNumber: string;
    studyType: string;
    chamberName: string;
    locationLabel: string;
    availableQuantity: number;
    totalQuantity: number;
    withdrawnQuantity: number;
    status: string;
    nextPullDate?: string | null;
  }[];
  studies: {
    studyId: string;
    productName: string;
    batchNumber: string;
    studyType: string;
    storageCondition: string;
    chamberName: string;
    availableQuantity: number;
    totalQuantity: number;
    status: string;
    nextPullDate?: string | null;
  }[];
  variances: {
    productName: string;
    batchNumber: string;
    systemQuantity: number;
    physicalQuantity: number;
    variance: number;
    status: string;
    reconciliationDate: string;
  }[];
  recentActivity: {
    transactionType: string;
    productName: string;
    batchNumber: string;
    quantity: number;
    performedByName: string;
    performedAt: string;
  }[];
};

const OPEN_PULL = ["Upcoming", "Due Soon", "Due Today", "Overdue", "Partially Withdrawn"];
const CACHE_MS = 45_000;

let cache: { at: number; data: InventoryAiContext } | null = null;

export function invalidateInventoryContext() {
  cache = null;
}

export async function getInventoryContext(force = false): Promise<InventoryAiContext> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const [stats, chambers, pulls, alerts, samples, studies, recs, activity] = await Promise.all([
    getDashboardStats(),
    getChamberUtilization(),
    listPullPoints(),
    listAlerts(),
    listSamples(),
    listStudies(),
    listReconciliations(),
    getRecentActivity(8),
  ]);

  const data: InventoryAiContext = {
    generatedAt: new Date().toISOString(),
    stats,
    chambers: chambers.map((c) => ({
      chamberName: c.chamberName,
      temperature: c.temperature,
      relativeHumidity: c.relativeHumidity,
      capacity: c.capacity,
      usedCapacity: c.usedCapacity,
      available: c.available,
      utilization: c.utilization,
      status: c.status,
      location: c.location,
    })),
    duePulls: pulls
      .filter((p) => OPEN_PULL.includes(p.status))
      .slice(0, 30)
      .map((p) => ({
        id: p.id,
        productName: p.productName,
        batchNumber: p.batchNumber,
        studyType: p.studyType,
        storageCondition: p.storageCondition,
        chamberName: p.chamberName,
        pullPoint: p.pullPoint,
        plannedDate: p.plannedDate,
        plannedQuantity: p.plannedQuantity,
        actualQuantity: p.actualQuantity,
        status: p.status,
      })),
    alerts: alerts
      .filter((a) => !a.acknowledged)
      .slice(0, 20)
      .map((a) => ({
        title: a.title,
        message: a.message,
        severity: a.severity,
        alertType: a.alertType,
        createdAt: a.createdAt,
      })),
    samples: samples.slice(0, 50).map((s) => ({
      sampleId: s.sampleId,
      productName: s.productName,
      batchNumber: s.batchNumber,
      studyType: s.studyType,
      chamberName: s.chamberName,
      locationLabel: s.locationLabel,
      availableQuantity: s.availableQuantity,
      totalQuantity: s.totalQuantity,
      withdrawnQuantity: s.withdrawnQuantity,
      status: s.status,
      nextPullDate: s.nextPullDate,
    })),
    studies: studies.slice(0, 40).map((s) => ({
      studyId: s.studyId,
      productName: s.productName,
      batchNumber: s.batchNumber,
      studyType: s.studyType,
      storageCondition: s.storageCondition,
      chamberName: s.chamberName,
      availableQuantity: s.availableQuantity,
      totalQuantity: s.totalQuantity,
      status: s.status,
      nextPullDate: s.nextPullDate,
    })),
    variances: recs
      .filter((r) => r.variance !== 0 || r.status === "Variance Found" || r.status === "Investigation Required")
      .slice(0, 12)
      .map((r) => ({
        productName: r.productName,
        batchNumber: r.batchNumber,
        systemQuantity: r.systemQuantity,
        physicalQuantity: r.physicalQuantity,
        variance: r.variance,
        status: r.status,
        reconciliationDate: r.reconciliationDate,
      })),
    recentActivity: activity.map((tx) => ({
      transactionType: tx.transactionType,
      productName: tx.productName,
      batchNumber: tx.batchNumber,
      quantity: tx.quantity,
      performedByName: tx.performedByName,
      performedAt: tx.performedAt,
    })),
  };

  cache = { at: Date.now(), data };
  return data;
}
