import { Directive, ElementRef, HostListener, inject } from '@angular/core';
import {
  AbstractControl,
  FormGroup,
  NgControl,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';

/**
 * Single source of truth for every Indian document / contact format used in the
 * portal. Patterns are exported as strings so the same rule can be pushed into
 * a dynamic registration field, and as validators for reactive forms.
 */
export const FORMAT_PATTERNS = {
  /** RFC-ish email, deliberately pragmatic rather than exhaustive. */
  email: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)+$',
  /** Indian mobile: 10 digits starting 6-9. */
  mobile: '^[6-9][0-9]{9}$',
  /** Landline with STD code, 10-11 digits. */
  landline: '^[0-9]{2,4}-?[0-9]{6,8}$',
  /** PAN: AAAAA9999A. */
  pan: '^[A-Z]{5}[0-9]{4}[A-Z]$',
  /** TAN: AAAA99999A. */
  tan: '^[A-Z]{4}[0-9]{5}[A-Z]$',
  /** GSTIN: 2 digit state code + PAN + entity code + Z + checksum. */
  gstin: '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$',
  /** Aadhaar: 12 digits, never starting with 0 or 1. */
  aadhaar: '^[2-9][0-9]{11}$',
  /** Pincode: 6 digits, first digit 1-9. */
  pincode: '^[1-9][0-9]{5}$',
  /** IFSC: 4 letters + 0 + 6 alphanumerics. */
  ifsc: '^[A-Z]{4}0[A-Z0-9]{6}$',
  /** Udyam registration number. */
  udyam: '^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$',
  /** Bank account: 9-18 digits. */
  bankAccount: '^[0-9]{9,18}$',
  /** Master / programme codes: upper-case letters, digits, dash, slash. */
  code: '^[A-Z0-9][A-Z0-9/-]{1,19}$',
} as const;

export type FormatName = keyof typeof FORMAT_PATTERNS;

export const FORMAT_MESSAGES: Record<FormatName, string> = {
  email: 'Enter a valid email address.',
  mobile: 'Enter a 10 digit mobile number starting with 6-9.',
  landline: 'Enter a valid landline number with STD code.',
  pan: 'PAN must be 10 characters, e.g. ABCDE1234F.',
  tan: 'TAN must be 10 characters, e.g. DELA12345B.',
  gstin: 'GSTIN must be 15 characters, e.g. 27AABCU9603R1ZX.',
  aadhaar: 'Aadhaar must be 12 digits and cannot start with 0 or 1.',
  pincode: 'Pincode must be 6 digits and cannot start with 0.',
  ifsc: 'IFSC must be 11 characters, e.g. SBIN0001234.',
  udyam: 'Udyam number looks like UDYAM-XX-00-0000000.',
  bankAccount: 'Account number must be 9 to 18 digits.',
  code: 'Use upper-case letters, digits, dash or slash (2-20 characters).',
};

/** Fields the user types in upper case. */
export const UPPERCASE_FORMATS: FormatName[] = ['pan', 'tan', 'gstin', 'ifsc', 'udyam', 'code'];

/**
 * Validator for a named format. Empty values pass so it composes cleanly with
 * `Validators.required`.
 */
export function formatValidator(name: FormatName): ValidatorFn {
  const expression = new RegExp(FORMAT_PATTERNS[name]);
  return (control: AbstractControl): ValidationErrors | null => {
    const raw = control.value;
    if (raw === null || raw === undefined || String(raw).trim() === '') return null;
    return expression.test(String(raw).trim()) ? null : { format: { name } };
  };
}

/** `[Validators.required, formatValidator(name)]` in one call. */
export function requiredFormat(name: FormatName): ValidatorFn[] {
  return [Validators.required, formatValidator(name)];
}

/** Human readable message for whatever failed on a control. */
export function describeError(errors: ValidationErrors | null, label = 'This field'): string {
  if (!errors) return '';
  if (errors['required']) return `${label} is required.`;
  if (errors['format']) {
    return FORMAT_MESSAGES[(errors['format'] as { name: FormatName }).name];
  }
  if (errors['email']) return FORMAT_MESSAGES.email;
  if (errors['pattern']) return `${label} is not in the expected format.`;
  if (errors['minlength']) {
    return `${label} must be at least ${(errors['minlength'] as { requiredLength: number }).requiredLength} characters.`;
  }
  if (errors['maxlength']) {
    return `${label} must be at most ${(errors['maxlength'] as { requiredLength: number }).requiredLength} characters.`;
  }
  if (errors['min']) return `${label} must be at least ${(errors['min'] as { min: number }).min}.`;
  if (errors['max']) return `${label} must be at most ${(errors['max'] as { max: number }).max}.`;
  return `${label} is invalid.`;
}

/**
 * Forces upper case as the user types, so PAN / GSTIN / TAN / IFSC always reach
 * the validator in the canonical case.
 */
@Directive({
  selector: 'input[appUppercase]',
})
export class UppercaseDirective {
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  @HostListener('input')
  onInput(): void {
    const input = this.element.nativeElement;
    const upper = input.value.toUpperCase();
    if (upper === input.value) return;
    const caret = input.selectionStart;
    input.value = upper;
    this.ngControl?.control?.setValue(upper, { emitEvent: false });
    input.setSelectionRange(caret, caret);
  }
}

/**
 * What to say when a form will not save.
 *
 * Walks the group for the first control the form is unhappy about and
 * describes it, so a refused Save can name the field instead of leaving
 * somebody to hunt for it. The control's own name is turned into words -
 * `subCategoryId` reads as "Sub category" - which is close enough to the
 * label above it to point at the right box.
 *
 * Nested groups and arrays are walked too: a dialog whose rows are a form
 * array is exactly the one where the missing answer is hardest to find.
 */
export function describeFirstError(group: AbstractControl | null): string {
  const found = firstInvalid(group, '');
  if (!found) return 'Check the highlighted fields and try again.';

  const [name, control] = found;
  return describeError(control.errors, name ? wordsOf(name) : 'This field');
}

function firstInvalid(
  control: AbstractControl | null,
  name: string,
): [string, AbstractControl] | null {
  if (!control || control.valid) return null;
  if (control.errors) return [name, control];

  const children: Record<string, AbstractControl> | AbstractControl[] | null =
    (control as FormGroup).controls ?? null;

  if (!children) return null;

  for (const [key, child] of Object.entries(children)) {
    const found = firstInvalid(child as AbstractControl, Number.isNaN(Number(key)) ? key : name);
    if (found) return found;
  }

  return null;
}

/** `subCategoryId` -> `Sub category`. Ids are not shown to anybody. */
function wordsOf(name: string): string {
  const words = name
    .replace(/Id$/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase();

  return words.charAt(0).toUpperCase() + words.slice(1);
}
