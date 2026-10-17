import { Id, RecordStatus } from './common.model';
import { FieldType } from './profile-field.model';

/**
 * One field on the form a coordinator fills in to register a trainer.
 *
 * The faculty form used to be markup inside the coordinator app, so the
 * questions it asked were whatever that build had been shipped with. They
 * belong to the scheme rather than to a build, so they are set up in the
 * portal and the app renders what it is given.
 *
 * One form, not one per programme type: a trainer is registered once and
 * reused across every batch their agency runs.
 */
export interface TrainerField {
  id: Id;
  /** What the answer is stored against. Fixed once the field exists. */
  key: string;
  label: string;
  placeholder?: string | null;
  helpText?: string | null;
  type: FieldType;
  required: boolean;
  displayOrder: number;

  /** Backed by a column on the trainer record: editable, never removable. */
  isBuiltIn: boolean;

  /**
   * Cannot be switched off. A trainer with no name is not a record anybody
   * can read, and the mobile number is what the same person is recognised
   * by across an agency's batches.
   */
  isLocked: boolean;

  status: RecordStatus;
  options: TrainerFieldOption[];
}

export interface TrainerFieldOption {
  value: string;
  label: string;
}

export interface TrainerFieldUpsert {
  key: string;
  label: string;
  placeholder?: string | null;
  helpText?: string | null;
  type: FieldType;
  required: boolean;
  displayOrder: number;
  status: RecordStatus;
  options: TrainerFieldOption[];
}

/** The trainer form: what a coordinator is asked, in order. */
export interface TrainerForm {
  fields: TrainerField[];
}
