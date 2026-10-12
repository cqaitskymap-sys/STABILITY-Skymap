"use client";

import { controlOrg, isDestructionEligible } from "@/lib/control-samples";
import { todayISO } from "@/lib/utils";
import { getOrganizationSettings } from "@/services/organization";
import {
  listCollections,
  listControlSamples,
  listObservations,
  listRequisitions,
} from "@/services/control-samples";

export type ControlAiContext = {
  generatedAt: string;
  module: "control-samples";
  stats: {
    total: number;
    available: number;
    observationDue: number;
    destructionDue: number;
    openRequisitions: number;
    abnormalObservations: number;
  };
  observationDue: {
    controlSampleId: string;
    productName: string;
    batchNumber: string;
    nextObservationDate: string;
    availableQuantity: number;
    status: string;
    locationLabel: string;
  }[];
  destructionDue: {
    controlSampleId: string;
    productName: string;
    batchNumber: string;
    expiryDate: string;
    destructionEligibleDate: string;
    availableQuantity: number;
    status: string;
  }[];
  samples: {
    controlSampleId: string;
    productName: string;
    batchNumber: string;
    availableQuantity: number;
    unit: string;
    status: string;
    locationLabel: string;
    nextObservationDate?: string;
    destructionEligibleDate?: string;
    expiryDate: string;
  }[];
  collections: {
    collectionId: string;
    productName: string;
    batchNumber: string;
    actualQuantity: number;
    unit: string;
    stage: string;
    status: string;
    date: string;
  }[];
  requisitions: {
    requisitionNumber: string;
    productName: string;
    batchNumber: string;
    quantityRequired: number;
    quantityIssued: number;
    fromDepartment: string;
    status: string;
    reason: string;
  }[];
  abnormalObservations: {
    observationId: string;
    controlSampleId: string;
    productName: string;
    batchNumber: string;
    result: string;
    status: string;
    observationDate: string;
  }[];
};

const CACHE_MS = 45_000;
let cache: { at: number; data: ControlAiContext } | null = null;

export function invalidateControlContext() {
  cache = null;
}

export async function getControlContext(force = false): Promise<ControlAiContext> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const [samples, collections, observations, requisitions, settings] = await Promise.all([
    listControlSamples(),
    listCollections(),
    listObservations(),
    listRequisitions(),
    getOrganizationSettings(),
  ]);
  const cfg = controlOrg(settings);
  const today = todayISO();
  const live = samples.filter((s) => s.status !== "Destroyed" && s.status !== "Disposed");
  const observationDue = live.filter((s) => Boolean(s.nextObservationDate && s.nextObservationDate <= today));
  const destructionDue = live.filter((s) => isDestructionEligible(s, cfg));

  const data: ControlAiContext = {
    generatedAt: new Date().toISOString(),
    module: "control-samples",
    stats: {
      total: samples.length,
      available: live.filter((s) => (s.availableQuantity || 0) > 0).length,
      observationDue: observationDue.length,
      destructionDue: destructionDue.length,
      openRequisitions: requisitions.filter((r) => r.status === "Submitted" || r.status === "Approved").length,
      abnormalObservations: observations.filter((o) => o.result === "Abnormal Observation" && o.status !== "Closed").length,
    },
    observationDue: observationDue.slice(0, 20).map((s) => ({
      controlSampleId: s.controlSampleId,
      productName: s.productName,
      batchNumber: s.batchNumber,
      nextObservationDate: s.nextObservationDate || "",
      availableQuantity: s.availableQuantity,
      status: s.status,
      locationLabel: s.locationLabel || "",
    })),
    destructionDue: destructionDue.slice(0, 20).map((s) => ({
      controlSampleId: s.controlSampleId,
      productName: s.productName,
      batchNumber: s.batchNumber,
      expiryDate: s.expiryDate,
      destructionEligibleDate: s.destructionEligibleDate || "",
      availableQuantity: s.availableQuantity,
      status: s.status,
    })),
    samples: live.slice(0, 40).map((s) => ({
      controlSampleId: s.controlSampleId,
      productName: s.productName,
      batchNumber: s.batchNumber,
      availableQuantity: s.availableQuantity,
      unit: s.unit,
      status: s.status,
      locationLabel: s.locationLabel || "",
      nextObservationDate: s.nextObservationDate,
      destructionEligibleDate: s.destructionEligibleDate,
      expiryDate: s.expiryDate,
    })),
    collections: collections.slice(0, 20).map((c) => ({
      collectionId: c.collectionId,
      productName: c.productName,
      batchNumber: c.batchNumber,
      actualQuantity: c.actualQuantity,
      unit: c.unit,
      stage: c.collectionStage,
      status: c.status,
      date: c.date,
    })),
    requisitions: requisitions
      .filter((r) => r.status !== "Closed" && r.status !== "Rejected" && r.status !== "Returned")
      .slice(0, 20)
      .map((r) => ({
        requisitionNumber: r.requisitionNumber,
        productName: r.productName,
        batchNumber: r.batchNumber,
        quantityRequired: r.quantityRequired,
        quantityIssued: r.quantityIssued,
        fromDepartment: r.fromDepartment,
        status: r.status,
        reason: r.reason,
      })),
    abnormalObservations: observations
      .filter((o) => o.result === "Abnormal Observation" && o.status !== "Closed")
      .slice(0, 12)
      .map((o) => ({
        observationId: o.observationId,
        controlSampleId: o.controlSampleId,
        productName: o.productName,
        batchNumber: o.batchNumber,
        result: o.result,
        status: o.status,
        observationDate: o.observationDate,
      })),
  };

  cache = { at: Date.now(), data };
  return data;
}
