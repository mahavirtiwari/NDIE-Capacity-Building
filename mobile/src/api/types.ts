/** Mirrors the DTOs the .NET API returns. */

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string | null;
  data: T;
  errors?: string[] | null;
}

/** Portal identity, maintained by Super Admin in the web portal. */
export interface Branding {
  organisationName: string;
  shortName: string;
  portalTitle: string;
  tagline?: string | null;
  supportEmail?: string | null;
  hasLogo: boolean;
  logoFileName?: string | null;
  /** Relative to the API base, already carrying a cache-busting version. */
  logoUrl?: string | null;
  logoVersion: number;
  updatedOn: string;
}

/**
 * Self-declared at sign-up. The scheme reports reach by gender and social
 * category, so these are asked once, by the person they describe, rather than
 * inferred later from a name or a document.
 */
export type Gender = 'Male' | 'Female' | 'Other';
export type SocialCategory = 'General' | 'OBC' | 'SC' | 'ST';

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Others' },
];

export const SOCIAL_CATEGORY_OPTIONS: { value: SocialCategory; label: string }[] = [
  { value: 'General', label: 'General' },
  { value: 'OBC', label: 'OBC' },
  { value: 'SC', label: 'SC' },
  { value: 'ST', label: 'ST' },
];

export interface Applicant {
  id: number;
  applicantCode: string;
  fullName: string;
  email: string;
  mobile: string;
  pan: string;
  gender?: Gender | null;
  socialCategory?: SocialCategory | null;
  categoryId: number;
  categoryName?: string;
  subCategoryId: number;
  subCategoryName?: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  kycStatus: string;
  stateCode?: number | null;
  state?: string;
  districtCode?: number | null;
  district?: string;
  city?: string;
  registeredOn: string;
  lastLoginOn?: string | null;
  isBlocked: boolean;
}

export interface ApplicantLoginResponse {
  token: string;
  refreshToken: string;
  expiresInSeconds: number;
  applicant: Applicant;
}

export interface LookupItem {
  id: number;
  name: string;
  code?: string;
  parentId?: number | null;
}

export interface ApplicantProgram {
  programTypeId: number;
  code: string;
  name: string;
  shortDescription?: string;
  categoryName?: string;
  subCategoryName?: string;
  durationDays: number;
  deliveryMode: string;
  minQualification?: string;
  minExperienceYears: number;
  isExamMandatory: boolean;
  feePayable: number;
  tdsOptions: number[];
  acceptingApplications: boolean;
  /** False when applying needs no form — the app submits straight away. */
  requiresRegistrationForm?: boolean;
  existingApplicationStatus?: string | null;
  existingApplicationId?: number | null;
  existingApplicationNo?: string | null;
  existingSubmittedOn?: string | null;
  /** Why the last one was turned down, where it was. */
  existingRejectionReason?: string | null;

  /**
   * Whether to offer the Apply button.
   *
   * Not the same as `acceptingApplications`: a track can be open while this
   * applicant already has one in flight. A rejection does not stand in the
   * way — they may fix what was wrong and apply again.
   */
  canApply: boolean;
}

/* ------------------------------------------------- dynamic registration form */

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'email' | 'mobile' | 'pan' | 'tan' | 'gstin'
  | 'ifsc' | 'pincode' | 'aadhaar' | 'date' | 'select' | 'multiselect' | 'radio'
  | 'checkbox' | 'file';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldValidation {
  required: boolean;
  minLength?: number | null;
  maxLength?: number | null;
  min?: number | null;
  max?: number | null;
  pattern?: string | null;
  allowedExtensions?: string[] | null;
  maxFileSizeMb?: number | null;
}

export interface RegistrationField {
  id: number;
  key: string;
  label: string;
  type: FieldType;
  isEnabled: boolean;
  placeholder?: string;
  helpText?: string;
  displayOrder: number;
  colSpan: number;
  options: FieldOption[];
  validation: FieldValidation;
  visibleWhenFieldKey?: string | null;
  visibleWhenValues?: string[] | null;
}

export interface RegistrationSection {
  id: number;
  /** What a repeating section's entries are stored under, set by the server. */
  key?: string;
  title: string;
  description?: string;
  displayOrder: number;
  isEnabled: boolean;
  /** The applicant can fill this section more than once. */
  isRepeatable?: boolean;
  minEntries?: number;
  maxEntries?: number;
  /** What one entry is called: "Qualification 2", "Add qualification". */
  itemLabel?: string;
  fields: RegistrationField[];
}

export interface RegistrationForm {
  id: number;
  programTypeId: number;
  programTypeName?: string;
  version: string;
  status: string;
  sections: RegistrationSection[];
}

/* --------------------------------------------------------- sign-up form */

/**
 * One box on the form somebody fills in to create an account.
 *
 * A built-in field lands in a column on the applicant record and the app has
 * a control of its own for it; anything else is a question somebody added in
 * the portal, and its answer travels in the `answers` bag.
 */
export interface SignupField {
  id: number;
  key: string;
  label: string;
  placeholder?: string | null;
  helpText?: string | null;
  type: FieldType;
  required: boolean;
  displayOrder: number;
  isBuiltIn: boolean;
  isLocked: boolean;
  status: string;
  options: FieldOption[];
}

export interface SignupForm {
  subCategoryId?: number | null;
  subCategoryName?: string | null;
  /** False when these are the shared defaults rather than this track's own. */
  isOwnForm: boolean;
  fields: SignupField[];
}

export interface MaterialTicket {
  url: string;
  expiresInSeconds: number;
}

/* -------------------------------------------------------------- payments */

export interface PaymentLine {
  label: string;
  amount: number;
  isDeduction: boolean;
  isTotal: boolean;
}

/**
 * What is payable on one application. Answers even when it cannot be paid:
 * `blocked` says why, and a screen that only knew the button was missing
 * could not tell the applicant anything useful.
 */
export interface PaymentSummary {
  applicationId: number;
  applicationNo: string;
  programTypeName?: string;
  currency: string;
  lines: PaymentLine[];
  feeGross: number;
  tdsPercent: number;
  tdsAmount: number;
  payable: number;
  paymentStatus: string;
  canPay: boolean;
  blocked?: string | null;
  gateway?: string | null;
  testMode: boolean;
  /** True when the split came from the fee in force, not from the application. */
  fromCurrentFee: boolean;
}

export interface PaymentInitiation {
  orderId: string;
  amount: number;
  currency: string;
  /** Opened in the phone's own browser, never inside the app. */
  redirectUrl: string;
  testMode: boolean;
}

export type PaymentAttemptStatus =
  | 'Initiated'
  | 'Processing'
  | 'Paid'
  | 'Failed'
  | 'Cancelled'
  | 'Abandoned';

export interface PaymentTransaction {
  id: number;
  orderId: string;
  applicationId: number;
  applicationNo: string;
  programTypeName?: string;
  feeGross: number;
  tdsAmount: number;
  amount: number;
  currency: string;
  status: PaymentAttemptStatus;
  gateway: string;
  testMode: boolean;
  method?: string | null;
  trackingId?: string | null;
  bankReference?: string | null;
  failureReason?: string | null;
  initiatedOn: string;
  completedOn?: string | null;
}

/* ------------------------------------------------------------------- fee */

export interface FeeComponent {
  id: number;
  kind: string;
  label: string;
  amount: number;
  isTaxable: boolean;
}

export interface FeeConcession {
  id: number;
  label: string;
  percentage: number;
  remarks?: string;
}

export interface FeeStructure {
  id: number;
  title: string;
  currency: string;
  gstPercent: number;
  tdsOptions: number[];
  components: FeeComponent[];
  concessions: FeeConcession[];
  totals: { taxable: number; nonTaxable: number; gst: number; gross: number };
}

/* ---------------------------------------------------------- applications */

export interface ApplicationDocument {
  id: number;
  fieldKey: string;
  label: string;
  fileName: string;
  fileSizeKb: number;
  uploadedOn: string;
  verified: boolean;
  remarks?: string;
}

export interface ScrutinyEvent {
  id: number;
  action: string;
  byUserName: string;
  byRole: string;
  on: string;
  remarks?: string;
  /** The reason chosen on a rejection, worded as it was given. */
  rejectionReasonLabel?: string | null;
}

export interface Application {
  id: number;
  applicationNo: string;
  programTypeId: number;
  programTypeName?: string;
  categoryName?: string;
  subCategoryName?: string;
  status: string;
  submittedOn?: string | null;
  paymentStatus: string;
  feeAmount: number;
  tdsPercent: number;
  tan?: string | null;
  deductorName?: string | null;
  /** Why it was turned down, worded as it was at the time. */
  rejectionReasonLabel?: string | null;
  score?: number | null;
  responses: Record<string, unknown>;
  documents: ApplicationDocument[];
  history: ScrutinyEvent[];
}

export interface Enrolment {
  /** The enrolment's own id — one person on one batch — which the exam is keyed by. */
  participantId: number;
  programmeId: string;
  programmeName: string;
  agencyName?: string;
  mode: string;
  venue: string;
  state?: string;
  startDate: string;
  endDate: string;
  meetingLink?: string | null;
  examDateTime?: string | null;
  status: string;
  attendancePercent: number;
  examScore?: number | null;
  result: string;
  certificateNo?: string | null;
}

/* ------------------------------------------------------------ examination */

/**
 * Whether this enrolment's written paper can be sat, and what has been done.
 *
 * Nothing the server sends about a paper ever says which option is correct: the
 * questions arrive with their options and no answer key.
 */
export interface ExamAvailability {
  participantId: number;
  programmeName: string;
  hasPaper: boolean;
  paperTitle?: string | null;
  instructions?: string | null;
  durationMinutes: number;
  questionCount: number;
  totalMarks: number;
  passPercentage: number;
  negativeMarking: boolean;
  /** When the paper opens. Null when no exam has been scheduled. */
  opensOn?: string | null;
  attemptsUsed: number;
  maxAttempts: number;
  canSit: boolean;
  /** Why not, when it cannot be sat. */
  blocker?: string | null;
  /** A sitting left open, which resuming continues rather than restarts. */
  inProgressAttemptId?: number | null;
  expiresOn?: string | null;
  /** The best sitting so far, which is the one that counts. */
  best?: ExamResult | null;
}

export interface ExamSitting {
  attemptId: number;
  attemptNo: number;
  paperTitle: string;
  instructions?: string | null;
  totalMarks: number;
  negativeMarking: boolean;
  startedOn: string;
  expiresOn: string;
  /** Worked out on the server; the countdown runs from this, not the device clock. */
  secondsRemaining: number;
  questions: ExamQuestion[];
}

export interface ExamQuestion {
  id: number;
  displayOrder: number;
  text: string;
  type: 'SingleChoice' | 'MultipleChoice' | 'TrueFalse';
  marks: number;
  negativeMarks: number;
  options: { id: number; text: string }[];
  /** What was chosen so far, so a resume looks unbroken. */
  selectedOptionIds: number[];
}

export interface ExamResult {
  attemptId: number;
  attemptNo: number;
  status: 'Submitted' | 'Expired' | 'InProgress';
  submittedOn?: string | null;
  score: number;
  paperTotal: number;
  percentage: number;
  /** Against the paper's own pass mark — not the same as qualifying. */
  passed: boolean;
  answered: number;
  questionCount: number;
  /** What this contributed to the programme marksheet. */
  writtenMarks?: number | null;
  /** Where the candidate stands on the programme: pending until the viva is marked. */
  programmeResult: 'Pending' | 'Pass' | 'Fail';
}

export interface TrainingMaterial {
  id: number;
  title: string;
  description?: string;
  kind: string;
  programTypeName?: string;
  fileName?: string;
  fileSizeKb?: number;
  url?: string;
  durationMinutes?: number | null;
  language: string;
  version: string;
  publishedOn: string;
  downloadAllowed: boolean;
}

/**
 * A dated batch the applicant can join, as opposed to the track it belongs to.
 * Registration closes by itself once maxParticipants is reached, so seatsLeft
 * and registrationStatus are the fields worth showing.
 */
export interface ApplicantBatch {
  id: number;
  programmeId: string;
  programmeName: string;
  programTypeId: number;
  programTypeName: string;
  shortDescription?: string;
  categoryName: string;
  subCategoryName: string;
  mode: string;
  venue?: string | null;
  city?: string | null;
  state?: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  maxParticipants: number;
  enrolled: number;
  seatsLeft: number;
  registrationsOpen: boolean;
  registrationStatus: string;
  agencyName?: string | null;
  minQualificationLabel?: string | null;
  minExperienceYears: number;
  isFeeApplicable: boolean;
  isEnrolled: boolean;
  hasApplied: boolean;
}
