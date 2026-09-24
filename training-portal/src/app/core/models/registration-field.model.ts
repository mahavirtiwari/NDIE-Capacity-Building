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

export interface RegistrationField {
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

export interface RegistrationSection {
  id: Id;
  title: string;
  description?: string;
  displayOrder: number;
  isEnabled: boolean;
  fields: RegistrationField[];
}

/** The complete applicant registration form for one program type. */
export interface RegistrationForm extends AuditInfo {
  id: Id;
  programTypeId: Id;
  programTypeName?: string;
  categoryName?: string;
  subCategoryName?: string;
  version: string;
  status: RecordStatus;
  sections: RegistrationSection[];
}

export function registrationFieldCount(form: RegistrationForm): number {
  return form.sections.reduce((n, s) => n + s.fields.length, 0);
}

export function activeFieldCount(form: RegistrationForm): number {
  return form.sections
    .filter((s) => s.isEnabled)
    .reduce((n, s) => n + s.fields.filter((f) => f.isEnabled).length, 0);
}

/**
 * Deep copy of a form definition for a different program type. Ids are reset so
 * the backend treats every section and field as new.
 */
export function cloneRegistrationForm(
  source: RegistrationForm,
  programTypeId: Id,
  version: string,
): Omit<RegistrationForm, 'id'> {
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
