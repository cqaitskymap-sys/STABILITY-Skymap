export type DailyCollectionSampleType = "Control Sample" | "Stability Sample";

export type DailyCollectionStatus = "Draft" | "Submitted" | "Reviewed" | "Finalized" | "Cancelled";

export type DailyCollectionAction =
  | "Created"
  | "Edited"
  | "Submitted"
  | "Reviewed"
  | "Finalized"
  | "Cancelled"
  | "Corrected";

export interface DailyCollectionCorrection {
  correctedAt: string;
  correctedBy: string;
  correctedByName: string;
  reason: string;
  changes: { field: string; oldValue: string; newValue: string }[];
}

export interface DailyCollectionRecord {
  id: string;
  recordId: string;
  serialNumber: number;
  serialDisplay: string;
  serialYear: number;

  date: string;
  sampleType: DailyCollectionSampleType;

  productId: string;
  productName: string;
  productCode?: string;

  batchId: string;
  batchNumber: string;
  batchSize?: string;
  manufacturingDate: string;
  expiryDate: string;

  marketId?: string;
  market: string;

  packSizeId?: string;
  packSize: string;

  quantityCollected: number;
  quantityUnit: string;

  collectedByUserId: string;
  collectedByName: string;
  collectedByEmployeeCode?: string;

  remarks?: string;

  controlSampleId?: string;
  controlSampleDocId?: string;
  controlCollectionId?: string;
  stabilityStudyId?: string;
  stabilitySampleId?: string;

  status: DailyCollectionStatus;

  backdatedEntry?: boolean;
  backdatedReason?: string;
  enteredBy?: string;
  enteredByName?: string;
  enteredAt?: string;

  duplicateAcknowledged?: boolean;
  duplicateReason?: string;

  corrections?: DailyCollectionCorrection[];

  submittedBy?: string;
  submittedByName?: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  finalizedBy?: string;
  finalizedByName?: string;
  finalizedAt?: string;
  cancelledBy?: string;
  cancelledByName?: string;
  cancelledAt?: string;
  cancelReason?: string;

  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedBy: string;
  updatedByName: string;
  updatedAt: string;
}

export interface DailyCollectionInput {
  date: string;
  sampleType: DailyCollectionSampleType;
  productId: string;
  productName: string;
  productCode?: string;
  batchId: string;
  batchNumber: string;
  batchSize?: string;
  manufacturingDate: string;
  expiryDate: string;
  marketId?: string;
  market: string;
  packSizeId?: string;
  packSize: string;
  quantityCollected: number;
  quantityUnit: string;
  collectedByUserId: string;
  collectedByName: string;
  collectedByEmployeeCode?: string;
  remarks?: string;
  controlSampleId?: string;
  controlSampleDocId?: string;
  controlCollectionId?: string;
  stabilityStudyId?: string;
  stabilitySampleId?: string;
  duplicateAcknowledged?: boolean;
  duplicateReason?: string;
  backdatedReason?: string;
}
