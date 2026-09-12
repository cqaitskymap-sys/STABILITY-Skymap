export type UserRole =
  | "Admin"
  | "QA Manager"
  | "QA Executive"
  | "QA User"
  | "QC User"
  | "Engineering User"
  | "Read Only";

export type Permission =
  | "masters.manage"
  | "users.manage"
  | "studies.create"
  | "studies.edit"
  | "charging.perform"
  | "receiving.perform"
  | "withdrawal.perform"
  | "movement.perform"
  | "reconciliation.perform"
  | "disposal.perform"
  | "reports.view"
  | "inventory.view"
  | "control.perform"
  | "control.collect"
  | "chamber.ops"
  | "protocol.manage"
  | "analysis.perform"
  | "approve.records"
  | "audit.view";

export type MasterStatus = "Active" | "Inactive";

export type ChamberStatus =
  | "Active"
  | "Under Maintenance"
  | "Inactive"
  | "Off"
  | "Starting"
  | "Stabilizing"
  | "Running"
  | "Alarm"
  | "Out of Service";

export type StudyStatus =
  | "Draft"
  | "Active"
  | "Partially Withdrawn"
  | "Fully Withdrawn"
  | "Completed"
  | "Disposed"
  | "Discontinued"
  | "Pending Approval";

export type SampleStatus =
  | "Available"
  | "Partially Withdrawn"
  | "Fully Withdrawn"
  | "Depleted"
  | "Under Reconciliation"
  | "Disposed"
  | "Received - Awaiting COA"
  | "COA Received - Ready for Charging"
  | "Charged"
  | "Loose Sample";

export type PullPointStatus =
  | "Upcoming"
  | "Due Soon"
  | "Due Today"
  | "Due"
  | "Within Window"
  | "Overdue"
  | "Withdrawn"
  | "Partially Withdrawn"
  | "Sent to QC"
  | "Completed"
  | "Cancelled"
  | "Missed";

export type ReconciliationStatus =
  | "Matched"
  | "Variance Found"
  | "Investigation Required"
  | "Adjusted";

export type TransactionType =
  | "SAMPLE_RECEIVED"
  | "SAMPLE_CHARGED"
  | "SAMPLE_ALLOCATED"
  | "SAMPLE_WITHDRAWN"
  | "SAMPLE_TRANSFERRED"
  | "SAMPLE_RETURNED"
  | "SAMPLE_ADJUSTED"
  | "SAMPLE_RECONCILED"
  | "SAMPLE_DISPOSED"
  | "CONTROL_SAMPLE_CREATED"
  | "CONTROL_SAMPLE_ISSUED"
  | "CONTROL_SAMPLE_RETURNED"
  | "CONTROL_SAMPLE_MOVED"
  | "CONTROL_SAMPLE_RECONCILED"
  | "CONTROL_SAMPLE_DISPOSED"
  | "CHAMBER_SAMPLE_TRANSFERRED";

export type AlertType =
  | "WITHDRAWAL_DUE_7_DAYS"
  | "WITHDRAWAL_DUE_TODAY"
  | "WITHDRAWAL_OVERDUE"
  | "INSUFFICIENT_QUANTITY"
  | "CHAMBER_NEAR_FULL"
  | "CHAMBER_INACTIVE"
  | "RECONCILIATION_VARIANCE"
  | "SAMPLE_DEPLETED"
  | "CHARGING_BEYOND_30_DAYS"
  | "AWAITING_COA"
  | "READY_FOR_CHARGING"
  | "ANALYSIS_DUE"
  | "ANALYSIS_OVERDUE"
  | "CHAMBER_EXCURSION"
  | "CHAMBER_ALARM"
  | "CALIBRATION_DUE"
  | "MAPPING_DUE"
  | "CLEANING_DUE"
  | "MKT_PENDING"
  | "CONTROL_DISPOSAL_DUE"
  | "ACCOUNT_EXPIRY"
  | "PASSWORD_EXPIRY";

export type DisposalReason =
  | "Study Completed"
  | "Expired"
  | "Damaged"
  | "Excess Sample"
  | "Other";

export interface AppUser {
  uid: string;
  /** Login ID (Employee ID). */
  employeeId: string;
  /** Firebase Auth email (derived from Employee ID) or legacy contact email. */
  email: string;
  displayName: string;
  role: UserRole;
  department?: string;
  /** When set, overrides default role permissions for module access. */
  moduleAccess?: Permission[];
  active: boolean;
  validTo?: string;
  passwordLastChanged?: string;
  lastLogin?: string;
  failedLoginCount?: number;
  accountLocked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  productName: string;
  productCode?: string;
  genericName?: string;
  strength?: string;
  dosageForm?: string;
  labelClaim?: string;
  market?: string;
  brand?: string;
  shelfLife?: string;
  storageCondition?: string;
  primaryPackaging?: string;
  secondaryPackaging?: string;
  pharmacopoeialStatus?: string;
  applicableSpecification?: string;
  stpNumber?: string;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Batch {
  id: string;
  productId: string;
  productName: string;
  batchNumber: string;
  batchSize?: string;
  manufacturingDate: string;
  expiryDate: string;
  releaseDate?: string;
  manufacturingSite?: string;
  coaStatus?: "Pending" | "Received" | "Not Applicable";
  stabilityEligibility?: boolean;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export type StudyWorkflow = "standard-inventory" | "photostability" | "in-use";

export interface StudyType {
  id: string;
  name: string;
  code: string;
  description?: string;
  workflow?: StudyWorkflow;
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
  setTemperature?: number;
  temperatureTolerance?: number;
  setRh?: number;
  rhTolerance?: number;
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
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  temperature: string;
  relativeHumidity: string;
  setTemperature?: number;
  temperatureTolerance?: number;
  setRh?: number;
  rhTolerance?: number;
  temperatureChannels?: number;
  humidityChannels?: number;
  capacity: number;
  usedCapacity: number;
  location: string;
  storageConditionId?: string;
  storageCondition?: string;
  installationDate?: string;
  calibrationDueDate?: string;
  mappingDueDate?: string;
  maintenanceDueDate?: string;
  cleaningFrequency?: string;
  remarks?: string;
  status: ChamberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StorageLocation {
  id: string;
  chamberId: string;
  chamberName: string;
  area?: string;
  rack: string;
  shelf: string;
  position: string;
  label: string;
  allowMultiOccupancy?: boolean;
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

export type SampleOrientation = "Upright" | "Inverted" | "Mixed";
export type SampleKind = "stability" | "control";

export interface StabilityStudy {
  id: string;
  studyId: string;
  productId: string;
  batchId: string;
  productName: string;
  genericName?: string;
  batchNumber: string;
  batchSize?: string;
  manufacturingDate: string;
  expiryDate: string;
  chargingDate: string;
  incubationDate?: string;
  studyTypeId: string;
  studyType: string;
  studyReasonId?: string;
  studyReason?: string;
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
  returnedQuantity?: number;
  disposedQuantity: number;
  unit: string;
  invertedPercent?: number;
  uprightQuantity?: number;
  invertedQuantity?: number;
  protocolNumber?: string;
  protocolDocId?: string;
  lateCharging?: boolean;
  lateChargingReason?: string;
  receiptDocId?: string;
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
  incubationDate?: string;
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
  returnedQuantity?: number;
  disposedQuantity: number;
  availableQuantity: number;
  unit: string;
  orientation?: SampleOrientation;
  isLooseSample?: boolean;
  sampleKind?: SampleKind;
  receiptDocId?: string;
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
  windowEndDate?: string;
  plannedQuantity: number;
  actualQuantity: number;
  orientation?: SampleOrientation;
  status: PullPointStatus;
  withdrawalId?: string | null;
  analysisRequestId?: string | null;
  completedDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WithdrawalRecordStatus =
  | "Upcoming"
  | "Due"
  | "Within Window"
  | "Overdue"
  | "Withdrawn"
  | "Sent to QC"
  | "Completed"
  | "Cancelled";

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
  scheduledDate?: string;
  windowEndDate?: string;
  withdrawalDate: string;
  withdrawnBy: string;
  receivedBy: string;
  qcRequestId?: string;
  analysisRequestId?: string;
  status?: WithdrawalRecordStatus;
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
  unit?: string;
  previousBalance?: number;
  newBalance?: number;
  fromLocation?: string;
  toLocation?: string;
  reason?: string;
  remarks?: string;
  reference?: string;
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
  module?: string;
  recordId?: string;
  recordType?: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole?: string;
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
  samplesAwaitingCoa: number;
  samplesReadyForCharging: number;
  controlSampleCount: number;
  pendingReconciliation: number;
  activeChamberAlarms: number;
  chamberExcursions: number;
  calibrationDue: number;
  mappingDue: number;
  cleaningDue: number;
  analysisPending: number;
  studyTypeOverview: {
    studyType: string;
    activeStudies: number;
    totalSamples: number;
    availableSamples: number;
    upcomingWithdrawals: number;
  }[];
}

export type ReceiptStatus =
  | "Received - Awaiting COA"
  | "COA Received - Ready for Charging"
  | "Charged"
  | "Voided";

export interface StudyReason {
  id: string;
  name: string;
  description?: string;
  status: MasterStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PackagingMaterial {
  id: string;
  kind: "Primary" | "Secondary" | "Container Closure";
  material: string;
  supplier?: string;
  arNumber?: string;
  approvedAr?: string;
  description?: string;
  packSize?: string;
  status: MasterStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SampleReceipt {
  id: string;
  receiptId: string;
  date: string;
  productId: string;
  productName: string;
  batchId: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  sampleQuantity: number;
  unit: string;
  sampleReceivedBy: string;
  dateReceived: string;
  status: ReceiptStatus;
  coaStatus: "Pending" | "Received";
  chargingEligibility: boolean;
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  checkedBy?: string;
  checkedDate?: string;
  chargedStudyId?: string;
  chargedAt?: string;
  updatedAt: string;
}

export type ControlSampleStatus =
  | "Available"
  | "Partially Issued"
  | "Depleted"
  | "Under Reconciliation"
  | "Disposed"
  | "Retention"
  | "Collected"
  | "Submitted"
  | "Received"
  | "Verified"
  | "Stored"
  | "Observation Due"
  | "Destruction Eligible"
  | "Destruction Hold"
  | "Destroyed";

export interface ControlSample {
  id: string;
  controlSampleId: string;
  productId: string;
  productName: string;
  productCode?: string;
  batchId: string;
  batchNumber: string;
  batchSize?: string;
  manufacturingDate: string;
  expiryDate: string;
  packSize?: string;
  collectionDate?: string;
  collectionStage?: string;
  quantity: number;
  initialQuantity?: number;
  issuedQuantity: number;
  returnedQuantity: number;
  disposedQuantity: number;
  destroyedQuantity?: number;
  verificationDiscardedQuantity?: number;
  adjustedQuantity?: number;
  availableQuantity: number;
  unit: string;
  containerType?: string;
  packConfiguration?: string;
  storageCondition?: string;
  temperature?: string;
  relativeHumidity?: string;
  storageArea?: string;
  rackNumber?: string;
  partitionNumber?: string;
  boxNumber?: string;
  position?: string;
  chamberId?: string;
  chamberName?: string;
  locationId?: string;
  locationLabel?: string;
  purpose?: string;
  retentionBasis?: string;
  retentionEndDate?: string;
  disposalEligibleDate?: string;
  destructionEligibleDate?: string;
  destructionHold?: boolean;
  lastObservationDate?: string;
  nextObservationDate?: string;
  motherBatch?: string;
  conversionBatch?: string;
  brand?: string;
  conversionNoteRef?: string;
  status: ControlSampleStatus;
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type AnalysisRequestStatus = "Open" | "Sent to QC" | "Within Timeline" | "Due Soon" | "Overdue" | "Completed" | "Cancelled";

export interface AnalysisRequest {
  id: string;
  requestId: string;
  date: string;
  withdrawalId?: string;
  sampleId: string;
  sampleDocId: string;
  studyId: string;
  studyDocId: string;
  productName: string;
  batchNumber: string;
  sampleQuantity: number;
  unit: string;
  manufacturingDate: string;
  expiryDate: string;
  studyType: string;
  stage: string;
  dueDate: string;
  analysisDueDate: string;
  analysisRequired?: string;
  qaOfficer: string;
  qcOfficer?: string;
  status: AnalysisRequestStatus;
  completedDate?: string;
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type AlarmStatus = "Active" | "Acknowledged" | "Rectified" | "Closed";

export interface ChamberAlarm {
  id: string;
  alarmId: string;
  chamberId: string;
  chamberName: string;
  alarmType: string;
  startTime: string;
  endTime?: string;
  status: AlarmStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  rectifiedBy?: string;
  rectifiedAt?: string;
  remark?: string;
  ipAddress?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type ExcursionStatus = "Open" | "QA Assessment" | "Transferred" | "Closed";

export interface ChamberExcursion {
  id: string;
  excursionId: string;
  chamberId: string;
  chamberName: string;
  condition: string;
  startTime: string;
  endTime?: string;
  durationHours?: number;
  parameter: "Temperature" | "Humidity" | "Both";
  setPoint?: string;
  actualValue?: string;
  minValue?: string;
  maxValue?: string;
  beyond48Hours: boolean;
  affectedSampleIds: string[];
  affectedStudyIds: string[];
  actionTaken?: string;
  deviationReference?: string;
  standbyChamberId?: string;
  qaAssessment?: string;
  status: ExcursionStatus;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChamberCleaningRecord {
  id: string;
  recordId: string;
  chamberId: string;
  chamberName: string;
  date: string;
  cleaningAgent?: string;
  durationFrom?: string;
  durationTo?: string;
  cleanedBy: string;
  checkedBy?: string;
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export type CalibrationStatus = "Valid" | "Due Soon" | "Expired" | "Out of Service";

export interface ChamberCalibrationRecord {
  id: string;
  recordId: string;
  chamberId: string;
  chamberName: string;
  instrument?: string;
  instrumentId?: string;
  calibrationDate: string;
  dueDate: string;
  vendor?: string;
  certificateNo?: string;
  result?: string;
  attachmentPath?: string;
  status: CalibrationStatus;
  approvedBy?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface TemperatureMappingRecord {
  id: string;
  recordId: string;
  chamberId: string;
  chamberName: string;
  mappingDate: string;
  nextDueDate: string;
  protocolNumber?: string;
  reportNumber?: string;
  performedBy?: string;
  vendor?: string;
  result?: string;
  attachmentPath?: string;
  approvalStatus: "Draft" | "Approved" | "Rejected";
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface ChamberMaintenanceRecord {
  id: string;
  recordId: string;
  chamberId: string;
  chamberName: string;
  maintenanceType: string;
  date: string;
  description?: string;
  engineer?: string;
  vendor?: string;
  startTime?: string;
  endTime?: string;
  spareParts?: string;
  observation?: string;
  correctiveAction?: string;
  status: "Open" | "In Progress" | "Completed";
  nextDueDate?: string;
  attachmentPath?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface ChamberEvent {
  id: string;
  eventId: string;
  chamberId: string;
  chamberName: string;
  eventDate: string;
  eventTime: string;
  eventType: string;
  description: string;
  userName: string;
  remark?: string;
  createdAt: string;
}

export interface ChamberDataLog {
  id: string;
  chamberId: string;
  chamberName: string;
  timestamp: string;
  channel?: string;
  temperature?: number;
  rh?: number;
  setPoint?: number;
  processValue?: number;
  alarmStatus?: string;
  source: "imported" | "integration" | "simulation";
  createdAt: string;
}

export type DestructionStatus = "Pending Authorization" | "Approved" | "Destroyed" | "Verified" | "Cancelled";

export interface SampleDisposal {
  id: string;
  disposalId: string;
  sampleId: string;
  sampleDocId: string;
  studyId: string;
  productName: string;
  batchNumber: string;
  storageCondition?: string;
  quantity: number;
  disposalDate: string;
  reason: DisposalReason;
  method?: string;
  initiatedBy?: string;
  checkedBy?: string;
  authorizedBy?: string;
  disposedBy: string;
  verifiedBy?: string;
  status?: DestructionStatus;
  attachmentPath?: string;
  remarks?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface ElectronicSignature {
  id: string;
  recordType: string;
  recordId: string;
  meaning: "Prepared By" | "Checked By" | "Approved By" | "Verified By" | "Authorized By";
  userId: string;
  userName: string;
  userRole: string;
  signedAt: string;
  recordVersion?: string;
}

export interface StabilityProtocol {
  id: string;
  protocolNumber: string;
  studyDocId?: string;
  productName: string;
  batchNumber?: string;
  status: "Draft" | "Approved" | "Superseded";
  sections: Record<string, string>;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface StabilityStudyReport {
  id: string;
  reportNumber: string;
  studyDocId: string;
  studyId: string;
  productName: string;
  genericName?: string;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate?: string;
  labelClaim?: string;
  stpNo?: string;
  protocolNo?: string;
  chamberId?: string;
  chargingDate?: string;
  packagingStyle?: string;
  apiSource?: string;
  primaryPackagingSource?: string;
  proposedShelfLife?: string;
  assignedShelfLife?: string;
  conclusion?: string;
  status: "Draft" | "Approved";
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface WaterLossStudy {
  id: string;
  studyRef: string;
  productName: string;
  genericName?: string;
  batchNumber: string;
  protocolNumber?: string;
  chamberName?: string;
  storageCondition?: string;
  studyType: string;
  filledVolume?: string;
  initialWeight: number;
  observedWeight: number;
  interval?: string;
  percentWaterLoss: number;
  acceptanceLimit: number;
  remark?: string;
  status: "Draft" | "Approved";
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface OrganizationSettings {
  companyName: string;
  plantCode: string;
  departmentCode: string;
  documentPrefix: string;
  chargingWindowDays: number;
  withdrawalWindowDays: number;
  analysisDaysAccelerated: number;
  analysisDaysLongTerm: number;
  invertedPercentDefault: number;
  waterLossLimitPercent: number;
  requireReceiptBeforeCharging: boolean;
  requireLateChargingReason: boolean;
  requireDestructionApproval: boolean;
  allowMultiOccupancy: boolean;
  hardwareIntegrationEnabled: boolean;
  simulationEnabled: boolean;
  passwordMinLength: number;
  passwordMaxLength: number;
  failedLoginLockout: number;
  controlDestructionMonthsAfterExpiry: number;
  controlObservationIntervalMonths: number;
  controlObservationAfterExpiryMonths: number;
  controlConversionBatchQuantity: number;
  controlRequireWithdrawalApproval: boolean;
  controlAllowDuplicateBoxOccupancy: boolean;
  labelColors: {
    accelerated: string;
    longTerm: string;
    intermediate: string;
  };
  updatedAt?: string;
  updatedBy?: string;
}

export interface SopTask {
  id: string;
  title: string;
  cadence: "Daily" | "Weekly" | "Monthly" | "Bimonthly" | "Annual";
  module: string;
  href: string;
  dueDate: string;
  status: "Open" | "Completed";
  completedBy?: string;
  completedAt?: string;
}

export interface MktReport {
  id: string;
  reportId: string;
  chamberId: string;
  chamberName: string;
  weekLabel: string;
  startDate: string;
  endDate: string;
  lowestTemperature?: number;
  highestTemperature?: number;
  averageTemperature?: number;
  mkt?: number;
  dataCompleteness: number;
  dataPoints: number;
  sufficient: boolean;
  message?: string;
  generatedBy: string;
  generatedDate: string;
}

export type {
  CollectionStage,
  ControlCollectionStatus,
  ControlObservationResult,
  ControlObservationStatus,
  ControlRequisitionStatus,
  ControlDestructionStatus,
  ControlHoldType,
  ControlTxType,
  ControlSampleQuantityMaster,
  ControlSampleCollection,
  ControlSampleObservation,
  ControlSampleRequisition,
  ControlSampleHold,
  ControlSampleDestruction,
  ControlSampleBox,
  ControlSampleRack,
  ControlSampleBoxCategory,
  ControlObservationParameter,
  ControlSampleTx,
} from "./control-samples";

