import { EvaluationScheme } from './masters.model';
import { Id } from './common.model';

/**
 * The trainer's marksheet for one programme.
 *
 * The same shape the coordinator's app reads, so the sheet a coordinator fills
 * in on a phone and the one an operation manager corrects in the portal are the
 * same sheet, not two views that have to be kept in step.
 */
export interface Marksheet {
  programmeId: Id;
  programmeCode: string;
  programmeName: string;
  programTypeName: string;
  /** What is examined, out of how many marks, and what passes. */
  evaluation: EvaluationScheme;
  skills: MarksheetSkill[];
  trainers: MarksheetTrainer[];
  rows: MarksheetRow[];
  /** Whether this account may mark. False still shows the sheet. */
  canEdit: boolean;
  readOnlyReason?: string | null;
  markedCount: number;
  passCount: number;
  failCount: number;
}

export interface MarksheetSkill {
  id: Id;
  name: string;
  description?: string | null;
  maxMarks: number;
  displayOrder: number;
  /** Retired, but still carrying marks on this sheet. Nothing new goes here. */
  isRetired: boolean;
}

export interface MarksheetTrainer {
  id: Id;
  fullName: string;
  organisation?: string | null;
}

export interface MarksheetRow {
  participantId: Id;
  name: string;
  applicationNo: string;
  attendancePercent: number;
  writtenMarks?: number | null;
  vivaMarks?: number | null;
  total?: number | null;
  result: 'Pending' | 'Pass' | 'Fail';
  resultRecordedOn?: string | null;
  /** What is still unmarked, when the result is pending. */
  pending?: string | null;
  /** Which bar was missed, when the candidate did not qualify. */
  shortfall?: string | null;
  /** True once a certificate has been issued: the line is then read only. */
  isLocked: boolean;
  /** True when the written mark came from the paper the candidate sat online. */
  writtenFromExam: boolean;
  /** The percentage on their best sitting, when there was one. */
  examPercentage?: number | null;
  examAttempts: number;
  skillMarks: MarksheetSkillMark[];
}

export interface MarksheetSkillMark {
  skillId: Id;
  marks: number;
  trainerId?: Id | null;
  trainerName?: string | null;
  markedOn: string;
}

/* ------------------------------------------------------------------ saving */

export interface MarksheetSave {
  rows: MarksheetRowSave[];
}

export interface MarksheetRowSave {
  participantId: Id;
  /** Left out entirely to leave the recorded written mark alone. */
  writtenMarks?: number | null;
  skillMarks: MarksheetSkillMarkSave[];
  /** Who marked this candidate, when it is known. */
  trainerId?: Id | null;
}

export interface MarksheetSkillMarkSave {
  skillId: Id;
  marks: number;
  /** Removes the mark instead of setting it. */
  clear?: boolean;
}
