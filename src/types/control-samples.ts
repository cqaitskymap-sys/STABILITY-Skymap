import type { MasterStatus } from "@/types";

export type CollectionStage = "Initial" | "Middle" | "End";

export type ControlCollectionStatus =
  | "Draft"
  | "Collected"
  | "Submitted"
  | "Received"
  | "Verification Pending"
  | "Verified"
  | "Stored"
  | "Verification Exception";

export type ControlObservationResult = "OK" | "Abnormal Observation";

export type ControlObservationStatus =
  | "Observation Due"
  | "Observation Completed"
  | "OK"
  | "Abnormal Observation"
  | "QA Review"
  | "Investigation Required"
  | "Closed";

export type ControlRequisitionStatus =
  | "Draft"
  | "Submitted"
  | "Approved"
  | "Rejected"
  | "Issued"
  | "Partially Returned"
  | "Returned"
  | "Closed";

export type ControlDestructionStatus =
  | "Due"
  | "Hold"
  | "Note Created"
  | "QA Initiated"
  | "Approved"
  | "Destroyed Pending Verification"
  | "Destroyed"
  | "Cancelled";

export type ControlHoldType =
  | "Legal enquiry pending"
  | "Market complaint investigation pending"
  | "Sample taken by regulatory authority"
  | "Matter not cleared"
  | "Other";

export type ControlTxType =
  | "CONTROL_SAMPLE_CREATED"
  | "CONTROL_SAMPLE_COLLECTED"
  | "CONTROL_SAMPLE_SUBMITTED"
  | "CONTROL_SAMPLE_RECEIVED"
  | "CONTROL_SAMPLE_VERIFIED"
  | "CONTROL_SAMPLE_STORED"
  | "CONTROL_SAMPLE_MOVED"
  | "CONTROL_SAMPLE_ISSUED"
  | "CONTROL_SAMPLE_RETURNED"
  | "CONTROL_SAMPLE_VERIFICATION_DISCARDED"
  | "CONTROL_SAMPLE_ADJUSTED"
  | "CONTROL_SAMPLE_RECONCILED"
  | "CONTROL_SAMPLE_DESTRUCTION_ELIGIBLE"
  | "CONTROL_SAMPLE_DESTRUCTION_HOLD"
  | "CONTROL_SAMPLE_DESTRUCTION_RELEASED"
  | "CONTROL_SAMPLE_DESTRUCTION_INITIATED"
  | "CONTROL_SAMPLE_DESTROYED"
  | "CONTROL_SAMPLE_DESTRUCTION_VERIFIED";

export interface ControlSampleQuantityMaster {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  revisionNumber: number;
  previousRevisionId?: string;
  effectiveDate: string;
  preparedBy?: string;
  checkedBy?: string;
  approvedBy?: string;
  conversionBatchQuantity?: number;
  conversionBatchUnit?: string;
  status: MasterStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ControlSampleCollection {
  id: string;
  collectionId: string;
  date: string;
  productId: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  batchSize?: string;
  manufacturingDate: string;
  expiryDate: string;
  marketId?: string;
  market?: string;
  requiredQuantity: number;
  actualQuantity: number;
  unit: string;
  collectionStage: CollectionStage;
  collectionTime?: string;
  collectedBy: string;
  physicalAppearanceCheck: boolean;
  codingDetailsCheck: boolean;
  motherBatch?: string;
  conversionBatch?: string;
  brand?: string;
  conversionNoteRef?: string;
  batchKind?: "Standard" | "Mother Batch" | "Conversion Batch";
  remarks?: string;
  status: ControlCollectionStatus;
  submittedAt?: string;
  receivedBy?: string;
  receivedAt?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  discrepancy?: string;
  exceptionRemarks?: string;
  controlSampleDocId?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ControlSampleObservation {
  id: string;
  observationId: string;
  controlSampleDocId: string;
  controlSampleId: string;
  productName: string;
  batchNumber: string;
  observationDate: string;
  observer: string;
  productType?: string;
  checklist: { parameter: string; result: string }[];
  productDescription?: string;
  physicalCondition?: string;
  packIntegrity?: string;
  leakage?: string;
  colour?: string;
  visibleParticles?: string;
  sealCondition?: string;
  otherObservation?: string;
  result: ControlObservationResult;
  status: ControlObservationStatus;
  discardedQuantity: number;
  investigationRef?: string;
  qaReview?: string;
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface ControlSampleRequisition {
  id: string;
  requisitionNumber: string;
  date: string;
  fromDepartment: string;
  controlSampleDocId: string;
  controlSampleId: string;
  productName: string;
  batchNumber: string;
  quantityRequired: number;
  quantityIssued: number;
  quantityReturned: number;
  reason: string;
  requestedBy: string;
  requestedDate: string;
  status: ControlRequisitionStatus;
  approvedBy?: string;
  approvedDate?: string;
  issuedTo?: string;
  issuedBy?: string;
  issuedAt?: string;
  returnedBy?: string;
  returnDate?: string;
  returnCheckedBy?: string;
  returnCondition?: string;
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ControlSampleHold {
  id: string;
  holdId: string;
  controlSampleDocId: string;
  controlSampleId: string;
  holdType: ControlHoldType;
  reason: string;
  referenceNumber?: string;
  holdDate: string;
  appliedBy: string;
  releasedBy?: string;
  releaseDate?: string;
  active: boolean;
  remarks?: string;
  createdAt: string;
}

export interface ControlSampleDestruction {
  id: string;
  dcnNumber: string;
  date: string;
  controlSampleDocId: string;
  controlSampleId: string;
  productName: string;
  batchNumber: string;
  quantity: number;
  reason: string;
  modeOfDestruction?: string;
  checklist: { step: string; completed: boolean; completedBy?: string; completedAt?: string; remarks?: string }[];
  status: ControlDestructionStatus;
  initiatedBy?: string;
  checkedBy?: string;
  verifiedBy?: string;
  destroyedOn?: string;
  destroyedBy?: string;
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ControlSampleBox {
  id: string;
  boxNumber: string;
  category?: string;
  rackNumber: string;
  partitionNumber?: string;
  productName?: string;
  batchNumber?: string;
  manufacturingDate?: string;
  expiryDate?: string;
  quantity?: number;
  remarks?: string;
  status: MasterStatus;
  createdAt: string;
}

export interface ControlSampleRack {
  id: string;
  rackNumber: string;
  partitionNumber?: string;
  area: string;
  status: MasterStatus;
  createdAt: string;
}

export interface ControlSampleBoxCategory {
  id: string;
  category: string;
  prefix: string;
  numberingPattern: string;
  currentSequence: number;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ControlObservationParameter {
  id: string;
  productType: string;
  parameter: string;
  status: MasterStatus;
  sortOrder: number;
}

export interface ControlSampleTx {
  id: string;
  transactionId: string;
  controlSampleId: string;
  controlSampleDocId: string;
  productName: string;
  batchNumber: string;
  transactionType: ControlTxType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  fromLocation?: string;
  toLocation?: string;
  reason?: string;
  reference?: string;
  remarks?: string;
  performedBy: string;
  performedByName: string;
  performedAt: string;
}
