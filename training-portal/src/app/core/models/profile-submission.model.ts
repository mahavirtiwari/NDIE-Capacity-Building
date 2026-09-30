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
export interface ProfileSubmission extends AuditInfo {
  id: Id;
  applicantId: Id;
  applicantCode?: string | null;
  applicantName?: string | null;
  subCategoryId: Id;
  subCategoryName?: string | null;
  profileFormId?: Id | null;
  /** Which try this is, counting from one. */
  attemptNo: number;
  status: ProfileSubmissionStatus;
  submittedOn?: string | null;
  decidedOn?: string | null;
  decidedByUserName?: string | null;
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
export const PROFILE_STATUSES: ProfileSubmissionStatus[] = [
  'Submitted',
  'UnderScrutiny',
  'Approved',
  'Rejected',
];

export const PROFILE_STATUS_LABELS: Record<ProfileSubmissionStatus, string> = {
  Draft: 'Draft',
  Submitted: 'Waiting',
  UnderScrutiny: 'Being read',
  Approved: 'Accepted',
  Rejected: 'Turned down',
};

export interface ProfileDecision {
  /** Required on a rejection, ignored on an approval. */
  rejectionReasonId?: Id | null;
  remarks?: string | null;
}
