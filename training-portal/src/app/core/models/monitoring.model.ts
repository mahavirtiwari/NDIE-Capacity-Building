import { Id } from './common.model';

/**
 * What a coordinator recorded on the ground, as the portal reads it.
 *
 * The same payload the coordinator's own app works from. It is kept apart
 * from {@link Program} on purpose: the programme register is the office's
 * record of a batch — who it is for, when it runs, who is enrolled — and
 * this is the field record of what actually happened in the room. They are
 * written by different people at different times and they can disagree,
 * which is most of the reason anybody opens this.
 */
export interface ProgrammeMonitoring {
  id: Id;
  programmeId: string;
  programmeName: string;
  programTypeName?: string | null;
  venue?: string | null;
  city?: string | null;
  state?: string | null;
  startDate: string;
  endDate: string;
  status: string;
  isSubmitted: boolean;
  submittedOn?: string | null;

  progress?: MonitoringProgress;
  /** The venue as the coordinator geo-tagged it, with its photographs. */
  venue2?: MonitoringVenue | null;
  trainers: MonitoringTrainer[];
  sessions: MonitoringSession[];
  participants: OnSpotParticipant[];
  /** The signed sheets, photographed. */
  attendanceSheets: MonitoringPhoto[];
}

export interface MonitoringProgress {
  venueDone?: boolean;
  trainersDone?: boolean;
  sessionsDone?: boolean;
  participantsDone?: boolean;
  attendanceDone?: boolean;
}

export interface MonitoringVenue {
  id: Id;
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

export interface MonitoringTrainer {
  id: Id;
  fullName: string;
  mobile: string;
  email?: string | null;
  designation?: string | null;
  organisation?: string | null;
  engagement?: 'FullTime' | 'PartTime' | null;
  yearsExperience?: number | null;
  qualification?: string | null;
  /** The last four digits. The whole number is never sent to a screen. */
  aadhaarLast4?: string | null;
}

export interface MonitoringSession {
  id: Id;
  trainerId: Id;
  trainerName?: string | null;
  curriculumSessionId: Id;
  topicName?: string | null;
  curriculumTopicId: Id;
  subTopicName?: string | null;
  conductedOn: string;
  comments?: string | null;
  photo?: MonitoringPhoto | null;
}

export interface OnSpotParticipant {
  id: Id;
  fullName: string;
  mobile: string;
  email: string;
  enterpriseName: string;
  designation?: string | null;
  /** The Udyam registration number, or "NA". */
  udyamNumber: string;
  gender?: string | null;
  socialCategory?: string | null;
  stateCode?: number | null;
  districtCode?: number | null;

  /** Present on any day — the roll-up, not the register. */
  isPresent?: boolean | null;
  attendanceMarkedOn?: string | null;
  days: OnSpotAttendanceDay[];
  feedbackRating?: number | null;
  feedbackComments?: string | null;
  photo?: MonitoringPhoto | null;
}

export interface OnSpotAttendanceDay {
  day: string;
  isPresent: boolean;
  markedOn: string;
}

export interface MonitoringPhoto {
  id: Id;
  kind: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  latitude?: number | null;
  longitude?: number | null;
  capturedOn: string;
  /** When it reached the server, and off what handset. */
  syncedOn?: string | null;
  devicePlatform?: string | null;
  deviceModel?: string | null;
  /** Whether the time and place were burnt into the image. */
  stamped: boolean;
  url: string;
}

/** A photograph with the object URL its bytes were loaded into. */
export interface LoadedMonitoringPhoto extends MonitoringPhoto {
  objectUrl: string;
}
