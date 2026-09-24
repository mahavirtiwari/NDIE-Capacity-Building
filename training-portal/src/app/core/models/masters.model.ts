import { AuditInfo, Id, RecordStatus } from './common.model';

/** Top level grouping, e.g. "ZED Certification", "Lean Manufacturing". */
export interface Category extends AuditInfo {
  id: Id;
  code: string;
  name: string;
  description?: string;
  displayOrder: number;
  status: RecordStatus;
  subCategoryCount?: number;
}

/** e.g. "Bronze", "Silver", "Gold" under ZED Certification. */
export interface SubCategory extends AuditInfo {
  id: Id;
  categoryId: Id;
  categoryName?: string;
  code: string;
  name: string;
  description?: string;
  displayOrder: number;
  status: RecordStatus;
}

export type DeliveryMode = 'Physical' | 'Virtual' | 'Hybrid';
export const DELIVERY_MODES: DeliveryMode[] = ['Physical', 'Virtual', 'Hybrid'];

/**
 * The applicant-facing program type, e.g. Master Trainer / Assessor /
 * Consultant. Drives the registration form, fee, curriculum and exam paper.
 */
export interface ProgramType extends AuditInfo {
  id: Id;
  categoryId: Id;
  categoryName?: string;
  subCategoryId: Id;
  subCategoryName?: string;
  code: string;
  name: string;
  shortDescription?: string;
  durationDays: number;
  deliveryMode: DeliveryMode;
  minQualification?: string;
  /** Display text for the stored code. */
  minQualificationLabel?: string;
  minExperienceYears: number;
  certificateValidityMonths: number;
  isExamMandatory: boolean;
  isFeeApplicable: boolean;
  status: RecordStatus;
}

export type AgencyType =
  | 'Government Body'
  | 'Industry Association'
  | 'Academic Institute'
  | 'Private Partner';

export const AGENCY_TYPES: AgencyType[] = [
  'Government Body',
  'Industry Association',
  'Academic Institute',
  'Private Partner',
];

/** Implementing agency created by Admin; conducts programs on the ground. */
export interface ImplementingAgency extends AuditInfo {
  id: Id;
  code: string;
  name: string;
  agencyType: AgencyType;
  contactPerson: string;
  email: string;
  mobile: string;
  gstin?: string;
  pan?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  /** LGD state code; `state` carries the display name. */
  stateCode: number;
  state?: string;
  /** LGD district code; `district` carries the display name. */
  districtCode?: number | null;
  district?: string;
  pincode: string;
  categoryIds: Id[];
  subCategoryIds: Id[];
  programTypeIds: Id[];
  /** LGD state codes the agency is empanelled for. */
  stateCodes: number[];
  empanelledOn: string;
  empanelmentValidTill: string;
  status: RecordStatus;
}
