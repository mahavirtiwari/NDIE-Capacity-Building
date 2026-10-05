import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { FieldType, ProfileField, ProfileForm, ProfileSection } from '../../core/models';
import { FORMAT_MESSAGES, FORMAT_PATTERNS } from '../../core/validation/formats';
import { IconComponent } from './icon.component';

type FieldValue = string | string[] | number | boolean | null;

/** One filling of a repeating section: the same fields, answered again. */
type EntryValues = Record<string, FieldValue>;

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
 * Renders a Super Admin defined profile form. Used for the form-builder
 * preview, and in read-only mode to display an applicant's submitted answers
 * on the scrutiny screen.
 *
 * A section marked as repeating is held as a form array of identical groups —
 * one per entry — under the section's own key, which is how the API stores it
 * too. Every other section contributes its fields straight to the top level,
 * exactly as it always has. Fields are bound by control rather than by name so
 * the same markup can render a top-level field and a field inside an entry.
 */
@Component({
  selector: 'app-dynamic-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, NgTemplateOutlet],
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
            @if (section.isRepeatable) {
              <span class="chip">{{ entriesOf(section).length }} of {{ maxEntries(section) }}</span>
            } @else {
              <span class="chip">{{ enabledFields(section).length }} fields</span>
            }
          </div>

          <div class="card__body">
            @if (!section.isRepeatable) {
              <div class="form-grid">
                @for (field of enabledFields(section); track field.key) {
                  <ng-container
                    *ngTemplateOutlet="fieldTpl; context: { field: field, group: form() }"
                  />
                }
              </div>
            } @else {
              <div class="stack stack-md">
                @for (entry of entriesOf(section); track $index) {
                  <div class="entry">
                    <div class="entry__head">
                      <span class="entry__title">{{ entryNoun(section) }} {{ $index + 1 }}</span>
                      @if (canRemove(section)) {
                        <button
                          type="button"
                          class="btn btn--icon is-danger"
                          [title]="'Remove ' + entryNoun(section).toLowerCase()"
                          (click)="removeEntry(section, $index)"
                        >
                          <app-icon name="trash" [size]="15" />
                        </button>
                      }
                    </div>
                    <div class="form-grid">
                      @for (field of enabledFields(section); track field.key) {
                        <ng-container
                          *ngTemplateOutlet="fieldTpl; context: { field: field, group: entry }"
                        />
                      }
                    </div>
                  </div>
                }

                @if (entriesOf(section).length === 0) {
                  <p class="text-muted text-sm">
                    No {{ entryNoun(section).toLowerCase() }} was added.
                  </p>
                }

                @if (canAdd(section)) {
                  <div>
                    <button type="button" class="btn btn--secondary btn--sm" (click)="addEntry(section)">
                      <app-icon name="plus" [size]="15" />
                      Add {{ entryNoun(section).toLowerCase() }}
                    </button>
                    <span class="field-hint" style="margin-left: 0.5rem">
                      Up to {{ maxEntries(section) }}.
                    </span>
                  </div>
                }
              </div>
            }
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

    <!-- One field, bound to whichever group it belongs to: the form itself, or
         one entry of a repeating section. -->
    <ng-template #fieldTpl let-field="field" let-group="group">
      @if (isVisible(field, group)) {
        <div class="field" [class.field--span-2]="field.colSpan === 2">
          <label class="field-label" [for]="idFor(field, group)">
            {{ field.label }}
            @if (field.validation.required) { <span class="req">*</span> }
          </label>

          @switch (field.type) {
            @case ('textarea') {
              <textarea
                class="textarea"
                [id]="idFor(field, group)"
                [formControl]="ctrl(group, field.key)"
                [placeholder]="field.placeholder || ''"
                [class.is-invalid]="invalid(group, field.key)"
              ></textarea>
            }
            @case ('select') {
              <select
                class="select"
                [id]="idFor(field, group)"
                [formControl]="ctrl(group, field.key)"
                [class.is-invalid]="invalid(group, field.key)"
              >
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
                      [checked]="isChecked(group, field.key, opt.value)"
                      [disabled]="readonly()"
                      (change)="toggleMulti(group, field.key, opt.value, $event)"
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
                    <input type="radio" [value]="opt.value" [formControl]="ctrl(group, field.key)" />
                    <span>{{ opt.label }}</span>
                  </label>
                }
              </div>
            }
            @case ('checkbox') {
              <label class="check">
                <input type="checkbox" [formControl]="ctrl(group, field.key)" />
                <span class="text-sm">{{ field.helpText || 'Yes' }}</span>
              </label>
            }
            @case ('file') {
              <div class="file-box">
                <app-icon name="upload" [size]="16" />
                <span class="text-sm">
                  {{ readonly() ? (value(group, field.key) || 'Not uploaded') : 'Choose a file' }}
                </span>
                @if (!readonly()) {
                  <input type="file" [id]="idFor(field, group)" (change)="onFile(group, field.key, $event)" />
                }
              </div>
            }
            @case ('date') {
              <input
                type="date"
                class="input"
                [id]="idFor(field, group)"
                [formControl]="ctrl(group, field.key)"
                [attr.min]="field.validation.minDate || null"
                [attr.max]="field.validation.maxDate || null"
                [class.is-invalid]="invalid(group, field.key)"
              />
            }
            @case ('number') {
              <input
                type="number"
                class="input"
                [id]="idFor(field, group)"
                [formControl]="ctrl(group, field.key)"
                [placeholder]="field.placeholder || ''"
                [class.is-invalid]="invalid(group, field.key)"
              />
            }
            @default {
              <input
                type="text"
                class="input"
                [id]="idFor(field, group)"
                [formControl]="ctrl(group, field.key)"
                [placeholder]="field.placeholder || ''"
                [class.is-invalid]="invalid(group, field.key)"
                [attr.maxlength]="maxLengthFor(field)"
                [style.text-transform]="isUppercase(field) ? 'uppercase' : null"
              />
            }
          }

          @if (hintFor(field)) {
            <span class="field-hint">{{ hintFor(field) }}</span>
          }
          @if (invalid(group, field.key)) {
            <span class="field-error">{{ errorFor(group, field) }}</span>
          }
        </div>
      }
    </ng-template>
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
      .entry {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.85rem;
        background: var(--surface-muted);
      }
      .entry__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin-bottom: 0.6rem;
      }
      .entry__title {
        font-size: var(--fs-sm);
        font-weight: 600;
        color: var(--ink-700);
      }
    `,
  ],
})
export class DynamicFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly definition = input.required<ProfileForm>();
  readonly values = input<Record<string, FieldValue | EntryValues[]>>({});
  readonly readonly = input(false);

  /**
   * Shows the form as an applicant would meet it rather than as it was
   * answered: a repeating section still starts with its opening entries, so a
   * preview of a form nobody has filled in is not an empty card. Off on the
   * scrutiny screen, where an empty section means exactly that.
   */
  readonly preview = input(false);
  readonly submitted = output<Record<string, unknown>>();

  private readonly formSignal = signal<FormGroup>(this.fb.group({}));
  readonly form = computed(() => this.formSignal());

  constructor() {
    effect(() => {
      const definition = this.definition();
      const values = this.values();
      const group: Record<string, AbstractControl> = {};

      for (const section of definition.sections) {
        if (section.isEnabled === false) continue;
        const fields = this.enabledFields(section);

        if (!section.isRepeatable) {
          for (const field of fields) {
            group[field.key] = this.controlFor(field, values[field.key] as FieldValue);
          }
          continue;
        }

        const raw = values[this.keyOf(section)];
        const answered = Array.isArray(raw) ? (raw as EntryValues[]) : [];

        /* Read-only shows exactly what was answered. While filling, the
           smallest allowed number of entries is on screen from the start, so
           a required section is never an empty card with a button. */
        const shown = this.readonly() && !this.preview()
          ? answered.length
          : Math.max(answered.length, this.minEntries(section), 1);

        group[this.keyOf(section)] = this.fb.array(
          Array.from({ length: shown }, (_, index) =>
            this.entryGroup(fields, answered[index] ?? {}),
          ),
        );
      }

      this.formSignal.set(this.fb.group(group));
    });
  }

  /* --------------------------------------------------------- definition */

  /** Disabled sections and fields never render and never validate. */
  protected readonly enabledSections = computed(() =>
    this.definition().sections.filter((s) => s.isEnabled !== false),
  );

  protected enabledFields(section: { fields: ProfileField[] }): ProfileField[] {
    return section.fields.filter((f) => f.isEnabled !== false);
  }

  /** What one entry is called, falling back to the section's own title. */
  protected entryNoun(section: ProfileSection): string {
    return section.itemLabel?.trim() || section.title;
  }

  protected minEntries(section: ProfileSection): number {
    return Math.max(0, section.minEntries ?? 1);
  }

  protected maxEntries(section: ProfileSection): number {
    return Math.max(1, section.maxEntries ?? 10);
  }

  /**
   * The key a repeating section's entries live under. Falls back to the id so
   * a form saved before section keys existed still renders.
   */
  private keyOf(section: ProfileSection): string {
    return section.key?.trim() || `section${section.id}`;
  }

  /* -------------------------------------------------------------- entries */

  protected entriesOf(section: ProfileSection): FormGroup[] {
    const array = this.form().get(this.keyOf(section));
    return array instanceof FormArray ? (array.controls as FormGroup[]) : [];
  }

  protected canAdd(section: ProfileSection): boolean {
    return !this.readonly() && this.entriesOf(section).length < this.maxEntries(section);
  }

  protected canRemove(section: ProfileSection): boolean {
    return (
      !this.readonly() &&
      this.entriesOf(section).length > Math.max(this.minEntries(section), 1)
    );
  }

  protected addEntry(section: ProfileSection): void {
    const array = this.form().get(this.keyOf(section));
    if (!(array instanceof FormArray) || !this.canAdd(section)) return;
    array.push(this.entryGroup(this.enabledFields(section), {}));
  }

  protected removeEntry(section: ProfileSection, index: number): void {
    const array = this.form().get(this.keyOf(section));
    if (!(array instanceof FormArray) || !this.canRemove(section)) return;
    array.removeAt(index);
  }

  private entryGroup(fields: ProfileField[], values: EntryValues): FormGroup {
    const group: Record<string, FormControl> = {};
    for (const field of fields) group[field.key] = this.controlFor(field, values[field.key]);
    return this.fb.group(group);
  }

  private controlFor(field: ProfileField, value: FieldValue | undefined): FormControl {
    return new FormControl<FieldValue>(
      { value: value ?? defaultFor(field), disabled: this.readonly() },
      { validators: validatorsFor(field) },
    );
  }

  /* --------------------------------------------------------------- fields */

  /** The control a field is bound to within the group it was rendered in. */
  protected ctrl(group: FormGroup, key: string): FormControl {
    return group.get(key) as FormControl;
  }

  /**
   * Unique per entry, so clicking a label focuses the field in the entry it
   * was clicked in rather than the first one on the page.
   */
  protected idFor(field: ProfileField, group: FormGroup): string {
    const parent = group.parent;
    if (parent instanceof FormArray) {
      return `${field.key}-${parent.controls.indexOf(group)}`;
    }
    return field.key;
  }

  /**
   * A conditional field reads its trigger from the group it lives in, so each
   * entry answers for itself, and from the form when the trigger is a field
   * outside the section.
   */
  protected isVisible(field: ProfileField, group: FormGroup): boolean {
    if (!field.visibleWhenFieldKey) return true;
    const source = group.get(field.visibleWhenFieldKey)
      ?? this.form().get(field.visibleWhenFieldKey);
    const raw = source?.value;
    const current = typeof raw === 'boolean' ? String(raw) : String(raw ?? '');
    return (field.visibleWhenValues ?? []).includes(current);
  }

  protected value(group: FormGroup, key: string): string {
    const raw = group.get(key)?.value;
    if (raw === null || raw === undefined || raw === '') return '';
    if (Array.isArray(raw)) return raw.join(', ');
    if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
    return String(raw);
  }

  protected invalid(group: FormGroup, key: string): boolean {
    const control = group.get(key);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  protected isUppercase(field: ProfileField): boolean {
    return UPPERCASE_TYPES.includes(field.type);
  }

  protected maxLengthFor(field: ProfileField): number | null {
    if (field.type === 'pan' || field.type === 'tan') return 10;
    if (field.type === 'gstin') return 15;
    if (field.type === 'ifsc') return 11;
    if (field.type === 'aadhaar') return 12;
    if (field.type === 'pincode') return 6;
    return field.validation.maxLength ?? null;
  }

  protected hintFor(field: ProfileField): string {
    if (field.type === 'checkbox') return '';
    return field.helpText || FORMAT_HINTS[field.type] || '';
  }

  protected errorFor(group: FormGroup, field: ProfileField): string {
    const errors = group.get(field.key)?.errors ?? {};
    if (errors['required']) return `${field.label} is required.`;
    if (errors['pattern']) {
      return FORMAT_HINTS[field.type] ?? `Enter a valid ${field.label.toLowerCase()}.`;
    }
    if (errors['minlength']) return `Minimum ${field.validation.minLength} characters.`;
    if (errors['maxlength']) return `Maximum ${field.validation.maxLength} characters.`;
    if (errors['min']) return `Minimum value is ${field.validation.min}.`;
    if (errors['minDate']) return `Cannot be before ${field.validation.minDate}.`;
    if (errors['maxDate']) return `Cannot be after ${field.validation.maxDate}.`;
    if (errors['max']) return `Maximum value is ${field.validation.max}.`;
    return 'Invalid value.';
  }

  protected isChecked(group: FormGroup, key: string, option: string): boolean {
    const raw = group.get(key)?.value;
    return Array.isArray(raw) && raw.includes(option);
  }

  protected toggleMulti(group: FormGroup, key: string, option: string, event: Event): void {
    const control = group.get(key);
    if (!control) return;
    const checked = (event.target as HTMLInputElement).checked;
    const current = Array.isArray(control.value) ? [...(control.value as string[])] : [];
    const next = checked ? [...current, option] : current.filter((v) => v !== option);
    control.setValue(next);
    control.markAsDirty();
  }

  protected onFile(group: FormGroup, key: string, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    const control = group.get(key);
    control?.setValue(file ? file.name : null);
    control?.markAsDirty();
  }
}

function defaultFor(field: ProfileField): FieldValue {
  if (field.type === 'multiselect') return [];
  if (field.type === 'checkbox') return false;
  return '';
}

function dateNotBefore(earliest: string): ValidatorFn {
  return (control) => {
    const value = control.value as string | null;
    return value && value < earliest ? { minDate: { earliest } } : null;
  };
}

function dateNotAfter(latest: string): ValidatorFn {
  return (control) => {
    const value = control.value as string | null;
    return value && value > latest ? { maxDate: { latest } } : null;
  };
}

function validatorsFor(field: ProfileField): ValidatorFn[] {
  const rules: ValidatorFn[] = [];
  const v = field.validation;
  if (v.required) {
    rules.push(field.type === 'checkbox' ? Validators.requiredTrue : Validators.required);
  }
  if (v.minLength) rules.push(Validators.minLength(v.minLength));
  if (v.maxLength) rules.push(Validators.maxLength(v.maxLength));
  if (v.min !== null && v.min !== undefined) rules.push(Validators.min(v.min));
  if (v.max !== null && v.max !== undefined) rules.push(Validators.max(v.max));

  /* Dates compare as yyyy-MM-dd strings, which is what the input gives and
     what the server stores — no parsing, and no timezone to get wrong. */
  if (v.minDate) rules.push(dateNotBefore(v.minDate));
  if (v.maxDate) rules.push(dateNotAfter(v.maxDate));
  const pattern = v.pattern ? new RegExp(v.pattern) : PATTERNS[field.type];
  if (pattern) rules.push(Validators.pattern(pattern));
  return rules;
}
