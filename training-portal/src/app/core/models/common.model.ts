/** Shared primitives used across every feature module. */

export type Id = number;

export interface AuditInfo {
  createdBy?: string;
  createdOn?: string;
  modifiedBy?: string;
  modifiedOn?: string;
}

export interface PagedRequest {
  page: number;
  pageSize: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  [key: string]: unknown;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: string[];
}

export interface LookupItem {
  id: Id;
  name: string;
  code?: string;
  parentId?: Id | null;
}

export type RecordStatus = 'Active' | 'Inactive';

export const RECORD_STATUSES: RecordStatus[] = ['Active', 'Inactive'];

/**
 * Returned once, when an account is created or its password is reset. The
 * password is shown to the creator and never stored in readable form, so it
 * cannot be retrieved afterwards — only reissued.
 */
export interface GeneratedCredentials {
  userCode: string;
  temporaryPassword: string;
}

/** One state's slice of the programme, for the dashboard map. */
export interface StateCoverage {
  /** LGD state code — how the map keys its tiles. */
  stateCode: number;
  state: string;
  programTypes: number;
  programmes: number;
  participants: number;
}

/** One district, returned only when a single state is filtered. */
export interface DistrictCoverage {
  districtCode: number;
  district: string;
  /**
   * The state it sits in. On every row because district names are not unique
   * across India, and because the map highlights the state a row belongs to.
   */
  state: string;
  stateCode: number;
  programTypes: number;
  programmes: number;
  participants: number;
}

export interface StateCoverageResult {
  states: StateCoverage[];
  /** The filtered state's districts. Empty unless exactly one state is chosen. */
  districts?: DistrictCoverage[];
  /** Which state those districts belong to, for the column heading. */
  districtsOf?: string | null;
  maxProgramTypes: number;
  maxParticipants: number;
  totalParticipants: number;
  totalProgrammes: number;
  statesCovered: number;
}

/**
 * One person the scheme has qualified, on one programme. A person qualified on
 * two programmes is two rows, because they hold two qualifications.
 */
export interface QualifiedProfessional {
  participantId: Id;
  applicantId: Id;
  applicantCode: string;
  fullName: string;
  email?: string | null;
  mobile?: string | null;

  categoryId: Id;
  categoryName?: string | null;
  subCategoryId: Id;
  subCategoryName?: string | null;
  programTypeId: Id;
  programTypeName?: string | null;

  programmeId: Id;
  programmeCode?: string | null;
  programmeName?: string | null;

  stateCode?: number | null;
  stateName?: string | null;
  districtCode?: number | null;
  districtName?: string | null;

  examScore?: number | null;
  attendancePercent: number;
  qualifiedOn?: string | null;

  /** The certificate row, so it can be opened or re-sent. Null when none. */
  certificateId?: Id | null;
  /** Qualification or Participation. */
  certificateKind?: string | null;
  certificateNumber?: string | null;
  issuedOn?: string | null;
  validTill?: string | null;
  revokedOn?: string | null;

  /** Valid, Expiring, Expired, Revoked or NotIssued — as of today. */
  standing: CertificateStanding;
  daysToExpiry?: number | null;
}

export type CertificateStanding =
  | 'Valid'
  | 'Expiring'
  | 'Expired'
  | 'Revoked'
  | 'NotIssued';

/** How the deployment itself is set. The gateway key is never sent back. */
export interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage?: string | null;
  maintenanceUntil?: string | null;

  paymentEnabled: boolean;
  paymentGateway?: string | null;
  paymentTestMode: boolean;
  merchantId?: string | null;
  accessCode?: string | null;
  /** True when a working key is stored. The value itself is never readable. */
  hasWorkingKey: boolean;
  returnUrl?: string | null;
  cancelUrl?: string | null;
  /** False until the gateway has everything it needs to be switched on. */
  paymentConfigured: boolean;

  /** The largest file anybody may publish, in megabytes. */
  maxUploadMb: number;

  panVerificationEnabled: boolean;
  panProvider?: string | null;
  panEndpoint?: string | null;
  /** True when a key is stored; the value never leaves the server. */
  hasPanApiKey: boolean;
  panApiKeyHeader: string;
  panValidPath: string;
  panNamePath: string;
  panTimeoutSeconds: number;
  panRefuseWhenUnavailable: boolean;
  panConfigured: boolean;

  /** How many rejections before the sub-category closes, and for how long. */
  profileMaxAttempts: number;
  profileBlockMonths: number;
  /** How many times an applicant may fail to clear a program type. */
  programTypeMaxAttempts: number;

  /** Where the invoice for a paid fee is raised, and how it is fetched. */
  erpInvoiceEnabled: boolean;
  erpProvider?: string | null;
  erpInvoiceEndpoint?: string | null;
  /** True when a key is stored; the value never leaves the server. */
  hasErpApiKey: boolean;
  erpApiKeyHeader: string;
  erpInvoiceReference: string;
  erpInvoicePdfPath?: string | null;
  erpInvoiceNumberPath?: string | null;
  erpTimeoutSeconds: number;
  erpStoreInvoiceCopy: boolean;
  erpConfigured: boolean;
  /** What may be chosen as the key the ERP looks an invoice up by. */
  erpInvoiceReferences: string[];

  updatedOn: string;
}

export interface SystemSettingsUpdate {
  profileMaxAttempts: number;
  profileBlockMonths: number;
  programTypeMaxAttempts: number;

  maintenanceMode: boolean;
  maintenanceMessage?: string | null;
  maintenanceUntil?: string | null;
  paymentEnabled: boolean;
  paymentGateway?: string | null;
  paymentTestMode: boolean;
  merchantId?: string | null;
  accessCode?: string | null;
  /** Omitted to keep the stored key; empty string clears it. */
  workingKey?: string | null;

  maxUploadMb: number;

  panVerificationEnabled: boolean;
  panProvider?: string | null;
  panEndpoint?: string | null;
  /** Left out to keep the stored key; empty string clears it. */
  panApiKey?: string | null;
  panApiKeyHeader?: string | null;
  panValidPath?: string | null;
  panNamePath?: string | null;
  panTimeoutSeconds: number;
  panRefuseWhenUnavailable: boolean;
  returnUrl?: string | null;
  cancelUrl?: string | null;

  erpInvoiceEnabled: boolean;
  erpProvider?: string | null;
  erpInvoiceEndpoint?: string | null;
  /** Left out to keep the stored key; empty string clears it. */
  erpApiKey?: string | null;
  erpApiKeyHeader?: string | null;
  erpInvoiceReference?: string | null;
  erpInvoicePdfPath?: string | null;
  erpInvoiceNumberPath?: string | null;
  erpTimeoutSeconds: number;
  erpStoreInvoiceCopy: boolean;
}

/* ---------------------------------------------------------------- reports */

/** One programme in the report register. */
export interface ReportProgramme {
  id: Id;
  programmeCode: string;
  programmeName: string;
  agencyName?: string | null;
  programTypeId: Id;
  programTypeName?: string | null;
  categoryName?: string | null;
  subCategoryName?: string | null;
  mode: string;
  venue: string;
  stateName?: string | null;
  districtName?: string | null;
  startDate: string;
  endDate: string;
  participantCount: number;
  status: string;
}

export interface ReportVenue {
  name: string;
  address: string;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geoTaggedOn?: string | null;
}

export interface ReportTrainer {
  fullName: string;
  designation?: string | null;
  organisation?: string | null;
  mobile: string;
  email?: string | null;
}

export interface ReportParticipant {
  serialNo: number;
  applicantCode: string;
  fullName: string;
  gender?: string | null;
  mobile?: string | null;
  email?: string | null;
  attendancePercent: number;
  writtenMarks?: number | null;
  vivaMarks?: number | null;
  examScore?: number | null;
  result: string;
  certificateNumber?: string | null;
  feedbackRating?: number | null;
}

export interface ReportSession {
  serialNo: number;
  sessionCode?: string | null;
  title: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  facultyName?: string | null;
  presentCount: number;
  markedCount: number;
}

export interface ReportMonitoring {
  serialNo: number;
  conductedOn: string;
  trainerName?: string | null;
  topic?: string | null;
  subTopic?: string | null;
  comments?: string | null;
  photoCount: number;
}

export interface ReportTotals {
  enrolled: number;
  passed: number;
  failed: number;
  pending: number;
  certified: number;
  averageAttendance: number;
  averageFeedback?: number | null;
  sessionsHeld: number;
  monitoringSessions: number;
}

/** Everything one programme is answerable for, assembled per request. */
export interface ProgrammeReport {
  organisationName: string;
  generatedOn: string;
  generatedBy: string;
  programme: ReportProgramme;
  venue?: ReportVenue | null;
  coordinatorName?: string | null;
  coordinatorEmail?: string | null;
  coordinatorMobile?: string | null;
  trainers: ReportTrainer[];
  participants: ReportParticipant[];
  sessions: ReportSession[];
  monitoring: ReportMonitoring[];
  totals: ReportTotals;
}

/**
 * A trainer as the faculty register shows them. One row per delivery: a
 * trainer who took three workshops appears three times, because each row is
 * that programme's own record of who turned up.
 */
export interface Faculty {
  id: Id;
  fullName: string;
  mobile: string;
  email?: string | null;
  designation?: string | null;
  organisation?: string | null;

  programmeId: Id;
  programmeCode?: string | null;
  programmeName?: string | null;
  programTypeName?: string | null;
  agencyName?: string | null;
  stateName?: string | null;
  startDate: string;
  endDate: string;
}

export interface FacultyUpsert {
  fullName: string;
  mobile: string;
  email?: string | null;
  designation?: string | null;
  organisation?: string | null;
}
