import { AuditInfo, Id } from './common.model';

/**
 * How a batch is delivered. Hybrid is both at once rather than a third
 * thing: the room is real and so is the joining link, so a hybrid batch
 * carries a venue and a meeting link together.
 */
export type ProgramMode = 'Physical' | 'Virtual' | 'Hybrid';
export const PROGRAM_MODES: ProgramMode[] = ['Physical', 'Virtual', 'Hybrid'];

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

/**
 * The states in the words the office uses for them.
 *
 * "New program" said what the row was rather than what had happened to
 * it, which is the question the register is read to answer. Nor is
 * "Program created by IA", which says who did something rather than
 * what anybody is now waiting for: a batch at this point has been
 * raised by the agency running it and is waiting on the manager above
 * to permit it, and that is what both of them want to read.
 */
export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  New: 'Pending for approval',
  PermissionAccepted: 'Permission accepted',
  CalendarCreated: 'Calendar created',
  Conducted: 'Conducted',
  PermissionRejected: 'Permission rejected',
  QCRejected: 'QC rejected',
  Postponed: 'Postponed',
};

/**
 * The states that carry a reason with them.
 *
 * A refusal and a postponement are the two a reader cannot act on
 * without knowing why, so the register prints the reason beside the
 * badge instead of making somebody open the batch to find it.
 */
export function statusNeedsReason(status: ProgramStatus): boolean {
  return status === 'PermissionRejected'
    || status === 'QCRejected'
    || status === 'Postponed';
}

export interface ProgramParticipant {
  id: Id;
  applicantId: Id;
  applicationNo: string;
  name: string;
  email: string;
  mobile: string;
  enrolledOn: string;
  attendancePercent: number;
  /**
   * Off the applicant's accepted profile, for the questions the form's
   * designer marked as holding them. Absent where the discipline's form
   * marks no such field, or where it was left blank.
   */
  organisation?: string | null;
  udyamNumber?: string | null;
  /** The two halves as well as the total, where the type marks both. */
  writtenMarks?: number | null;
  vivaMarks?: number | null;
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
/**
 * What this discipline's profile form calls the answers the register
 * prints beside a name.
 *
 * The designer's own wording, because they named the field. Absent where
 * the form marks no field with that meaning, which is how the column
 * knows not to appear.
 */
export interface ParticipantProfileFields {
  organisationLabel?: string | null;
  udyamLabel?: string | null;
}

export interface Program extends AuditInfo {
  /** See {@link ParticipantProfileFields}. On the detail only. */
  participantFields?: ParticipantProfileFields | null;

  /** Why the agency has asked for this to be put off, if it has. */
  postponementReason?: string | null;
  postponementRequestedOn?: string | null;

  /* Where the agency has asked to move it to, if it has asked. The live
     venue is untouched until the manager accepts. */
  requestedVenue?: string | null;
  requestedCity?: string | null;
  requestedDistrict?: string | null;
  requestedDistrictCode?: number | null;
  requestedPincode?: string | null;
  venueChangeReason?: string | null;
  venueChangeRequestedOn?: string | null;

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
  coordinatorMobile?: string | null;
  coordinatorEmail?: string | null;
  operationManagerId: Id;
  operationManagerName?: string;
  mode: ProgramMode;
  /** "Virtual" for online batches, otherwise the physical address. */
  venue: string;
  city?: string;
  /** LGD state code; `state` is the display name. */
  stateCode?: number;
  state: string;
  /** Optional, and what the dashboard drills into below state level. */
  districtCode?: number | null;
  district?: string | null;
  /** The venue's pincode, for a batch with a room. */
  pincode?: string | null;
  meetingPlatform?: string;
  meetingLink?: string;
  startDate: string;
  endDate: string;
  /** The hours of the day the batch runs, as HH:mm. */
  startTime: string;
  endTime: string;
  /** Registration closes by itself once participantCount reaches this. */
  maxParticipants: number;
  participantCount: number;
  cumulativeFeedback?: number | null;
  comments?: string;
  registrationsOpen: boolean;
  examDateTime?: string | null;
  /** The paper this batch sits online, chosen when the exam is scheduled. */
  examPaperId?: number | null;
  examPaperTitle?: string | null;
  status: ProgramStatus;
  sessions: ProgramSession[];
  participants: ProgramParticipant[];
}

/** Actions the register exposes inline, depending on the current status. */
export function programActions(
  program: Pick<
    Program,
    | 'status'
    | 'registrationsOpen'
    | 'examDateTime'
    | 'startDate'
    | 'mode'
    | 'venueChangeRequestedOn'
    | 'postponementRequestedOn'
  >,
): {
  canAcceptPermission: boolean;
  canRejectPermission: boolean;
  canReopenRegistrations: boolean;
  canSetExamTime: boolean;
  canDecidePostponement: boolean;
  canAskToPostpone: boolean;
  canAskToMove: boolean;
  canDecideMove: boolean;
  canMarkConducted: boolean;
} {
  const open = program.status === 'PermissionAccepted' || program.status === 'CalendarCreated';

  /* Registration closes the day before the batch starts, and a batch closes
     itself the moment it fills. So reopening is offered on a closed batch
     that has not reached that day — and closing by hand is offered at all,
     the cap having already done it. */
  const startsOn = program.startDate ? new Date(program.startDate) : null;
  const inTime =
    !!startsOn &&
    new Date(new Date().toDateString()) < new Date(startsOn.getTime() - 86_400_000);

  const asked = !!program.postponementRequestedOn;

  return {
    /* A batch the agency has raised is waiting on one answer, and there
       are two of them. Rejecting was reachable by no button at all, so a
       batch the manager did not want sat at New for ever or was quietly
       postponed instead - which is a different thing and says a different
       thing to the agency. */
    canAcceptPermission: program.status === 'New',
    canRejectPermission: program.status === 'New',
    canReopenRegistrations: open && !program.registrationsOpen && inTime,
    canSetExamTime: open && !program.registrationsOpen,
    /* Putting a batch off is an answer to an ask, not something done to a
       running batch out of nowhere: the agency is the one that knows the
       hall has flooded. It was offered on every open batch and on every
       new one, which invited the manager to postpone a batch nobody had
       asked about and left the agency's ask looking unanswerable. */
    canDecidePostponement: asked,
    /* The agency asks; the manager decides. Same act, different side of
       it - but only once the programme has been permitted. There is
       nothing to put off before that: a batch still waiting on the
       manager is refused or permitted, and putting off something that
       may never run is a decision about nothing. And not twice: an ask
       already on the row is waiting to be answered. */
    canAskToPostpone: open && !asked,
    canMarkConducted: open && !!program.examDateTime,
    /* Only a batch that is actually held somewhere, and only once it has
       been permitted: before that the agency edits it outright. */
    canAskToMove: open && program.mode !== 'Virtual' && !program.venueChangeRequestedOn,
    canDecideMove: !!program.venueChangeRequestedOn,
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
  minParticipants: number;
  isFeeApplicable: boolean;
}

/* --------------------------------------------------------- quality control */

/** Where a conducted programme's report stands with the Operation Manager. */
export type QcStatus = 'AwaitingAgency' | 'Pending' | 'Approved' | 'Rejected';

export const QC_STATUSES: QcStatus[] =
  ['AwaitingAgency', 'Pending', 'Approved', 'Rejected'];

export const QC_STATUS_LABELS: Record<QcStatus, string> = {
  AwaitingAgency: 'With the agency',
  Pending: 'Pending programs',
  Approved: 'Approved programs',
  Rejected: 'Rejected programs',
};

/**
 * A conducted programme as the QC queues show it.
 *
 * Carries the programme's identity, what the coordinator handed in, and
 * the manager's decision — enough for a row and for the sheet that opens
 * from it, without a second call per programme.
 */
export interface QcProgramme {
  programmeId: Id;
  programmeCode: string;
  programmeName: string;
  programTypeId: Id;
  programTypeName?: string | null;
  agencyId?: Id | null;
  agencyName?: string | null;
  venue?: string | null;
  mode?: string | null;
  state?: string | null;
  startDate?: string | null;
  endDate?: string | null;

  submittedOn: string;
  submittedBy?: string | null;
  trainerCount: number;
  sessionCount: number;
  participantCount: number;
  presentCount: number;
  photoCount: number;
  remarks?: string | null;

  qcStatus: QcStatus;
  /** Who at the agency passed it to the manager, and when. */
  forwardedBy?: string | null;
  forwardedOn?: string | null;
  qcOn?: string | null;
  qcBy?: string | null;
  qcRemarks?: string | null;
}

export interface QcCounts {
  /** Handed in by a coordinator, waiting on the agency to forward it. */
  awaitingAgency: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface QcDecision {
  /** Required on a rejection, optional on an approval. */
  remarks?: string | null;
}
