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
  startDate: string;
  endDate: string;
  status: string;
  isSubmitted: boolean;
  submittedOn?: string | null;
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
  isPresent?: boolean | null;
  attendanceMarkedOn?: string | null;
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
  hasLogo: boolean;
  logoFileName?: string | null;
  /** Relative to the API base, already carrying a cache-busting version. */
  logoUrl?: string | null;
  logoVersion: number;
  updatedOn: string;
}
