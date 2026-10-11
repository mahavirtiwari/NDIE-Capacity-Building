import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  FIELD_TYPES,
  FieldType,
  RecordStatus,
  SignupField,
  SignupFieldOption,
  fieldTypeHasOptions,
} from '../../core/models';
import { SignupFormService } from '../../core/services/academics.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';

/**
 * The form an applicant fills in to create an account.
 *
 * Deliberately not a data table. There is one form and the order of its
 * fields is part of what is being edited, so it reads as the form it
 * configures rather than as a register of rows.
 *
 * One form for everybody. It used to be possible to give a sub-category its
 * own, which existed so that a scheme could ask an assessor and a master
 * trainer different things at sign-up. Sign-up no longer knows which
 * discipline anybody is in - that is chosen in the app afterwards - so those
 * questions live on the profile form, which is per sub-category.
 */
@Component({
  selector: 'app-signup-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CanDirective,
    ReactiveFormsModule,
    IconComponent,
    ModalComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
  ],
  template: `
    <app-page-header
      icon="form"
      [title]="copy.text('page.signupForm.title')"
      [subtitle]="copy.text('page.signupForm.subtitle')"
      [breadcrumbs]="[{ label: 'Administration' }, { label: copy.text('page.signupForm.title') }]"
    >
      <button *appCan="'masters.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" />
        New field
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <p class="text-muted text-sm">
          One form, filled in by everybody who creates an account. Which category and
          sub-category somebody works in is not asked here — they choose that in the app,
          on the profile form, and one account can hold a profile in each category.
        </p>
      </div>

      <div class="card__header">
        <span class="card__title">Fields</span>
        <span class="card__meta">{{ activeCount() }} of {{ fields().length }} shown to applicants</span>
      </div>

      <div class="card__body field-list">
        @if (loading()) {
          <p class="empty">Loading the form...</p>
        } @else if (fields().length === 0) {
          <p class="empty">No fields yet.</p>
        }

        @for (field of fields(); track field.id; let i = $index) {
          <article class="field" [class.is-off]="field.status !== 'Active'">
            <div class="field__order">
              <button type="button" class="btn btn--icon" title="Move up"
                [disabled]="i === 0 || saving()" (click)="move(i, -1)">
                <app-icon name="chevron-up" [size]="14" />
              </button>
              <button type="button" class="btn btn--icon" title="Move down"
                [disabled]="i === fields().length - 1 || saving()" (click)="move(i, 1)">
                <app-icon name="chevron-down" [size]="14" />
              </button>
            </div>

            <div class="field__main">
              <div class="field__title">
                {{ field.label }}
                @if (field.required) { <span class="req" title="Required">*</span> }
                @if (field.isBuiltIn) { <span class="chip">Built in</span> }
                @if (field.isLocked) { <span class="chip chip--lock">Always on</span> }
              </div>
              <div class="field__meta">
                <code>{{ field.key }}</code>
                <span>{{ typeLabel(field.type) }}</span>
                @if (field.options.length) { <span>{{ field.options.length }} options</span> }
              </div>
              @if (field.helpText) {
                <div class="field__help">{{ field.helpText }}</div>
              }
            </div>

            <app-status-badge [value]="field.status" />

            <div class="field__actions">
              <button *appCan="'masters.manage'" type="button" class="btn btn--icon" title="Edit"
                [disabled]="saving()" (click)="openForm(field)">
                <app-icon name="edit" [size]="15" />
              </button>

              <!-- A field the account cannot work without offers no switch at
                   all, rather than one that always refuses. -->
              @if (!field.isLocked) {
                <button type="button" class="btn btn--sm"
                  [class.btn--ghost]="field.status === 'Active'"
                  [disabled]="saving()" (click)="toggle(field)">
                  {{ field.status === 'Active' ? 'Disable' : 'Enable' }}
                </button>
              }

              @if (!field.isBuiltIn) {
                <button *appCan="'masters.manage'" type="button" class="btn btn--icon btn--danger" title="Remove"
                  [disabled]="saving()" (click)="remove(field)">
                  <app-icon name="trash" [size]="15" />
                </button>
              }
            </div>
          </article>
        }
      </div>
    </section>

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit field' : 'New field'"
        subtitle="Shown on the applicant sign-up screen, in the order set here."
        (closed)="formOpen.set(false)"
      >
        <form [formGroup]="form" class="stack stack-md" (ngSubmit)="save()">
          <div class="grid-2">
            <label class="field-label">
              Label *
              <input class="input" formControlName="label" placeholder="Full name" />
            </label>

            <label class="field-label">
              Key
              <input class="input" formControlName="key" placeholder="enterpriseName" />
              <small class="hint">
                {{ editing()
                    ? 'Answers are stored against this, so it cannot change.'
                    : 'Letters, digits and underscores. Cannot be changed later.' }}
              </small>
            </label>
          </div>

          <div class="grid-2">
            <label class="field-label">
              Type
              <select class="input" formControlName="type">
                @for (t of types; track t.value) {
                  <option [value]="t.value">{{ t.label }}</option>
                }
              </select>
              @if (editing()?.isBuiltIn) {
                <small class="hint">Set by the column behind this field.</small>
              }
            </label>

            <label class="field-label">
              Placeholder
              <input class="input" formControlName="placeholder" placeholder="Enter your answer" />
            </label>
          </div>

          <label class="field-label">
            Help text
            <input class="input" formControlName="helpText" placeholder="Shown under the field" />
          </label>

          <label class="check">
            <input type="checkbox" formControlName="required" />
            <span>Required</span>
          </label>

          @if (needsOptions()) {
            <div class="options">
              <div class="options__head">
                <span>Options</span>
                <button type="button" class="btn btn--sm btn--ghost" (click)="addOption()">
                  Add option
                </button>
              </div>
              @for (option of options(); track $index; let i = $index) {
                <div class="options__row">
                  <input class="input" [value]="option.label"
                    placeholder="Label shown to the applicant"
                    (input)="setOption(i, 'label', $event)" />
                  <input class="input" [value]="option.value"
                    placeholder="Stored value"
                    (input)="setOption(i, 'value', $event)" />
                  <button type="button" class="btn btn--icon btn--danger" title="Remove this option"
                    (click)="dropOption(i)">
                    <app-icon name="trash" [size]="14" />
                  </button>
                </div>
              }
              @if (options().length === 0) {
                <p class="hint">A field the applicant chooses from needs at least one option.</p>
              }
            </div>
          }

          <div class="modal__actions">
            <button type="button" class="btn" (click)="formOpen.set(false)">Cancel</button>
            <button type="submit" class="btn btn--primary" [disabled]="saving()">
              {{ editing() ? 'Save changes' : 'Add field' }}
            </button>
          </div>
        </form>
      </app-modal>
    }
  `,
  styles: [
    `
      .field-list { display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; }
      .empty { color: var(--ink-500); font-size: var(--fs-sm); margin: 1rem 0; text-align: center; }

      .field {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto auto;
        align-items: center;
        gap: 0.9rem;
        padding: 0.7rem 0.85rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
      }
      /* A disabled field stays legible: it is still part of the form somebody
         is editing, just not one applicants see. */
      .field.is-off { background: var(--ink-50); opacity: 0.8; }

      .field__order { display: flex; flex-direction: column; gap: 0.1rem; }
      .field__title {
        display: flex; align-items: center; gap: 0.4rem;
        font-weight: 600; font-size: var(--fs-md);
      }
      .req { color: var(--danger-500); }
      .field__meta {
        display: flex; flex-wrap: wrap; gap: 0.75rem;
        color: var(--ink-500); font-size: var(--fs-xs); margin-top: 0.15rem;
      }
      .field__meta code { font-size: var(--fs-xs); }
      .field__help { color: var(--ink-500); font-size: var(--fs-xs); margin-top: 0.2rem; }
      .field__actions { display: flex; align-items: center; gap: 0.35rem; }

      .chip--lock { background: var(--brand-50); color: var(--brand-700); }

      .options { border: 1px solid var(--border); border-radius: var(--radius); padding: 0.75rem; }
      .options__head {
        display: flex; justify-content: space-between; align-items: center;
        font-weight: 600; font-size: var(--fs-sm); margin-bottom: 0.5rem;
      }
      .options__row {
        display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
        gap: 0.4rem; margin-bottom: 0.4rem;
      }
      .check { display: flex; align-items: center; gap: 0.5rem; font-size: var(--fs-sm); }
      .hint { color: var(--ink-500); font-size: var(--fs-xs); }
      .grid-2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.75rem; }
      @media (max-width: 640px) { .grid-2 { grid-template-columns: minmax(0, 1fr); } }
    `,
  ],
})
export class SignupFormComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(SignupFormService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly types = FIELD_TYPES;
  protected readonly fields = signal<SignupField[]>([]);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly editing = signal<SignupField | null>(null);
  protected readonly options = signal<SignupFieldOption[]>([]);

  protected readonly activeCount = computed(
    () => this.fields().filter((f) => f.status === 'Active').length,
  );

  protected readonly form = this.fb.nonNullable.group({
    key: ['', [Validators.required]],
    label: ['', [Validators.required]],
    type: ['text' as FieldType],
    placeholder: [''],
    helpText: [''],
    required: [false],
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);

    this.service.list().subscribe({
      next: (fields) => {
        this.fields.set(fields);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected typeLabel(type: FieldType): string {
    return FIELD_TYPES.find((t) => t.value === type)?.label ?? type;
  }

  protected needsOptions(): boolean {
    return fieldTypeHasOptions(this.form.controls.type.value);
  }

  protected openForm(field?: SignupField): void {
    this.editing.set(field ?? null);
    this.options.set(field ? field.options.map((o) => ({ ...o })) : []);

    this.form.reset({
      key: field?.key ?? '',
      label: field?.label ?? '',
      type: field?.type ?? 'text',
      placeholder: field?.placeholder ?? '',
      helpText: field?.helpText ?? '',
      required: field?.required ?? false,
    });

    /* The key is what answers are stored against, and the type of a built-in
       field is decided by the column behind it. Both are shown rather than
       hidden, so what cannot be changed is still visible. */
    if (field) this.form.controls.key.disable();
    else this.form.controls.key.enable();

    if (field?.isBuiltIn) this.form.controls.type.disable();
    else this.form.controls.type.enable();

    this.formOpen.set(true);
  }

  protected addOption(): void {
    this.options.update((list) => [...list, { value: '', label: '' }]);
  }

  protected dropOption(index: number): void {
    this.options.update((list) => list.filter((_, i) => i !== index));
  }

  protected setOption(index: number, part: 'value' | 'label', event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.options.update((list) =>
      list.map((o, i) => (i === index ? { ...o, [part]: text } : o)),
    );
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const editing = this.editing();

    const body = {
      key: raw.key,
      label: raw.label,
      type: raw.type,
      placeholder: raw.placeholder || null,
      helpText: raw.helpText || null,
      required: raw.required,
      displayOrder: editing?.displayOrder ?? 0,
      status: editing?.status ?? ('Active' as RecordStatus),
      options: this.options().filter((o) => o.value.trim().length > 0),
    };

    this.saving.set(true);
    const request = editing
      ? this.service.update(editing.id, body)
      : this.service.create(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success(editing ? 'Field updated.' : 'Field added.');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected toggle(field: SignupField): void {
    const next: RecordStatus = field.status === 'Active' ? 'Inactive' : 'Active';
    this.saving.set(true);
    this.service.setStatus(field.id, next).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(next === 'Active' ? 'Field enabled.' : 'Field disabled.');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async remove(field: SignupField): Promise<void> {
    const ok = await this.confirm.ask({
      title: `Remove ${field.label}?`,
      message:
        'It stops appearing on the sign-up form. Answers already given are kept, so putting ' +
        'the field back later finds its history where it left it.',
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;

    this.saving.set(true);
    this.service.remove(field.id).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Field removed.');
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected move(index: number, by: number): void {
    const list = [...this.fields()];
    const target = index + by;
    if (target < 0 || target >= list.length) return;

    [list[index], list[target]] = [list[target], list[index]];
    /* Moved on screen straight away; the order is saved behind it. Waiting for
       the round trip makes reordering a list feel broken. */
    this.fields.set(list);

    this.saving.set(true);
    this.service.reorder(list.map((f) => f.id)).subscribe({
      next: (saved) => {
        this.fields.set(saved);
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.load();
      },
    });
  }
}
