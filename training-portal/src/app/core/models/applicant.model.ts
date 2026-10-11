import { AuditInfo, Id, RecordStatus } from './common.model';

export type ApplicantKycStatus = 'Pending' | 'Verified' | 'Rejected';

/** Self-declared at sign-up; undefined for applicants who predate the question. */
export type ApplicantGender = 'Male' | 'Female' | 'Other';
export type ApplicantSocialCategory = 'General' | 'OBC' | 'SC' | 'ST';

export const APPLICANT_GENDERS: ApplicantGender[] = ['Male', 'Female', 'Other'];
export const APPLICANT_SOCIAL_CATEGORIES: ApplicantSocialCategory[] = ['General', 'OBC', 'SC', 'ST'];

/**
 * Created from the mobile app during basic sign-up. The system generates the
 * login id once the email OTP is verified.
 */
export type ApplicantStanding =
  | 'Registered'
  | 'ApplicationReceived'
  | 'Approved'
  | 'Rejected';

/**
 * What the Applicants list filters and shows.
 *
 * Deliberately the scrutiny vocabulary rather than a second one of its own:
 * somebody reading both screens should not have to translate between them.
 */
export const APPLICANT_STANDINGS: { value: ApplicantStanding; label: string }[] = [
  { value: 'Registered', label: 'Registered' },
  { value: 'ApplicationReceived', label: 'Application received' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
];

export interface Applicant extends AuditInfo {
  id: Id;
  applicantCode: string;
  fullName: string;
  email: string;
  mobile: string;
  pan: string;
  gender?: ApplicantGender;
  socialCategory?: ApplicantSocialCategory;
  /**
   * The first discipline this person entered, kept for the reports that
   * group by one. Not the whole truth: an account holds a profile per
   * category, and null until the first one is started.
   */
  categoryId?: Id | null;
  categoryName?: string;
  subCategoryId?: Id | null;
  subCategoryName?: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  kycStatus: ApplicantKycStatus;

  /** Where they stand, read from their applications rather than held on the account. */
  standing: ApplicantStanding;

  /** The current block: when, and the reason chosen at the time. */
  blockedOn?: string | null;
  blockReasonLabel?: string | null;
  state?: string;
  city?: string;
  registeredOn: string;
  lastLoginOn?: string | null;
  isBlocked: boolean;
  /** Why it was last blocked or unblocked. Absent if it never has been. */
  statusReason?: string | null;
  statusChangedOn?: string | null;
  statusChangedBy?: string | null;

  /**
   * Answers to the custom questions on the sign-up form, worded as they were
   * asked. Empty where that sub-category's form asked nothing extra.
   */
  answers?: ApplicantAnswer[];
}

export interface ApplicantAnswer {
  key: string;
  label: string;
  value?: string | null;
}

/* --------------------------------------------------------- blocking */

/** One reason an account may be blocked, as configured by a Super Admin. */
export type AccessReasonKind = 'Block' | 'Unblock';

export interface BlockReason {
  id: Id;
  /** Whether this is a reason to block or a reason to let back in. */
  kind: AccessReasonKind;
  label: string;
  displayOrder: number;
  /** True where the reason needs the specifics spelled out. */
  requiresNote: boolean;
  status: RecordStatus;
  usedByCount: number;
}

export interface BlockReasonUpsert {
  kind: AccessReasonKind;
  label: string;
  displayOrder: number;
  requiresNote: boolean;
  status: RecordStatus;
}

/** One time an account was blocked or let back in. */
export interface ApplicantStatusEvent {
  id: Id;
  blocked: boolean;
  reasonLabel?: string | null;
  remarks?: string | null;
  byUserName: string;
  byUserCode: string;
  on: string;
}

/**
 * One thing that happened, from whichever part of the system it happened
 * in. Shared by the applicant, the portal user and the agency, because
 * the three answer the same question and should read the same way.
 */
export interface TimelineEvent {
  on: string;
  /** Account, Profile, Application, Payment, Programme or Certificate. */
  area: string;
  title: string;
  /** How it went: success, danger, warning or info. Absent for most. */
  tone?: string | null;
  detail?: string | null;
  /** An application number, a programme, a sub-category. */
  reference?: string | null;
  /** Absent where the system did it rather than a person. */
  by?: string | null;
}

export interface ApplicantHistory {
  applicantId: Id;
  applicantCode: string;
  fullName: string;
  email: string;
  isBlocked: boolean;
  blockedOn?: string | null;
  blockReasonLabel?: string | null;
  registeredOn: string;
  lastLoginOn?: string | null;
  events: ApplicantStatusEvent[];

  /** Everything that has happened, oldest first. */
  timeline?: TimelineEvent[];
}

/** One row of the applicants export, with the sign-up answers flattened in. */
export interface ApplicantExportRow {
  applicantCode: string;
  fullName: string;
  email: string;
  mobile: string;
  pan: string;
  gender?: string | null;
  socialCategory?: string | null;
  category?: string | null;
  subCategory?: string | null;
  state?: string | null;
  district?: string | null;
  city?: string | null;
  emailVerified: boolean;
  mobileVerified: boolean;
  standing: string;
  registeredOn: string;
  firstAppliedOn?: string | null;
  approvedOn?: string | null;
  rejectedOn?: string | null;
  rejectionReason?: string | null;
  access: string;
  blockedOn?: string | null;
  blockReason?: string | null;
  lastLoginOn?: string | null;
  answers: Record<string, string | null>;
}
