import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CertificateStanding, Id, QualifiedProfessional } from '../../core/models';
import { CertificateService } from '../../core/services/certificate.service';
import { LookupService } from '../../core/services/masters.service';
import { QualifiedProfessionalService } from '../../core/services/system.service';
import { SiteTextService } from '../../core/services/site-text.service';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
} from '../../shared/components/data-table.component';
import { IconComponent } from '../../shared/components/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ToastService } from '../../core/services/toast.service';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'name', header: 'Professional', sortable: true, variant: 'primary' },
  { key: 'programType', header: 'Qualified as', sortable: true },
  { key: 'state', header: 'State/UT', sortable: true, width: '150px' },
  { key: 'certificate', header: 'Certificate', width: '190px' },
  { key: 'validTill', header: 'Valid till', sortable: true, width: '150px' },
  { key: 'standing', header: 'Standing', width: '130px' },
  { key: 'actions', header: '', width: '160px', align: 'right' },
];

/** What each standing is called and how it is coloured. */
const STANDINGS: Record<CertificateStanding, { label: string; tone: string }> = {
  Valid: { label: 'Valid', tone: 'ok' },
  Expiring: { label: 'Expiring', tone: 'warn' },
  Expired: { label: 'Expired', tone: 'bad' },
  Revoked: { label: 'Revoked', tone: 'bad' },
  NotIssued: { label: 'Not issued', tone: 'muted' },
};

@Component({
  selector: 'app-qualified-professionals',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    IconComponent,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.qualifiedProfessionals.title')"
      [subtitle]="copy.text('page.qualifiedProfessionals.subtitle')"
      icon="graduation"
      [breadcrumbs]="[
        { label: 'Administration' },
        { label: copy.text('page.qualifiedProfessionals.title') },
      ]"
    />

    <section class="card">
      <div class="card__body card__body--tight">
        <p class="text-muted text-sm">
          One row per qualification: somebody who has passed two programmes appears twice,
          because they hold two. A qualification is recorded when the marks are in, and the
          certificate follows — so a professional can be qualified and not yet certified.
        </p>

        <div class="filter-bar">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input
                class="input"
                placeholder="Search by name, applicant ID, mobile or certificate number"
                (input)="list.setSearch(term($event))"
              />
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="qpCategory">Category</label>
            <select
              id="qpCategory"
              class="select"
              (change)="onCategory(numberOrNull($event))"
            >
              <option value="">All categories</option>
              @for (option of categories(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field-label" for="qpSubCategory">Sub-category</label>
            <select
              id="qpSubCategory"
              class="select"
              [value]="list.stagedValue('subCategoryId')"
              (change)="list.stageFilter('subCategoryId', value($event))"
              >
              <option value="">All sub-categories</option>
              @for (option of subCategories(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="qpType">Program type</label>
            <select
              id="qpType"
              class="select"
              [value]="list.stagedValue('programTypeId')"
              (change)="list.stageFilter('programTypeId', value($event))"
              >
              <option value="">All program types</option>
              @for (option of programTypes(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field-label" for="qpState">State/UT</label>
            <select id="qpState" class="select"
              [value]="list.stagedValue('stateCode')"
              (change)="list.stageFilter('stateCode', value($event))"
            >
              <option value="">All states/UTs</option>
              @for (option of states(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
              }
            </select>
          </div>

          <div class="field field--range">
            <label class="field-label" for="qpFrom">Qualified between</label>
            <div class="field-range__inputs">
              <input
                id="qpFrom"
                class="input"
                type="date"
                aria-label="Qualified from"
                [value]="list.stagedValue('qualifiedFrom')"
                (change)="list.stageFilter('qualifiedFrom', value($event))"
                />
              <span class="field-range__dash">&ndash;</span>
              <input
                id="qpTo"
                class="input"
                type="date"
                aria-label="Qualified to"
                [value]="list.stagedValue('qualifiedTo')"
                (change)="list.stageFilter('qualifiedTo', value($event))"
                />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="qpStanding">Standing</label>
            <select id="qpStanding" class="select"
              [value]="list.stagedValue('standing')"
              (change)="list.stageFilter('standing', value($event))"
            >
              <option value="">All</option>
              <option value="Valid">Valid</option>
              <option value="Expiring">Expiring within 90 days</option>
              <option value="Expired">Expired</option>
              <option value="Revoked">Revoked</option>
              <option value="NotIssued">Certificate not issued</option>
            </select>
          </div>

          <div class="filter-bar__actions">
            <button type="button" class="btn btn--primary" (click)="list.applyFilters()">
              <app-icon name="filter" [size]="15" /> Apply
            </button>
            <button type="button" class="btn btn--ghost" (click)="list.clearFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          </div>
        </div>
      </div>

      <app-data-table
        exportName="Qualified professionals"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No qualified professionals yet"
        emptyMessage="Somebody appears here once their result is recorded as a pass."
        emptyIcon="graduation"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="name" let-row>
          <div class="stack stack-xs">
            <strong>{{ $any(row).fullName }}</strong>
            <span class="text-xs text-muted">
              {{ $any(row).applicantCode }}
              @if ($any(row).mobile) { · {{ $any(row).mobile }} }
            </span>
          </div>
        </ng-template>

        <ng-template appCell="programType" let-row>
          <div class="stack stack-xs">
            <span>{{ $any(row).programTypeName }}</span>
            <span class="text-xs text-muted">{{ $any(row).programmeCode }}</span>
          </div>
        </ng-template>

        <ng-template appCell="state" let-row>
          <div class="stack stack-xs">
            <span>{{ $any(row).stateName || '—' }}</span>
            @if ($any(row).districtName) {
              <span class="text-xs text-muted">{{ $any(row).districtName }}</span>
            }
          </div>
        </ng-template>

        <ng-template appCell="certificate" let-row>
          @if ($any(row).certificateNumber) {
            <div class="stack stack-xs">
              <span class="tabular">{{ $any(row).certificateNumber }}</span>
              <span class="text-xs text-muted">
                {{ $any(row).certificateKind === 'Participation' ? 'Participation' : 'Qualification' }}
                &middot; issued {{ $any(row).issuedOn }}
              </span>
            </div>
          } @else {
            <!-- Said in words. A dash here reads as missing data rather than
                 as a fact about this person. -->
            <span class="text-muted">No certificate</span>
          }
        </ng-template>

        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            @if ($any(row).certificateId) {
              <a
                class="btn btn--sm btn--secondary"
                [href]="certificateUrl($any(row).certificateId)"
                target="_blank"
                rel="noopener"
                title="Opens the certificate, ready to print or save as PDF"
              >
                Download
              </a>
              @if (!$any(row).revokedOn) {
                <button
                  type="button"
                  class="btn btn--icon"
                  title="E-mail it to the holder again"
                  [disabled]="resending() === $any(row).certificateId"
                  (click)="resend($any(row))"
                >
                  @if (resending() === $any(row).certificateId) {
                    <span class="spinner"></span>
                  } @else {
                    <app-icon name="mail" [size]="15" />
                  }
                </button>
              }
            }
          </div>
        </ng-template>

        <ng-template appCell="validTill" let-row>
          @if ($any(row).validTill) {
            <div class="stack stack-xs">
              <span class="tabular">{{ $any(row).validTill }}</span>
              <span class="text-xs text-muted">{{ expiry($any(row)) }}</span>
            </div>
          } @else if ($any(row).certificateNumber) {
            <span class="text-muted">No expiry</span>
          } @else {
            <span class="text-muted">—</span>
          }
        </ng-template>

        <ng-template appCell="standing" let-row>
          <span class="standing" [attr.data-tone]="tone($any(row).standing)">
            {{ standing($any(row).standing) }}
          </span>
        </ng-template>
      </app-data-table>
    </section>
  `,
  styles: [
    `
      .standing {
        display: inline-block;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        font-size: var(--fs-xs);
        font-weight: 600;
        white-space: nowrap;
      }
      .standing[data-tone='ok'] { background: var(--success-50, #e8f5ec); color: var(--success-700); }
      .standing[data-tone='warn'] { background: #fdf3e2; color: #8a5a00; }
      .standing[data-tone='bad'] { background: #fdeceb; color: var(--danger-700); }
      .standing[data-tone='muted'] { background: var(--surface-muted); color: var(--ink-500); }
    `,
  ],
})
export class QualifiedProfessionalsComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(QualifiedProfessionalService);
  private readonly lookups = inject(LookupService);

  protected readonly columns = COLUMNS;

  /* The certificate itself is a printable page served by the API, the same
     one the programme screen opens; re-sending is an e-mail of the details
     and the verification link rather than the document, because a PDF in an
     inbox is a copy nobody can withdraw. */
  private readonly certificates = inject(CertificateService);
  private readonly toast = inject(ToastService);
  protected readonly resending = signal<number | null>(null);

  protected certificateUrl(id: number): string {
    return this.certificates.documentUrl(id);
  }

  protected resend(row: QualifiedProfessional): void {
    if (!row.certificateId || this.resending()) return;

    this.resending.set(row.certificateId as number);
    this.certificates.resend(row.certificateId).subscribe({
      next: (sentTo) => {
        this.resending.set(null);
        this.toast.success('Certificate sent', sentTo);
      },
      error: () => this.resending.set(null),
    });
  }

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly list = new ListState<QualifiedProfessional>(
    (request) => this.service.list(request),
    { sortBy: 'qualifiedOn', sortDir: 'desc' },
  );

  protected readonly categories = toSignal(this.lookups.categories(), { initialValue: [] });
  protected readonly states = toSignal(this.lookups.states(), { initialValue: [] });

  /* Both narrowed to the chosen category, so the filters cannot contradict
     one another. */
  protected readonly programTypes = signal<{ id: Id; name: string }[]>([]);
  protected readonly subCategories = signal<{ id: Id; name: string }[]>([]);

  constructor() {
    this.loadProgramTypes(null);
    this.loadSubCategories(null);
  }

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;

  protected numberOrNull(event: Event): number | null {
    const raw = (event.target as HTMLSelectElement).value;
    return raw ? Number(raw) : null;
  }

  protected onCategory(categoryId: number | null): void {
    this.list.setFilter('categoryId', categoryId ? String(categoryId) : '');
    /* A program type or sub-category from another category would filter
       everything away, so the narrower lists are reloaded and the stale
       choices dropped. */
    this.list.setFilter('programTypeId', '');
    this.list.setFilter('subCategoryId', '');
    this.loadProgramTypes(categoryId);
    this.loadSubCategories(categoryId);
  }

  private loadSubCategories(categoryId: number | null): void {
    this.lookups.subCategories(categoryId).subscribe((items) => {
      this.subCategories.set(items.map((item) => ({ id: item.id, name: item.name })));
    });
  }

  private loadProgramTypes(categoryId: number | null): void {
    this.lookups.programTypes(null, categoryId).subscribe((items) => {
      this.programTypes.set(items.map((item) => ({ id: item.id, name: item.name })));
    });
  }

  protected standing(value: CertificateStanding): string {
    return STANDINGS[value]?.label ?? value;
  }

  protected tone(value: CertificateStanding): string {
    return STANDINGS[value]?.tone ?? 'muted';
  }

  /** Reads the countdown back in words, so a date alone is not the only cue. */
  protected expiry(row: QualifiedProfessional): string {
    const days = row.daysToExpiry;
    if (days === null || days === undefined) return '';
    if (days < 0) return `${Math.abs(days)} days ago`;
    if (days === 0) return 'Today';
    return `in ${days} days`;
  }
}
