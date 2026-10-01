import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ELIGIBILITY_ROLES,
  FIELD_TYPES,
  FieldType,
  LookupItem,
  RecordStatus,
  ProfileField,
  ProfileForm,
  ProfileSection,
  activeFieldCount,
  cloneProfileForm,
  fieldTypeHasOptions,
  profileFieldCount,
} from '../../core/models';
import { ProfileFormService } from '../../core/services/academics.service';
import { LookupService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { DynamicFormComponent } from '../../shared/components/dynamic-form.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { StatusToggleComponent } from '../../shared/components/status-toggle.component';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'subCategoryName', header: 'Sub-category', sortable: true, variant: 'primary' },
  { key: 'categoryName', header: 'Category', variant: 'muted' },
  { key: 'version', header: 'Version', align: 'center', width: '100px' },
  { key: 'summary', header: 'Structure', width: '230px' },
  /* Whether a submission is read before the programs open. On the list
     rather than only inside the designer, because it decides what happens
     to every applicant who fills the form in and is the one setting
     somebody would otherwise have to open each form to check. */
  { key: 'scrutiny', header: 'Scrutiny', width: '150px' },
  { key: 'status', header: 'Status', width: '110px' },
  { key: 'actions', header: '', width: '175px', align: 'right' },
];

let localId = 10_000;
const nextLocalId = () => ++localId;

function blankField(): ProfileField {
  return {
    id: nextLocalId(),
    key: '',
    label: '',
    type: 'text',
    isEnabled: true,
    displayOrder: 0,
    colSpan: 1,
    options: [],
    validation: { required: false },
  };
}

@Component({
  selector: 'app-profile-forms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CanDirective,
    ReactiveFormsModule,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    StatusToggleComponent,
    ModalComponent,
    DynamicFormComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.profileForms.title')"
      [subtitle]="copy.text('page.profileForms.subtitle')"
      icon="form"
      [breadcrumbs]="[{ label: 'Program setup' }, { label: copy.text('page.profileForms.title') }]"
    >
      <button *appCan="'masters.manage'" type="button" class="btn btn--primary" (click)="openBuilder()">
        <app-icon name="plus" [size]="15" /> New form
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar filter-bar--inline">
          <div class="field">
            <label class="field-label" for="rfSearch">Search</label>
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input id="rfSearch" class="input" placeholder="Program type" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="rfCategory">Category</label>
            <select
              id="rfCategory"
              class="select"
              [value]="filterCategoryId() ?? ''"
              (change)="onCategoryFilter($event)"
            >
              <option value="">All categories</option>
              @for (category of categories(); track category.id) {
                <option [value]="category.id">{{ category.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="rfSubCategory">Sub-category</label>
            <select
              id="rfSubCategory"
              class="select"
              [value]="filterSubCategoryId() ?? ''"
              (change)="onSubCategoryFilter($event)"
            >
              <option value="">All sub-categories</option>
              @for (sub of filterSubCategories(); track sub.id) {
                <option [value]="sub.id">{{ sub.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="rfStatus">Status</label>
            <select id="rfStatus" class="select" (change)="list.setFilter('status', value($event))">
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div class="filter-bar__actions">
            <button type="button" class="btn btn--ghost" (click)="resetFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          </div>
        </div>
      </div>

      <app-data-table
        exportName="Profile forms"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No profile forms"
        emptyIcon="form"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="summary" let-row>
          <div class="row row-sm row-wrap">
            <span class="chip">{{ $any(row).sections.length }} sections</span>
            <span class="chip">{{ fieldCount($any(row)) }} fields</span>
            <span class="chip">{{ activeCount($any(row)) }} active</span>
          </div>
        </ng-template>
        <ng-template appCell="scrutiny" let-row>
          @if ($any(row).requiresScrutiny ?? true) {
            <span class="chip">Read before opening</span>
          } @else {
            <span class="chip chip--muted">Accepted as it arrives</span>
          }
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <button type="button" class="btn btn--icon" title="Preview as applicant" (click)="previewOf.set($any(row))">
              <app-icon name="eye" [size]="15" />
            </button>
            <button type="button" class="btn btn--icon" title="Replicate to another program type" (click)="openReplicate($any(row))">
              <app-icon name="copy" [size]="15" />
            </button>
            <button type="button" class="btn btn--icon" title="Design" (click)="openBuilder($any(row))">
              <app-icon name="sliders" [size]="15" />
            </button>
            <app-status-toggle [status]="$any(row).status" (toggled)="setStatus($any(row), $event)" />
          </div>
        </ng-template>
      </app-data-table>
    </section>

    <!-- ---------------- Builder ---------------- -->
    @if (builderOpen()) {
      <app-modal
        [title]="editing() ? 'Design profile form' : 'New profile form'"
        [subtitle]="enabledFieldCount() + ' active of ' + totalFieldCount() + ' fields · ' + sections().length + ' sections'"
        size="xl"
        (closed)="closeBuilder()"
      >
        <div class="tabs mb-md">
          <button type="button" class="tab" [class.is-active]="builderTab() === 'design'" (click)="builderTab.set('design')">
            Design
          </button>
          <button type="button" class="tab" [class.is-active]="builderTab() === 'preview'" (click)="builderTab.set('preview')">
            Applicant preview
          </button>
        </div>

        @if (builderTab() === 'design') {
          <form [formGroup]="headerForm" id="reg-form" (ngSubmit)="save()" class="form-grid form-grid--3 mb-md">
            <div class="field">
              <label class="field-label" for="rfType">Sub-category <span class="req">*</span></label>
              <select id="rfType" class="select" formControlName="subCategoryId">
                <option [ngValue]="null">Select sub-category</option>
                @for (subCategory of allSubCategories(); track subCategory.id) {
                  <option [ngValue]="subCategory.id">{{ subCategory.name }}</option>
                }
              </select>
              <span class="field-hint">
                One active form per sub-category. Every program under it asks the same
                questions, and the applicant answers them once.
              </span>
            </div>
            <div class="field">
              <label class="field-label" for="rfVersion">Version</label>
              <input id="rfVersion" class="input" formControlName="version" />
            </div>
            <div class="field field--span-2">
              <label class="check">
                <input type="checkbox" formControlName="requiresScrutiny" />
                <span>Read this profile before the programs open</span>
              </label>
              <span class="field-hint">
                @if (headerForm.controls.requiresScrutiny.value) {
                  A submission joins the scrutiny queue, and the programs under this
                  sub-category stay shut until somebody accepts it.
                } @else {
                  Accepted as it arrives. The applicant fills the form and goes straight on
                  to apply — for a discipline that asks only for things nobody verifies, a
                  queue of submissions to rubber-stamp helps no one.
                }
              </span>
            </div>

            <div class="field">
              <label class="field-label" for="rfStatusSel">Status</label>
              <select id="rfStatusSel" class="select" formControlName="status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </form>

          <div class="row row-between mb-sm">
            <strong class="text-md">Sections</strong>
            <div class="btn-row">
              @if (list.rows().length) {
                <button type="button" class="btn btn--sm btn--secondary" (click)="copyFromOpen.set(true)">
                  <app-icon name="copy" [size]="14" /> Copy from existing form
                </button>
              }
              <button type="button" class="btn btn--sm btn--primary" (click)="addSection()">
                <app-icon name="plus" [size]="14" /> Add section
              </button>
            </div>
          </div>

          <div class="stack stack-md">
            @for (section of sections(); track section.id; let si = $index) {
              <fieldset class="section-box" [class.is-off]="!section.isEnabled">
                <div class="section-box__head">
                  <span class="section-box__index">{{ si + 1 }}</span>
                  <input
                    class="input"
                    [value]="section.title"
                    placeholder="Section title"
                    (input)="patchSection(si, { title: inputValue($event) })"
                  />
                  <div class="btn-row">
                    <button type="button" class="btn btn--icon" title="Move up" [disabled]="si === 0" (click)="moveSection(si, -1)">
                      <app-icon name="chevron-up" [size]="15" />
                    </button>
                    <button type="button" class="btn btn--icon" title="Move down" [disabled]="si === sections().length - 1" (click)="moveSection(si, 1)">
                      <app-icon name="chevron-down" [size]="15" />
                    </button>
                    <label class="switch" [title]="section.isEnabled ? 'Disable section' : 'Enable section'">
                      <input type="checkbox" [checked]="section.isEnabled" (change)="patchSection(si, { isEnabled: checked($event) })" />
                      <span class="switch-track"></span>
                    </label>
                    <button type="button" class="btn btn--icon is-danger" title="Remove section" (click)="removeSection(si)">
                      <app-icon name="trash" [size]="15" />
                    </button>
                  </div>
                </div>
                <input
                  class="input"
                  [value]="section.description || ''"
                  placeholder="Helper text shown above the section"
                  (input)="patchSection(si, { description: inputValue($event) })"
                />

                <div class="repeat-box">
                  <label class="check">
                    <input
                      type="checkbox"
                      [checked]="!!section.isRepeatable"
                      (change)="setRepeatable(si, checked($event))"
                    />
                    <span>The applicant can add more than one</span>
                  </label>

                  @if (section.isRepeatable) {
                    <div class="repeat-box__settings">
                      <div class="field">
                        <label class="field-label">Each one is called</label>
                        <input
                          class="input"
                          maxlength="80"
                          [value]="section.itemLabel || ''"
                          [placeholder]="section.title"
                          (input)="patchSection(si, { itemLabel: inputValue($event) })"
                        />
                      </div>
                      <div class="field">
                        <label class="field-label">At least</label>
                        <input
                          type="number"
                          class="input"
                          min="0"
                          max="50"
                          [value]="section.minEntries ?? 1"
                          (input)="patchSection(si, { minEntries: entryCount($event, 0) })"
                        />
                      </div>
                      <div class="field">
                        <label class="field-label">At most</label>
                        <input
                          type="number"
                          class="input"
                          min="1"
                          max="50"
                          [value]="section.maxEntries ?? 10"
                          (input)="patchSection(si, { maxEntries: entryCount($event, 1) })"
                        />
                      </div>
                    </div>
                    <p class="text-muted text-xs">
                      The applicant fills {{ entryNoun(section) }} up to
                      {{ section.maxEntries ?? 10 }} times, with an
                      "Add {{ entryNoun(section).toLowerCase() }}" button under the last one.
                      @if (section.key) {
                        Answers are kept as a list under <code>{{ section.key }}</code>.
                      }
                    </p>
                  }
                </div>

                <div class="table-wrap mt-sm">
                  <table class="table table--compact">
                    <thead>
                      <tr>
                        <th style="width: 60px" class="text-center">On</th>
                        <th style="width: 170px">Key</th>
                        <th>Label</th>
                        <th style="width: 150px">Type</th>
                        <th style="width: 90px" class="text-center">Required</th>
                        <th style="width: 80px">Width</th>
                        <th style="width: 120px" class="text-right"></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (fieldRow of section.fields; track fieldRow.id; let fi = $index) {
                        <tr [class.is-off]="!fieldRow.isEnabled">
                          <td class="text-center">
                            <label class="switch">
                              <input type="checkbox" [checked]="fieldRow.isEnabled" (change)="patchField(si, fi, { isEnabled: checked($event) })" />
                              <span class="switch-track"></span>
                            </label>
                          </td>
                          <td>
                            <input class="input" [value]="fieldRow.key" placeholder="firstName" (input)="patchField(si, fi, { key: inputValue($event) })" />
                          </td>
                          <td>
                            <input class="input" [value]="fieldRow.label" placeholder="First name" (input)="patchField(si, fi, { label: inputValue($event) })" />
                          </td>
                          <td>
                            <select class="select" (change)="changeType(si, fi, $event)">
                              @for (type of fieldTypes; track type.value) {
                                <option [value]="type.value" [selected]="type.value === fieldRow.type">
                                  {{ type.label }}
                                </option>
                              }
                            </select>
                          </td>
                          <td class="text-center">
                            <input
                              type="checkbox"
                              [checked]="fieldRow.validation.required"
                              (change)="patchValidation(si, fi, { required: checked($event) })"
                            />
                          </td>
                          <td>
                            <select class="select" (change)="patchField(si, fi, { colSpan: inputValue($event) === '2' ? 2 : 1 })">
                              <option value="1" [selected]="fieldRow.colSpan === 1">Half</option>
                              <option value="2" [selected]="fieldRow.colSpan === 2">Full</option>
                            </select>
                          </td>
                          <td class="text-right">
                            <div class="btn-row btn-row--end">
                              <button type="button" class="btn btn--icon" title="Field settings" (click)="openFieldEditor(si, fi)">
                                <app-icon name="settings" [size]="15" />
                              </button>
                              <button type="button" class="btn btn--icon" title="Move up" [disabled]="fi === 0" (click)="moveField(si, fi, -1)">
                                <app-icon name="chevron-up" [size]="15" />
                              </button>
                              <button type="button" class="btn btn--icon is-danger" title="Remove field" (click)="removeField(si, fi)">
                                <app-icon name="x" [size]="15" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <button type="button" class="btn btn--ghost btn--sm mt-sm" (click)="addField(si)">
                  <app-icon name="plus" [size]="14" /> Add field
                </button>
              </fieldset>
            } @empty {
              <div class="alert alert--info">
                <app-icon name="info" [size]="16" />
                <span>Add a section, or copy the layout from a form you have already built.</span>
              </div>
            }
          </div>
        } @else {
          <!-- What the applicant is told before they start, which depends on
               the scrutiny setting. Shown here so the preview is a preview of
               the screen rather than only of its boxes. -->
          <p class="text-muted text-sm mb-md">
            @if (headerForm.controls.requiresScrutiny.value) {
              The applicant is told this is asked once for the sub-category, that it goes
              to scrutiny, and that the programs open once it has been accepted.
            } @else {
              The applicant is told the programs open as soon as they send it, and the
              button reads &ldquo;Submit and open my programs&rdquo; rather than
              &ldquo;Send for scrutiny&rdquo;.
            }
          </p>

          @if (previewDefinition(); as definition) {
            <app-dynamic-form [definition]="definition" [readonly]="false" />
          }
        }

        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeBuilder()">Cancel</button>
          <button type="submit" form="reg-form" class="btn btn--primary" [disabled]="saving()" (click)="save()">
            @if (saving()) { <span class="spinner"></span> }
            Save form
          </button>
        </div>
      </app-modal>
    }

    <!-- ---------------- Field settings ---------------- -->
    @if (fieldEditor(); as editor) {
      <app-modal
        title="Field settings"
        [subtitle]="editor.field.label || editor.field.key || 'New field'"
        size="md"
        (closed)="fieldEditor.set(null)"
      >
        <div class="stack stack-md">
          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="feKey">Key <span class="req">*</span></label>
              <input id="feKey" class="input" [value]="editor.field.key" (input)="editField({ key: inputValue($event) })" />
              <span class="field-hint">Stored against the applicant's answer. Keep it stable.</span>
            </div>
            <div class="field">
              <label class="field-label" for="feLabel">Label <span class="req">*</span></label>
              <input id="feLabel" class="input" [value]="editor.field.label" (input)="editField({ label: inputValue($event) })" />
            </div>
            <div class="field">
              <label class="field-label" for="fePlaceholder">Placeholder</label>
              <input id="fePlaceholder" class="input" [value]="editor.field.placeholder || ''" (input)="editField({ placeholder: inputValue($event) })" />
            </div>
            <div class="field">
              <label class="field-label" for="feHelp">Help text</label>
              <input id="feHelp" class="input" [value]="editor.field.helpText || ''" (input)="editField({ helpText: inputValue($event) })" />
            </div>

            <!-- ----------------------------------------- eligibility ----
                 A program type states a minimum qualification and
                 experience. This is how the system knows which answer to
                 measure against it, rather than guessing from the key. -->
            <div class="field field--span-2">
              <label class="field-label" for="feRole">This answer is</label>
              <select
                id="feRole"
                class="select"
                (change)="editField({ eligibilityRole: $any(inputValue($event)) })"
              >
                @for (role of eligibilityRoles; track role.value) {
                  <option
                    [value]="role.value"
                    [selected]="(editor.field.eligibilityRole ?? 'None') === role.value"
                  >
                    {{ role.label }}
                  </option>
                }
              </select>
              <span class="field-hint">
                Pointed at a qualification or a number of years, this answer decides which
                programs an applicant is eligible for once their profile is accepted. Only one
                field can hold each, and neither can sit in a repeating section.
              </span>
            </div>
          </div>

          @if (editorHasOptions()) {
            <div class="field">
              <label class="field-label" for="feOptions">Options</label>
              <textarea
                id="feOptions"
                class="textarea"
                [value]="optionText()"
                placeholder="One option per line"
                (input)="setOptions(inputValue($event))"
              ></textarea>
              <span class="field-hint">One option per line. The stored value is derived from the label.</span>
            </div>
          }

          <div class="divider"></div>
          <strong class="text-sm">Validation</strong>
          <div class="form-grid">
            <div class="field">
              <label class="check">
                <input type="checkbox" [checked]="editor.field.validation.required" (change)="editValidation({ required: checked($event) })" />
                <span>Mandatory field</span>
              </label>
            </div>
            <div class="field">
              <label class="field-label" for="fePattern">Pattern (regex)</label>
              <input id="fePattern" class="input" [value]="editor.field.validation.pattern || ''" (input)="editValidation({ pattern: inputValue($event) })" />
            </div>
            @if (isTextual()) {
              <div class="field">
                <label class="field-label" for="feMinLen">Minimum length</label>
                <input id="feMinLen" type="number" class="input" [value]="editor.field.validation.minLength ?? ''" (input)="editValidation({ minLength: numberValue($event) })" />
              </div>
              <div class="field">
                <label class="field-label" for="feMaxLen">Maximum length</label>
                <input id="feMaxLen" type="number" class="input" [value]="editor.field.validation.maxLength ?? ''" (input)="editValidation({ maxLength: numberValue($event) })" />
              </div>
            }
            @if (editor.field.type === 'number') {
              <div class="field">
                <label class="field-label" for="feMin">Minimum value</label>
                <input id="feMin" type="number" class="input" [value]="editor.field.validation.min ?? ''" (input)="editValidation({ min: numberValue($event) })" />
              </div>
              <div class="field">
                <label class="field-label" for="feMax">Maximum value</label>
                <input id="feMax" type="number" class="input" [value]="editor.field.validation.max ?? ''" (input)="editValidation({ max: numberValue($event) })" />
              </div>
            }
            @if (editor.field.type === 'photos') {
              <div class="field field--span-2">
                <label class="field-label" for="fePhotos">How many pictures</label>
                <input
                  id="fePhotos"
                  type="number"
                  min="1"
                  max="20"
                  class="input"
                  [value]="editor.field.validation.maxPhotos ?? ''"
                  (input)="editValidation({ maxPhotos: numberValue($event) })"
                />
                <span class="field-hint">
                  The applicant takes up to this many with the camera, and they are served
                  back as one PDF in the order taken. Left blank, five.
                </span>
              </div>
            }
            @if (editor.field.type === 'file') {
              <div class="field">
                <label class="field-label" for="feExt">Allowed extensions</label>
                <input id="feExt" class="input" [value]="(editor.field.validation.allowedExtensions || []).join(', ')" placeholder="pdf, jpg, png" (input)="setExtensions(inputValue($event))" />
              </div>
              <div class="field">
                <label class="field-label" for="feSize">Maximum size (MB)</label>
                <input id="feSize" type="number" class="input" [value]="editor.field.validation.maxFileSizeMb ?? ''" (input)="editValidation({ maxFileSizeMb: numberValue($event) })" />
              </div>
            }
          </div>

          <div class="divider"></div>
          <strong class="text-sm">Conditional visibility</strong>
          <p class="text-xs text-muted">Show this field only when another answer matches.</p>
          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="feWhenKey">Depends on field</label>
              <select id="feWhenKey" class="select" (change)="editField({ visibleWhenFieldKey: inputValue($event) || null })">
                <option value="" [selected]="!editor.field.visibleWhenFieldKey">Always visible</option>
                @for (candidate of otherFieldKeys(); track candidate) {
                  <option [value]="candidate" [selected]="candidate === editor.field.visibleWhenFieldKey">
                    {{ candidate }}
                  </option>
                }
              </select>
            </div>
            <div class="field">
              <label class="field-label" for="feWhenValues">Visible when value is</label>
              <input
                id="feWhenValues"
                class="input"
                [value]="(editor.field.visibleWhenValues || []).join(', ')"
                placeholder="true, yes"
                (input)="setVisibleValues(inputValue($event))"
              />
            </div>
          </div>
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="fieldEditor.set(null)">Close</button>
          <button type="button" class="btn btn--primary" (click)="fieldEditor.set(null)">Done</button>
        </div>
      </app-modal>
    }

    <!-- ---------------- Copy layout from an existing form ---------------- -->
    @if (copyFromOpen()) {
      <app-modal title="Copy layout from an existing form" size="sm" (closed)="copyFromOpen.set(false)">
        <div class="field">
          <label class="field-label" for="copySource">Source form</label>
          <select id="copySource" class="select" (change)="copySourceId.set(+inputValue($event))">
            <option value="">Select a form</option>
            @for (form of list.rows(); track form.id) {
              <option [value]="form.id" [selected]="form.id === copySourceId()">
                {{ form.subCategoryName }} · {{ form.version }}
              </option>
            }
          </select>
          <span class="field-hint">Every section and field is copied. You can then edit or switch off what does not apply.</span>
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="copyFromOpen.set(false)">Cancel</button>
          <button type="button" class="btn btn--primary" [disabled]="!copySourceId()" (click)="applyCopy()">
            Copy layout
          </button>
        </div>
      </app-modal>
    }

    <!-- ---------------- Replicate whole form ---------------- -->
    @if (replicateFrom(); as source) {
      <app-modal
        title="Replicate profile form"
        [subtitle]="'From ' + source.subCategoryName"
        size="sm"
        (closed)="replicateFrom.set(null)"
      >
        <div class="stack stack-md">
          <div class="alert alert--info">
            <app-icon name="info" [size]="16" />
            <span>
              {{ fieldCount(source) }} fields across {{ source.sections.length }} sections will be
              copied to the selected program type.
            </span>
          </div>
          <div class="field">
            <label class="field-label" for="repTarget">Target program type <span class="req">*</span></label>
            <select id="repTarget" class="select" (change)="replicateTargetId.set(+inputValue($event))">
              <option value="">Select program type</option>
              @for (programType of replicableTargets(); track programType.id) {
                <option [value]="programType.id" [selected]="programType.id === replicateTargetId()">
                  {{ programType.name }}
                </option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="repVersion">Version</label>
            <input id="repVersion" class="input" [value]="replicateVersion()" (input)="replicateVersion.set(inputValue($event))" />
          </div>
        </div>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="replicateFrom.set(null)">Cancel</button>
          <button type="button" class="btn btn--primary" [disabled]="!replicateTargetId() || saving()" (click)="replicate()">
            @if (saving()) { <span class="spinner"></span> }
            Replicate
          </button>
        </div>
      </app-modal>
    }

    <!-- ---------------- Read-only preview ---------------- -->
    @if (previewOf(); as preview) {
      <app-modal
        title="Applicant view"
        [subtitle]="preview.subCategoryName + ' · ' + preview.version"
        size="xl"
        (closed)="previewOf.set(null)"
      >
        <app-dynamic-form [definition]="preview" [readonly]="true" [preview]="true" />
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="previewOf.set(null)">Close</button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .section-box {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        padding: 0.85rem;
        margin: 0;
        background: var(--surface-muted);
      }
      .section-box.is-off { opacity: 0.6; }
      .section-box__head {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
      }
      .section-box__index {
        width: 24px;
        height: 24px;
        flex: none;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: var(--brand-600);
        color: #fff;
        font-size: var(--fs-xs);
        font-weight: 700;
      }
      .repeat-box {
        margin-top: 0.5rem;
        padding: 0.55rem 0.7rem;
        border: 1px dashed var(--border-strong);
        border-radius: var(--radius-sm, 6px);
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .repeat-box__settings {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
        gap: 0.6rem;
      }
      @media (max-width: 640px) {
        .repeat-box__settings { grid-template-columns: minmax(0, 1fr); }
      }
      .table { background: var(--surface); }
      .table .input,
      .table .select { font-size: var(--fs-sm); padding: 0.3rem 0.45rem; }
      .table .select { padding-right: 1.6rem; }
      tr.is-off td { opacity: 0.5; }
    `,
  ],
})
export class ProfileFormsComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(ProfileFormService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly fieldTypes = FIELD_TYPES;
  protected readonly fieldCount = profileFieldCount;
  protected readonly activeCount = activeFieldCount;
  protected readonly term = searchTerm;
  protected readonly value = (event: Event) => (event.target as HTMLSelectElement).value;

  protected readonly programTypes = toSignal(this.lookups.programTypes(null), {
    initialValue: [] as LookupItem[],
  });

  protected readonly categories = toSignal(this.lookups.categories(), {
    initialValue: [] as LookupItem[],
  });
  protected readonly allSubCategories = toSignal(this.lookups.subCategories(null), {
    initialValue: [] as LookupItem[],
  });

  protected readonly list = new ListState<ProfileForm>((request) => this.service.list(request), {
    sortBy: 'subCategoryName',
  });

  /* ------------------------------------------------------- list filters ----
     The three narrow each other through the masters, so a sub-category cannot
     stay selected under a category it does not belong to. */
  protected readonly filterCategoryId = signal<number | null>(null);
  protected readonly filterSubCategoryId = signal<number | null>(null);
  protected readonly filterSubCategories = computed(() => {
    const category = this.filterCategoryId();
    const all = this.allSubCategories();
    return category === null ? all : all.filter((sc) => sc.parentId === category);
  });

  protected onCategoryFilter(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.filterCategoryId.set(raw ? Number(raw) : null);
    this.filterSubCategoryId.set(null);
    this.list.setFilter('categoryId', raw || null);
    this.list.setFilter('subCategoryId', null);
  }

  protected onSubCategoryFilter(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.filterSubCategoryId.set(raw ? Number(raw) : null);
    this.list.setFilter('subCategoryId', raw || null);
  }

  protected resetFilters(): void {
    this.filterCategoryId.set(null);
    this.filterSubCategoryId.set(null);
    this.list.clearFilters();
  }

  /* ---------------- builder state ---------------- */
  protected readonly builderOpen = signal(false);
  protected readonly builderTab = signal<'design' | 'preview'>('design');
  protected readonly saving = signal(false);
  protected readonly editing = signal<ProfileForm | null>(null);
  protected readonly sections = signal<ProfileSection[]>([]);

  protected readonly headerForm = this.fb.group({
    subCategoryId: [null as number | null, Validators.required],
    requiresScrutiny: [true],
    version: ['v1.0'],
    status: ['Active'],
  });

  protected readonly totalFieldCount = computed(() =>
    this.sections().reduce((n, s) => n + s.fields.length, 0),
  );
  protected readonly enabledFieldCount = computed(() =>
    this.sections()
      .filter((s) => s.isEnabled)
      .reduce((n, s) => n + s.fields.filter((f) => f.isEnabled).length, 0),
  );

  /** Live definition fed to the preview tab. */
  protected readonly previewDefinition = computed<ProfileForm>(() => ({
    id: this.editing()?.id ?? 0,
    subCategoryId: this.headerForm.value.subCategoryId ?? 0,
    subCategoryName: this.allSubCategories()
      .find((sc) => sc.id === this.headerForm.value.subCategoryId)?.name,
    version: this.headerForm.value.version ?? 'v1.0',
    status: (this.headerForm.value.status as RecordStatus) ?? 'Active',
    sections: this.sections(),
  }));

  /* ---------------- dialogs ---------------- */
  protected readonly previewOf = signal<ProfileForm | null>(null);
  protected readonly copyFromOpen = signal(false);
  protected readonly copySourceId = signal<number | null>(null);
  protected readonly replicateFrom = signal<ProfileForm | null>(null);
  protected readonly replicateTargetId = signal<number | null>(null);
  protected readonly replicateVersion = signal('v1.0');
  protected readonly fieldEditor = signal<{
    sectionIndex: number;
    fieldIndex: number;
    field: ProfileField;
  } | null>(null);

  protected readonly replicableTargets = computed(() => {
    const sourceId = this.replicateFrom()?.subCategoryId;
    return this.allSubCategories().filter((sc) => sc.id !== sourceId);
  });

  protected readonly eligibilityRoles = ELIGIBILITY_ROLES;

  protected readonly editorHasOptions = computed(() => {
    const editor = this.fieldEditor();
    return !!editor && fieldTypeHasOptions(editor.field.type);
  });

  protected readonly isTextual = computed(() => {
    const type = this.fieldEditor()?.field.type;
    return type === 'text' || type === 'textarea' || type === 'email';
  });

  protected readonly optionText = computed(() =>
    (this.fieldEditor()?.field.options ?? []).map((o) => o.label).join('\n'),
  );

  protected readonly otherFieldKeys = computed(() => {
    const editor = this.fieldEditor();
    if (!editor) return [];
    return this.sections()
      .flatMap((s) => s.fields)
      .filter((f) => f.key && f.id !== editor.field.id)
      .map((f) => f.key);
  });

  /* ---------------- small DOM helpers ---------------- */
  protected inputValue(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
  }

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected numberValue(event: Event): number | null {
    const raw = (event.target as HTMLInputElement).value;
    return raw === '' ? null : Number(raw);
  }

  /* ---------------- section & field editing ---------------- */
  protected addSection(): void {
    this.sections.update((list) => [
      ...list,
      {
        id: nextLocalId(),
        title: 'New section',
        description: '',
        displayOrder: list.length + 1,
        isEnabled: true,
        isRepeatable: false,
        minEntries: 1,
        maxEntries: 1,
        fields: [blankField()],
      },
    ]);
  }

  protected async removeSection(index: number): Promise<void> {
    const section = this.sections()[index];
    if (section.fields.length > 1) {
      const confirmed = await this.confirm.ask({
        title: 'Remove section?',
        message: `"${section.title}" and its ${section.fields.length} fields will be removed from the design.`,
        confirmLabel: 'Remove',
        tone: 'danger',
      });
      if (!confirmed) return;
    }
    this.sections.update((list) => list.filter((_, i) => i !== index));
  }

  protected moveSection(index: number, delta: number): void {
    this.sections.update((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, displayOrder: i + 1 }));
    });
  }

  protected patchSection(index: number, patch: Partial<ProfileSection>): void {
    this.sections.update((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  /** Turning repetition on gives the section the limits it has never had. */
  protected setRepeatable(index: number, on: boolean): void {
    const section = this.sections()[index];
    this.patchSection(index, {
      isRepeatable: on,
      minEntries: on ? (section.minEntries ?? 1) : 1,
      maxEntries: on && (section.maxEntries ?? 0) > 1 ? section.maxEntries : on ? 10 : 1,
    });
  }

  /** What one entry is called, falling back to the section's own title. */
  protected entryNoun(section: ProfileSection): string {
    return section.itemLabel?.trim() || section.title || 'entry';
  }

  /** A count the server will accept, whatever gets typed into the box. */
  protected entryCount(event: Event, floor: number): number {
    const typed = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(typed)) return floor;
    return Math.min(50, Math.max(floor, Math.trunc(typed)));
  }

  protected addField(sectionIndex: number): void {
    this.sections.update((list) =>
      list.map((s, i) => (i === sectionIndex ? { ...s, fields: [...s.fields, blankField()] } : s)),
    );
  }

  protected removeField(sectionIndex: number, fieldIndex: number): void {
    this.sections.update((list) =>
      list.map((s, i) =>
        i === sectionIndex ? { ...s, fields: s.fields.filter((_, f) => f !== fieldIndex) } : s,
      ),
    );
  }

  protected moveField(sectionIndex: number, fieldIndex: number, delta: number): void {
    this.sections.update((list) =>
      list.map((s, i) => {
        if (i !== sectionIndex) return s;
        const fields = [...s.fields];
        const target = fieldIndex + delta;
        if (target < 0 || target >= fields.length) return s;
        [fields[fieldIndex], fields[target]] = [fields[target], fields[fieldIndex]];
        return { ...s, fields: fields.map((f, o) => ({ ...f, displayOrder: o + 1 })) };
      }),
    );
  }

  protected patchField(sectionIndex: number, fieldIndex: number, patch: Partial<ProfileField>): void {
    this.sections.update((list) =>
      list.map((s, i) =>
        i === sectionIndex
          ? { ...s, fields: s.fields.map((f, o) => (o === fieldIndex ? { ...f, ...patch } : f)) }
          : s,
      ),
    );
    const editor = this.fieldEditor();
    if (editor && editor.sectionIndex === sectionIndex && editor.fieldIndex === fieldIndex) {
      this.fieldEditor.set({ ...editor, field: { ...editor.field, ...patch } });
    }
  }

  protected patchValidation(
    sectionIndex: number,
    fieldIndex: number,
    patch: Partial<ProfileField['validation']>,
  ): void {
    const current = this.sections()[sectionIndex].fields[fieldIndex];
    this.patchField(sectionIndex, fieldIndex, {
      validation: { ...current.validation, ...patch },
    });
  }

  protected changeType(sectionIndex: number, fieldIndex: number, event: Event): void {
    const type = this.inputValue(event) as FieldType;
    const patch: Partial<ProfileField> = { type };
    if (!fieldTypeHasOptions(type)) patch.options = [];
    this.patchField(sectionIndex, fieldIndex, patch);
  }

  /* ---------------- field editor dialog ---------------- */
  protected openFieldEditor(sectionIndex: number, fieldIndex: number): void {
    this.fieldEditor.set({
      sectionIndex,
      fieldIndex,
      field: this.sections()[sectionIndex].fields[fieldIndex],
    });
  }

  protected editField(patch: Partial<ProfileField>): void {
    const editor = this.fieldEditor();
    if (!editor) return;
    this.patchField(editor.sectionIndex, editor.fieldIndex, patch);
  }

  protected editValidation(patch: Partial<ProfileField['validation']>): void {
    const editor = this.fieldEditor();
    if (!editor) return;
    this.patchValidation(editor.sectionIndex, editor.fieldIndex, patch);
  }

  protected setOptions(text: string): void {
    const options = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((label) => ({ value: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label }));
    this.editField({ options });
  }

  protected setExtensions(text: string): void {
    const allowedExtensions = text
      .split(',')
      .map((x) => x.trim().replace(/^\./, '').toLowerCase())
      .filter(Boolean);
    this.editValidation({ allowedExtensions });
  }

  protected setVisibleValues(text: string): void {
    const visibleWhenValues = text
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    this.editField({ visibleWhenValues });
  }

  /* ---------------- open / save ---------------- */
  protected openBuilder(row?: ProfileForm): void {
    this.editing.set(row ?? null);
    this.builderTab.set('design');
    this.headerForm.reset({
      subCategoryId: row?.subCategoryId ?? null,
      requiresScrutiny: row?.requiresScrutiny ?? true,
      version: row?.version ?? 'v1.0',
      status: row?.status ?? 'Active',
    });
    this.sections.set(
      row
        ? row.sections.map((section) => ({
            ...section,
            isEnabled: section.isEnabled ?? true,
            fields: section.fields.map((f) => ({ ...f, isEnabled: f.isEnabled ?? true })),
          }))
        : [],
    );
    if (!row) this.addSection();
    this.builderOpen.set(true);
  }

  protected closeBuilder(): void {
    this.builderOpen.set(false);
    this.editing.set(null);
  }

  protected applyCopy(): void {
    const source = this.list.rows().find((f) => f.id === this.copySourceId());
    if (!source) return;
    this.sections.set(
      source.sections.map((section) => ({
        ...section,
        id: nextLocalId(),
        isEnabled: section.isEnabled ?? true,
        fields: section.fields.map((f) => ({
          ...f,
          id: nextLocalId(),
          isEnabled: f.isEnabled ?? true,
          options: f.options.map((o) => ({ ...o })),
          validation: { ...f.validation },
        })),
      })),
    );
    this.copyFromOpen.set(false);
    this.toast.success('Layout copied', `${profileFieldCount(source)} fields brought across.`);
  }

  protected save(): void {
    if (this.headerForm.invalid) {
      this.headerForm.markAllAsTouched();
      this.toast.warning('Select a program type', 'A profile form always belongs to one track.');
      return;
    }
    const invalidField = this.sections()
      .flatMap((s) => s.fields)
      .find((f) => !f.key.trim() || !f.label.trim());
    if (invalidField) {
      this.toast.warning('Incomplete field', 'Every field needs a key and a label.');
      return;
    }

    this.saving.set(true);
    const raw = this.headerForm.getRawValue();
    const payload = {
      subCategoryId: raw.subCategoryId,
      requiresScrutiny: raw.requiresScrutiny,
      version: raw.version,
      status: raw.status,
      sections: this.sections().map((section, si) => ({
        ...section,
        displayOrder: si + 1,
        fields: section.fields.map((f, fi) => ({ ...f, displayOrder: fi + 1 })),
      })),
    };
    const current = this.editing();
    const request = current ? this.service.update(current.id, payload) : this.service.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Profile form saved', `${this.enabledFieldCount()} active fields.`);
        this.closeBuilder();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  /* ---------------- replicate ---------------- */
  protected openReplicate(row: ProfileForm): void {
    this.replicateFrom.set(row);
    this.replicateTargetId.set(null);
    this.replicateVersion.set(row.version);
  }

  protected replicate(): void {
    const source = this.replicateFrom();
    const targetId = this.replicateTargetId();
    if (!source || !targetId) return;
    this.saving.set(true);
    const payload = cloneProfileForm(source, targetId, this.replicateVersion());
    this.service.create(payload as unknown as Record<string, unknown>).subscribe({
      next: () => {
        this.saving.set(false);
        const target = this.allSubCategories().find((sc) => sc.id === targetId);
        this.toast.success('Form replicated', `Copied to ${target?.name ?? 'the selected track'}.`);
        this.replicateFrom.set(null);
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: ProfileForm, status: RecordStatus): Promise<void> {
    const verb = status === 'Active' ? 'Enable' : 'Disable';
    const confirmed = await this.confirm.ask({
      title: `${verb} profile form?`,
      message:
        status === 'Active'
          ? 'Applicants can submit against this form again.'
          : 'Applicants can no longer start a new application on this program type.',
      confirmLabel: verb,
      tone: status === 'Active' ? 'primary' : 'danger',
    });
    if (!confirmed) return;
    this.service.setStatus(row.id, status).subscribe(() => {
      this.toast.success(
        `Profile form ${status === 'Active' ? 'enabled' : 'disabled'}`,
        row.subCategoryName,
      );
      this.list.reload();
    });
  }
}
