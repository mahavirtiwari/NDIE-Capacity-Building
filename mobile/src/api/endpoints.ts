import { api, download } from './client';
import type {
  Applicant,
  ApplicantBatch,
  ApplicantLoginResponse,
  ApplicantProgram,
  Application,
  BatchRegistration,
  Branding,
  Enrolment,
  ExamAvailability,
  ExamResult,
  ExamSitting,
  FeeStructure,
  FileStanding,
  Gender,
  LookupItem,
  MaterialTicket,
  PaymentInitiation,
  PaymentSummary,
  PaymentTransaction,
  PhotoStanding,
  ProfileForm,
  ProfileStanding,
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

  /**
   * Takes a seat. Answers either that they are registered, or that the fee
   * has to be paid first and against which application.
   */
  register: (programmeId: number) =>
    api.post<BatchRegistration>(`me/batches/${programmeId}/register`),
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

  /* ------------------------------------------------------ profile form */

  /** Live, not cached: this decides whether anything else is reachable. */
  profileStanding: () => api.getLive<ProfileStanding>('me/profile-submission'),

  /* -------------------------------------------- pictures on a field */

  photoStanding: (fieldKey: string) =>
    api.getLive<PhotoStanding>(`me/profile-photos/${encodeURIComponent(fieldKey)}`),

  addPhoto: (fieldKey: string, picture: { uri: string; type: string }) => {
    const body = new FormData();
    body.append('picture', {
      uri: picture.uri,
      name: 'picture.jpg',
      type: picture.type,
    } as unknown as Blob);

    return api.postForm<PhotoStanding>(
      `me/profile-photos/${encodeURIComponent(fieldKey)}`, body);
  },

  removePhoto: (fieldKey: string, displayOrder: number) =>
    api.delete<PhotoStanding>(
      `me/profile-photos/${encodeURIComponent(fieldKey)}/${displayOrder}`),

  /* ------------------------------------------------ a file on a field */

  profileFile: (fieldKey: string) =>
    api.getLive<FileStanding>(`me/profile-files/${encodeURIComponent(fieldKey)}`),

  /** Replaces whatever the field held, because a file field has one answer. */
  setProfileFile: (fieldKey: string, file: { uri: string; name: string; type: string }) => {
    const body = new FormData();
    body.append('document', {
      uri: file.uri,
      name: file.name,
      type: file.type,
    } as unknown as Blob);

    return api.postForm<FileStanding>(
      `me/profile-files/${encodeURIComponent(fieldKey)}`, body);
  },

  profileFileDownload: (fieldKey: string) =>
    download(`me/profile-files/${encodeURIComponent(fieldKey)}/download`, fieldKey),

  /** Every picture for the field, merged, in the order taken. */
  photoPdf: (fieldKey: string) =>
    download(`me/profile-photos/${encodeURIComponent(fieldKey)}/pdf`, `${fieldKey}.pdf`),

  /** The form for this applicant's own sub-category. */
  profileForm: () => api.get<ProfileForm>('me/profile-form'),

  submitProfile: (responses: Record<string, unknown>) =>
    api.post<ProfileStanding>('me/profile-submission', { responses }),

  form: (programTypeId: number) =>
    api.get<ProfileForm>(`me/programs/${programTypeId}/form`),

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

  /**
   * Opens the paper, with the photograph taken at the desk.
   *
   * Multipart rather than JSON, because the picture is a file. It is
   * required by the screen rather than by the API: an older app that does
   * not send one still works, and the sitting simply has no photograph
   * against it.
   */
  start: (participantId: number, selfie?: { uri: string; type: string }) => {
    if (!selfie) {
      return api.post<ExamSitting>(`me/enrolments/${participantId}/exam/start`);
    }

    const body = new FormData();
    body.append('selfie', {
      uri: selfie.uri,
      name: 'selfie.jpg',
      type: selfie.type,
    } as unknown as Blob);

    return api.postForm<ExamSitting>(`me/enrolments/${participantId}/exam/start`, body);
  },

  resume: (attemptId: number) => api.get<ExamSitting>(`me/exam/${attemptId}`),

  answer: (attemptId: number, answers: { questionId: number; optionIds: number[] }[]) =>
    api.put<number>(`me/exam/${attemptId}/answers`, { answers }),

  submit: (attemptId: number) => api.post<ExamResult>(`me/exam/${attemptId}/submit`),
};
