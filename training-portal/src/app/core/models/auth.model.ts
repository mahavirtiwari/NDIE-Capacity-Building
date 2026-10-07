import { TimelineEvent } from './applicant.model';
import { Id, RecordStatus } from './common.model';

/**
 * Application roles. `Applicant` authenticates from the React Native app but is
 * included here because the web portal renders applicant records and profiles.
 */
export type AppRole =
  | 'SuperAdmin'
  | 'Ministry'
  | 'Admin'
  | 'OperationManager'
  | 'AgencyAdmin'
  | 'Coordinator'
  | 'Applicant';

export const ROLE_LABELS: Record<AppRole, string> = {
  SuperAdmin: 'Super Admin',
  Ministry: 'Ministry of MSME',
  Admin: 'Admin',
  OperationManager: 'Operation Manager',
  AgencyAdmin: 'Implementing Agency',
  Coordinator: 'Coordinator',
  Applicant: 'Applicant',
};

/**
 * Fine grained permissions. A role carries a permission set so Super Admin can
 * mint new admin roles without a code change.
 */
export type Permission =
  | 'masters.view' | 'masters.manage'
  | 'curriculum.view' | 'curriculum.manage'
  | 'fees.view' | 'fees.manage'
  | 'exams.view' | 'exams.manage'
  | 'materials.view' | 'materials.manage'
  | 'roles.view' | 'roles.manage'
  | 'agencies.view' | 'agencies.manage'
  | 'users.view' | 'users.manage' | 'users.status'
  | 'applications.view' | 'applications.scrutinise'
  | 'programs.view' | 'programs.create' | 'programs.manage' | 'programs.approve'
  | 'coordinators.view' | 'coordinators.manage'
  | 'reports.view'
  | 'professionals.view'
  | 'trainers.view' | 'trainers.manage'
  | 'settings.manage'
  | 'notifications.view' | 'notifications.send';

export interface PermissionGroup {
  group: string;
  permissions: { key: Permission; label: string }[];
}

export const PERMISSION_CATALOGUE: PermissionGroup[] = [
  {
    group: 'Masters',
    permissions: [
      { key: 'masters.view', label: 'View categories / sub-categories / program types' },
      { key: 'masters.manage', label: 'Create & edit masters' },
    ],
  },
  {
    group: 'Curriculum & Assessment',
    permissions: [
      { key: 'curriculum.view', label: 'View curriculum' },
      { key: 'curriculum.manage', label: 'Manage curriculum' },
      { key: 'exams.view', label: 'View exam papers' },
      { key: 'exams.manage', label: 'Manage exam papers' },
      { key: 'materials.view', label: 'View training material' },
      { key: 'materials.manage', label: 'Manage training material' },
    ],
  },
  {
    group: 'Finance',
    permissions: [
      { key: 'fees.view', label: 'View fee structures' },
      { key: 'fees.manage', label: 'Manage fee structures' },
    ],
  },
  {
    group: 'Access control',
    permissions: [
      { key: 'roles.view', label: 'View roles' },
      { key: 'roles.manage', label: 'Manage roles & permissions' },
      { key: 'users.view', label: 'View users' },
      { key: 'users.manage', label: 'Manage users' },
      { key: 'users.status', label: 'Enable or disable users' },
    ],
  },
  {
    group: 'Operations',
    permissions: [
      { key: 'agencies.view', label: 'View implementing agencies' },
      { key: 'agencies.manage', label: 'Manage implementing agencies' },
      { key: 'applications.view', label: 'View applications' },
      { key: 'applications.scrutinise', label: 'Scrutinise / approve applications' },
      { key: 'programs.view', label: 'View programs' },
      /* Raising a batch is the implementing agency's job; permitting and
         running it belongs to the tier above. Two permissions, because
         they are two jobs. */
      { key: 'programs.create', label: 'Raise a new program' },
      { key: 'programs.manage', label: 'Run programs: exam, sessions, attendance, enrolment' },
      { key: 'programs.approve', label: 'Permit or postpone a program' },
      { key: 'coordinators.view', label: 'View coordinators' },
      { key: 'coordinators.manage', label: 'Manage coordinators' },
    ],
  },
  {
    group: 'Reports & registers',
    permissions: [
      { key: 'reports.view', label: 'View reports' },
      { key: 'professionals.view', label: 'View qualified professionals' },
      { key: 'trainers.view', label: 'View trainers' },
      { key: 'trainers.manage', label: 'Add & edit trainers' },
    ],
  },
  {
    group: 'Portal settings',
    permissions: [
      { key: 'settings.manage', label: 'Edit portal branding (name & logo)' },
    ],
  },
  {
    group: 'Notifications',
    permissions: [
      { key: 'notifications.view', label: 'Read what has been sent to the apps' },
      { key: 'notifications.send', label: 'Write and send a notification' },
    ],
  },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_CATALOGUE.flatMap((g) =>
  g.permissions.map((p) => p.key),
);

export interface AuthUser {
  id: Id;
  userCode: string;
  fullName: string;
  email: string;
  mobile: string;
  role: AppRole;
  roleName: string;
  permissions: Permission[];
  /** Operation managers / coordinators are scoped to a slice of the masters. */
  categoryIds: Id[];
  subCategoryIds: Id[];
  programTypeIds: Id[];
  agencyId?: Id | null;
  avatarInitials: string;
  mustChangePassword: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
  captcha?: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: AuthUser;
}

/**
 * Reply to a reset request — byte for byte identical for unknown user IDs, so
 * it deliberately carries no address to show back.
 */
export interface ForgotPasswordResult {
  message: string;
  validityMinutes: number;
}

/** One switch of an account on or off, and the grounds for it. */
export interface UserStatusEvent {
  id: Id;
  fromStatus: RecordStatus;
  toStatus: RecordStatus;
  reason: string;
  byUserName: string;
  byUserCode: string;
  on: string;
}

/**
 * An account's status history, carrying the login it belongs to so the popup
 * showing it does not have to be told separately who it is about.
 */
export interface UserHistory {
  userId: Id;
  userCode: string;
  fullName: string;
  email?: string | null;
  roleName: string;
  status: RecordStatus;
  lastLoginOn?: string | null;
  events: UserStatusEvent[];

  /** Everything that has happened to this account, oldest first. */
  timeline?: TimelineEvent[];
}
