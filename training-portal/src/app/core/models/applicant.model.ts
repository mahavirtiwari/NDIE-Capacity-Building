import { AuditInfo, Id } from './common.model';

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
  categoryId: Id;
  categoryName?: string;
  subCategoryId: Id;
  subCategoryName?: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  kycStatus: ApplicantKycStatus;

  /** Where they stand, read from their applications rather than held on the account. */
  standing: ApplicantStanding;
  state?: string;
  city?: string;
  registeredOn: string;
  lastLoginOn?: string | null;
  isBlocked: boolean;

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
