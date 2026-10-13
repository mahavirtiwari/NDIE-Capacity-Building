import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
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
import {
  DurationValue,
  FieldType,
  LoadedPhoto,
  ProfileField,
  ProfileForm,
  ProfileSection,
  durationWords,
  monthsBetween,
} from '../../core/models';
import { FORMAT_MESSAGES, FORMAT_PATTERNS } from '../../core/validation/formats';
import { IconComponent } from './icon.component';

/* A span is a value like any other: the control holds an object, which is
   what a duration field stores against its answer. */
type FieldValue = string | string[] | number | boolean | DurationValue | null;

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
  imports: [DatePipe, ReactiveFormsModule, IconComponent, NgTemplateOutlet],
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
<!-- How many entries a repeating section holds is worth knowing.
                 How many fields a plain one has is not — it tells a reader
                 the size of what is already in front of them. -->
            @if (section.isRepeatable) {
              <span class="chip">{{ entriesOf(section).length }} of {{ maxEntries(section) }}</span>
            } @else if (!reading()) {
              <span class="chip">
                {{ enabledFields(section).length }}
                {{ enabledFields(section).length === 1 ? 'field' : 'fields' }}
              </span>
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
        <!-- Being read, not filled in.

             A scrutiny officer meets this screen to decide whether what
             somebody wrote is right, and every answer arrived as a grey
             disabled box: thirty identical rounded rectangles down the
             page, the writing in them dimmed because the control was
             switched off. Answers are the thing on this page, so they are
             set in plain text under their labels and the boxes are gone.

             Not in the form builder's preview, which exists to show what
             the applicant will meet and must therefore keep the inputs. -->
        @if (reading()) {
          <div class="read-field" [class.field--span-2]="field.colSpan === 2">
            <div class="read-field__label">{{ field.label }}</div>

            @switch (field.type) {
              @case ('photos') {
                @if (shots(field.key); as pictures) {
                  <div class="shots">
                    @for (shot of pictures; track shot.displayOrder) {
                      <figure class="shot">
                        <a [href]="shot.url" target="_blank" rel="noopener">
                          <img
                            [src]="shot.url"
                            [alt]="field.label + ', picture ' + shot.displayOrder"
                            loading="lazy"
                          />
                        </a>
                        <figcaption>
                          <span class="shot__n">{{ shot.displayOrder }}</span>
                          <span>{{ shot.capturedOn | date: 'dd MMM yyyy, h:mm a' }}</span>
                          @if (shot.latitude != null && shot.longitude != null) {
                            <a
                              class="shot__where"
                              [href]="
                                'https://www.openstreetmap.org/?mlat=' + shot.latitude +
                                '&mlon=' + shot.longitude + '#map=17/' +
                                shot.latitude + '/' + shot.longitude
                              "
                              target="_blank"
                              rel="noopener"
                            >
                              {{ place(shot) }}
                            </a>
                          } @else {
                            <span class="text-muted">Location not recorded</span>
                          }
                          @if (shot.deviceModel) {
                            <span class="text-muted">{{ shot.deviceModel }}</span>
                          }
                          <span class="text-muted">
                            Synced {{ shot.syncedOn | date: 'dd MMM yyyy, h:mm a' }}
                          </span>
                        </figcaption>
                      </figure>
                    }
                  </div>
                } @else {
                  <div class="read-field__value is-empty">{{ taken(group, field.key) }}</div>
                }
              }
              @case ('duration') {
                @if (span(group, field.key).from && span(group, field.key).to) {
                  <div class="read-field__value">
                    {{ span(group, field.key).from }} to {{ span(group, field.key).to }}
                    <span class="text-xs text-muted">{{ spanWords(group, field.key) }}</span>
                  </div>
                } @else {
                  <div class="read-field__value is-empty">Not answered</div>
                }
              }
              @case ('multiselect') {
                @if (chosen(group, field) .length > 0) {
                  <div class="read-chips">
                    @for (label of chosen(group, field); track label) {
                      <span class="chip">{{ label }}</span>
                    }
                  </div>
                } @else {
                  <div class="read-field__value is-empty">Not answered</div>
                }
              }
              @case ('textarea') {
                @if (shown(group, field)) {
                  <!-- Tight against the tags on purpose: this value is
                       rendered with pre-wrap so the applicant's own line
                       breaks survive, which means the template's
                       indentation would survive with them. -->
                  <div
                    class="read-field__value read-field__value--flow"
                  >{{ shown(group, field) }}</div>
                } @else {
                  <div class="read-field__value is-empty">Not answered</div>
                }
              }
              @case ('file') {
                <div class="read-field__value">
                  @if (value(group, field.key)) {
                    <!-- The name on its own was all this said, which told
                         the officer that something had been attached and
                         nothing about what. The document itself is what
                         they are reading the profile for. -->
                    @if (openable()) {
                      <button
                        type="button"
                        class="read-file read-file--link"
                        (click)="openFile.emit(field.key)"
                      >
                        <app-icon name="file" [size]="14" />
                        <span class="read-file__name">{{ value(group, field.key) }}</span>
                        <app-icon name="eye" [size]="13" />
                      </button>
                    } @else {
                      <span class="read-file">
                        <app-icon name="file" [size]="14" />
                        {{ value(group, field.key) }}
                      </span>
                    }
                  } @else {
                    <span class="is-empty">Not uploaded</span>
                  }
                </div>
              }
              @default {
                @if (shown(group, field)) {
                  <div class="read-field__value">{{ shown(group, field) }}</div>
                } @else {
                  <div class="read-field__value is-empty">Not answered</div>
                }
              }
            }
          </div>
        } @else {
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
              <!-- A native dropdown cannot carry a line under an option,
                   so the chosen one explains itself underneath. -->
              @if (describing(group, field); as note) {
                <span class="choice-note choice-note--under">{{ note }}</span>
              }
            }
            <!-- A dropdown you tick several things in.

                 It was a flat grid of checkboxes, which reads as a
                 different kind of question from the dropdown beside it and
                 takes the height of the whole list whether or not anybody
                 is answering it. Closed it says what has been chosen;
                 open it is the same tick list as before, descriptions and
                 all. -->
            @case ('multiselect') {
              <div class="multi" [attr.data-key]="field.key">
                <button
                  type="button"
                  class="input multi__trigger"
                  [class.is-invalid]="invalid(group, field.key)"
                  [disabled]="readonly()"
                  [attr.aria-expanded]="openMulti() === multiId(field, group)"
                  (click)="toggleMultiPanel(field, group)"
                >
                  @if (chosen(group, field); as picked) {
                    @if (picked.length === 0) {
                      <span class="multi__placeholder">Select</span>
                    } @else {
                      <span class="multi__chips">
                        @for (label of picked.slice(0, 3); track label) {
                          <span class="chip">{{ label }}</span>
                        }
                        @if (picked.length > 3) {
                          <span class="chip chip--count">+{{ picked.length - 3 }}</span>
                        }
                      </span>
                    }
                  }
                  <app-icon name="chevron-down" [size]="14" />
                </button>

                @if (openMulti() === multiId(field, group)) {
                  <div class="multi__panel">
                    @for (opt of field.options; track opt.value) {
                      <label class="check check--described">
                        <input
                          type="checkbox"
                          [checked]="isChecked(group, field.key, opt.value)"
                          (change)="toggleMulti(group, field.key, opt.value, $event)"
                        />
                        <span>
                          {{ opt.label }}
                          <!-- What the choice means, under the words it
                               explains: the person reading is deciding
                               between this and the one below it. -->
                          @if (opt.description) {
                            <span class="choice-note">{{ opt.description }}</span>
                          }
                        </span>
                      </label>
                    }

                    <div class="multi__foot">
                      <button type="button" class="btn btn--sm btn--ghost"
                        (click)="clearMulti(group, field.key)">
                        Clear
                      </button>
                      <button type="button" class="btn btn--sm btn--secondary"
                        (click)="openMulti.set(null)">
                        Done
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
            @case ('radio') {
              <div class="check-grid">
                @for (opt of field.options; track opt.value) {
                  <label class="check check--described">
                    <input type="radio" [value]="opt.value" [formControl]="ctrl(group, field.key)" />
                    <span>
                      {{ opt.label }}
                      @if (opt.description) {
                        <span class="choice-note">{{ opt.description }}</span>
                      }
                    </span>
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
<!-- Pictures taken on the phone. Without this the switch fell
                 through to a text box holding the answer, which for a camera
                 field is the number of pictures taken — so a selfie read as
                 a disabled input containing "1", and the photographs the
                 applicant was asked for could not be seen at all. -->
            @case ('photos') {
              @if (shots(field.key); as pictures) {
                <div class="shots">
                  @for (shot of pictures; track shot.displayOrder) {
                    <figure class="shot">
                      <a [href]="shot.url" target="_blank" rel="noopener">
                        <img
                          [src]="shot.url"
                          [alt]="field.label + ', picture ' + shot.displayOrder"
                          loading="lazy"
                        />
                      </a>
                      <figcaption>
                        <span class="shot__n">{{ shot.displayOrder }}</span>
                        <span>{{ shot.capturedOn | date: 'dd MMM yyyy, h:mm a' }}</span>
                        @if (shot.latitude != null && shot.longitude != null) {
                          <a
                            class="shot__where"
                            [href]="
                              'https://www.openstreetmap.org/?mlat=' + shot.latitude +
                              '&mlon=' + shot.longitude + '#map=17/' +
                              shot.latitude + '/' + shot.longitude
                            "
                            target="_blank"
                            rel="noopener"
                          >
                            {{ shot.latitude }}, {{ shot.longitude }}
                          </a>
                        } @else {
                          <span class="text-muted">Location not recorded</span>
                        }
                        @if (shot.deviceModel) {
                          <span class="text-muted">{{ shot.deviceModel }}</span>
                        }
                        <span class="text-muted">
                          Synced {{ shot.syncedOn | date: 'dd MMM yyyy, h:mm a' }}
                        </span>
                      </figcaption>
                    </figure>
                  }
                </div>
              } @else {
                <div class="file-box">
                  <app-icon name="camera" [size]="16" />
                  <span class="text-sm">
                    {{ taken(group, field.key) }}
                  </span>
                </div>
              }
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
            <!-- Two dates and the length between them. Asked as one
                 question because it is one fact: "how long" answered on
                 its own is somebody's arithmetic done from memory, and
                 two people doing it from the same dates do not always
                 agree. -->
            @case ('duration') {
              <div class="span">
                <div class="span__date">
                  <label class="span__cap" [attr.for]="idFor(field, group) + '-from'">From</label>
                  <input
                    type="date"
                    class="input"
                    [id]="idFor(field, group) + '-from'"
                    [value]="span(group, field.key).from"
                    [disabled]="readonly()"
                    [attr.min]="field.validation.minDate || null"
                    [attr.max]="field.validation.maxDate || null"
                    [class.is-invalid]="invalid(group, field.key)"
                    (change)="setSpan(group, field.key, 'from', dateValue($event))"
                  />
                </div>

                <div class="span__date">
                  <label class="span__cap" [attr.for]="idFor(field, group) + '-to'">To</label>
                  <input
                    type="date"
                    class="input"
                    [id]="idFor(field, group) + '-to'"
                    [value]="span(group, field.key).to"
                    [disabled]="readonly()"
                    [attr.min]="span(group, field.key).from || field.validation.minDate || null"
                    [attr.max]="field.validation.maxDate || null"
                    [class.is-invalid]="invalid(group, field.key)"
                    (change)="setSpan(group, field.key, 'to', dateValue($event))"
                  />
                </div>

                <!-- Worked out, not typed. It is a reading of the two
                     dates beside it and changes with them. -->
                <div class="span__total">
                  <span class="span__cap">Duration</span>
                  <strong class="span__words">{{ spanWords(group, field.key) }}</strong>
                </div>
              </div>
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
      }
    </ng-template>
  `,
  styles: [
    `
      /* The closed control reads like the dropdown beside it; the panel
         under it is the tick list it always was. */
      .multi { position: relative; }
      .multi__trigger {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        width: 100%;
        min-height: 2.25rem;
        text-align: left;
        cursor: pointer;
        background: var(--surface);
      }
      .multi__trigger:disabled { cursor: default; opacity: 0.7; }
      .multi__trigger app-icon { margin-left: auto; color: var(--ink-500); }
      .multi__placeholder { color: var(--ink-400); }
      .multi__chips { display: flex; flex-wrap: wrap; gap: 0.25rem; min-width: 0; }
      .chip--count { background: var(--ink-100); color: var(--ink-600); }

      .multi__panel {
        position: absolute;
        z-index: 40;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        max-height: 280px;
        overflow-y: auto;
        padding: 0.5rem;
        display: grid;
        gap: 0.15rem;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        box-shadow: var(--shadow-lg);
      }
      .multi__panel .check { padding: 0.3rem 0.35rem; border-radius: var(--radius-sm); }
      .multi__panel .check:hover { background: var(--ink-100); }
      /* Sticky, so Done is reachable without scrolling a long list back. */
      .multi__foot {
        position: sticky;
        bottom: -0.5rem;
        display: flex;
        justify-content: space-between;
        gap: 0.5rem;
        margin: 0.35rem -0.5rem -0.5rem;
        padding: 0.4rem 0.5rem;
        background: var(--surface);
        border-top: 1px solid var(--border);
      }

      /* Two dates and what they add up to, on one line where there is
         room and stacked where there is not. */
      .span {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.5rem 0.75rem;
        align-items: end;
      }
      .span__date { display: grid; gap: 0.2rem; }
      .span__cap {
        font-size: var(--fs-xs);
        color: var(--ink-500);
        font-weight: 600;
      }
      .span__total {
        display: grid;
        gap: 0.2rem;
        padding: 0.35rem 0.6rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface-muted);
      }
      .span__words { font-size: var(--fs-sm); color: var(--ink-900); }

      /* What a choice means, under the words it explains. Quiet, and
         indented to the label it belongs to rather than the control. */
      .choice-note {
        display: block;
        font-size: var(--fs-xs);
        color: var(--ink-500);
        line-height: 1.35;
        margin-top: 1px;
      }
      .choice-note--under { margin-top: 0.25rem; }
      /* A described choice is two lines, so the box lines up with the
         first of them rather than the middle of both. */
      .check--described { align-items: flex-start; }
      .check--described input { margin-top: 3px; }

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
      /* One entry inside a repeating section. Related to the section
         heading above it and plainly subordinate to it, so the gold
         accent rather than a second crimson bar. */
      .entry__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        margin: -0.85rem -0.85rem 0.6rem;
        padding: 0.4rem 0.6rem;
        background: var(--accent-100);
        border-left: 3px solid var(--accent-500);
        border-radius: var(--radius) var(--radius) 0 0;
      }
      .entry__title {
        font-size: var(--fs-sm);
        font-weight: 600;
        color: var(--accent-700);
      }

      /* Where one section ends and the next begins.

         A long profile is a run of white cards down a white page, and
         the only thing separating "Basic details" from "Educational
         qualification" was a gap. A tinted band and a bar in the brand
         give each section a visible top edge, so somebody scrolling can
         see the joins without reading the headings.

         These selectors reach only this component's own section cards —
         Angular scopes a component's styles to its own template — so no
         other card in the portal is touched. */
      .card__header {
        background: var(--brand-50);
        border-left: 3px solid var(--brand-600);
        border-top-left-radius: inherit;
        border-top-right-radius: inherit;
      }
      .card__title {
        color: var(--brand-800);
        font-weight: 600;
      }
      .card__subtitle { color: var(--ink-600); }

      /* An answer, set as text under its label.

         Two columns like the form it mirrors, so a profile read here sits
         where it sat when it was filled in and the eye can go back to the
         same place. The rule under each one does the separating that the
         input borders used to, at a fraction of the weight. */
      .read-field {
        display: flex;
        flex-direction: column;
        gap: 0.2rem;
        padding-bottom: 0.6rem;
        border-bottom: 1px solid var(--border);
        min-width: 0;
      }
      .read-field__label {
        font-size: var(--fs-xs);
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: var(--ink-500);
      }
      .read-field__value {
        font-size: var(--fs-sm);
        color: var(--ink-800);
        /* A long unbroken answer — a URL, a run of digits — must wrap
           rather than push the column wide and the one beside it off. */
        overflow-wrap: anywhere;
      }
      /* A paragraph answer keeps the line breaks the applicant typed. */
      .read-field__value--flow { white-space: pre-wrap; }
      .read-field__value .is-empty,
      .read-field__value.is-empty {
        color: var(--ink-400, var(--ink-500));
        font-style: italic;
      }
      .read-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
      .read-file { display: inline-flex; align-items: center; gap: 0.35rem; }
      .read-file--link {
        padding: 0;
        border: 0;
        background: none;
        font: inherit;
        color: var(--brand-700);
        text-align: left;
        cursor: pointer;
      }
      .read-file--link:hover .read-file__name { text-decoration: underline; }
      .read-file__name { word-break: break-all; }

      /* Wide enough that a photograph of a certificate can be read without
         opening it, and a grid so a set of five does not become a column
         the length of the page. */
      .shots {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: 0.75rem;
      }
      .shot {
        margin: 0;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        overflow: hidden;
        background: var(--surface-2, var(--surface));
      }
      .shot img {
        display: block;
        width: 100%;
        height: 170px;
        object-fit: cover;
        background: var(--ink-100, #eee);
      }
      .shot figcaption {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        padding: 0.45rem 0.55rem;
        font-size: 0.75rem;
        line-height: 1.35;
      }
      .shot__n {
        font-weight: 600;
        color: var(--ink-700);
      }
      /* A link, so it takes the link colour rather than the brand's. */
      .shot__where { color: var(--link-600); text-decoration: none; }
      .shot__where:hover { color: var(--link-700); text-decoration: underline; }
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

  /**
   * The pictures held for each camera field, keyed by field key.
   *
   * Passed in rather than fetched here, because the form has no idea whose
   * profile it is rendering — the screen that does knows, and is also the
   * one that has to revoke the object URLs afterwards.
   */
  readonly photos = input<Record<string, LoadedPhoto[]>>({});

  /**
   * Whether an attached document can be fetched and shown.
   *
   * The form holds the name the field answered with and nothing else; who
   * the profile belongs to, and therefore where the bytes are, is known
   * only to the screen above. Off by default, so the form builder's
   * preview does not offer to open files that do not exist.
   */
  readonly openable = input(false);

  readonly submitted = output<Record<string, unknown>>();

  /** The key of a file field somebody asked to see. */
  readonly openFile = output<string>();

  /**
   * Whether this is somebody reading a filled-in profile.
   *
   * Read-only on its own is not enough to decide: the form builder's
   * preview is also read-only, and there the point is to show the
   * applicant's experience, controls and all.
   */
  protected readonly reading = computed(() => this.readonly() && !this.preview());

  /**
   * One field's answer, in the words the form used.
   *
   * A dropdown stores a code and displays a label; reading the control
   * back gives the code, so a question answered "Graduation" would be
   * reported to the scrutiny officer as "grad_3". Options are resolved
   * to their labels, dates are written out, and a yes/no says which.
   */
  protected shown(group: FormGroup, field: ProfileField): string {
    const raw = group.get(field.key)?.value;
    if (raw === null || raw === undefined || raw === '') return '';

    if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';

    if (field.type === 'select' || field.type === 'radio') {
      return field.options?.find((o) => o.value === String(raw))?.label ?? String(raw);
    }

    if (field.type === 'date') {
      const at = new Date(String(raw));
      if (!Number.isNaN(at.getTime())) {
        return at.toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }
    }

    return String(raw);
  }

  /**
   * A picture's position, to a fixed six places.
   *
   * Printed raw the two halves disagree with each other — a latitude
   * ending in a zero loses it and sits a character short of the
   * longitude beside it, which reads as less precision rather than as a
   * trailing nought.
   */
  protected place(shot: LoadedPhoto): string {
    return `${(shot.latitude ?? 0).toFixed(6)}, ${(shot.longitude ?? 0).toFixed(6)}`;
  }

  /** The labels of whatever was ticked on a multi-select. */
  protected chosen(group: FormGroup, field: ProfileField): string[] {
    const raw = group.get(field.key)?.value;
    if (!Array.isArray(raw)) return [];
    return raw.map(
      (v) => field.options?.find((o) => o.value === String(v))?.label ?? String(v),
    );
  }

  /** The pictures for one field, or null where there are none to show. */
  protected shots(fieldKey: string): LoadedPhoto[] | null {
    const held = this.photos()[fieldKey];
    return held && held.length > 0 ? held : null;
  }

  /**
   * What to say when there are no pictures to show.
   *
   * The answer on a camera field is the count, so it can say that some
   * were taken even on a screen that has not been given the images —
   * the form builder's preview, for one, where there is no applicant.
   */
  protected taken(group: FormGroup, key: string): string {
    const count = Number(this.value(group, key)) || 0;
    if (count === 0) return 'No pictures taken';
    return count === 1 ? '1 picture taken' : `${count} pictures taken`;
  }

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
        const entries = this.reading()
          ? answered.length
          : Math.max(answered.length, this.minEntries(section), 1);

        group[this.keyOf(section)] = this.fb.array(
          Array.from({ length: entries }, (_, index) =>
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

    const wanted = field.visibleWhenValues ?? [];

    /* Nothing to match against is no restriction. The applicant's app
       and the server that validates what they send both read it that
       way; this read it as "match nothing", so a half-written rule hid
       the field here and showed it — and demanded it — on the phone. */
    if (wanted.length === 0) return true;

    /* Case-insensitively, for the same reason. A rule written CB against
       an answer stored as cb passed on the phone and at the server and
       failed only here, which is exactly what "the rule works but not in
       the preview" looks like. */
    return wanted.some((candidate) => candidate.toLowerCase() === current.toLowerCase());
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

  /**
   * What the chosen option means, for a control that cannot say it inline.
   *
   * A native select renders text and nothing else, so the description of
   * whichever option is chosen goes under the box. Null where nothing is
   * chosen or the choice carries no description, which is most of them.
   */
  protected describing(group: FormGroup, field: ProfileField): string | null {
    const chosen = group.get(field.key)?.value;
    if (!chosen) return null;
    return field.options?.find((option) => option.value === chosen)?.description ?? null;
  }

  /**
   * The span held against one field, as a shape the template can read.
   *
   * Answers are stored as whatever the field's type says, and this one
   * stores an object. Anything else - a blank, or a string written by an
   * older build - reads as an unanswered span rather than throwing.
   */
  /** What an <input type="date"> now holds. */
  protected dateValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected span(group: FormGroup, key: string): { from: string; to: string } {
    const raw = group.get(key)?.value as Partial<DurationValue> | null | undefined;
    if (!raw || typeof raw !== 'object') return { from: '', to: '' };
    return { from: raw.from ?? '', to: raw.to ?? '' };
  }

  /**
   * Sets one end of it, and works the length out again.
   *
   * The months are stored with the dates rather than left to each reader:
   * a report that groups by length should not have to know how a length
   * is worked out. They are recomputed here on every change, so they
   * cannot drift from the dates they came from.
   */
  protected setSpan(group: FormGroup, key: string, end: 'from' | 'to', value: string): void {
    const control = group.get(key);
    if (!control) return;

    const current = this.span(group, key);
    const next = { ...current, [end]: value } as DurationValue;

    /* A to-date before the from-date is not a span. The later one moves
       to meet the earlier rather than being refused: somebody correcting
       the start of a period should not have to clear the end of it. */
    if (next.from && next.to && next.to < next.from) {
      if (end === 'from') next.to = next.from;
      else next.from = next.to;
    }

    next.months = monthsBetween(next.from, next.to);
    control.setValue(next);
    control.markAsDirty();
    control.markAsTouched();
  }

  /** The length, in words, for the line under the two dates. */
  protected spanWords(group: FormGroup, key: string): string {
    const { from, to } = this.span(group, key);
    if (!from || !to) return 'Pick both dates';
    return durationWords(monthsBetween(from, to));
  }

  /**
   * Which multi-select panel is open, if any.
   *
   * One at a time, and held by the component rather than per control: two
   * panels open at once overlap each other, and the second one to open is
   * the one somebody is reading.
   */
  protected readonly openMulti = signal<string | null>(null);

  /** A panel's identity: the field, and which entry of a repeated section. */
  protected multiId(field: ProfileField, group: FormGroup): string {
    return `${field.key}:${this.idFor(field, group)}`;
  }

  protected toggleMultiPanel(field: ProfileField, group: FormGroup): void {
    const id = this.multiId(field, group);
    this.openMulti.set(this.openMulti() === id ? null : id);
  }

  protected clearMulti(group: FormGroup, key: string): void {
    const control = group.get(key);
    if (!control) return;
    control.setValue([]);
    control.markAsDirty();
    control.markAsTouched();
  }

  /** Closes an open panel when the click lands anywhere else. */
  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.openMulti()) return;
    const target = event.target as HTMLElement;
    if (!target.closest('.multi')) this.openMulti.set(null);
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.openMulti.set(null);
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
  /* An unanswered span is an empty one rather than a blank string: the
     control reads an object, and a string would make every read of it
     check the type first. */
  if (field.type === 'duration') return { from: '', to: '', months: 0 };
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
