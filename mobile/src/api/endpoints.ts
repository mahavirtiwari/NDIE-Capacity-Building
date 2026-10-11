import { api, API_BASE_URL, download } from './client';
import { asFields, type CaptureFacts } from '../files/captureFacts';
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
  MyNotifications,
  PaymentInitiation,
  PaymentSummary,
  PaymentTransaction,
  PhotoShot,
  PhotoStanding,
  ProfileForm,
  FeedbackForm,
  FeedbackInvitation,
  ProfileChoice,
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

  /** Answers to whatever else the form asks, keyed by field. */
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
   * The sign-up form, with the switched-off questions already left out.
   * Anonymous, because it is drawn before anybody has an account.
   */
  signupForm: () => api.get<SignupForm>('signup-form/public', undefined, true),

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

  /* No email here. A new address is proven before it is trusted, so it
     moves through the three calls below and a code sent to it. */
  updateProfile: (payload: {
    mobile: string;
    stateCode?: number | null;
    districtCode?: number | null;
    city?: string | null;
  }) => api.put<Applicant>('me', payload),

  /** Sends a passcode to the address the applicant wants to move to. */
  requestEmailChange: (email: string) =>
    api.post<Applicant>('me/email-change', { email }),

  resendEmailChange: () => api.post<Applicant>('me/email-change/resend', {}),

  /** Moves the account, once the passcode proves they can read it. */
  confirmEmailChange: (code: string) =>
    api.post<Applicant>('me/email-change/verify', { code }),

  cancelEmailChange: () => api.delete<Applicant>('me/email-change'),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<boolean>('me/change-password', { currentPassword, newPassword }),

  programs: () => api.get<ApplicantProgram[]>('me/programs'),

  /* ------------------------------------------------------ profile form
     Keyed by sub-category throughout. One account holds a profile in each
     category it has entered - one per category, never two - so none of
     this can be addressed by the account alone. */

  /** Every profile held, and where each stands. */
  myProfiles: () => api.getLive<ProfileStanding[]>('me/profile-submissions'),

  /** The disciplines a new profile may still be started in. */
  profileChoices: () => api.getLive<ProfileChoice[]>('me/profile-choices'),

  /** Live, not cached: this decides whether anything else is reachable. */
  profileStanding: (subCategoryId: number) =>
    api.getLive<ProfileStanding>(`me/profile-submission/${subCategoryId}`),

  /* ------------------------------------------------- notifications */

  notifications: (take = 50) =>
    api.getLive<MyNotifications>('my-notifications', { take }),

  markNotificationRead: (id: number) =>
    api.post<boolean>(`my-notifications/${id}/read`, {}),

  registerDevice: (device: { token: string; platform: string; app: string }) =>
    api.post<boolean>('my-notifications/devices', device),

  retireDevice: (token: string) =>
    api.delete<boolean>(`my-notifications/devices/${encodeURIComponent(token)}`),

  /* -------------------------------------------- pictures on a field */

  photoStanding: (subCategoryId: number, fieldKey: string) =>
    api.getLive<PhotoStanding>(
      `me/profile-photos/${subCategoryId}/${encodeURIComponent(fieldKey)}`),

  /**
   * Sends one picture with what the phone knew when it was taken.
   *
   * The facts travel with the image rather than in a call of their own:
   * two requests could be separated by a dropped connection, and a
   * position stored against a photograph that never arrived is worse
   * than no position at all.
   */
  addPhoto: (
    subCategoryId: number,
    fieldKey: string,
    picture: { uri: string; type: string },
    facts?: CaptureFacts,
  ) =>
    api.uploadFile<PhotoStanding>(
      `me/profile-photos/${subCategoryId}/${encodeURIComponent(fieldKey)}`,
      'picture',
      { uri: picture.uri, name: 'picture.jpg', type: picture.type },
      facts ? asFields(facts) : {},
    ),

  /** Every picture held for a field, in the order taken. */
  photoList: (subCategoryId: number, fieldKey: string) =>
    api.getLive<PhotoShot[]>(
      `me/profile-photos/${subCategoryId}/${encodeURIComponent(fieldKey)}/all`),

  /** Where one picture can be fetched from, for the thumbnail beside the field. */
  photoUri: (subCategoryId: number, fieldKey: string, displayOrder: number) =>
    `${API_BASE_URL}/me/profile-photos/${subCategoryId}`
    + `/${encodeURIComponent(fieldKey)}/${displayOrder}`,

  removePhoto: (subCategoryId: number, fieldKey: string, displayOrder: number) =>
    api.delete<PhotoStanding>(
      `me/profile-photos/${subCategoryId}/${encodeURIComponent(fieldKey)}/${displayOrder}`),

  /* ------------------------------------------------ a file on a field */

  profileFile: (subCategoryId: number, fieldKey: string) =>
    api.getLive<FileStanding>(
      `me/profile-files/${subCategoryId}/${encodeURIComponent(fieldKey)}`),

  /** Replaces whatever the field held, because a file field has one answer. */
  setProfileFile: (
    subCategoryId: number,
    fieldKey: string,
    file: { uri: string; name: string; type: string },
  ) =>
    api.uploadFile<FileStanding>(
      `me/profile-files/${subCategoryId}/${encodeURIComponent(fieldKey)}`,
      'document',
      file,
    ),

  profileFileDownload: (subCategoryId: number, fieldKey: string) =>
    download(
      `me/profile-files/${subCategoryId}/${encodeURIComponent(fieldKey)}/download`, fieldKey),

  /** Every picture for the field, merged, in the order taken. */
  /** The form one sub-category asks. */
  /**
   * Null where no form has been published for the discipline. That is a
   * real state rather than a fault: a profile carried over from the old
   * per-application scrutiny can be accepted in a sub-category that has
   * no form on it today. The screen reads the standing for what it shows
   * and only needs the form to fill one in.
   */
  profileForm: (subCategoryId: number) =>
    api.get<ProfileForm | null>(`me/profile-form/${subCategoryId}`),

  /**
   * The answers from a profile already held, to start another one from.
   * Nothing is submitted by this - the applicant reads every answer and
   * sends it themselves.
   */
  fetchProfile: (subCategoryId: number, fromSubCategoryId: number) =>
    api.getLive<Record<string, unknown>>(
      `me/profile-form/${subCategoryId}/from/${fromSubCategoryId}`),

  /**
   * Keeps what has been filled in so far, without sending it.
   *
   * The answers used to live only in the screen's own state, so signing
   * out threw away a form that had taken an hour to fill. Saved as the
   * applicant moves between sections; the draft is the row the
   * submission will become, so nothing has to be reconciled later.
   */
  saveProfileDraft: (subCategoryId: number, responses: Record<string, unknown>) =>
    api.put<ProfileStanding>('me/profile-draft', { subCategoryId, responses }),

  submitProfile: (subCategoryId: number, responses: Record<string, unknown>) =>
    api.post<ProfileStanding>('me/profile-submission', { subCategoryId, responses }),

  /* ---------------------------------------------------------- feedback
     Asked once a batch has been conducted. What is written is stored
     against the batch and not against the person who wrote it, so there
     is no route to read an answer back - only to know it was given. */

  feedbackInvitations: () => api.getLive<FeedbackInvitation[]>('me/feedback'),

  feedbackForm: (participantId: number) =>
    api.get<FeedbackForm>(`me/feedback/${participantId}`),

  submitFeedback: (participantId: number, answers: Record<string, unknown>) =>
    api.post<boolean>(`me/feedback/${participantId}`, { answers }),

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
   * Multipart rather than JSON, because the picture is a file, and the
   * picture is not optional: the server refuses to open a paper without
   * one, so there is no call to make without it.
   */
  start: (participantId: number, selfie: { uri: string; type: string }) => {
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

  /**
   * Closes the paper because the app was left.
   *
   * Reported as the screen goes away, so it is sent on a best effort: the
   * phone may be locked a moment later. The candidate starts again from
   * the first question either way, because the app refuses to resume a
   * sitting it has reported.
   */
  abandon: (attemptId: number) => api.post<boolean>(`me/exam/${attemptId}/abandon`),
};
