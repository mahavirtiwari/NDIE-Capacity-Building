import { TimelineEvent } from './applicant.model';
import { AuditInfo, Id, LookupItem, RecordStatus } from './common.model';

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

  /** The applicant answers the sign-up form to register under this discipline. */
  requiresSignupForm?: boolean;
  /**
   * The applicant completes the profile form and has it scrutinised before
   * the programs under this discipline open to them. Off, and they are open
   * from the start.
   */
  requiresProfileForm?: boolean;
}

export type DeliveryMode = 'Physical' | 'Virtual' | 'Hybrid';
export const DELIVERY_MODES: DeliveryMode[] = ['Physical', 'Virtual', 'Hybrid'];

/**
 * The applicant-facing program type, e.g. Master Trainer / Assessor /
 * Consultant. Drives the profile form, fee, curriculum and exam paper.
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
  /** The fewest candidates a batch of this type is run for. */
  minParticipants: number;
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
  /** What it is empanelled for, in words, for the register. */
  categoryNames: string[];
  programTypeNames: string[];
  empanelledOn: string;
  empanelmentValidTill: string;

  /**
   * The agency's own login, shown on this screen because this is where
   * somebody comes looking for it. Absent where the agency is empanelled
   * but has no login yet.
   */
  loginUserCode?: string | null;
  loginEmail?: string | null;
  loginStatus?: RecordStatus | null;
  loginLastSeenOn?: string | null;

  status: RecordStatus;
  /**
   * Whether this account may change the record. Decided on the server: an
   * agency is edited by the Operation Manager who appointed it, or by whoever
   * added it. False still allows viewing and enabling or disabling.
   */
  canEdit?: boolean;
}

/**
 * What the signed-in account may allocate to somebody beneath it.
 *
 * The scope pickers read this rather than the open master lookups. An
 * Admin holding one category was shown all of them, could tick them, and
 * was refused on Save - the API has always enforced the boundary. Offering
 * a choice and then refusing it is worse than not offering it.
 *
 * For an unscoped account it is the whole master, which is the right
 * answer for Super Admin rather than a special case.
 */
export interface AllocatableScope {
  categories: LookupItem[];
  subCategories: LookupItem[];
  programTypes: LookupItem[];
  states: LookupItem[];
  districts: LookupItem[];
}

/**
 * A named list of choices, used by any number of form fields.
 *
 * Kept once so the same question asked on three forms offers the same
 * three answers, and so a report grouping by one of them has a single set
 * of words to group by.
 */
export interface OptionSet extends AuditInfo {
  id: Id;
  code: string;
  name: string;
  description?: string | null;
  status: RecordStatus;
  /** How many fields point at this list, across every form. */
  usedByFieldCount: number;
  items: OptionSetItem[];
}

export interface OptionSetItem {
  id: Id;
  /** What is stored against an answer. Fixed once answers exist. */
  value: string;
  label: string;
  displayOrder: number;
  /** Withdrawn rather than deleted, so old answers keep reading. */
  status: RecordStatus;
}

/** What happened to one agency: empanelment, login, coordinators, batches. */
export interface AgencyHistory {
  agencyId: Id;
  code: string;
  name: string;
  status: RecordStatus;
  empanelledOn: string;
  empanelmentValidTill?: string | null;
  timeline: TimelineEvent[];
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
