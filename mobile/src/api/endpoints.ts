import { api } from './client';
import type {
  Applicant,
  ApplicantBatch,
  ApplicantLoginResponse,
  ApplicantProgram,
  Application,
  Branding,
  Enrolment,
  FeeStructure,
  Gender,
  LookupItem,
  RegistrationForm,
  SocialCategory,
  TrainingMaterial,
} from './types';

/* ------------------------------------------------------------ anonymous */

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
  gender: Gender;
  socialCategory: SocialCategory;
  categoryId: number;
  subCategoryId: number;
}

export const batches = {
  /** Open batches this applicant could join, with their standing on each. */
  mine: () => api.get<ApplicantBatch[]>('me/batches'),
};

export const auth = {
  signUp: (payload: SignUpPayload) =>
    api.post<Applicant>('applicants/sign-up', payload, true),

  sendOtp: (email: string, name?: string) =>
    api.post<boolean>('otp/send', { email, name }, true),

  /** Verifying for the first time is what issues the password, by e-mail. */
  verifyOtp: (email: string, code: string) =>
    api.post<boolean>('otp/verify', { email, code }, true),

  login: (applicantCode: string, password: string) =>
    api.post<ApplicantLoginResponse>('auth/applicant/login', { applicantCode, password }, true),
};

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

  materials: (programTypeId?: number) =>
    api.get<TrainingMaterial[]>('me/materials', { programTypeId }),
};
