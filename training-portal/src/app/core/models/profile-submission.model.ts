import { AuditInfo, Id } from './common.model';
import { ScrutinyEvent } from './application.model';

/**
 * An applicant's answers to their sub-category's profile form, and where
 * scrutiny got to with them.
 *
 * This is read before anything else about somebody, because nothing else
 * exists yet — an applicant has no applications until their profile has
 * been accepted.
 */
/**
 * The headline figures over the scrutiny queue.
 *
 * Counted under the same filters as the list but without its status, so the
 * tiles always add up to what was received.
 */
export interface ProfileScrutinyCounts {
  received: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface ProfileSubmission extends AuditInfo {
  id: Id;
  applicantId: Id;
  applicantCode?: string | null;
  applicantName?: string | null;
  /**
   * The category this profile was submitted under. An applicant holds one
   * profile per category, so the queue can carry several rows for the same
   * person and the officer has to see which discipline each one is.
   */
  categoryId: Id;
  categoryName?: string | null;
  subCategoryId: Id;
  subCategoryName?: string | null;
  profileFormId?: Id | null;
  /** Which try this is, counting from one. */
  attemptNo: number;
  status: ProfileSubmissionStatus;
  submittedOn?: string | null;
  decidedOn?: string | null;
  decidedByUserName?: string | null;
  /** The Operation Manager whose desk this is on, if anybody's. */
  assignedToUserId?: Id | null;
  assignedToName?: string | null;
  rejectionReasonId?: Id | null;
  rejectionReasonLabel?: string | null;
  remarks?: string | null;
  /** Answers keyed by the form's own field keys. */
  responses: Record<string, unknown>;
  history: ScrutinyEvent[];
}

export type ProfileSubmissionStatus =
  | 'Draft'
  | 'Submitted'
  | 'UnderScrutiny'
  | 'Approved'
  | 'Rejected';

/** The ones worth filtering by: a draft never reaches the queue. */
/**
 * The three a profile can be filtered by.
 *
 * Draft has not been handed in, so it is in nobody's queue. UnderScrutiny is
 * read in places but never written — nothing moves a profile into it — so
 * offering it was a filter that could only ever come back empty.
 */
export const PROFILE_STATUSES: ProfileSubmissionStatus[] = [
  'Submitted',
  'Approved',
  'Rejected',
];

/**
 * Plain names, matching the badge on the row.
 *
 * These read "Waiting", "Accepted" and "Turned down" while the badge beside
 * them said Submitted, Approved and Rejected — the same state under two
 * vocabularies on one screen, which reads as two different things.
 */
export const PROFILE_STATUS_LABELS: Record<ProfileSubmissionStatus, string> = {
  Draft: 'Draft',
  Submitted: 'Submitted',
  UnderScrutiny: 'Under scrutiny',
  Approved: 'Approved',
  Rejected: 'Rejected',
};

export interface ProfileDecision {
  /** Required on a rejection, ignored on an approval. */
  rejectionReasonId?: Id | null;
  remarks?: string | null;
}
