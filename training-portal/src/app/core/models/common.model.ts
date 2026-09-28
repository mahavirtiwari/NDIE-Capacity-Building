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
