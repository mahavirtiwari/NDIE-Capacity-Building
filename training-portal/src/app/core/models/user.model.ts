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
  status: RecordStatus;
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
  lastLoginOn?: string | null;
  status: RecordStatus;
}
