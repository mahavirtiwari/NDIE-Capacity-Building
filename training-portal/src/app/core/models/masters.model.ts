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
  /** What the programme awards at the end of it. */
  certificationPolicy: CertificationPolicy;
  certificationPolicyLabel?: string;
  /** The kinds this policy awards, so the screen knows which templates to offer. */
  certificateKinds: CertificateKind[];
  certificateTemplates: CertificateTemplate[];
  status: RecordStatus;
}

export type CertificationPolicy =
  | 'None'
  | 'ParticipationOnly'
  | 'QualificationOnly'
  | 'QualificationAndParticipation';

export type CertificateKind = 'Qualification' | 'Participation';

/** Mirrors CertificationPolicies on the server, which is the authority. */
export const CERTIFICATION_POLICIES: {
  value: CertificationPolicy;
  label: string;
  hint: string;
  /** The templates this policy needs — one upload slot each. */
  kinds: CertificateKind[];
}[] = [
  { value: 'None', label: 'No certificate', hint: 'Nothing is issued at the end.', kinds: [] },
  {
    value: 'ParticipationOnly',
    label: 'Participation certificate only',
    hint: 'Everyone who attends gets one, whatever the result.',
    kinds: ['Participation'],
  },
  {
    value: 'QualificationOnly',
    label: 'Certification for those who qualify',
    hint: 'Only candidates who pass are certified; the rest get nothing.',
    kinds: ['Qualification'],
  },
  {
    value: 'QualificationAndParticipation',
    label: 'Certification for those who qualify, participation for the rest',
    hint: 'Candidates who pass are certified; those who do not still get a participation certificate.',
    kinds: ['Qualification', 'Participation'],
  },
];

/** The upload slots a policy calls for, without waiting for the server to say so. */
export const kindsForPolicy = (policy: CertificationPolicy): CertificateKind[] =>
  CERTIFICATION_POLICIES.find((p) => p.value === policy)?.kinds ?? [];

export const CERTIFICATE_KIND_LABELS: Record<CertificateKind, string> = {
  Qualification: 'Certification certificate',
  Participation: 'Participation certificate',
};

export interface CertificateTemplate {
  id: Id;
  kind: CertificateKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedOn?: string;
  uploadedBy?: string;
  /** Relative API path the file is fetched from. */
  url: string;
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
