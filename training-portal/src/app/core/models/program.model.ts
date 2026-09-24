import { AuditInfo, Id } from './common.model';

export type ProgramMode = 'Physical' | 'Virtual';
export const PROGRAM_MODES: ProgramMode[] = ['Physical', 'Virtual'];

/** Lifecycle of a programme on the register, mirroring the live workflow. */
export type ProgramStatus =
  | 'New'
  | 'PermissionAccepted'
  | 'CalendarCreated'
  | 'Conducted'
  | 'PermissionRejected'
  | 'QCRejected'
  | 'Postponed';

export const PROGRAM_STATUSES: ProgramStatus[] = [
  'New',
  'PermissionAccepted',
  'CalendarCreated',
  'Conducted',
  'PermissionRejected',
  'QCRejected',
  'Postponed',
];

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  New: 'New programme',
  PermissionAccepted: 'Permission accepted',
  CalendarCreated: 'Calendar created',
  Conducted: 'Conducted',
  PermissionRejected: 'Permission rejected',
  QCRejected: 'QC rejected',
  Postponed: 'Postponed',
};

export interface ProgramParticipant {
  id: Id;
  applicantId: Id;
  applicationNo: string;
  name: string;
  email: string;
  mobile: string;
  enrolledOn: string;
  attendancePercent: number;
  examScore?: number | null;
  result?: 'Pass' | 'Fail' | 'Pending';
  certificateNo?: string | null;
  feedbackRating?: number | null;
}

export interface ProgramSession {
  id: Id;
  sessionCode?: string;
  title: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  facultyName?: string;
  presentCount: number;
  isAttendanceLocked: boolean;
}

/**
 * A scheduled batch captured by a coordinator. Virtual batches record the
 * meeting platform and show "Virtual" as their venue on the register.
 */
export interface Program extends AuditInfo {
  id: Id;
  programmeId: string;
  programmeName: string;
  curriculumId?: Id | null;
  programmeCode?: string;
  categoryId: Id;
  categoryName?: string;
  subCategoryId: Id;
  subCategoryName?: string;
  programTypeId: Id;
  programTypeName?: string;
  agencyId: Id;
  agencyName?: string;
  coordinatorId: Id;
  coordinatorName?: string;
  operationManagerId: Id;
  operationManagerName?: string;
  mode: ProgramMode;
  /** "Virtual" for online batches, otherwise the physical address. */
  venue: string;
  city?: string;
  /** LGD state code; `state` is the display name. */
  stateCode?: number;
  state: string;
  meetingPlatform?: string;
  meetingLink?: string;
  startDate: string;
  endDate: string;
  /** Registration closes by itself once participantCount reaches this. */
  maxParticipants: number;
  participantCount: number;
  cumulativeFeedback?: number | null;
  comments?: string;
  registrationsOpen: boolean;
  examDateTime?: string | null;
  status: ProgramStatus;
  sessions: ProgramSession[];
  participants: ProgramParticipant[];
}

export interface AttendanceMark {
  participantId: Id;
  present: boolean;
}

/** Actions the register exposes inline, depending on the current status. */
export function programActions(program: Pick<Program, 'status' | 'registrationsOpen' | 'examDateTime'>): {
  canAcceptPermission: boolean;
  canCloseRegistrations: boolean;
  canSetExamTime: boolean;
  canPostpone: boolean;
  canMarkConducted: boolean;
} {
  const open = program.status === 'PermissionAccepted' || program.status === 'CalendarCreated';
  return {
    canAcceptPermission: program.status === 'New',
    canCloseRegistrations: open && program.registrationsOpen,
    canSetExamTime: open && !program.registrationsOpen,
    canPostpone: open || program.status === 'New',
    canMarkConducted: open && !!program.examDateTime,
  };
}

/* ------------------------------------------------ the public batch link */

/**
 * A batch as the shareable link shows it. Served without a sign-in, so it
 * carries nothing about who is enrolled or who is running it beyond the
 * agency's name.
 */
export interface PublicProgramme {
  programmeId: string;
  programmeName: string;
  programTypeName: string;
  shortDescription?: string;
  categoryName: string;
  subCategoryName: string;
  mode: string;
  venue?: string | null;
  city?: string | null;
  district?: string | null;
  state?: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  maxParticipants: number;
  enrolled: number;
  seatsLeft: number;
  /** Upcoming, Ongoing or Completed — where it sits in time. */
  scheduleStatus: string;
  registrationsOpen: boolean;
  /** Open, Full, Already held, Awaiting approval or Closed. */
  registrationStatus: string;
  agencyName?: string | null;
  minQualificationLabel?: string | null;
  minExperienceYears: number;
  isFeeApplicable: boolean;
}
