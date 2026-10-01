import { AuditInfo, Id, RecordStatus } from './common.model';
import { FieldOption } from './profile-field.model';

/** What a feedback question asks for. */
export type FeedbackQuestionType = 'Rating' | 'Text' | 'Select' | 'Radio' | 'YesNo';

/**
 * What a program type asks its participants once a batch is over.
 *
 * One per program type: the questions worth asking about a five-day
 * assessor course are the same whichever batch somebody sat.
 */
export interface FeedbackForm extends AuditInfo {
  id: Id;
  programTypeId: Id;
  programTypeName?: string | null;
  programTypeCode?: string | null;
  title: string;
  intro?: string | null;
  status: RecordStatus;
  /** How many sets of answers have come back. */
  responseCount: number;
  questions: FeedbackQuestion[];
}

export interface FeedbackQuestion {
  id: Id;
  /** What the answer is stored against. Fixed once answered. */
  key: string;
  text: string;
  helpText?: string | null;
  type: FeedbackQuestionType;
  required: boolean;
  displayOrder: number;
  maxRating: number;
  /** A shared choice list, if the question reads one. */
  optionSetId?: Id | null;
  optionSetName?: string | null;
  /** What to offer, from the question or the list. Filled in by the server. */
  options: FieldOption[];
}

/**
 * What the answers add up to.
 *
 * Counts, averages and the comments on their own. There is nothing here
 * to attribute because a response is not stored against anybody.
 */
export interface FeedbackSummary {
  programTypeId: Id;
  programTypeName?: string | null;
  responseCount: number;
  questions: FeedbackQuestionSummary[];
}

export interface FeedbackQuestionSummary {
  key: string;
  text: string;
  type: FeedbackQuestionType;
  average?: number | null;
  answered: number;
  tally: { value: string; label: string; count: number }[];
  comments: string[];
}
