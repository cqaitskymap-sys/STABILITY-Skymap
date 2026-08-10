export type UserRole = "Admin" | "QA Manager" | "QA User";

export type MasterStatus = "Active" | "Inactive";

export type ChamberStatus = "Active" | "Under Maintenance" | "Inactive";

export type StudyStatus =
  | "Draft"
  | "Active"
  | "Partially Withdrawn"
  | "Fully Withdrawn"
  | "Completed"
  | "Disposed";

export type SampleStatus =
  | "Available"
  | "Partially Withdrawn"
  | "Fully Withdrawn"
  | "Depleted"
  | "Under Reconciliation"
  | "Disposed";

export type PullPointStatus =
  | "Upcoming"
  | "Due Soon"
  | "Due Today"
  | "Overdue"
  | "Withdrawn"
  | "Partially Withdrawn"
  | "Missed";

export type ReconciliationStatus =
  | "Matched"
  | "Variance Found"
  | "Investigation Required"
  | "Adjusted";

export type TransactionType =
  | "SAMPLE_CHARGED"
  | "SAMPLE_ALLOCATED"
  | "SAMPLE_WITHDRAWN"
  | "SAMPLE_TRANSFERRED"
  | "SAMPLE_RETURNED"
  | "SAMPLE_ADJUSTED"
  | "SAMPLE_DISPOSED";

export type AlertType =
  | "WITHDRAWAL_DUE_7_DAYS"
  | "WITHDRAWAL_DUE_TODAY"
  | "WITHDRAWAL_OVERDUE"
  | "INSUFFICIENT_QUANTITY"
  | "CHAMBER_NEAR_FULL"
  | "CHAMBER_INACTIVE"
  | "RECONCILIATION_VARIANCE"
  | "SAMPLE_DEPLETED";

export type DisposalReason =
  | "Study Completed"
  | "Expired"
  | "Damaged"
  | "Excess Sample"
  | "Other";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  productName: string;
  productCode?: string;
  strength?: string;
  dosageForm?: string;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  productId: string;
  productName: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudyType {
  id: string;
  name: string;
  code: string;
  description?: string;
  defaultPullPointIds: string[];
  status: MasterStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface StorageCondition {
  id: string;
  name: string;
  temperature: string;
  relativeHumidity: string;
  displayLabel: string;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PullPointMaster {
  id: string;
  code: string;
  label: string;
  months: number;
  studyTypeIds: string[];
  status: MasterStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Chamber {
  id: string;
  chamberId: string;
  chamberName: string;
  chamberType: string;
  temperature: string;
  relativeHumidity: string;
  capacity: number;
  usedCapacity: number;
  location: string;
  status: ChamberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StorageLocation {
  id: string;
  chamberId: string;
  chamberName: string;
  rack: string;
  shelf: string;
  position: string;
  label: string;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StabilityStudy {
  id: string;
  studyId: string;
  productId: string;
  batchId: string;
  productName: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  chargingDate: string;
  studyTypeId: string;
  studyType: string;
  storageConditionId: string;
  storageCondition: string;
  chamberId: string;
  chamberName: string;
  locationId: string;
  locationLabel: string;
  duration: string;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  withdrawnQuantity: number;
  disposedQuantity: number;
  unit: string;
  notes?: string;
  status: StudyStatus;
  nextPullDate?: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface StabilitySample {
  id: string;
  sampleId: string;
  studyId: string;
  studyDocId: string;
  productId: string;
  batchId: string;
  productName: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  chargingDate: string;
  studyType: string;
  studyTypeId: string;
  storageCondition: string;
  storageConditionId: string;
  chamberId: string;
  chamberName: string;
  locationId: string;
  locationLabel: string;
  totalQuantity: number;
  reservedQuantity: number;
  withdrawnQuantity: number;
  disposedQuantity: number;
  availableQuantity: number;
  unit: string;
  status: SampleStatus;
  nextPullDate?: string | null;
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudyPullPoint {
  id: string;
  pullPointId: string;
  studyId: string;
  studyDocId: string;
  sampleId: string;
  sampleDocId: string;
  productName: string;
  batchNumber: string;
  studyType: string;
  storageCondition: string;
  chamberId: string;
  chamberName: string;
  pullPoint: string;
  months: number;
  plannedDate: string;
  plannedQuantity: number;
  actualQuantity: number;
  status: PullPointStatus;
  withdrawalId?: string | null;
  completedDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SampleWithdrawal {
  id: string;
  withdrawalId: string;
  sampleId: string;
  sampleDocId: string;
  studyId: string;
  studyDocId: string;
  pullPointDocId: string;
  productName: string;
  batchNumber: string;
  studyType: string;
  storageCondition: string;
  chamberName: string;
  locationLabel: string;
  pullPoint: string;
  plannedQuantity: number;
  actualQuantity: number;
  withdrawalDate: string;
  withdrawnBy: string;
  receivedBy: string;
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface SampleMovement {
  id: string;
  movementId: string;
  sampleId: string;
  sampleDocId: string;
  studyId: string;
  productName: string;
  batchNumber: string;
  fromChamberId: string;
  fromChamberName: string;
  fromLocationId: string;
  fromLocationLabel: string;
  toChamberId: string;
  toChamberName: string;
  toLocationId: string;
  toLocationLabel: string;
  movementDate: string;
  movedBy: string;
  reason: string;
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface SampleDisposal {
  id: string;
  disposalId: string;
  sampleId: string;
  sampleDocId: string;
  studyId: string;
  productName: string;
  batchNumber: string;
  quantity: number;
  disposalDate: string;
  reason: DisposalReason;
  disposedBy: string;
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface InventoryReconciliation {
  id: string;
  reconciliationId: string;
  sampleId: string;
  sampleDocId: string;
  studyId: string;
  productName: string;
  batchNumber: string;
  studyType: string;
  systemQuantity: number;
  physicalQuantity: number;
  variance: number;
  status: ReconciliationStatus;
  adjustmentQuantity?: number;
  reason?: string;
  remarks?: string;
  performedBy: string;
  performedByName: string;
  approvedBy?: string;
  reconciliationDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryTransaction {
  id: string;
  transactionId: string;
  sampleId: string;
  sampleDocId: string;
  studyId: string;
  productName: string;
  batchNumber: string;
  transactionType: TransactionType;
  quantity: number;
  fromLocation?: string;
  toLocation?: string;
  reason?: string;
  remarks?: string;
  performedBy: string;
  performedByName: string;
  performedAt: string;
}

export interface InventoryAlert {
  id: string;
  alertType: AlertType;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
  relatedId?: string;
  relatedType?: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  recordId?: string;
  recordType?: string;
  previousValue?: unknown;
  newValue?: unknown;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
}

export interface CounterDoc {
  prefix: string;
  year: number;
  value: number;
}

export interface DashboardStats {
  totalActiveStudies: number;
  totalSamples: number;
  availableSamples: number;
  samplesWithdrawn: number;
  samplesDueSoon: number;
  overdueSamples: number;
  activeChambers: number;
  chamberUtilization: number;
  studyTypeOverview: {
    studyType: string;
    activeStudies: number;
    totalSamples: number;
    availableSamples: number;
    upcomingWithdrawals: number;
  }[];
}
