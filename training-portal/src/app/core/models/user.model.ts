import { AppRole, Permission } from './auth.model';
import { AuditInfo, Id, RecordStatus } from './common.model';

/** Admin role definition created by Super Admin. */
export interface AdminRole extends AuditInfo {
  id: Id;
  name: string;
  code: string;
  baseRole: Exclude<AppRole, 'Applicant'>;
  description?: string;
  permissions: Permission[];
  userCount?: number;
  isSystemRole: boolean;
  /** The seeded starting point for its tier, owned by nobody and edited by nobody. */
  isDefault: boolean;
  /** Whether this caller may reshape it. Decided on the server. */
  canEdit: boolean;

  /**
   * Which axes an account on this role is allocated on, sent by the
   * server from the one definition it keeps.
   *
   * Optional only so an older cached response does not break the screen;
   * absent means allocate nothing, which is the safe reading.
   */
  axes?: ScopeAxes;

  status: RecordStatus;
}

/** The allocation axes of one tier. */
export interface ScopeAxes {
  category: boolean;
  subCategory: boolean;
  programType: boolean;
  state: boolean;
  district: boolean;
  /** True where the tier sees the whole estate and allocates nothing. */
  none: boolean;
}

/**
 * Any back-office user: Admin, Operation Manager or Coordinator. Operation
 * managers carry a master scope; coordinators additionally carry an agency.
 */
export interface PortalUser extends AuditInfo {
  id: Id;
  userCode: string;
  fullName: string;
  email: string;
  mobile: string;
  designation?: string;
  roleId: Id;
  roleName?: string;
  baseRole: Exclude<AppRole, 'Applicant'>;
  categoryIds: Id[];
  subCategoryIds: Id[];
  programTypeIds: Id[];
  /** LGD state codes this account is allocated to work in. */
  stateCodes: number[];
  /** LGD district codes; coordinators only. */
  districtCodes: number[];
  agencyId?: Id | null;
  agencyName?: string;
  reportsToUserId?: Id | null;
  reportsToName?: string;
  /** LGD codes; the plain names are for display only. */
  stateCode?: number | null;
  state?: string;
  districtCode?: number | null;
  district?: string;
  city?: string;
  pincode?: string;
  /** Who the person is, for the record. Optional, format-checked. */
  pan?: string;
  aadhaar?: string;
  lastLoginOn?: string | null;
  status: RecordStatus;
}
