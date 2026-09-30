import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Qualification, RecordStatus } from '../../core/models';
import { LookupService, QualificationService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
} from '../../shared/components/data-table.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { StatusToggleComponent } from '../../shared/components/status-toggle.component';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'rank', header: 'Position', align: 'center', sortable: true, width: '100px' },
  { key: 'label', header: 'Qualification', sortable: true, variant: 'primary' },
  { key: 'code', header: 'Stored as', variant: 'muted', width: '190px' },
  { key: 'programTypeCount', header: 'Program types', align: 'center', width: '130px' },
  { key: 'status', header: 'Status', width: '120px' },
  { key: 'actions', header: '', width: '110px', align: 'right' },
];

@Component({
  selector: 'app-qualifications',
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
    IconComponent,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.qualifications.title')"
      [subtitle]="copy.text('page.qualifications.subtitle')"
      icon="book"
      [breadcrumbs]="[
        { label: 'Program setup' },
        { label: copy.text('page.qualifications.title') },
      ]"
    >
      <button *appCan="'masters.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New qualification
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <p class="text-muted text-sm">
          A program type asks for a <strong>minimum</strong>, so what matters is the order.
          An applicant clears the bar when their own qualification sits at the same position
          or higher. Give two qualifications the same position when either one should count —
          an ITI and a diploma, say.
        </p>

        <div class="filter-bar">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input
                class="input"
                placeholder="Search qualifications"
                (input)="list.setSearch(term($event))"
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="status">Status</label>
            <select id="status" class="select" (change)="list.setFilter('status', value($event))">
              <option value="">All</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          @if (list.hasFilters) {
            <button type="button" class="btn btn--ghost" (click)="list.clearFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          }
        </div>
      </div>

      <app-data-table
        exportName="Qualifications"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No qualifications yet"
        emptyMessage="Add the qualifications your program types can ask for."
        emptyIcon="book"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <button type="button" class="btn btn--icon" title="Edit" (click)="openForm($any(row))">
              <app-icon name="edit" [size]="15" />
            </button>
            @if (!$any(row).isSystem) {
              <app-status-toggle
                [status]="$any(row).status"
                (toggled)="setStatus($any(row), $event)"
              />
            }
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit qualification' : 'New qualification'"
        subtitle="Program types choose their minimum from this list."
        (closed)="closeForm()"
      >
        <form [formGroup]="form" class="form-grid" id="qualification-form" (ngSubmit)="save()">
          <div class="field field--span-2">
            <label class="field-label" for="label">Qualification <span class="req">*</span></label>
            <input
              id="label"
              class="input"
              formControlName="label"
              maxlength="160"
              placeholder="e.g. B.Voc (Retail)"
              [class.is-invalid]="invalid('label')"
            />
            @if (invalid('label')) {
              <span class="field-error">Enter the qualification as it should read on the form.</span>
            } @else if (editing()) {
              <span class="field-hint">
                Stored as <code>{{ editing()!.code }}</code
                >. Rewording is safe — the stored value never changes.
              </span>
            }
          </div>

          @if (isSystem()) {
            <div class="field field--span-2">
              <p class="text-muted text-sm">
                This is the "no minimum" rung every program type starts at. Its wording is yours
                to change; its position and availability are not.
              </p>
            </div>
          } @else {
            <div class="field">
              <label class="field-label" for="rank">Position on the ladder</label>
              <input
                id="rank"
                type="number"
                class="input"
                formControlName="rank"
                min="1"
                max="10000"
                [class.is-invalid]="invalid('rank')"
              />
              @if (invalid('rank')) {
                <span class="field-error">Enter a position between 1 and 10000.</span>
              } @else {
                <span class="field-hint">{{ placement() }}</span>
              }
            </div>
            <div class="field">
              <label class="field-label" for="qStatus">Status</label>
              <select id="qStatus" class="select" formControlName="status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
              <span class="field-hint">
                Inactive keeps it on older program types but takes it off the form.
              </span>
            </div>
          }
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="qualification-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            {{ editing() ? 'Save changes' : 'Add qualification' }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class QualificationsComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(QualificationService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly list = new ListState<Qualification>((request) => this.service.list(request), {
    sortBy: 'rank',
  });

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<Qualification | null>(null);

  protected readonly isSystem = computed(() => this.editing()?.isSystem === true);

  protected readonly form = this.fb.nonNullable.group({
    label: ['', Validators.required],
    rank: [10, [Validators.min(1), Validators.max(10000)]],
    status: ['Active' as RecordStatus],
  });

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;

  /** Reads back where the typed position lands, in the words of the ladder itself. */
  protected placement(): string {
    const rank = Number(this.form.controls.rank.value);
    const others = this.list
      .rows()
      .filter((row) => row.id !== this.editing()?.id)
      .sort((a, b) => a.rank - b.rank);

    const same = others.find((row) => row.rank === rank);
    if (same) return `Counts as equivalent to ${same.label}.`;

    const below = others.filter((row) => row.rank < rank).pop();
    const above = others.find((row) => row.rank > rank);

    if (below && above) return `Sits between ${below.label} and ${above.label}.`;
    if (below) return `Sits at the top, above ${below.label}.`;
    if (above) return `Sits at the bottom, below ${above.label}.`;
    return 'The first rung on the ladder.';
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  protected openForm(row?: Qualification): void {
    this.editing.set(row ?? null);
    this.form.reset({
      label: row?.label ?? '',
      rank: row?.rank ?? this.nextRank(),
      status: row?.status ?? 'Active',
    });
    this.formOpen.set(true);
  }

  /** One step above the highest rung on screen, so a new one lands at the top. */
  private nextRank(): number {
    const highest = this.list.rows().reduce((top, row) => Math.max(top, row.rank), 0);
    return highest + 10;
  }

  protected closeForm(): void {
    this.formOpen.set(false);
    this.editing.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const payload = this.form.getRawValue();
    const current = this.editing();
    const request = current
      ? this.service.update(current.id, payload)
      : this.service.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(current ? 'Qualification updated' : 'Qualification added', payload.label);
        /* The program type form reads this list from the lookup cache. */
        this.lookups.invalidate('qualifications');
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: Qualification, status: RecordStatus): Promise<void> {
    const verb = status === 'Active' ? 'Enable' : 'Disable';
    const inUse = row.programTypeCount ?? 0;

    const confirmed = await this.confirm.ask({
      title: `${verb} qualification?`,
      message:
        status === 'Active'
          ? 'It goes back on the program type form.'
          : inUse > 0
            ? `${inUse} program type(s) already ask for it and keep it. It only comes off the form for new ones.`
            : 'It comes off the program type form. Nothing already saved changes.',
      confirmLabel: verb,
      tone: status === 'Active' ? 'primary' : 'danger',
    });
    if (!confirmed) return;

    this.service.setStatus(row.id, status).subscribe(() => {
      this.toast.success(
        `Qualification ${status === 'Active' ? 'enabled' : 'disabled'}`,
        row.label,
      );
      this.lookups.invalidate('qualifications');
      this.list.reload();
    });
  }
}
