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
  | 'radio'
  | 'checkbox'
  | 'file';

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
  { value: 'select', label: 'Dropdown', hasOptions: true },
  { value: 'multiselect', label: 'Multi select', hasOptions: true },
  { value: 'radio', label: 'Radio group', hasOptions: true },
  { value: 'checkbox', label: 'Checkbox', hasOptions: false },
  { value: 'file', label: 'File upload', hasOptions: false },
];

export function fieldTypeHasOptions(type: FieldType): boolean {
  return FIELD_TYPES.find((f) => f.value === type)?.hasOptions ?? false;
}

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldValidation {
  required: boolean;
  minLength?: number | null;
  maxLength?: number | null;
  min?: number | null;
  max?: number | null;
  pattern?: string | null;
  allowedExtensions?: string[];
  maxFileSizeMb?: number | null;
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
  options: FieldOption[];
  validation: FieldValidation;
  /** Show this field only when another field holds one of these values. */
  visibleWhenFieldKey?: string | null;
  visibleWhenValues?: string[];
}

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
  programTypeId: Id;
  programTypeName?: string;
  categoryName?: string;
  subCategoryName?: string;
  version: string;
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
 * Deep copy of a form definition for a different program type. Ids are reset so
 * the backend treats every section and field as new.
 */
export function cloneProfileForm(
  source: ProfileForm,
  programTypeId: Id,
  version: string,
): Omit<ProfileForm, 'id'> {
  return {
    programTypeId,
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
