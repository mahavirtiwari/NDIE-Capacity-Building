import { Id, RecordStatus } from './common.model';
import { FieldType } from './profile-field.model';

/**
 * One field on the form somebody fills in to create an applicant account.
 *
 * Not the same thing as a `ProfileField`. That belongs to a programme
 * type's application form; this is the single form that exists before anyone
 * has an account at all.
 */
export interface SignupField {
  id: Id;
  /** Which form it belongs to. Null is the default set. */
  subCategoryId?: Id | null;
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

/**
 * One sub-category's sign-up form, and whether it is its own or the default it
 * falls back to. The screen has to say which, or an administrator edits what
 * they think is one sub-category's form and changes everybody's.
 */
export interface SignupForm {
  subCategoryId?: Id | null;
  subCategoryName?: string | null;
  isOwnForm: boolean;
  fields: SignupField[];
}
