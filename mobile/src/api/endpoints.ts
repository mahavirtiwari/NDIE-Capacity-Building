import { api, download } from './client';
import type {
  Applicant,
  ApplicantBatch,
  ApplicantLoginResponse,
  ApplicantProgram,
  Application,
  Branding,
  Enrolment,
  ExamAvailability,
  ExamResult,
  ExamSitting,
  FeeStructure,
  Gender,
  LookupItem,
  MaterialTicket,
  PaymentInitiation,
  PaymentSummary,
  PaymentTransaction,
  RegistrationForm,
  SignupForm,
  SocialCategory,
  TrainingMaterial,
} from './types';

/* ------------------------------------------------------------ anonymous */

export const siteText = {
  /* Anonymous like the branding, and cached like every other read: the wording
     has to be there on a phone that has not reached the server today. */
  map: () => api.get<Record<string, string>>('site-text/map', undefined, true),
};

export const branding = {
  get: () => api.get<Branding>('branding', undefined, true),
};

export const lookups = {
  categories: () => api.get<LookupItem[]>('lookups/categories', undefined, true),
  subCategories: (categoryId?: number | null) =>
    api.get<LookupItem[]>('lookups/sub-categories', { categoryId }, true),
  states: () => api.get<LookupItem[]>('lookups/states', undefined, true),
  districts: (stateCode?: number | null) =>
    api.get<LookupItem[]>('lookups/districts', { stateCode }, true),
};

export interface SignUpPayload {
  fullName: string;
  email: string;
  mobile: string;
  pan: string;
  /** Null where the form does not ask; the scheme reports on both. */
  gender: Gender | null;
  socialCategory: SocialCategory | null;
  categoryId: number;
  subCategoryId: number;

  /** Answers to whatever else this sub-category's form asks, keyed by field. */
  answers: Record<string, string>;
}

export const batches = {
  /** Open batches this applicant could join, with their standing on each. */
  mine: () => api.get<ApplicantBatch[]>('me/batches'),
};

export const auth = {
  /**
   * The form this sub-category asks, with the switched-off questions already
   * left out. Anonymous, because it is drawn before anybody has an account.
   */
  signupForm: (subCategoryId?: number | null) =>
    api.get<SignupForm>('signup-form/public', { subCategoryId }, true),

  signUp: (payload: SignUpPayload) =>
    api.post<Applicant>('applicants/sign-up', payload, true),

  sendOtp: (email: string, name?: string) =>
    api.post<boolean>('otp/send', { email, name }, true),

  /** Verifying for the first time is what issues the password, by e-mail. */
  verifyOtp: (email: string, code: string) =>
    api.post<boolean>('otp/verify', { email, code }, true),

  login: (applicantCode: string, password: string) =>
    api.post<ApplicantLoginResponse>('auth/applicant/login', { applicantCode, password }, true),

  /**
   * Asks for a reset code. The reply is the same shape whether or not the
   * account exists, so the screen after this one cannot be read as proof that
   * an applicant ID is real.
   */
  forgotPassword: (identifier: string) =>
    api.post<ForgotPasswordResult>('auth/applicant/forgot-password', { identifier }, true),

  resetPassword: (identifier: string, code: string, newPassword: string) =>
    api.post<boolean>(
      'auth/applicant/reset-password',
      { identifier, code, newPassword },
      true,
    ),
};

export interface ForgotPasswordResult {
  message: string;
  validityMinutes: number;
  /** Masked, e.g. a****@e******.org. Absent when there was no account. */
  maskedEmail?: string | null;
  resendAfterSeconds: number;
}

/* ------------------------------------------------------- signed-in scope */

export const me = {
  profile: () => api.get<Applicant>('me'),

  updateProfile: (payload: {
    email: string;
    mobile: string;
    stateCode?: number | null;
    districtCode?: number | null;
    city?: string | null;
  }) => api.put<Applicant>('me', payload),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<boolean>('me/change-password', { currentPassword, newPassword }),

  programs: () => api.get<ApplicantProgram[]>('me/programs'),

  form: (programTypeId: number) =>
    api.get<RegistrationForm>(`me/programs/${programTypeId}/form`),

  fee: (programTypeId: number) =>
    api.get<FeeStructure | null>(`me/programs/${programTypeId}/fee`),

  applications: () => api.get<Application[]>('me/applications'),

  submit: (payload: {
    programTypeId: number;
    responses: Record<string, unknown>;
    tdsPercent: number;
    tan?: string | null;
    deductorName?: string | null;
  }) => api.post<Application>('me/applications', payload),

  enrolments: () => api.get<Enrolment[]>('me/enrolments'),

  /**
   * The applicant's copy of the invoice for one payment, as the document
   * itself rather than JSON. Raised and numbered by the ERP; this only
   * fetches the copy.
   */
  invoice: (orderId: string) =>
    download(`me/payments/${orderId}/invoice`, `invoice-${orderId}.pdf`),

  /* ------------------------------------------------------------ payments */

  /** Live, not cached: this is the figure somebody is about to be charged. */
  paymentSummary: (applicationId: number) =>
    api.getLive<PaymentSummary>(`me/applications/${applicationId}/payment`),

  startPayment: (applicationId: number) =>
    api.post<PaymentInitiation>(`me/applications/${applicationId}/payment`),

  payments: () => api.get<PaymentTransaction[]>('me/payments'),

  payment: (orderId: string) => api.getLive<PaymentTransaction>(`me/payments/${orderId}`),

  materials: (programTypeId?: number) =>
    api.get<TrainingMaterial[]>('me/materials', { programTypeId }),

  /**
   * A short-lived address for one uploaded file.
   *
   * The phone's browser and its PDF viewer cannot send a bearer token, so the
   * permission is settled here and what is handed over is a ticket good for
   * that one file, once, for a couple of minutes.
   */
  materialTicket: (id: number, download = false) =>
    api.post<MaterialTicket>(`materials/${id}/ticket?download=${download}`),
};

/* --------------------------------------------------------------- the paper */

/**
 * Sitting the written paper.
 *
 * Deliberately none of this is queued for later. An examination is timed on the
 * server, and an answer accepted by a phone hours after the paper closed would
 * be a promise nobody can keep — the candidate is told plainly when the network
 * is the problem, while there is still time to do something about it.
 */
export const exam = {
  availability: (participantId: number) =>
    api.get<ExamAvailability>(`me/enrolments/${participantId}/exam`),

  start: (participantId: number) =>
    api.post<ExamSitting>(`me/enrolments/${participantId}/exam/start`),

  resume: (attemptId: number) => api.get<ExamSitting>(`me/exam/${attemptId}`),

  answer: (attemptId: number, answers: { questionId: number; optionIds: number[] }[]) =>
    api.put<number>(`me/exam/${attemptId}/answers`, { answers }),

  submit: (attemptId: number) => api.post<ExamResult>(`me/exam/${attemptId}/submit`),
};
