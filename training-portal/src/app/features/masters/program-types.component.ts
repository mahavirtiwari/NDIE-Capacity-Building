import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CERTIFICATE_KIND_LABELS,
  CERTIFICATION_POLICIES,
  CertificateKind,
  CertificateTemplate,
  DELIVERY_MODES,
  EXAMINATION_KINDS,
  ExaminationKind,
  LookupItem,
  ProgramType,
  RecordStatus,
  examinesViva,
  examinesWritten,
  kindsForPolicy,
} from '../../core/models';
import { FeeService } from '../../core/services/academics.service';
import { LookupService, ProgramTypeService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { CascadeSelectComponent } from '../../shared/components/cascade-select.component';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { StatusToggleComponent } from '../../shared/components/status-toggle.component';
import {
  UppercaseDirective,
  describeError,
  formatValidator,
} from '../../core/validation/formats';
import { computeFeeTotals, type FeeStructure } from '../../core/models';
import { abbreviate, composeCode } from '../../core/validation/code-suggest';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  /* The code opens the configuration. It is the identity the system
     issued, and it saves a column whose button did nothing the code
     could not. */
  { key: 'code', header: 'Program type ID', sortable: true, width: '150px' },
  { key: 'name', header: 'Program type', sortable: true, variant: 'primary' },
  { key: 'categoryName', header: 'Category' },
  { key: 'subCategoryName', header: 'Sub-category' },
  { key: 'durationDays', header: 'Days', align: 'center', sortable: true, width: '80px' },
  { key: 'deliveryMode', header: 'Mode', width: '120px' },
  { key: 'status', header: 'Status', width: '110px' },
  { key: 'actions', header: '', width: '140px', align: 'right' },
];

/**
 * One way in, while it is being edited.
 *
 * Requirements are the text in the box rather than the lines it will
 * become: splitting on every keystroke would take the cursor with it the
 * moment somebody pressed Enter.
 */
interface WayDraft {
  qualificationCode: string;
  minExperienceYears: number;
  requirements: string;
}

@Component({
  selector: 'app-program-types',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    CanDirective,
    ReactiveFormsModule,
    UppercaseDirective,
    RouterLink,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    StatusBadgeComponent,
    StatusToggleComponent,
    ModalComponent,
    CascadeSelectComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.programTypes.title')"
      [subtitle]="copy.text('page.programTypes.subtitle')"
      icon="layers"
      [breadcrumbs]="[{ label: 'Program setup' }, { label: copy.text('page.programTypes.title') }]"
    >
      <button *appCan="'masters.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New program type
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input class="input" placeholder="Search program types" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="ptCategory">Category</label>
            <select
              id="ptCategory"
              class="select"
              [value]="filterCategoryId() ?? ''"
              (change)="onCategoryFilter($event)"
            >
              <option value="">All categories</option>
              @for (item of categories(); track item.id) {
                <option [value]="item.id">{{ item.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="ptSubCategory">Sub-category</label>
            <select
              id="ptSubCategory"
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
            <label class="field-label" for="ptMode">Delivery mode</label>
            <select id="ptMode" class="select"
              [value]="list.stagedValue('deliveryMode')"
              (change)="list.stageFilter('deliveryMode', value($event))"
            >
              <option value="">All modes</option>
              @for (mode of modes; track mode) {
                <option [value]="mode">{{ mode }}</option>
              }
            </select>
          </div>
          <!-- A register that can be switched off can be read by that:
               the three screens without this filter were the three where
               somebody had to scroll looking for the disabled ones. -->
          <div class="field">
            <label class="field-label" for="ptStatus">Status</label>
            <select id="ptStatus" class="select"
              [value]="list.stagedValue('status')"
              (change)="list.stageFilter('status', value($event))"
            >
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div class="filter-bar__actions">
            <button type="button" class="btn btn--primary" (click)="list.applyFilters()">
              <app-icon name="filter" [size]="15" /> Apply
            </button>
            <button type="button" class="btn btn--ghost" (click)="resetFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          </div>
        </div>
      </div>

      <app-data-table
        exportName="Program types"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No program types"
        emptyIcon="layers"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="deliveryMode" let-row>
          <app-status-badge [value]="$any(row).deliveryMode" />
        </ng-template>
        <!-- One button, not three chips. The chips said what was set but
             not what it was set to, so the row was wide and still sent you
             into the editor to find out. -->
        <ng-template appCell="code" let-row>
          <button type="button" class="cell-link tabular" (click)="showConfig($any(row))">
            {{ $any(row).code }}
          </button>
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <button *appCan="'masters.manage'" type="button" class="btn btn--icon" title="Edit" (click)="openForm($any(row))">
              <app-icon name="edit" [size]="15" />
            </button>
            <ng-container *appCan="'masters.manage'">
              <app-status-toggle
              [status]="$any(row).status"
              (toggled)="setStatus($any(row), $event)"
            />
            </ng-container>
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (configOf(); as row) {
      <app-modal
        [title]="row.name"
        subtitle="How this track is configured. Change any of it from Edit."
        size="md"
        (closed)="configOf.set(null)"
      >
        <div class="config">
          <!-- What it is. The sheet opened on the assessment, which is
               halfway through the story: where the track sits, what it is
               called and how long it runs were only on the register
               behind the dialog. -->
          <section class="panel panel--span">
            <h2 class="panel__head"><app-icon name="layers" [size]="14" /> The track</h2>
            <div class="panel__body">
              <div class="facts">
                <div class="fact">
                  <span class="fact__term">Code</span>
                  <span class="fact__value tabular">{{ row.code }}</span>
                </div>
                <div class="fact">
                  <span class="fact__term">Category</span>
                  <span class="fact__value">{{ row.categoryName || '—' }}</span>
                </div>
                <div class="fact">
                  <span class="fact__term">Sub-category</span>
                  <span class="fact__value">{{ row.subCategoryName || '—' }}</span>
                </div>
                <div class="fact">
                  <span class="fact__term">Status</span>
                  <span class="fact__value"><app-status-badge [value]="row.status" /></span>
                </div>
              </div>
              @if (row.shortDescription) {
                <p class="config__blurb">{{ row.shortDescription }}</p>
              }
            </div>
          </section>

          <section class="panel panel--span">
            <h2 class="panel__head"><app-icon name="calendar" [size]="14" /> How it runs</h2>
            <div class="panel__body">
              <div class="facts">
                <div class="fact">
                  <span class="fact__term">Duration</span>
                  <span class="fact__value tabular">
                    {{ row.durationDays }} {{ row.durationDays === 1 ? 'day' : 'days' }}
                  </span>
                </div>
                <div class="fact">
                  <span class="fact__term">Delivery mode</span>
                  <span class="fact__value">{{ row.deliveryMode }}</span>
                </div>
                <div class="fact">
                  <span class="fact__term">Smallest batch</span>
                  <span class="fact__value tabular">
                    @if (row.minParticipants > 0) {
                      {{ row.minParticipants }} participants
                    } @else {
                      <span class="text-muted">Not set</span>
                    }
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section class="panel">
            <h2 class="panel__head"><app-icon name="clipboard" [size]="14" /> Assessment</h2>
            <div class="panel__body">
              <div class="fact">
                <span class="fact__term">Examination</span>
                <span class="fact__value">
                  {{ row.evaluation.kindLabel || row.evaluation.kind }}
                  <!-- Marks only once there are some. A track whose paper has
                       not been set yet said "0 marks, pass 0", which reads as
                       a setting rather than as nothing set. -->
                  @if (row.evaluation.totalMarks > 0) {
                    <span class="text-xs text-muted tabular">
                      {{ row.evaluation.totalMarks }} marks, pass
                      {{ row.evaluation.overallPassMarks }}
                    </span>
                  } @else if (row.evaluation.kind !== 'None') {
                    <span class="text-xs text-muted">marks not set</span>
                  }
                </span>
              </div>

              <!-- The split is only worth printing where there is a split.
                   A written-only track said "60 marks, pass 42" twice over,
                   once as the examination and once as its only part. -->
              @if (splitWorthShowing(row)) {
                @if (row.evaluation.hasWritten && row.evaluation.writtenMarks > 0) {
                  <div class="fact">
                    <span class="fact__term">Written</span>
                    <span class="fact__value tabular">
                      {{ row.evaluation.writtenMarks }} marks, pass
                      {{ row.evaluation.writtenPassMarks }}
                    </span>
                  </div>
                }
                @if (row.evaluation.hasViva && row.evaluation.vivaMarks > 0) {
                  <div class="fact">
                    <span class="fact__term">Viva or practical</span>
                    <span class="fact__value tabular">
                      {{ row.evaluation.vivaMarks }} marks, pass
                      {{ row.evaluation.vivaPassMarks }}
                      @if (row.skillCount) {
                        <span class="text-xs text-muted">{{ row.skillCount }} skills</span>
                      }
                    </span>
                  </div>
                }
              }

              <div class="fact">
                <span class="fact__term">Sitting it</span>
                <span class="fact__value">
                  @if (row.isExamMandatory) {
                    <span class="chip chip--warn">Mandatory</span>
                  } @else {
                    <span class="chip chip--muted">Optional</span>
                  }
                </span>
              </div>
            </div>
          </section>

          <section class="panel">
            <h2 class="panel__head"><app-icon name="award" [size]="14" /> Certificate</h2>
            <div class="panel__body">
              <div class="fact">
                <span class="fact__term">Awarded to</span>
                <span class="fact__value">
                  {{ row.certificationPolicyLabel || row.certificationPolicy }}
                </span>
              </div>
              <div class="fact">
                <span class="fact__term">Valid for</span>
                <span class="fact__value tabular">{{ row.certificateValidityMonths }} months</span>
              </div>
              @if (row.certificateKinds.length) {
                <div class="fact">
                  <span class="fact__term">Kinds awarded</span>
                  <span class="fact__value">
                    <span class="chips">
                      @for (kind of row.certificateKinds; track kind) {
                        <span class="chip">{{ kind }}</span>
                      }
                    </span>
                  </span>
                </div>
              }
              <!-- Whether there is artwork to print on. A track that
                   certifies people and has no template is a gap somebody
                   finds on the day the first certificate is due. -->
              <div class="fact">
                <span class="fact__term">Artwork</span>
                <span class="fact__value">
                  @if (row.certificateTemplates.length) {
                    <span class="text-sm">
                      {{ row.certificateTemplates.length }}
                      {{ row.certificateTemplates.length === 1 ? 'template' : 'templates' }} uploaded
                    </span>
                  } @else if (row.certificationPolicy === 'None') {
                    <span class="text-sm text-muted">Not needed</span>
                  } @else {
                    <span class="chip chip--warn">None uploaded</span>
                  }
                </span>
              </div>
            </div>
          </section>

          <section class="panel">
            <h2 class="panel__head"><app-icon name="graduation" [size]="14" /> Who may apply</h2>
            <div class="panel__body">
              <!-- Where the track states more than one way in, the two
                   figures beneath are the lowest of them and saying both
                   would be saying it twice. -->
              @if (row.eligibilityRoutes?.length) {
                <ol class="ways">
                  @for (way of row.eligibilityRoutes; track way.qualificationCode) {
                    <li class="way">
                      <span class="way__head">{{ way.summary }}</span>
                      @if (way.requirements.length) {
                        <ul class="way__asks">
                          @for (ask of way.requirements; track ask) {
                            <li>{{ ask }}</li>
                          }
                        </ul>
                      }
                    </li>
                  }
                </ol>
                <span class="text-xs text-muted">
                  Any one of these is enough. What has to be produced is read with the
                  profile at scrutiny.
                </span>
              } @else {
                <div class="fact">
                  <span class="fact__term">Minimum qualification</span>
                  <span class="fact__value">
                    {{ row.minQualificationLabel || row.minQualification || 'Not specified' }}
                  </span>
                </div>
                <div class="fact">
                  <span class="fact__term">Minimum experience</span>
                  <span class="fact__value">
                    {{ row.minExperienceYears ? row.minExperienceYears + ' years' : 'None' }}
                  </span>
                </div>
              }
            </div>
          </section>

          <section class="panel">
            <h2 class="panel__head"><app-icon name="rupee" [size]="14" /> Fee</h2>
            <div class="panel__body">
              @if (!row.isFeeApplicable) {
                <div class="fact">
                  <span class="fact__term">On applying</span>
                  <span class="fact__value"><span class="chip chip--muted">Not applicable</span></span>
                </div>
              } @else if (feeLoading()) {
                <span class="text-sm text-muted">Reading the fee…</span>
              } @else if (fee(); as structure) {
                <div class="fact">
                  <span class="fact__term">Payable on applying</span>
                  <span class="fact__value">
                    <strong class="amount tabular">{{ feeTotals()!.gross | currency: 'INR' : 'symbol-narrow' : '1.0-2' }}</strong>
                  </span>
                </div>
                <!-- The parts, because a single figure with tax folded into
                     it is the one somebody queries. -->
                <div class="fact">
                  <span class="fact__term">Made up of</span>
                  <span class="fact__value text-sm">
                    {{ feeTotals()!.taxable + feeTotals()!.nonTaxable | currency: 'INR' : 'symbol-narrow' : '1.0-2' }}
                    @if (feeTotals()!.gst > 0) {
                      <span class="text-xs text-muted">
                        + {{ structure.gstPercent }}% GST
                        {{ feeTotals()!.gst | currency: 'INR' : 'symbol-narrow' : '1.0-2' }}
                      </span>
                    }
                  </span>
                </div>
                <div class="fact">
                  <span class="fact__term">Under</span>
                  <span class="fact__value text-sm">
                    {{ structure.title }}
                    <span class="text-xs text-muted">
                      from {{ structure.effectiveFrom | date: 'dd MMM yyyy' }}
                    </span>
                  </span>
                </div>
              } @else {
                <div class="fact">
                  <span class="fact__term">On applying</span>
                  <span class="fact__value">
                    <span class="chip chip--warn">Payable — none set</span>
                  </span>
                </div>
                <!-- Chargeable with no structure in force is a gap somebody
                     has to close, not a free programme. -->
                <span class="text-xs text-muted">
                  This type charges a fee but has no fee structure in force today.
                  Set one up under Fee structures.
                </span>
              }
            </div>
          </section>

          <!-- Who set it up and who last changed it. Every other sheet in
               the portal carries this, and a configuration is exactly the
               kind of thing somebody asks "who changed that" about. -->
          <section class="panel panel--span">
            <h2 class="panel__head"><app-icon name="clock" [size]="14" /> On the record</h2>
            <div class="panel__body">
              <div class="facts">
                <div class="fact">
                  <span class="fact__term">Created</span>
                  <span class="fact__value text-sm">
                    {{ (row.createdOn | date: 'dd MMM yyyy') || '—' }}
                    @if (row.createdBy) {
                      <span class="text-xs text-muted">by {{ row.createdBy }}</span>
                    }
                  </span>
                </div>
                <div class="fact">
                  <span class="fact__term">Last changed</span>
                  <span class="fact__value text-sm">
                    @if (row.modifiedOn) {
                      {{ row.modifiedOn | date: 'dd MMM yyyy' }}
                      @if (row.modifiedBy) {
                        <span class="text-xs text-muted">by {{ row.modifiedBy }}</span>
                      }
                    } @else {
                      <span class="text-muted">Not changed since</span>
                    }
                  </span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div footer>
          <button type="button" class="btn btn--secondary" (click)="configOf.set(null)">Close</button>
          <button type="button" class="btn btn--primary" (click)="editFromConfig(row)">
            <app-icon name="edit" [size]="15" /> Edit
          </button>
        </div>
      </app-modal>
    }

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit program type' : 'New program type'"
        subtitle="Eligibility and delivery settings applied to every batch of this track."
        size="lg"
        (closed)="closeForm()"
      >
        <form [formGroup]="form" id="pt-form" (ngSubmit)="save()" class="stack stack-md">
          <div class="form-grid">
            <app-cascade-select [group]="form" [showProgramType]="false" [required]="true" anyLabel="Select" />
          </div>
          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="ptName">Name <span class="req">*</span></label>
              <input id="ptName" class="input" formControlName="name" [class.is-invalid]="invalid('name')" />
            </div>
            <div class="field">
              <label class="field-label" for="ptCode">Code</label>
              <input id="ptCode" class="input" formControlName="code" appUppercase maxlength="20"
                [placeholder]="suggestedCode()" [class.is-invalid]="invalid('code')" />
              @if (invalid('code')) {
                <span class="field-error">{{ errorFor('code', 'Code') }}</span>
              } @else {
                <span class="field-hint">Leave blank and we'll generate it.</span>
              }
            </div>
            <div class="field field--span-2">
              <label class="field-label" for="ptDesc">Short description</label>
              <textarea id="ptDesc" class="textarea" formControlName="shortDescription"></textarea>
            </div>
            <div class="field">
              <label class="field-label" for="ptDays">Duration (days) <span class="req">*</span></label>
              <input id="ptDays" type="number" class="input" formControlName="durationDays" />
            </div>
            <div class="field">
              <label class="field-label" for="ptModeSel">Delivery mode</label>
              <select id="ptModeSel" class="select" formControlName="deliveryMode">
                @for (mode of modes; track mode) {
                  <option [value]="mode">{{ mode }}</option>
                }
              </select>
            </div>
            <!-- The single bar, where that is the whole rule. Taken from
                 the lowest way in as soon as any are listed, because the
                 public catalogue and the batch card have room for one line
                 and that line has to stay true. -->
            <div class="field">
              <label class="field-label" for="ptQual">Minimum educational qualification</label>
              <select id="ptQual" class="select" formControlName="minQualification"
                [attr.disabled]="ways().length ? '' : null">
                @for (level of qualifications(); track level.code) {
                  <option [value]="level.code">{{ level.name }}</option>
                }
              </select>
              @if (ways().length) {
                <span class="field-hint">Taken from the first way in below.</span>
              } @else {
                <span class="field-hint">
                  Not listed? Add it under
                  <a routerLink="/masters/qualifications">Qualifications</a>.
                </span>
              }
            </div>
            <div class="field">
              <label class="field-label" for="ptExp">Minimum experience (years)</label>
              <input id="ptExp" type="number" class="input" formControlName="minExperienceYears"
                [attr.disabled]="ways().length ? '' : null" />
              @if (ways().length) {
                <span class="field-hint">Taken from the first way in below.</span>
              }
            </div>

            <!-- More than one bar, where the scheme sets more than one.

                 "A graduate with five years, or a diploma holder with
                 eight" cannot be said in a single minimum: the lower
                 qualification carries the longer service precisely because
                 it is lower, and one pair of fields can only say the one
                 thing. An applicant has to satisfy any one row. -->
            <div class="field field--span-2">
              <span class="field-label">Ways in</span>
              <span class="field-hint">
                Leave empty and the single minimum above is the whole rule. List two or
                more and an applicant qualifies by satisfying any one of them.
              </span>

              @if (ways().length) {
                <div class="ways-editor">
                  @for (way of ways(); track $index) {
                    <div class="way-row">
                      <div class="way-row__field">
                        <label class="field-label" [attr.for]="'wayQual' + $index">
                          Qualification
                        </label>
                        <select [id]="'wayQual' + $index" class="select"
                          [value]="way.qualificationCode"
                          (change)="editWay($index, { qualificationCode: value($event) })"
                        >
                          @for (level of qualifications(); track level.code) {
                            <option [value]="level.code">{{ level.name }}</option>
                          }
                        </select>
                      </div>

                      <div class="way-row__field way-row__field--years">
                        <label class="field-label" [attr.for]="'wayExp' + $index">
                          Experience (years)
                        </label>
                        <input [id]="'wayExp' + $index" type="number" class="input"
                          min="0" max="60" [value]="way.minExperienceYears"
                          (input)="editWay($index, { minExperienceYears: +value($event) })"
                        />
                      </div>

                      <div class="way-row__field way-row__field--asks">
                        <label class="field-label" [attr.for]="'wayAsk' + $index">
                          Also has to produce
                        </label>
                        <textarea [id]="'wayAsk' + $index" class="textarea" rows="2"
                          placeholder="Lead auditor certificate&#10;Evidence of 25 mandays of assessment"
                          [value]="way.requirements"
                          (input)="editWay($index, { requirements: value($event) })"
                        ></textarea>
                        <span class="field-hint">One per line. Read at scrutiny, not by the listing.</span>
                      </div>

                      <button type="button" class="btn btn--icon btn--ghost way-row__drop"
                        title="Remove this way in" (click)="dropWay($index)">
                        <app-icon name="trash" [size]="15" />
                      </button>
                    </div>
                  }
                </div>
              }

              <div class="row row-sm">
                <button type="button" class="btn btn--secondary btn--sm" (click)="addWay()">
                  <app-icon name="plus" [size]="14" /> Add a way in
                </button>
              </div>

              @if (wayProblem(); as problem) {
                <span class="field-error">{{ problem }}</span>
              }
            </div>
            <div class="field">
              <label class="field-label" for="ptMinPax">Minimum participants</label>
              <input id="ptMinPax" type="number" class="input" min="0" max="10000"
                formControlName="minParticipants" />
              <span class="field-hint">
                The fewest a batch of this type is worth running for. The agency raising
                one sets the ceiling; this is the floor, and it cannot go under it.
                Leave at 0 for no floor.
              </span>
            </div>
            <div class="field">
              <label class="field-label" for="ptValidity">Certificate validity (months)</label>
              <input id="ptValidity" type="number" class="input" formControlName="certificateValidityMonths" />
            </div>
            <div class="field field--span-2">
              <label class="field-label" for="ptCert">What this program awards</label>
              <select id="ptCert" class="select" formControlName="certificationPolicy">
                @for (option of certificationPolicies; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
              <span class="field-hint">{{ policyHint() }}</span>
            </div>
            <div class="field">
              <label class="field-label" for="ptStatus">Status</label>
              <select id="ptStatus" class="select" formControlName="status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div class="field field--span-2">
              <span class="field-label">Options</span>
              <div class="row row-md row-wrap">
                <label class="check">
                  <input type="checkbox" formControlName="isFeeApplicable" />
                  <span>Fee is applicable</span>
                </label>
              </div>
              <span class="field-hint">
                Which forms an applicant fills, and whether they are scrutinised, is set on
                the sub-category — the questions belong to the discipline rather than to one
                course inside it.
              </span>
            </div>

            <!-- ------------------------------------------------ evaluation --
                 What is examined, out of how many marks, and what passes.
                 Whether an exam is mandatory follows from the choice rather
                 than being a separate tick, so the two cannot contradict. -->
            <div class="field field--span-2" formGroupName="evaluation">
              <span class="field-label">Evaluation</span>

              <select id="ptExamKind" class="select" formControlName="kind">
                @for (option of examinationKinds; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
              <span class="field-hint">{{ examHint() }}</span>

              @if (examKind() !== 'None') {
                <div class="marks-grid mt-sm">
                  @if (hasWritten()) {
                    <div class="field">
                      <label class="field-label" for="ptWritten">Written exam marks</label>
                      <input id="ptWritten" type="number" min="0" class="input"
                        formControlName="writtenMarks" />
                    </div>
                    <div class="field">
                      <label class="field-label" for="ptWrittenPass">Written minimum to pass</label>
                      <input id="ptWrittenPass" type="number" min="0" class="input"
                        formControlName="writtenPassMarks" />
                    </div>
                  }
                  @if (hasViva()) {
                    <div class="field">
                      <label class="field-label" for="ptViva">Viva / practical marks</label>
                      <input id="ptViva" type="number" min="0" class="input"
                        formControlName="vivaMarks" />
                    </div>
                    <div class="field">
                      <label class="field-label" for="ptVivaPass">Viva minimum to pass</label>
                      <input id="ptVivaPass" type="number" min="0" class="input"
                        formControlName="vivaPassMarks" />
                    </div>
                  }
                  <div class="field">
                    <label class="field-label" for="ptTotal">Total marks</label>
                    <input id="ptTotal" type="number" min="0" class="input"
                      formControlName="totalMarks" [placeholder]="sectionTotal()" />
                    <span class="field-hint">Leave blank and the sections are added up.</span>
                  </div>
                  <div class="field">
                    <label class="field-label" for="ptOverall">Overall minimum to pass</label>
                    <input id="ptOverall" type="number" min="0" class="input"
                      formControlName="overallPassMarks" />
                  </div>
                </div>

                @if (marksProblem(); as problem) {
                  <span class="field-error">{{ problem }}</span>
                } @else {
                  <span class="field-hint">
                    {{ marksSummary() }}
                  </span>
                }

                @if (hasViva() && editing(); as row) {
                  <div class="row row-sm mt-sm">
                    <a class="btn btn--ghost btn--sm"
                      [routerLink]="['/masters/evaluation-skills']"
                      [queryParams]="{ programTypeId: $any(row).id }">
                      <app-icon name="clipboard" [size]="15" />
                      {{ $any(row).skillCount }} skill{{ $any(row).skillCount === 1 ? '' : 's' }} to mark against
                    </a>
                  </div>
                }
              }
            </div>

            <!-- Templates hang off a saved programme type, so they appear once
                 there is a record to attach them to. -->
            @if (editing(); as row) {
              <div class="field field--span-2">
                <span class="field-label">Certificate templates</span>

                @if (templateKinds().length === 0) {
                  <span class="field-hint">
                    This programme awards no certificate, so there is nothing to upload.
                  </span>
                } @else {
                  <span class="field-hint">
                    The artwork each certificate is produced from — {{ templateFormats }}.
                  </span>

                  <div class="stack stack-sm mt-sm">
                    @for (kind of templateKinds(); track kind) {
                      <div class="tpl-row">
                        <div class="tpl-row__text">
                          <strong class="text-sm">{{ kindLabel(kind) }}</strong>
                          @if (templateFor(kind); as tpl) {
                            <span class="text-xs text-muted">
                              {{ tpl.fileName }} · {{ sizeOf(tpl.sizeBytes) }}
                            </span>
                          } @else {
                            <span class="text-xs text-muted">Not uploaded yet</span>
                          }
                        </div>

                        <div class="btn-row btn-row--end">
                          @if (templateFor(kind); as tpl) {
                            <a
                              class="btn btn--ghost btn--sm"
                              [href]="templateUrl(row.id, kind)"
                              target="_blank"
                              rel="noopener"
                              >View</a
                            >
                            <button
                              type="button"
                              class="btn btn--ghost btn--sm"
                              [disabled]="uploading() === kind"
                              (click)="removeTemplate(row.id, kind)"
                            >
                              Remove
                            </button>
                          }
                          @if (canUpload(kind)) {
                            <label class="btn btn--secondary btn--sm">
                              @if (uploading() === kind) { <span class="spinner"></span> }
                              {{ templateFor(kind) ? 'Replace' : 'Upload' }}
                              <input
                                type="file"
                                hidden
                                [accept]="templateAccept"
                                (change)="uploadTemplate(row.id, kind, $event)"
                              />
                            </label>
                          } @else {
                            <span class="text-xs text-muted">Save the change to upload</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="pt-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            {{ editing() ? 'Save changes' : 'Create program type' }}
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      /* The ways in, on the sheet: numbered, because "any one of these"
         is a list of alternatives and a bullet does not say that. */
      .ways {
        display: grid;
        gap: 0.5rem;
        margin: 0;
        padding-left: 1.1rem;
      }
      .way__head {
        font-size: var(--fs-base);
        color: var(--ink-900);
        font-weight: 600;
      }
      .way__asks {
        margin: 0.2rem 0 0;
        padding-left: 1rem;
        display: grid;
        gap: 0.1rem;
      }
      .way__asks li {
        font-size: var(--fs-sm);
        color: var(--ink-600);
      }

      /* And in the form: one row per way, the qualification and the years
         side by side with what has to be produced beneath them. */
      .ways-editor {
        display: grid;
        gap: 0.6rem;
        margin: 0.35rem 0 0.6rem;
      }
      .way-row {
        display: grid;
        grid-template-columns: minmax(160px, 1.1fr) 150px 1fr auto;
        gap: 0.6rem;
        align-items: start;
        padding: 0.7rem 0.8rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface-muted);
      }
      .way-row__field {
        display: grid;
        gap: 0.25rem;
        min-width: 0;
      }
      .way-row__drop {
        align-self: center;
        color: var(--danger-600);
      }
      @media (max-width: 860px) {
        .way-row {
          grid-template-columns: 1fr 1fr;
        }
        .way-row__field--asks {
          grid-column: 1 / -1;
        }
        .way-row__drop {
          grid-column: 2;
          justify-self: end;
        }
      }

      /* Two columns where the dialog is wide enough for them, one
         where it is not. The panels themselves are in the shared sheet. */
      .config {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 0.9rem;
      }
      /* The panels that describe the whole track rather than one corner
         of it run the width of the sheet. */
      .panel--span { grid-column: 1 / -1; }

      /* Facts side by side inside a full-width panel: four short ones
         stacked would make the header of the sheet taller than the
         assessment under it. */
      .facts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.6rem 1rem;
      }
      .config__blurb {
        margin: 0.65rem 0 0;
        font-size: var(--fs-sm);
        color: var(--ink-600);
        line-height: 1.5;
      }
      .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; }
      .amount { font-size: var(--fs-xl); color: var(--brand-700); }
      .chip.is-off { opacity: 0.4; text-decoration: line-through; }
      .marks-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      }
    `,
  ],
})
export class ProgramTypesComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(ProgramTypeService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly modes = DELIVERY_MODES;
  /* Ordered lowest to highest, straight from the server's catalogue, so the
     dropdown and the validation behind it cannot drift apart. */
  /**
   * The ways in, as the form holds them.
   *
   * Outside the reactive form on purpose: it is a list that grows and
   * shrinks, and a FormArray of three controls each would be more
   * plumbing than the three values are worth. Requirements are held as
   * the text in the box and split on save.
   */
  protected readonly ways = signal<WayDraft[]>([]);

  protected readonly qualifications = toSignal(this.lookups.qualifications(), {
    initialValue: [] as LookupItem[],
  });

  protected readonly categories = toSignal(this.lookups.categories(), { initialValue: [] as LookupItem[] });
  protected readonly list = new ListState<ProgramType>((request) => this.service.list(request), {
    sortBy: 'code',
  });

  protected readonly formOpen = signal(false);

  /** The row whose configuration is on screen, or null. */
  protected readonly configOf = signal<ProgramType | null>(null);

  /* The fee in force today for the type on screen. Fetched when the dialog
     opens: the register does not need it, and most rows are never opened. */
  private readonly fees = inject(FeeService);
  protected readonly fee = signal<FeeStructure | null>(null);
  protected readonly feeLoading = signal(false);

  protected readonly feeTotals = computed(() => {
    const structure = this.fee();
    return structure ? computeFeeTotals(structure) : null;
  });

  /**
   * Whether the marks are worth breaking down.
   *
   * A track with one component has already had that component's marks
   * printed as the examination's, and saying it again under its own
   * heading reads as a second requirement rather than the same one.
   */
  protected splitWorthShowing(row: ProgramType): boolean {
    const parts = [
      row.evaluation.hasWritten && row.evaluation.writtenMarks > 0,
      row.evaluation.hasViva && row.evaluation.vivaMarks > 0,
    ].filter(Boolean).length;
    return parts > 1;
  }
  protected readonly saving = signal(false);
  protected readonly editing = signal<ProgramType | null>(null);

  /* ------------------------------------------- certificate templates */

  protected readonly certificationPolicies = CERTIFICATION_POLICIES;
  protected readonly templateFormats = 'PDF, PNG, JPEG, HTML or DOCX, up to 10 MB';
  protected readonly templateAccept =
    '.pdf,.png,.jpg,.jpeg,.html,.docx,application/pdf,image/png,image/jpeg,text/html,' +
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  /** Which kind is mid-upload, so only that row shows a spinner. */
  protected readonly uploading = signal<CertificateKind | null>(null);

  /** The wording under the policy select, so the choice explains itself. */
  protected readonly policyHint = computed(() => {
    const chosen = this.formValue().certificationPolicy;
    return CERTIFICATION_POLICIES.find((p) => p.value === chosen)?.hint ?? '';
  });

  /* -------------------------------------------------------- evaluation */

  protected readonly examinationKinds = EXAMINATION_KINDS;


  protected readonly examKind = computed<ExaminationKind>(
    () => (this.formValue().evaluation?.kind as ExaminationKind) ?? 'Written',
  );

  protected readonly examHint = computed(
    () => EXAMINATION_KINDS.find((k) => k.value === this.examKind())?.hint ?? '',
  );

  protected readonly hasWritten = computed(() => examinesWritten(this.examKind()));
  protected readonly hasViva = computed(() => examinesViva(this.examKind()));

  /** What the sections add up to, which is what the total has to agree with. */
  protected readonly sectionTotal = computed(() => {
    const marks = this.formValue().evaluation;
    return (this.hasWritten() ? Number(marks?.writtenMarks ?? 0) : 0) +
      (this.hasViva() ? Number(marks?.vivaMarks ?? 0) : 0);
  });

  /**
   * The same rules the server enforces, said before the save rather than after
   * it — somebody splitting 100 marks across two sections should see the sum
   * disagree while they are still typing.
   */
  protected readonly marksProblem = computed<string | null>(() => {
    if (this.examKind() === 'None') return null;

    const marks = this.formValue().evaluation;
    const sections = this.sectionTotal();
    const total = Number(marks?.totalMarks ?? 0) || sections;

    if (sections === 0) return 'An examined program needs marks against at least one section.';
    if (total !== sections) {
      return `The sections add up to ${sections}, which does not match the total of ${total}.`;
    }
    if (this.hasWritten() && Number(marks?.writtenPassMarks ?? 0) > Number(marks?.writtenMarks ?? 0)) {
      return 'The written pass mark is higher than the written paper is marked out of.';
    }
    if (this.hasViva() && Number(marks?.vivaPassMarks ?? 0) > Number(marks?.vivaMarks ?? 0)) {
      return 'The viva pass mark is higher than the viva is marked out of.';
    }

    const overall = Number(marks?.overallPassMarks ?? 0);
    if (overall > total) return 'The overall pass mark is higher than the total marks.';

    const sectionMinimums =
      (this.hasWritten() ? Number(marks?.writtenPassMarks ?? 0) : 0) +
      (this.hasViva() ? Number(marks?.vivaPassMarks ?? 0) : 0);
    if (overall > 0 && overall < sectionMinimums) {
      return 'The overall pass mark is below the section minimums added together, so it would never decide an outcome.';
    }
    return null;
  });

  /** Reads back the pattern in a sentence, so it can be checked at a glance. */
  protected readonly marksSummary = computed(() => {
    const marks = this.formValue().evaluation;
    const total = Number(marks?.totalMarks ?? 0) || this.sectionTotal();
    const parts: string[] = [];
    if (this.hasWritten()) {
      parts.push(`written ${marks?.writtenMarks ?? 0} (pass ${marks?.writtenPassMarks ?? 0})`);
    }
    if (this.hasViva()) {
      parts.push(`viva ${marks?.vivaMarks ?? 0} (pass ${marks?.vivaPassMarks ?? 0})`);
    }
    return `Out of ${total}: ${parts.join(', ')}. A candidate also needs ` +
      `${marks?.overallPassMarks ?? 0} overall.`;
  });

  /* Follows the policy in the form, not the saved record, so choosing "both"
     reveals the second slot straight away rather than after a save. */
  protected readonly templateKinds = computed<CertificateKind[]>(() =>
    kindsForPolicy(this.formValue().certificationPolicy as ProgramType['certificationPolicy']),
  );

  /**
   * Whether a kind can be uploaded yet.
   *
   * The server validates against the policy it has stored, so a slot revealed
   * by an unsaved change would be refused. The row appears either way — seeing
   * what the choice implies is the point — but its button waits for the save.
   */
  protected canUpload(kind: CertificateKind): boolean {
    return (this.editing()?.certificateKinds ?? []).includes(kind);
  }

  protected kindLabel(kind: CertificateKind): string {
    return CERTIFICATE_KIND_LABELS[kind];
  }

  protected templateFor(kind: CertificateKind): CertificateTemplate | undefined {
    return this.editing()?.certificateTemplates?.find((t) => t.kind === kind);
  }

  protected templateUrl(id: number, kind: CertificateKind): string {
    return this.service.templateUrl(id, kind);
  }

  protected sizeOf(bytes: number): string {
    return bytes < 1024 * 1024
      ? `${Math.max(1, Math.round(bytes / 1024))} KB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected uploadTemplate(id: number, kind: CertificateKind, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    /* Cleared straight away so picking the same file twice still fires. */
    input.value = '';
    if (!file) return;

    this.uploading.set(kind);
    this.service.uploadTemplate(id, kind, file).subscribe({
      next: (updated) => {
        this.uploading.set(null);
        this.editing.set(updated);
        this.list.reload();
        this.toast.success('Template uploaded', `${this.kindLabel(kind)} saved.`);
      },
      error: () => this.uploading.set(null),
    });
  }

  protected async removeTemplate(id: number, kind: CertificateKind): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Remove this template?',
      message: `The ${this.kindLabel(kind).toLowerCase()} artwork will be deleted.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!ok) return;

    this.service.removeTemplate(id, kind).subscribe((updated) => {
      this.editing.set(updated);
      this.list.reload();
      this.toast.success('Template removed', `${this.kindLabel(kind)} deleted.`);
    });
  }

  protected readonly form = this.fb.nonNullable.group({
    categoryId: [null as number | null, Validators.required],
    subCategoryId: [null as number | null, Validators.required],
    /* Optional: blank means the server derives it from the name. */
    code: ['', formatValidator('code')],
    name: ['', Validators.required],
    shortDescription: [''],
    durationDays: [5, [Validators.required, Validators.min(1)]],
    deliveryMode: ['Physical' as ProgramType['deliveryMode']],
    minQualification: ['NONE'],
    minExperienceYears: [0],
    minParticipants: [0],
    certificateValidityMonths: [36],
    certificationPolicy: ['QualificationOnly' as ProgramType['certificationPolicy']],
    isFeeApplicable: [true],
    evaluation: this.fb.nonNullable.group({
      kind: ['Written' as ExaminationKind],
      totalMarks: [100],
      writtenMarks: [100],
      vivaMarks: [0],
      writtenPassMarks: [40],
      vivaPassMarks: [0],
      overallPassMarks: [40],
    }),
    status: ['Active' as ProgramType['status']],
  });

  /** Live preview of the code the server will derive, shown as placeholder text. */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  private readonly allSubCategories = toSignal(this.lookups.subCategories(), {
    initialValue: [] as LookupItem[],
  });

  /* ------------------------------------------------------- list filters ----
     Sub-category narrows to the chosen category, and picking a category clears
     any sub-category beneath it so the pair can never contradict itself. */
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
    this.list.stageFilter('categoryId', raw || null);
    this.list.stageFilter('subCategoryId', null);
  }

  protected onSubCategoryFilter(event: Event): void {
    const raw = (event.target as HTMLSelectElement).value;
    this.filterSubCategoryId.set(raw ? Number(raw) : null);
    this.list.stageFilter('subCategoryId', raw || null);
  }

  protected resetFilters(): void {
    this.filterCategoryId.set(null);
    this.filterSubCategoryId.set(null);
    this.list.clearFilters();
  }

  protected readonly suggestedCode = computed(() => {
    const draft = this.formValue();
    if (!draft?.name?.trim()) return 'ZED-BRO-MT';
    const parent = this.allSubCategories().find((item) => item.id === draft.subCategoryId);
    return composeCode(parent?.code, abbreviate(draft.name));
  });

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;

  protected invalid(control: string): boolean {
    const field = this.form.get(control);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  protected errorFor(control: string, label: string): string {
    return describeError(this.form.get(control)?.errors ?? null, label);
  }

  protected showConfig(row: ProgramType): void {
    this.configOf.set(row);
    this.loadFee(row);
  }

  private loadFee(row: ProgramType): void {
    this.fee.set(null);
    if (!row.isFeeApplicable) return;

    this.feeLoading.set(true);
    this.fees.current(row.id).subscribe({
      next: (structure) => {
        this.fee.set(structure);
        this.feeLoading.set(false);
      },
      /* A fee that will not load must not take the rest of the sheet with
         it; the panel says none is in force, which is the same thing a
         reader has to go and check either way. */
      error: () => {
        this.fee.set(null);
        this.feeLoading.set(false);
      },
    });
  }

  /** Straight from reading it to changing it, without going back to the row. */
  protected editFromConfig(row: ProgramType): void {
    this.configOf.set(null);
    this.openForm(row);
  }

  protected openForm(row?: ProgramType): void {
    this.editing.set(row ?? null);
    this.form.reset({
      categoryId: row?.categoryId ?? null,
      subCategoryId: row?.subCategoryId ?? null,
      code: row?.code ?? '',
      name: row?.name ?? '',
      shortDescription: row?.shortDescription ?? '',
      durationDays: row?.durationDays ?? 5,
      deliveryMode: row?.deliveryMode ?? 'Physical',
      minQualification: row?.minQualification ?? 'NONE',
      minExperienceYears: row?.minExperienceYears ?? 0,
      minParticipants: row?.minParticipants ?? 0,
      certificateValidityMonths: row?.certificateValidityMonths ?? 36,
      certificationPolicy: row?.certificationPolicy ?? 'QualificationOnly',
      isFeeApplicable: row?.isFeeApplicable ?? true,
      evaluation: {
        kind: row?.evaluation?.kind ?? 'Written',
        totalMarks: row?.evaluation?.totalMarks ?? 100,
        writtenMarks: row?.evaluation?.writtenMarks ?? 100,
        vivaMarks: row?.evaluation?.vivaMarks ?? 0,
        writtenPassMarks: row?.evaluation?.writtenPassMarks ?? 40,
        vivaPassMarks: row?.evaluation?.vivaPassMarks ?? 0,
        overallPassMarks: row?.evaluation?.overallPassMarks ?? 40,
      },
      status: row?.status ?? 'Active',
    });
    this.ways.set(
      (row?.eligibilityRoutes ?? []).map((route) => ({
        qualificationCode: route.qualificationCode,
        minExperienceYears: route.minExperienceYears,
        requirements: route.requirements.join('\n'),
      })),
    );
    this.formOpen.set(true);
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  /** A way in is added at the bar the form already carries. */
  protected addWay(): void {
    this.ways.update((rows) => [
      ...rows,
      {
        qualificationCode:
          rows.length === 0
            ? (this.form.getRawValue().minQualification ?? 'NONE')
            : 'NONE',
        minExperienceYears:
          rows.length === 0 ? (this.form.getRawValue().minExperienceYears ?? 0) : 0,
        requirements: '',
      },
    ]);
  }

  protected editWay(index: number, patch: Partial<WayDraft>): void {
    this.ways.update((rows) =>
      rows.map((row, at) => (at === index ? { ...row, ...patch } : row)),
    );
  }

  protected dropWay(index: number): void {
    this.ways.update((rows) => rows.filter((_, at) => at !== index));
  }

  /**
   * What is wrong with the ways in, said before the server says it.
   *
   * Two rows on the same qualification are two different answers to one
   * question - which of them applies to a graduate? - so the server
   * refuses them, and this says so while there is still something to fix.
   */
  protected readonly wayProblem = computed(() => {
    const rows = this.ways();
    if (rows.length === 0) return null;

    if (rows.some((row) => !row.qualificationCode || row.qualificationCode === 'NONE')) {
      return 'Every way in needs a qualification of its own.';
    }

    const codes = rows.map((row) => row.qualificationCode);
    if (new Set(codes).size !== codes.length) {
      return 'Two ways in name the same qualification. Keep the one that applies.';
    }

    if (rows.some((row) => row.minExperienceYears < 0 || row.minExperienceYears > 60)) {
      return 'Experience on a way in has to be between 0 and 60 years.';
    }

    return null;
  });

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.marksProblem()) {
      this.toast.error('Check the marks', this.marksProblem()!);
      return;
    }
    if (this.wayProblem()) {
      this.toast.error('Check who may apply', this.wayProblem()!);
      return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();
    /* Whether an exam is mandatory is not asked separately: it is what the
       chosen scheme says. Sent anyway because the contract carries it, and the
       server derives the same answer. */
    const payload = {
      ...raw,
      /* Sent whether or not there are any: an empty list is how a track
         goes back to stating a single minimum. */
      eligibilityRoutes: this.ways().map((way) => ({
        qualificationCode: way.qualificationCode,
        minExperienceYears: way.minExperienceYears,
        requirements: way.requirements
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      })),
      isExamMandatory: raw.evaluation.kind !== 'None',
      evaluation: {
        ...raw.evaluation,
        totalMarks: raw.evaluation.totalMarks || this.sectionTotal(),
      },
    };
    const current = this.editing();
    const request = current ? this.service.update(current.id, payload) : this.service.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Program type updated' : 'Program type created', payload.name);
        this.lookups.invalidate('program-types');
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: { id: number; status: string; name?: string }, status: RecordStatus): Promise<void> {
    const verb = status === 'Active' ? 'Enable' : 'Disable';
    const confirmed = await this.confirm.ask({
      title: `${verb} program type?`,
      message:
        status === 'Active'
          ? 'The record becomes available again for new transactions.'
          : 'The record stays in history but can no longer be selected for new transactions.',
      confirmLabel: verb,
      tone: status === 'Active' ? 'primary' : 'danger',
    });
    if (!confirmed) return;
    this.service.setStatus(row.id, status).subscribe(() => {
      this.toast.success(`Program type ${status === 'Active' ? 'enabled' : 'disabled'}`, row.name);
      this.lookups.invalidate();
      this.list.reload();
    });
  }
}
