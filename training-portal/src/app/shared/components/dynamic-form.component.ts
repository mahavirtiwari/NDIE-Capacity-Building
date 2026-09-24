import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { FieldType, RegistrationField, RegistrationForm } from '../../core/models';
import { FORMAT_MESSAGES, FORMAT_PATTERNS } from '../../core/validation/formats';
import { IconComponent } from './icon.component';

type FieldValue = string | string[] | number | boolean | null;

/** Field types whose format is fixed by law; reused from the shared registry. */
const PATTERNS: Partial<Record<FieldType, RegExp>> = {
  email: new RegExp(FORMAT_PATTERNS.email),
  mobile: new RegExp(FORMAT_PATTERNS.mobile),
  pan: new RegExp(FORMAT_PATTERNS.pan),
  tan: new RegExp(FORMAT_PATTERNS.tan),
  gstin: new RegExp(FORMAT_PATTERNS.gstin),
  ifsc: new RegExp(FORMAT_PATTERNS.ifsc),
  pincode: new RegExp(FORMAT_PATTERNS.pincode),
  aadhaar: new RegExp(FORMAT_PATTERNS.aadhaar),
};

const FORMAT_HINTS: Partial<Record<FieldType, string>> = {
  email: FORMAT_MESSAGES.email,
  mobile: FORMAT_MESSAGES.mobile,
  pan: FORMAT_MESSAGES.pan,
  tan: FORMAT_MESSAGES.tan,
  gstin: FORMAT_MESSAGES.gstin,
  ifsc: FORMAT_MESSAGES.ifsc,
  pincode: FORMAT_MESSAGES.pincode,
  aadhaar: FORMAT_MESSAGES.aadhaar,
};

const UPPERCASE_TYPES: FieldType[] = ['pan', 'tan', 'gstin', 'ifsc'];

/**
 * Renders a Super Admin defined registration form. Used for the form-builder
 * preview, and in read-only mode to display an applicant's submitted answers
 * on the scrutiny screen.
 */
@Component({
  selector: 'app-dynamic-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent],
  template: `
    <form [formGroup]="form()" (ngSubmit)="submitted.emit(form().getRawValue())" class="stack stack-lg">
      @for (section of enabledSections(); track section.id) {
        <section class="card">
          <div class="card__header">
            <div class="stack stack-xs">
              <span class="card__title">{{ section.title }}</span>
              @if (section.description) {
                <span class="card__subtitle">{{ section.description }}</span>
              }
            </div>
            <span class="chip">{{ enabledFields(section).length }} fields</span>
          </div>
          <div class="card__body">
            <div class="form-grid">
              @for (field of enabledFields(section); track field.key) {
                @if (isVisible(field)) {
                  <div class="field" [class.field--span-2]="field.colSpan === 2">
                    <label class="field-label" [for]="field.key">
                      {{ field.label }}
                      @if (field.validation.required) { <span class="req">*</span> }
                    </label>

                    @switch (field.type) {
                      @case ('textarea') {
                        <textarea
                          class="textarea"
                          [id]="field.key"
                          [formControlName]="field.key"
                          [placeholder]="field.placeholder || ''"
                          [class.is-invalid]="invalid(field.key)"
                        ></textarea>
                      }
                      @case ('select') {
                        <select class="select" [id]="field.key" [formControlName]="field.key" [class.is-invalid]="invalid(field.key)">
                          <option value="">Select</option>
                          @for (opt of field.options; track opt.value) {
                            <option [value]="opt.value">{{ opt.label }}</option>
                          }
                        </select>
                      }
                      @case ('multiselect') {
                        <div class="check-grid">
                          @for (opt of field.options; track opt.value) {
                            <label class="check">
                              <input
                                type="checkbox"
                                [checked]="isChecked(field.key, opt.value)"
                                [disabled]="readonly()"
                                (change)="toggleMulti(field.key, opt.value, $event)"
                              />
                              <span>{{ opt.label }}</span>
                            </label>
                          }
                        </div>
                      }
                      @case ('radio') {
                        <div class="check-grid">
                          @for (opt of field.options; track opt.value) {
                            <label class="check">
                              <input type="radio" [value]="opt.value" [formControlName]="field.key" />
                              <span>{{ opt.label }}</span>
                            </label>
                          }
                        </div>
                      }
                      @case ('checkbox') {
                        <label class="check">
                          <input type="checkbox" [formControlName]="field.key" />
                          <span class="text-sm">{{ field.helpText || 'Yes' }}</span>
                        </label>
                      }
                      @case ('file') {
                        <div class="file-box">
                          <app-icon name="upload" [size]="16" />
                          <span class="text-sm">
                            {{ readonly() ? (value(field.key) || 'Not uploaded') : 'Choose a file' }}
                          </span>
                          @if (!readonly()) {
                            <input type="file" [id]="field.key" (change)="onFile(field.key, $event)" />
                          }
                        </div>
                      }
                      @case ('date') {
                        <input type="date" class="input" [id]="field.key" [formControlName]="field.key" [class.is-invalid]="invalid(field.key)" />
                      }
                      @case ('number') {
                        <input type="number" class="input" [id]="field.key" [formControlName]="field.key" [placeholder]="field.placeholder || ''" [class.is-invalid]="invalid(field.key)" />
                      }
                      @default {
                        <input
                          type="text"
                          class="input"
                          [id]="field.key"
                          [formControlName]="field.key"
                          [placeholder]="field.placeholder || ''"
                          [class.is-invalid]="invalid(field.key)"
                          [attr.maxlength]="maxLengthFor(field)"
                          [style.text-transform]="isUppercase(field) ? 'uppercase' : null"
                        />
                      }
                    }

                    @if (hintFor(field)) {
                      <span class="field-hint">{{ hintFor(field) }}</span>
                    }
                    @if (invalid(field.key)) {
                      <span class="field-error">{{ errorFor(field) }}</span>
                    }
                  </div>
                }
              }
            </div>
          </div>
        </section>
      }

      @if (!readonly()) {
        <div class="btn-row btn-row--end">
          <button type="submit" class="btn btn--primary">
            <app-icon name="send" [size]="15" /> Submit application
          </button>
        </div>
      }
    </form>
  `,
  styles: [
    `
      .file-box {
        position: relative;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.55rem 0.7rem;
        border: 1px dashed var(--border-strong);
        border-radius: var(--radius);
        color: var(--ink-500);
        background: var(--surface-muted);
      }
      .file-box input[type='file'] {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }
    `,
  ],
})
export class DynamicFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly definition = input.required<RegistrationForm>();
  readonly values = input<Record<string, FieldValue>>({});
  readonly readonly = input(false);
  readonly submitted = output<Record<string, FieldValue>>();

  private readonly formSignal = signal<FormGroup>(this.fb.group({}));
  readonly form = computed(() => this.formSignal());

  constructor() {
    effect(() => {
      const definition = this.definition();
      const values = this.values();
      const group: Record<string, FormControl> = {};
      for (const section of definition.sections) {
        if (section.isEnabled === false) continue;
        for (const field of section.fields) {
          if (field.isEnabled === false) continue;
          const initial = values[field.key] ?? defaultFor(field);
          group[field.key] = new FormControl<FieldValue>(
            { value: initial, disabled: this.readonly() },
            { validators: validatorsFor(field) },
          );
        }
      }
      this.formSignal.set(this.fb.group(group));
    });
  }

  /** Disabled sections and fields never render and never validate. */
  protected readonly enabledSections = computed(() =>
    this.definition().sections.filter((s) => s.isEnabled !== false),
  );

  protected enabledFields(section: { fields: RegistrationField[] }): RegistrationField[] {
    return section.fields.filter((f) => f.isEnabled !== false);
  }

  protected isVisible(field: RegistrationField): boolean {
    if (!field.visibleWhenFieldKey) return true;
    const raw = this.form().get(field.visibleWhenFieldKey)?.value;
    const current = typeof raw === 'boolean' ? String(raw) : String(raw ?? '');
    return (field.visibleWhenValues ?? []).includes(current);
  }

  protected control(key: string): AbstractControl | null {
    return this.form().get(key);
  }

  protected value(key: string): string {
    const raw = this.control(key)?.value;
    if (raw === null || raw === undefined || raw === '') return '';
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
    return String(raw);
  }

  protected invalid(key: string): boolean {
    const control = this.control(key);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  protected isUppercase(field: RegistrationField): boolean {
    return UPPERCASE_TYPES.includes(field.type);
  }

  protected maxLengthFor(field: RegistrationField): number | null {
    if (field.type === 'pan' || field.type === 'tan') return 10;
    if (field.type === 'gstin') return 15;
    if (field.type === 'ifsc') return 11;
    if (field.type === 'aadhaar') return 12;
    if (field.type === 'pincode') return 6;
    return field.validation.maxLength ?? null;
  }

  protected hintFor(field: RegistrationField): string {
    if (field.type === 'checkbox') return '';
    return field.helpText || FORMAT_HINTS[field.type] || '';
  }

  protected errorFor(field: RegistrationField): string {
    const errors = this.control(field.key)?.errors ?? {};
    if (errors['required']) return `${field.label} is required.`;
    if (errors['pattern']) {
      return FORMAT_HINTS[field.type] ?? `Enter a valid ${field.label.toLowerCase()}.`;
    }
    if (errors['minlength']) return `Minimum ${field.validation.minLength} characters.`;
    if (errors['maxlength']) return `Maximum ${field.validation.maxLength} characters.`;
    if (errors['min']) return `Minimum value is ${field.validation.min}.`;
    if (errors['max']) return `Maximum value is ${field.validation.max}.`;
    return 'Invalid value.';
  }

  protected isChecked(key: string, option: string): boolean {
    const raw = this.control(key)?.value;
    return Array.isArray(raw) && raw.includes(option);
  }

  protected toggleMulti(key: string, option: string, event: Event): void {
    const control = this.control(key);
    if (!control) return;
    const checked = (event.target as HTMLInputElement).checked;
    const current = Array.isArray(control.value) ? [...(control.value as string[])] : [];
    const next = checked ? [...current, option] : current.filter((v) => v !== option);
    control.setValue(next);
    control.markAsDirty();
  }

  protected onFile(key: string, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.control(key)?.setValue(file ? file.name : null);
    this.control(key)?.markAsDirty();
  }
}

function defaultFor(field: RegistrationField): FieldValue {
  if (field.type === 'multiselect') return [];
  if (field.type === 'checkbox') return false;
  return '';
}

function validatorsFor(field: RegistrationField): ValidatorFn[] {
  const rules: ValidatorFn[] = [];
  const v = field.validation;
  if (v.required) {
    rules.push(field.type === 'checkbox' ? Validators.requiredTrue : Validators.required);
  }
  if (v.minLength) rules.push(Validators.minLength(v.minLength));
  if (v.maxLength) rules.push(Validators.maxLength(v.maxLength));
  if (v.min !== null && v.min !== undefined) rules.push(Validators.min(v.min));
  if (v.max !== null && v.max !== undefined) rules.push(Validators.max(v.max));
  const pattern = v.pattern ? new RegExp(v.pattern) : PATTERNS[field.type];
  if (pattern) rules.push(Validators.pattern(pattern));
  return rules;
}
