/**
 * What the coordinator app exchanges with the API. These mirror the
 * contracts in Ntms.Application/Contracts/MonitoringDtos.cs.
 */

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string | null;
  errors?: string[] | null;
}

/** A coordinator's record, as the implementing agency filled it in. */
export interface CoordinatorProfile {
  userCode: string;
  fullName: string;
  designation?: string | null;
  email: string;
  mobile: string;
  roleName: string;
  organisationName?: string | null;
  panLast4?: string | null;
  aadhaarLast4?: string | null;
  city?: string | null;
  districtName?: string | null;
  stateName?: string | null;
  pincode?: string | null;
  agencyName?: string | null;
  agencyCode?: string | null;
  reportsToName?: string | null;
  reportsToCode?: string | null;
  states: string[];
  districts: string[];
  categories: string[];
  subCategories: string[];
  programTypes: string[];
}

/** Who to ring about a programme: the agency that appointed you. */
export interface AgencyContact {
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  mobile?: string | null;
}

/** What the server says after sending a reset code. */
export interface ForgotPasswordResult {
  message: string;
  validityMinutes: number;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: { id: number; userCode: string; fullName: string; roleName?: string };
}

export type PhotoKind =
  | 'VenueExterior'
  | 'VenueInterior'
  | 'Session'
  | 'Participant'
  | 'AttendanceSheet';

export interface MonitoringPhoto {
  id: number;
  kind: PhotoKind;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  latitude?: number | null;
  longitude?: number | null;
  capturedOn: string;
  /** Relative to the API base, e.g. "coordinator/photos/12". */
  url: string;
}

export interface Workshop {
  id: number;
  programmeId: string;
  programmeName: string;
  programTypeName?: string;
  venue: string;
  city?: string;
  state?: string;
  district?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  isSubmitted: boolean;
  submittedOn?: string | null;
  /** Whether the coordinator has registered the venue: the line between
      a programme that is scheduled and one that is under way. */
  venueRegistered: boolean;
  /** Physical, Virtual or Hybrid: decides whether an address or a link
      is the thing a coordinator needs. */
  mode: string;
  meetingPlatform?: string | null;
  meetingLink?: string | null;
  /** The teaching day, from the curriculum's own timetable. */
  dailyStartTime?: string | null;
  dailyEndTime?: string | null;
}

export interface Progress {
  venueRegistered: boolean;
  venueGeoTagged: boolean;
  venueExteriorPhoto: boolean;
  venueInteriorPhoto: boolean;
  trainerCount: number;
  sessionCount: number;
  participantCount: number;
  attendanceMarkedCount: number;
  presentCount: number;
  attendanceSheetCount: number;
  feedbackCount: number;
  photoCount: number;
  /** Empty means the workshop can be submitted. */
  blockers: string[];
}

export interface Venue {
  id: number;
  name: string;
  address: string;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracyMetres?: number | null;
  geoTaggedOn?: string | null;
  exteriorPhoto?: MonitoringPhoto | null;
  interiorPhoto?: MonitoringPhoto | null;
}

export interface Trainer {
  id: number;
  fullName: string;
  mobile: string;
  email?: string | null;
  designation?: string | null;
  organisation?: string | null;
  engagement?: 'FullTime' | 'PartTime' | null;
  yearsExperience?: number | null;
  qualification?: string | null;
  /** The last four digits. The whole number is never sent back. */
  aadhaarLast4?: string | null;
}

/** What is sent when a trainer is registered or corrected. */
export interface TrainerUpsert {
  fullName: string;
  mobile: string;
  email?: string;
  designation?: string;
  organisation?: string;
  engagement?: 'FullTime' | 'PartTime';
  yearsExperience?: number;
  qualification?: string;
  /** Sent whole, once. Nothing reads it back. */
  aadhaar?: string;
}

export interface MonitoringSession {
  id: number;
  trainerId: number;
  trainerName?: string;
  curriculumSessionId: number;
  topicName?: string;
  curriculumTopicId: number;
  subTopicName?: string;
  conductedOn: string;
  comments?: string | null;
  photo?: MonitoringPhoto | null;
}

/** One person's mark on one day, as yyyy-MM-dd. */
export interface AttendanceDay {
  day: string;
  isPresent: boolean;
  markedOn: string;
}

export interface Participant {
  id: number;
  fullName: string;
  mobile: string;
  email: string;
  enterpriseName: string;
  designation?: string | null;
  udyamNumber: string;
  gender?: string | null;
  socialCategory?: string | null;
  /** Present on any day of the programme. The roll-up, not the register. */
  isPresent?: boolean | null;
  attendanceMarkedOn?: string | null;
  /**
   * The days this person has been marked on, present or absent.
   *
   * A day missing from this list has not been taken yet, which the
   * register shows as untouched rather than as an absence.
   */
  days?: AttendanceDay[];
  feedbackRating?: number | null;
  feedbackComments?: string | null;
  photo?: MonitoringPhoto | null;
}

export interface WorkshopDetail extends Workshop {
  progress: Progress;
  /** Named venue2 on the wire: the base already has a venue address string. */
  venue2?: Venue | null;
  trainers: Trainer[];
  sessions: MonitoringSession[];
  participants: Participant[];
  attendanceSheets: MonitoringPhoto[];
}

export interface SessionTopic {
  sessionId: number;
  sessionName: string;
  subTopics: { topicId: number; topicName: string }[];
}

export interface Submission {
  programmeId: number;
  submittedOn: string;
  submittedBy?: string;
  trainerCount: number;
  sessionCount: number;
  participantCount: number;
  presentCount: number;
  photoCount: number;
  remarks?: string | null;
}

/* --------------------------------------------------------------- marksheet */

/**
 * The trainer's marksheet for one programme: the enrolled candidates, the
 * skills the viva is marked against, and what each of them has been given.
 *
 * The same shape the portal reads. Results are never worked out here — the
 * server recomputes them from the marks and sends the sheet back — so a phone
 * in a hall and a browser in an office cannot disagree about who passed.
 */
export interface Marksheet {
  programmeId: number;
  programmeCode: string;
  programmeName: string;
  programTypeName: string;
  evaluation: EvaluationScheme;
  skills: MarksheetSkill[];
  trainers: MarksheetTrainer[];
  rows: MarksheetRow[];
  canEdit: boolean;
  readOnlyReason?: string | null;
  markedCount: number;
  passCount: number;
  failCount: number;
}

/** What the program type examines, out of how many marks, and what passes. */
export interface EvaluationScheme {
  kind: 'None' | 'Written' | 'VivaPractical' | 'WrittenAndViva';
  kindLabel?: string | null;
  totalMarks: number;
  writtenMarks: number;
  vivaMarks: number;
  writtenPassMarks: number;
  vivaPassMarks: number;
  overallPassMarks: number;
  hasWritten: boolean;
  hasViva: boolean;
}

export interface MarksheetSkill {
  id: number;
  name: string;
  description?: string | null;
  maxMarks: number;
  displayOrder: number;
  /** Retired, but still carrying marks on this sheet. Nothing new goes here. */
  isRetired: boolean;
}

export interface MarksheetTrainer {
  id: number;
  fullName: string;
  organisation?: string | null;
}

export interface MarksheetRow {
  participantId: number;
  name: string;
  applicationNo: string;
  attendancePercent: number;
  writtenMarks?: number | null;
  vivaMarks?: number | null;
  total?: number | null;
  result: 'Pending' | 'Pass' | 'Fail';
  resultRecordedOn?: string | null;
  pending?: string | null;
  shortfall?: string | null;
  /** True once a certificate has been issued: the line is then read only. */
  isLocked: boolean;
  /** True when the written mark came from the paper the candidate sat online. */
  writtenFromExam: boolean;
  examPercentage?: number | null;
  examAttempts: number;
  skillMarks: MarksheetSkillMark[];
}

export interface MarksheetSkillMark {
  skillId: number;
  marks: number;
  trainerId?: number | null;
  trainerName?: string | null;
  markedOn: string;
}

export interface MarksheetRowSave {
  participantId: number;
  writtenMarks?: number | null;
  trainerId?: number | null;
  skillMarks: { skillId: number; marks: number; clear?: boolean }[];
}

export const GENDERS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Others' },
];

export const SOCIAL_CATEGORIES = [
  { value: 'General', label: 'General' },
  { value: 'OBC', label: 'OBC' },
  { value: 'SC', label: 'SC' },
  { value: 'ST', label: 'ST' },
];

/** The organisation's own identity, set by an administrator in the portal. */
export interface Branding {
  organisationName: string;
  shortName: string;
  portalTitle: string;
  tagline?: string | null;
  supportEmail?: string | null;
  /** Where the department takes questions. Empty where none is published. */
  supportUrl?: string | null;
  /** What the department says about the scheme, for the About screen. */
  aboutText?: string | null;
  hasLogo: boolean;
  logoFileName?: string | null;
  /** Relative to the API base, already carrying a cache-busting version. */
  logoUrl?: string | null;
  logoVersion: number;
  updatedOn: string;
}

/** One notice as the handset shows it. */
export interface MyNotification {
  id: number;
  title: string;
  body: string;
  linkPath?: string | null;
  kind: string;
  sentOn: string;
  isRead: boolean;
}

export interface MyNotifications {
  items: MyNotification[];
  unread: number;
}

/**
 * The signed-in account as the server describes it.
 *
 * Read on the profile screen rather than kept in the session: a role can
 * be reshaped while somebody is signed in, and what the app should show is
 * what the server says today.
 */
export interface AuthUser {
  id: number;
  userCode: string;
  fullName: string;
  email: string;
  mobile: string;
  role: string;
  roleName: string;
  permissions: string[];
  agencyId?: number | null;
  avatarInitials: string;
  mustChangePassword: boolean;
}

/** One published item of training material, as the coordinator may read it. */
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

/** A short-lived address for one uploaded file. */
export interface MaterialTicket {
  url: string;
  expiresInSeconds: number;
}
