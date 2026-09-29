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

  updatedOn: string;
}

export interface SystemSettingsUpdate {
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
  returnUrl?: string | null;
  cancelUrl?: string | null;
}
