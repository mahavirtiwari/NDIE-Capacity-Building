import { Id, RecordStatus } from './common.model';
import { FieldType } from './registration-field.model';

/**
 * One field on the form somebody fills in to create an applicant account.
 *
 * Not the same thing as a `RegistrationField`. That belongs to a programme
 * type's application form; this is the single form that exists before anyone
 * has an account at all.
 */
export interface SignupField {
  id: Id;
  /** What the answer is stored against. Fixed once the field exists. */
  key: string;
  label: string;
  placeholder?: string | null;
  helpText?: string | null;
  type: FieldType;
  required: boolean;
  displayOrder: number;

  /** Backed by a column on the applicant record: editable, never removable. */
  isBuiltIn: boolean;

  /**
   * Cannot be switched off. An account with no name has nobody to address and
   * one with no email cannot be sent its credentials.
   */
  isLocked: boolean;

  status: RecordStatus;
  options: SignupFieldOption[];
}

export interface SignupFieldOption {
  value: string;
  label: string;
}

export interface SignupFieldUpsert {
  key: string;
  label: string;
  placeholder?: string | null;
  helpText?: string | null;
  type: FieldType;
  required: boolean;
  displayOrder: number;
  status: RecordStatus;
  options: SignupFieldOption[];
}
