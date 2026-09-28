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

/**
 * One rung of the educational qualification ladder a program type sets its
 * minimum from. `rank` is the position: higher is a higher qualification, and
 * two rungs may share a rank when they count as equivalent.
 */
export interface Qualification extends AuditInfo {
  id: Id;
  code: string;
  label: string;
  rank: number;
  status: RecordStatus;
  /** The "no minimum" rung. It can be reworded, but not removed or disabled. */
  isSystem?: boolean;
  programTypeCount?: number;
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
  /** What is examined, out of how many marks, and what passes. */
  evaluation: EvaluationScheme;
  /** How many live skills the viva or practical is marked against. */
  skillCount: number;
  status: RecordStatus;
}

/* ------------------------------------------------------------ evaluation */

export type ExaminationKind = 'None' | 'Written' | 'VivaPractical' | 'WrittenAndViva';

/** Mirrors ExaminationKinds on the server, which is the authority. */
export const EXAMINATION_KINDS: { value: ExaminationKind; label: string; hint: string }[] = [
  {
    value: 'Written',
    label: 'Written examination',
    hint: 'One written paper decides the result.',
  },
  {
    value: 'VivaPractical',
    label: 'Viva / practical only',
    hint: 'Trainers mark each candidate against the skills set up for this program type.',
  },
  {
    value: 'WrittenAndViva',
    label: 'Written and viva / practical',
    hint: 'Both are marked, and a candidate has to clear each section as well as the total.',
  },
  {
    value: 'None',
    label: 'No examination',
    hint: 'Nothing is marked. Attendance alone decides what the candidate is awarded.',
  },
];

/**
 * The marking pattern.
 *
 * Marks are per section because passing is: a candidate can reach the overall
 * mark and still fail for missing the written minimum.
 */
export interface EvaluationScheme {
  kind: ExaminationKind;
  kindLabel?: string;
  totalMarks: number;
  writtenMarks: number;
  vivaMarks: number;
  writtenPassMarks: number;
  vivaPassMarks: number;
  overallPassMarks: number;
  hasWritten: boolean;
  hasViva: boolean;
}

/** One thing a trainer marks a candidate on in the viva or practical. */
export interface EvaluationSkill extends AuditInfo {
  id: Id;
  programTypeId: Id;
  programTypeName: string;
  name: string;
  description?: string;
  maxMarks: number;
  displayOrder: number;
  status: RecordStatus;
}

export const examinesViva = (kind: ExaminationKind): boolean =>
  kind === 'VivaPractical' || kind === 'WrittenAndViva';

export const examinesWritten = (kind: ExaminationKind): boolean =>
  kind === 'Written' || kind === 'WrittenAndViva';

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
  /**
   * Whether this account may change the record. Decided on the server: an
   * agency is edited by the Operation Manager who appointed it, or by whoever
   * added it. False still allows viewing and enabling or disabling.
   */
  canEdit?: boolean;
}

/* --------------------------------------------------- issued certificates */

/** A certificate that has been awarded to one participant. */
export interface Certificate {
  id: Id;
  number: string;
  kind: CertificateKind;
  kindLabel: string;
  participantId: Id;
  programmeId: Id;
  recipientName: string;
  programmeName: string;
  programTypeName: string;
  issuedOn: string;
  validTill?: string | null;
  issuedBy?: string;
  isRevoked: boolean;
  revokedOn?: string | null;
  revokedReason?: string | null;
  url: string;
}

/** One participant's standing: what they are owed, and whether it can be issued. */
export interface CertificateEligibility {
  participantId: Id;
  name: string;
  result: string;
  kind?: CertificateKind | null;
  kindLabel?: string | null;
  canIssue: boolean;
  /** Why not, when nothing is issued and it cannot be. */
  blocker?: string | null;
  certificate?: Certificate | null;
}

export interface ProgrammeCertificateSummary {
  programmeId: Id;
  programmeName: string;
  certificationPolicy: CertificationPolicy;
  certificationPolicyLabel: string;
  /** Kinds awarded here with no artwork uploaded yet. */
  missingTemplates: CertificateKind[];
  issued: number;
  pending: number;
  notEligible: number;
  participants: CertificateEligibility[];
}

export interface CertificateVerification {
  found: boolean;
  number: string;
  recipientName?: string;
  programTypeName?: string;
  kindLabel?: string;
  issuedOn?: string;
  validTill?: string;
  isRevoked: boolean;
  isExpired: boolean;
  status: string;
}
