import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { OptionSet, OptionSetItem, RecordStatus } from '../../core/models';
import { OptionSetService } from '../../core/services/masters.service';
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
  { key: 'name', header: 'List', sortable: true, variant: 'primary' },
  { key: 'code', header: 'Stored as', variant: 'muted', width: '150px' },
  { key: 'choices', header: 'Choices', width: '280px' },
  { key: 'usedByFieldCount', header: 'Used by', align: 'center', width: '110px' },
  { key: 'status', header: 'Status', width: '110px' },
  { key: 'actions', header: '', width: '110px', align: 'right' },
];

/**
 * The shared choice lists a form field can point at.
 *
 * A dropdown can always have its options typed straight into it, and for a
 * question asked in one place that is the right thing. It stops being the
 * right thing once the same list appears on three forms: the three drift,
 * somebody adds a sector to one of them, and a report that groups by
 * sector has to reconcile answers that were never the same set of words.
 *
 * A list defined here is used by name. Change it and every form using it
 * changes with it, which is the point.
 */
@Component({
  selector: 'app-option-sets',
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
      icon="form"
      title="Choice lists"
      subtitle="Lists of options kept once and used by any number of form fields."
      [breadcrumbs]="[{ label: 'Masters' }, { label: 'Choice lists' }]"
    >
      <button *appCan="'masters.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New list
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar">
          <div class="field field--search">
            <label class="field-label" for="osSearch">Search</label>
            <input
              id="osSearch"
              class="input"
              placeholder="List name or code"
              (input)="list.setSearch(term($event))"
            />
          </div>
          <div class="field">
            <label class="field-label" for="osStatus">Status</label>
            <select
              id="osStatus"
              class="select"
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
            <button type="button" class="btn btn--ghost" (click)="list.clearFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          </div>
        </div>
      </div>

      <app-data-table
        exportName="Choice lists"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No choice lists"
        emptyIcon="form"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="choices" let-row>
          <div class="row row-sm row-wrap">
            @for (item of shown($any(row)); track item.value) {
              <span class="chip" [class.chip--muted]="item.status !== 'Active'">
                {{ item.label }}
              </span>
            }
            @if ($any(row).items.length > 4) {
              <span class="cell-muted">+{{ $any(row).items.length - 4 }} more</span>
            }
          </div>
        </ng-template>
        <ng-template appCell="usedByFieldCount" let-row>
          @if ($any(row).usedByFieldCount) {
            <span class="chip">{{ $any(row).usedByFieldCount }} {{ $any(row).usedByFieldCount === 1 ? 'field' : 'fields' }}</span>
          } @else {
            <span class="cell-muted">—</span>
          }
        </ng-template>
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <button
              *appCan="'masters.manage'"
              type="button"
              class="btn btn--icon"
              title="Edit"
              (click)="openForm($any(row))"
            >
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

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit choice list' : 'New choice list'"
        subtitle="Every form field pointed at this list offers exactly these choices."
        (closed)="closeForm()"
      >
        <form [formGroup]="form" id="option-set-form" (ngSubmit)="save()" class="form-grid">
          <div class="field">
            <label class="field-label" for="osName">Name <span class="req">*</span></label>
            <input id="osName" class="input" formControlName="name" placeholder="Sectors" />
            <span class="field-hint">What a form designer picks from the list.</span>
          </div>
          <div class="field">
            <label class="field-label" for="osCode">Code <span class="req">*</span></label>
            <input id="osCode" class="input" formControlName="code" placeholder="SECTORS" />
            <span class="field-hint">
              A short handle. Letters, digits and underscores; never shown to an applicant.
            </span>
          </div>

          <div class="field field--span-2">
            <label class="field-label" for="osDesc">What it is for</label>
            <input
              id="osDesc"
              class="input"
              formControlName="description"
              placeholder="What the enterprise does."
            />
          </div>

          <div class="field field--span-2">
            <label class="field-label" for="osItems">Choices <span class="req">*</span></label>
            <textarea
              id="osItems"
              class="textarea"
              rows="7"
              [value]="itemText()"
              placeholder="One choice per line"
              (input)="setItems(inputValue($event))"
            ></textarea>
            <span class="field-hint">
              One per line, in the order they should appear. The stored value is taken from
              the wording the first time a choice is added and does not change afterwards —
              so a choice can be reworded without orphaning the answers already given.
            </span>
          </div>

          <!-- Each choice as a row: what it says, what it means, and
               whether it is still offered.

               The box above is still how choices are added, because typing
               a list is faster than filling in a form per line. This is
               where a choice is explained and withdrawn - a description
               belongs beside the words it explains, and withdrawing is not
               a delete, because answers already name it and the history
               has to keep reading. -->
          @if (items().length) {
            <div class="field field--span-2">
              <span class="field-label">What each choice means</span>
              <div class="choices">
                @for (item of items(); track item.value; let i = $index) {
                  <div class="choice" [class.choice--off]="item.status !== 'Active'">
                    <div class="choice__label">
                      <span class="choice__text">{{ item.label }}</span>
                      <code class="choice__value">{{ item.value }}</code>
                    </div>

                    <input
                      class="input input--sm"
                      [value]="item.description ?? ''"
                      placeholder="What it means, if the wording alone does not say it"
                      maxlength="500"
                      (input)="describeItem(item.value, inputValue($event))"
                    />

                    <button
                      type="button"
                      class="btn btn--sm"
                      [class.btn--secondary]="item.status === 'Active'"
                      [class.btn--subtle-danger]="item.status !== 'Active'"
                      (click)="toggleItem(item.value)"
                    >
                      {{ item.status === 'Active' ? 'Offered' : 'Withdrawn' }}
                    </button>
                  </div>
                }
              </div>
              <span class="field-hint">
                The description is shown under the choice on the form. Withdrawing one stops
                it being offered; it keeps its place in answers already given.
              </span>
            </div>
          }

          <div class="field">
            <label class="field-label" for="osStatusSel">Status</label>
            <select id="osStatusSel" class="select" formControlName="status">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>

          @if (editing()?.usedByFieldCount) {
            <div class="field field--span-2">
              <p class="text-sm text-muted">
                Used by {{ editing()?.usedByFieldCount }} field(s). Saving changes what every
                one of them offers.
              </p>
            </div>
          }
        </form>

        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="option-set-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Save list
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      /* One choice to a row: the wording, what it means, and whether it is
         still offered. Chips said only the first of those. */
      .choices {
        display: grid;
        gap: 0.4rem;
      }
      .choice {
        display: grid;
        grid-template-columns: minmax(160px, 1fr) minmax(200px, 1.6fr) auto;
        align-items: center;
        gap: 0.6rem;
        padding: 0.45rem 0.6rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
      }
      /* Withdrawn: still listed, because it is still in the answers. */
      .choice--off { background: var(--surface-muted); opacity: 0.75; }
      .choice__label { display: grid; gap: 1px; min-width: 0; }
      .choice__text { font-size: var(--fs-sm); color: var(--ink-900); }
      .choice__value { font-size: var(--fs-xs); color: var(--ink-500); }
      .input--sm { padding: 0.3rem 0.5rem; font-size: var(--fs-sm); }
      @media (max-width: 760px) {
        .choice { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class OptionSetsComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(OptionSetService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly columns = COLUMNS;
  protected readonly term = searchTerm;
  protected readonly value = (event: Event) => (event.target as HTMLSelectElement).value;
  protected readonly inputValue = (event: Event) => (event.target as HTMLTextAreaElement).value;
  protected readonly exportRows = () => this.list.fetchAll();

  protected readonly list = new ListState<OptionSet>((request) => this.service.list(request), {
    sortBy: 'name',
  });

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<OptionSet | null>(null);

  /** The choices being edited, which the textarea and the chips share. */
  protected readonly items = signal<OptionSetItem[]>([]);

  protected readonly itemText = computed(() => this.items().map((i) => i.label).join('\n'));

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    code: ['', [Validators.required]],
    description: [''],
    status: ['Active' as RecordStatus],
  });

  /** The first few, for the list column. */
  protected shown(row: OptionSet): OptionSetItem[] {
    return row.items.slice(0, 4);
  }

  /**
   * Rebuilds the choices from the text, keeping the status of any whose
   * wording is unchanged — so retyping the box does not quietly switch a
   * withdrawn choice back on.
   */
  protected setItems(text: string): void {
    const existing = this.items();
    this.items.set(
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((label, index) => {
          const was = existing.find((i) => i.label === label);
          return {
            id: was?.id ?? 0,
            value: was?.value ?? label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            label,
            /* Kept with the wording it belongs to: retyping the box must
               not quietly throw away what somebody wrote underneath. */
            description: was?.description,
            displayOrder: index + 1,
            status: was?.status ?? ('Active' as RecordStatus),
          };
        }),
    );
  }

  /**
   * What a choice means, kept against the choice rather than the line.
   *
   * Typed here instead of in the box above, because the box is split on
   * newlines and a description is a sentence - the two cannot share a
   * line without one of them having to be escaped out of the other.
   */
  protected describeItem(value: string, description: string): void {
    this.items.update((list) =>
      list.map((i) => (i.value === value ? { ...i, description } : i)),
    );
  }

  protected toggleItem(value: string): void {
    this.items.update((list) =>
      list.map((i) =>
        i.value === value
          ? { ...i, status: i.status === 'Active' ? ('Inactive' as RecordStatus) : ('Active' as RecordStatus) }
          : i,
      ),
    );
  }

  protected openForm(row?: OptionSet): void {
    this.editing.set(row ?? null);
    this.items.set(row ? row.items.map((i) => ({ ...i })) : []);
    this.form.reset({
      name: row?.name ?? '',
      code: row?.code ?? '',
      description: row?.description ?? '',
      status: row?.status ?? ('Active' as RecordStatus),
    });
    this.formOpen.set(true);
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
    if (this.items().length === 0) {
      this.toast.warning('No choices', 'A list needs at least one choice in it.');
      return;
    }

    const raw = this.form.getRawValue();
    const body = { ...raw, items: this.items() };
    const current = this.editing();

    this.saving.set(true);
    const request = current
      ? this.service.update(current.id, body)
      : this.service.create(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('List saved');
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: OptionSet, status: RecordStatus): Promise<void> {
    if (status === 'Inactive' && row.usedByFieldCount) {
      const ok = await this.confirm.ask({
        title: `Switch off ${row.name}?`,
        message:
          `${row.usedByFieldCount} field(s) offer this list. Switching it off stops it ` +
          'being offered on new forms; the fields already using it keep their choices.',
        confirmLabel: 'Switch off',
        tone: 'danger',
      });
      if (!ok) return;
    }

    this.service.setStatus(row.id, status).subscribe(() => this.list.reload());
  }
}
