import { AuditInfo, Id, RecordStatus } from './common.model';

/** A topic sits under a session; codes follow <sessionCode>/T01. */
export interface CurriculumTopic {
  id: Id;
  topicCode: string;
  topicName: string;
  displayOrder: number;
  durationMinutes?: number | null;
  learningOutcome?: string;
  /** A disabled topic stays on the plan but is not delivered. */
  status?: RecordStatus;
}

/** A session is a slot in the day plan; codes follow <programmeCode>/S01. */
export interface CurriculumSession {
  id: Id;
  sessionCode: string;
  sessionName: string;
  displayOrder: number;
  day?: number | null;
  /** When on that day it runs, as HH:mm. Null until the hours are settled. */
  startTime?: string | null;
  endTime?: string | null;
  /** A disabled session stays on the plan but is not delivered. */
  status?: RecordStatus;
  topics: CurriculumTopic[];
}

/**
 * One curriculum belongs to one programme type and holds a day-wise list of
 * sessions and their topics. The code, name and category are read from that
 * programme type rather than stored again here, so they cannot disagree.
 */
export interface Curriculum extends AuditInfo {
  id: Id;
  programTypeId: Id;
  /** From the programme type; session codes are built from it. */
  programTypeCode?: string;
  programTypeName?: string;
  /** Derived from the programme type; returned by the API for display. */
  categoryId?: Id | null;
  categoryName?: string;
  subCategoryId?: Id | null;
  subCategoryName?: string;
  objective?: string;
  durationDays: number;
  effectiveFrom: string;
  /** `Inactive` is shown as "Blocked" on the curriculum register. */
  status: RecordStatus;
  sessions: CurriculumSession[];
}

export function curriculumSessionCount(c: Curriculum): number {
  return c.sessions.length;
}

export function curriculumTopicCount(c: Curriculum): number {
  return c.sessions.reduce((n, s) => n + s.topics.length, 0);
}

export function curriculumTotalMinutes(c: Curriculum): number {
  return c.sessions.reduce(
    (sum, s) => sum + s.topics.reduce((t, x) => t + (x.durationMinutes ?? 0), 0),
    0,
  );
}

/** Next session code for a programme, e.g. ZED/TP18 -> ZED/TP18/S07. */
export function nextSessionCode(programmeCode: string, existing: number): string {
  return `${programmeCode}/S${String(existing + 1).padStart(2, '0')}`;
}

/** Next topic code for a session, e.g. ZED/TP18/S07 -> ZED/TP18/S07/T02. */
export function nextTopicCode(sessionCode: string, existing: number): string {
  return `${sessionCode}/T${String(existing + 1).padStart(2, '0')}`;
}
