import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LookupItem,
  FEE_COMPONENT_KINDS,
  FeeStructure,
  RecordStatus,
  TDS_RATES,
  TdsRate,
  computeFeeTotals,
} from '../../core/models';
import { FeeService } from '../../core/services/academics.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ProgramTypeLinkageComponent } from '../../shared/components/program-type-linkage.component';
import { ConfirmService } from '../../shared/components/confirm.service';
import { CellTemplateDirective, ColumnDef, DataTableComponent } from '../../shared/components/data-table.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { IconComponent } from '../../shared/components/icon.component';
import { LookupService } from '../../core/services/masters.service';
import { MasterFilterComponent } from '../../shared/components/master-filter.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { StatusToggleComponent } from '../../shared/components/status-toggle.component';
import { InrPipe } from '../../shared/pipes/format.pipes';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'title', header: 'Fee structure', sortable: true, variant: 'primary' },
  { key: 'programTypeName', header: 'Program type' },
  { key: 'categoryName', header: 'Category', variant: 'muted' },
  { key: 'gross', header: 'Payable', align: 'right', width: '150px' },
  { key: 'gstPercent', header: 'GST', align: 'center', width: '80px' },
  { key: 'tdsPercent', header: 'TDS options', align: 'center', width: '130px' },
  { key: 'effectiveFrom', header: 'Effective from', width: '140px' },
  { key: 'status', header: 'Status', width: '110px' },
  { key: 'actions', header: '', width: '110px', align: 'right' },
];

@Component({
  selector: 'app-fees',
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
    ProgramTypeLinkageComponent,
    IconComponent,
    MasterFilterComponent,
    InrPipe,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.fees.title')"
      [subtitle]="copy.text('page.fees.subtitle')"
      icon="rupee"
      [breadcrumbs]="[{ label: 'Program setup' }, { label: copy.text('page.fees.title') }]"
    >
      <button *appCan="'fees.manage'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="plus" [size]="15" /> New fee structure
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar filter-bar--inline">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input class="input" placeholder="Search fee structures" (input)="list.setSearch(term($event))" />
            </div>
          </div>
          <app-master-filter [list]="list" programTypeLabel="Program type" #masters />
          <div class="field">
            <label class="field-label" for="feeStatus">Status</label>
            <select id="feeStatus" class="select"
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
            <button type="button" class="btn btn--ghost" (click)="masters.clear(); list.clearFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          </div>
        </div>
      </div>

      <app-data-table
        exportName="Fee structures"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No fee structures"
        emptyIcon="rupee"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="status" let-row>
          <app-status-badge [value]="$any(row).status" />
        </ng-template>
        <ng-template appCell="gross" let-row>
          <strong class="tabular">{{ totals($any(row)).gross | inr }}</strong>
          <div class="cell-muted tabular">incl. {{ totals($any(row)).gst | inr }} GST</div>
          @if ($any(row).tdsOptions?.length) {
            <div class="cell-muted">TDS optional</div>
          }
        </ng-template>
        <ng-template appCell="gstPercent" let-row>
          <span class="chip">{{ $any(row).gstPercent }}%</span>
        </ng-template>
        <ng-template appCell="tdsPercent" let-row>
          @if ($any(row).tdsOptions?.length) {
            <div class="row row-sm">
              @for (rate of $any(row).tdsOptions; track rate) {
                <span class="chip">{{ rate }}%</span>
              }
            </div>
          } @else {
            <span class="cell-muted">—</span>
          }
        </ng-template>
        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            <button type="button" class="btn btn--icon" title="Edit" (click)="openForm($any(row))">
              <app-icon name="edit" [size]="15" />
            </button>
            <app-status-toggle
              [status]="$any(row).status"
              (toggled)="setStatus($any(row), $event)"
            />
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (formOpen()) {
      <app-modal
        [title]="editing() ? 'Edit fee structure' : 'New fee structure'"
        size="lg"
        (closed)="closeForm()"
      >
        <form [formGroup]="form" id="fee-form" (ngSubmit)="save()" class="stack stack-md">
          <div class="form-grid form-grid--3">
            <div class="field">
              <label class="field-label">Program type <span class="req">*</span></label>
              <select class="select" formControlName="programTypeId">
                <option [ngValue]="null">Select program type</option>
                @for (type of allProgramTypes(); track type.id) {
                  <option [ngValue]="type.id">{{ type.code }} — {{ type.name }}</option>
                }
              </select>
            </div>
            <app-program-type-linkage [programTypeId]="form.controls.programTypeId.value" />
          </div>
          <div class="form-grid form-grid--3">
            <div class="field field--span-2">
              <label class="field-label" for="feeTitle">Title <span class="req">*</span></label>
              <input id="feeTitle" class="input" formControlName="title" />
            </div>
            <div class="field">
              <label class="field-label" for="feeGst">GST %</label>
              <input id="feeGst" type="number" class="input" formControlName="gstPercent" (input)="touch()" />
            </div>
            <div class="field field--span-2">
              <span class="field-label">TDS deduction offered</span>
              <div class="row row-md row-wrap">
                @for (rate of tdsRates; track rate.value) {
                  <label class="check" [title]="rate.section">
                    <input
                      type="checkbox"
                      [checked]="offersTds(rate.value)"
                      (change)="toggleTds(rate.value, $event)"
                    />
                    <span>{{ rate.label }} &mdash; {{ rate.section }}</span>
                  </label>
                }
              </div>
              <span class="field-hint">
                Applicants who opt for TDS declare their own TAN on the profile form.
              </span>
            </div>
            <div class="field">
              <label class="field-label" for="feeFrom">Effective from</label>
              <input id="feeFrom" type="date" class="input" formControlName="effectiveFrom" />
            </div>
            <div class="field">
              <label class="field-label" for="feeTo">Effective to</label>
              <input id="feeTo" type="date" class="input" formControlName="effectiveTo" />
            </div>
            <div class="field">
              <label class="field-label" for="feeStatusSel">Status</label>
              <select id="feeStatusSel" class="select" formControlName="status">
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div class="divider"></div>

          <div class="row row-between">
            <strong class="text-md">Fee components</strong>
            <button type="button" class="btn btn--secondary btn--sm" (click)="addComponent()">
              <app-icon name="plus" [size]="14" /> Add component
            </button>
          </div>

          <div class="table-wrap" formArrayName="components">
            <table class="table table--compact">
              <thead>
                <tr>
                  <th style="width: 150px">Head</th>
                  <th>Label</th>
                  <th style="width: 140px" class="text-right">Amount (₹)</th>
                  <th style="width: 90px" class="text-center">Taxable</th>
                  <th style="width: 36px"></th>
                </tr>
              </thead>
              <tbody>
                @for (component of components.controls; track $index; let i = $index) {
                  <tr [formGroupName]="i">
                    <td>
                      <select class="select" formControlName="kind">
                        @for (kind of kinds; track kind) {
                          <option [value]="kind">{{ kind }}</option>
                        }
                      </select>
                    </td>
                    <td><input class="input" formControlName="label" /></td>
                    <td>
                      <input type="number" class="input text-right" formControlName="amount" (input)="touch()" />
                    </td>
                    <td class="text-center">
                      <label class="check">
                        <input type="checkbox" formControlName="isTaxable" (change)="touch()" />
                      </label>
                    </td>
                    <td>
                      <button type="button" class="btn btn--icon is-danger" (click)="removeComponent(i)">
                        <app-icon name="x" [size]="14" />
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="summary">
            <div><span class="text-xs text-muted">Taxable</span><strong class="tabular">{{ liveTotals().taxable | inr }}</strong></div>
            <div><span class="text-xs text-muted">Non-taxable</span><strong class="tabular">{{ liveTotals().nonTaxable | inr }}</strong></div>
            <div><span class="text-xs text-muted">GST</span><strong class="tabular">{{ liveTotals().gst | inr }}</strong></div>
            <div class="summary__total"><span class="text-xs">Gross payable</span><strong class="tabular">{{ liveTotals().gross | inr }}</strong></div>
            @for (preview of tdsPreviews(); track preview.rate) {
              <div>
                <span class="text-xs text-muted">Net after {{ preview.rate }}% TDS</span>
                <strong class="tabular">{{ preview.netPayable | inr }}</strong>
              </div>
            }
          </div>

          <div class="divider"></div>

          <div class="row row-between">
            <strong class="text-md">Concessions</strong>
            <button type="button" class="btn btn--secondary btn--sm" (click)="addConcession()">
              <app-icon name="plus" [size]="14" /> Add concession
            </button>
          </div>

          <div class="stack stack-sm" formArrayName="concessions">
            @for (concession of concessions.controls; track $index; let i = $index) {
              <div class="concession" [formGroupName]="i">
                <input class="input" formControlName="label" placeholder="Eligibility" />
                <input type="number" class="input" formControlName="percentage" placeholder="%" />
                <input class="input" formControlName="remarks" placeholder="Remarks" />
                <button type="button" class="btn btn--icon is-danger" (click)="removeConcession(i)">
                  <app-icon name="x" [size]="14" />
                </button>
              </div>
            } @empty {
              <span class="text-sm text-muted">No concessions configured.</span>
            }
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="closeForm()">Cancel</button>
          <button type="submit" form="fee-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Save fee structure
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      .summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        background: var(--surface-muted);
        border: 1px solid var(--border);
        border-radius: var(--radius);
      }
      .summary > div { display: flex; flex-direction: column; }
      .summary__total strong { color: var(--brand-700); font-size: var(--fs-lg); }
      .concession {
        display: grid;
        grid-template-columns: 1fr 110px 1fr 32px;
        gap: 0.4rem;
        align-items: center;
      }
      @media (max-width: 760px) {
        .concession { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class FeesComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(FeeService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);
  private readonly lookups = inject(LookupService);

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly kinds = FEE_COMPONENT_KINDS;
  protected readonly tdsRates = TDS_RATES;
  /* The form picks a programme type directly; category and sub-category are
     shown beside it, derived rather than chosen again. */
  protected readonly allProgramTypes = toSignal(this.lookups.programTypes(null), {
    initialValue: [] as LookupItem[],
  });

  protected readonly list = new ListState<FeeStructure>((request) => this.service.list(request), {
    sortBy: 'title',
  });

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly editing = signal<FeeStructure | null>(null);
  private readonly dirtyTick = signal(0);

  protected readonly form = this.fb.group({
    programTypeId: [null as number | null, Validators.required],
    title: ['', Validators.required],
    currency: ['INR'],
    gstPercent: [18],
    effectiveFrom: [new Date().toISOString().slice(0, 10)],
    effectiveTo: [''],
    status: ['Active'],
    components: this.fb.array<FormGroup>([]),
    concessions: this.fb.array<FormGroup>([]),
  });

  /** TDS rates the applicant may choose from at payment time. */
  protected readonly tdsOptions = signal<TdsRate[]>([]);

  protected readonly liveTotals = computed(() => {
    this.dirtyTick();
    return computeFeeTotals({
      gstPercent: Number(this.form.get('gstPercent')?.value ?? 0),
      components: this.components.controls.map((c) => ({
        id: 0,
        kind: 'Base',
        label: '',
        amount: Number(c.get('amount')?.value ?? 0),
        isTaxable: !!c.get('isTaxable')?.value,
      })),
    });
  });

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;
  protected totals = computeFeeTotals;

  get components(): FormArray<FormGroup> {
    return this.form.get('components') as FormArray<FormGroup>;
  }

  get concessions(): FormArray<FormGroup> {
    return this.form.get('concessions') as FormArray<FormGroup>;
  }

  protected touch(): void {
    this.dirtyTick.update((v) => v + 1);
  }

  protected invalid(control: string): boolean {
    const field = this.form.get(control);
    return !!field && field.invalid && (field.dirty || field.touched);
  }

  protected offersTds(rate: TdsRate): boolean {
    return this.tdsOptions().includes(rate);
  }

  protected toggleTds(rate: TdsRate, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.tdsOptions.update((list) =>
      checked ? [...list, rate].sort((a, b) => a - b) : list.filter((r) => r !== rate),
    );
    this.touch();
  }

  /**
   * What the agency actually receives if the applicant opts for each rate.
   *
   * dirtyTick is read for the same reason liveTotals reads it: the amounts
   * live in a reactive form, which is not a signal, so nothing here would
   * otherwise notice them changing. Without it these figures were computed
   * once - when a rate was ticked - and then never again, so ticking a rate
   * before typing an amount left both previews showing zero against a gross
   * of thirteen thousand.
   */
  protected readonly tdsPreviews = computed(() => {
    this.dirtyTick();
    return this.tdsOptions().map((rate) => ({
      rate,
      netPayable: computeFeeTotals({
        gstPercent: Number(this.form.get('gstPercent')?.value ?? 0),
        tdsPercent: rate,
        components: this.components.controls.map((c) => ({
          id: 0,
          kind: 'Base' as const,
          label: '',
          amount: Number(c.get('amount')?.value ?? 0),
          isTaxable: !!c.get('isTaxable')?.value,
        })),
      }).netPayable,
    }));
  });

  protected addComponent(): void {
    this.components.push(
      this.fb.group({
        id: [0],
        kind: ['Base'],
        label: ['', Validators.required],
        amount: [0, Validators.min(0)],
        isTaxable: [true],
      }),
    );
    this.touch();
  }

  protected removeComponent(index: number): void {
    this.components.removeAt(index);
    this.touch();
  }

  protected addConcession(): void {
    this.concessions.push(
      this.fb.group({ id: [0], label: [''], percentage: [0], remarks: [''] }),
    );
  }

  protected removeConcession(index: number): void {
    this.concessions.removeAt(index);
  }

  protected openForm(row?: FeeStructure): void {
    this.editing.set(row ?? null);
    this.components.clear();
    this.concessions.clear();
    this.form.patchValue({
      programTypeId: row?.programTypeId ?? null,
      title: row?.title ?? '',
      gstPercent: row?.gstPercent ?? 18,
      effectiveFrom: row?.effectiveFrom ?? new Date().toISOString().slice(0, 10),
      effectiveTo: row?.effectiveTo ?? '',
      status: row?.status ?? 'Active',
    });
    for (const component of row?.components ?? []) {
      this.components.push(
        this.fb.group({
          id: [component.id],
          kind: [component.kind],
          label: [component.label, Validators.required],
          amount: [component.amount, Validators.min(0)],
          isTaxable: [component.isTaxable],
        }),
      );
    }
    for (const concession of row?.concessions ?? []) {
      this.concessions.push(
        this.fb.group({
          id: [concession.id],
          label: [concession.label],
          percentage: [concession.percentage],
          remarks: [concession.remarks ?? ''],
        }),
      );
    }
    if (!this.components.length) this.addComponent();
    this.tdsOptions.set([...(row?.tdsOptions ?? [])]);
    this.touch();
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
    this.saving.set(true);
    const payload = { ...this.form.getRawValue(), tdsOptions: this.tdsOptions() };
    const current = this.editing();
    const request = current ? this.service.update(current.id, payload) : this.service.create(payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Fee structure saved', payload.title ?? '');
        this.closeForm();
        this.list.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  protected async setStatus(row: { id: number; status: string; title?: string }, status: RecordStatus): Promise<void> {
    const verb = status === 'Active' ? 'Enable' : 'Disable';
    const confirmed = await this.confirm.ask({
      title: `${verb} fee structure?`,
      message:
        status === 'Active'
          ? 'The record becomes available again for new transactions.'
          : 'The record stays in history but can no longer be selected for new transactions.',
      confirmLabel: verb,
      tone: status === 'Active' ? 'primary' : 'danger',
    });
    if (!confirmed) return;
    this.service.setStatus(row.id, status).subscribe(() => {
      this.toast.success(`Fee structure ${status === 'Active' ? 'enabled' : 'disabled'}`, row.title);
      this.list.reload();
    });
  }
}
