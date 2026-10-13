import { AuditInfo, Id, RecordStatus } from './common.model';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'mobile'
  | 'pan'
  | 'tan'
  | 'gstin'
  | 'ifsc'
  | 'pincode'
  | 'aadhaar'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'duration'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'photos';

export const FIELD_TYPES: { value: FieldType; label: string; hasOptions: boolean }[] = [
  { value: 'text', label: 'Single line text', hasOptions: false },
  { value: 'textarea', label: 'Paragraph', hasOptions: false },
  { value: 'number', label: 'Number', hasOptions: false },
  { value: 'email', label: 'Email', hasOptions: false },
  { value: 'mobile', label: 'Mobile number', hasOptions: false },
  { value: 'pan', label: 'PAN', hasOptions: false },
  { value: 'tan', label: 'TAN', hasOptions: false },
  { value: 'gstin', label: 'GSTIN', hasOptions: false },
  { value: 'ifsc', label: 'IFSC code', hasOptions: false },
  { value: 'pincode', label: 'Pincode', hasOptions: false },
  { value: 'aadhaar', label: 'Aadhaar', hasOptions: false },
  { value: 'date', label: 'Date', hasOptions: false },
  { value: 'select', label: 'Dropdown (one answer)', hasOptions: true },
  /* Named for what it is rather than for the word a developer would use:
     beside "Dropdown (one answer)" nobody has to guess whether "Multi
     select" is a dropdown or a list of tick boxes. It is a dropdown. */
  { value: 'multiselect', label: 'Dropdown (choose several)', hasOptions: true },
  { value: 'radio', label: 'Radio group', hasOptions: true },
  { value: 'checkbox', label: 'Checkbox', hasOptions: false },
  { value: 'file', label: 'File upload', hasOptions: false },
  { value: 'photos', label: 'Pictures from the camera', hasOptions: false },
  /* Two dates and the length between them, asked as one question because
     it is one fact. */
  { value: 'duration', label: 'Duration (from and to dates)', hasOptions: false },
];

/**
 * A span of time, as it is stored against an answer.
 *
 * The dates are what the applicant gave; the months are what they add up
 * to, and are carried rather than recomputed by every reader - a report
 * that groups by length should not have to know how the length is worked
 * out. Anything reading it back checks the arithmetic against the dates,
 * because the dates are the answer and the number is a convenience.
 */
export interface DurationValue {
  from: string;
  to: string;
  months: number;
}

/** Whole months between two ISO dates, counting a part month as served. */
export function monthsBetween(from: string, to: string): number {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end = new Date(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  /* The day of the month decides the last one: 1 Jan to 31 Jan is a month
     served, 1 Jan to 15 Feb is one month and a part. */
  if (end.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

/** "2 years 3 months", or "3 months", or "Less than a month". */
export function durationWords(months: number): string {
  if (months <= 0) return 'Less than a month';
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (rest > 0) parts.push(`${rest} month${rest === 1 ? '' : 's'}`);
  return parts.join(' ');
}

export function fieldTypeHasOptions(type: FieldType): boolean {
  return FIELD_TYPES.find((f) => f.value === type)?.hasOptions ?? false;
}

export interface FieldOption {
  value: string;
  label: string;
  /**
   * What the choice means, where the wording alone does not say it.
   * Carried from the shared choice list the field points at.
   */
  description?: string | null;
}

export interface FieldValidation {
  required: boolean;
  minLength?: number | null;
  maxLength?: number | null;
  min?: number | null;
  max?: number | null;
  /** The window a date field has to fall in, as yyyy-MM-dd. */
  minDate?: string | null;
  maxDate?: string | null;
  pattern?: string | null;
  allowedExtensions?: string[];
  maxFileSizeMb?: number | null;
  /** How many pictures a camera field accepts. */
  maxPhotos?: number | null;
}

export interface ProfileField {
  id: Id;
  key: string;
  label: string;
  type: FieldType;
  /** Disabled fields stay on the definition but are not rendered or validated. */
  isEnabled: boolean;
  placeholder?: string;
  helpText?: string;
  displayOrder: number;
  colSpan: 1 | 2;
  /**
   * What this answer means beyond being a question.
   *
   * Pointed at a qualification or a number of years, it becomes what a
   * program type's minimum is measured against. Pointed at an
   * organisation or a Udyam number, it becomes a column on the
   * participants register of every programme in the discipline.
   */
  role?: ProfileFieldRole;
  /**
   * A shared choice list this field reads instead of holding its own
   * options. When set, `options` is what that list currently offers —
   * resolved by the server, so anything rendering the form needs to know
   * nothing about where the choices came from.
   */
  optionSetId?: Id | null;
  optionSetName?: string | null;

  options: FieldOption[];
  validation: FieldValidation;
  /** Show this field only when another field holds one of these values. */
  visibleWhenFieldKey?: string | null;
  visibleWhenValues?: string[];
}

/**
 * Nothing is inferred from a field's name: the designer says which answer
 * holds each meaning. A field nobody points at is never read this way.
 *
 * Every discipline asks these things differently — one form's "Enterprise
 * name" is another's "Organisation", and the Udyam number is still a UAM
 * or an EM-2 to an enterprise that registered before 2020. Reading them
 * off the key would mean one spelling winning and the rest going blank.
 */
export type ProfileFieldRole =
  | 'None'
  | 'Qualification'
  | 'ExperienceYears'
  | 'Organisation'
  | 'UdyamNumber';

export const PROFILE_FIELD_ROLES: { value: ProfileFieldRole; label: string }[] = [
  { value: 'None', label: 'Just a question' },
  { value: 'Qualification', label: "The applicant's highest qualification" },
  { value: 'ExperienceYears', label: "The applicant's years of experience" },
  { value: 'Organisation', label: "The applicant's organisation" },
  { value: 'UdyamNumber', label: "The applicant's Udyam / UAM number" },
];

export interface ProfileSection {
  id: Id;
  /**
   * Set by the server from the title. It is what a repeating section's answers
   * are stored under, so once a section repeats the key stops changing.
   */
  key?: string;
  title: string;
  description?: string;
  displayOrder: number;
  isEnabled: boolean;
  /** The applicant can fill this section more than once. */
  isRepeatable?: boolean;
  minEntries?: number;
  maxEntries?: number;
  /** What one entry is called: "Qualification 2", "Add qualification". */
  itemLabel?: string;
  fields: ProfileField[];
}

/** The complete applicant profile form for one program type. */
export interface ProfileForm extends AuditInfo {
  id: Id;
  /** The discipline whose applicants fill this form. */
  subCategoryId: Id;
  subCategoryName?: string;
  categoryId?: Id;
  categoryName?: string;
  version: string;
  /** False and a submission is accepted as it arrives, with no queue. */
  requiresScrutiny?: boolean;
  status: RecordStatus;
  sections: ProfileSection[];
}

export function profileFieldCount(form: ProfileForm): number {
  return form.sections.reduce((n, s) => n + s.fields.length, 0);
}

export function activeFieldCount(form: ProfileForm): number {
  return form.sections
    .filter((s) => s.isEnabled)
    .reduce((n, s) => n + s.fields.filter((f) => f.isEnabled).length, 0);
}

/**
 * Deep copy of a form definition for a different sub-category. Ids are reset so
 * the backend treats every section and field as new.
 */
export function cloneProfileForm(
  source: ProfileForm,
  subCategoryId: Id,
  version: string,
): Omit<ProfileForm, 'id'> {
  return {
    subCategoryId,
    version,
    status: 'Active',
    sections: source.sections.map((section, si) => ({
      ...section,
      id: si + 1,
      fields: section.fields.map((field, fi) => ({
        ...field,
        id: si * 100 + fi + 1,
        options: field.options.map((o) => ({ ...o })),
        validation: { ...field.validation },
      })),
    })),
  };
}
