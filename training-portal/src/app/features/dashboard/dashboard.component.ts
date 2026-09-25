import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, switchMap } from 'rxjs';
import { LookupItem, PROGRAM_MODES } from '../../core/models';
import { AuthService } from '../../core/services/auth.service';
import { LookupService } from '../../core/services/masters.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { DashboardData, DashboardFilters, DashboardService } from '../../core/services/workflow.service';
import { StateCoverageResult } from '../../core/models';
import { StateCoverageMapComponent } from './state-coverage-map.component';
import { CascadeSelectComponent } from '../../shared/components/cascade-select.component';
import { BarChartComponent } from '../../shared/components/charts.component';
import { IconComponent, IconName } from '../../shared/components/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatCardComponent } from '../../shared/components/stat-card.component';
import { GenderDonutComponent, ShareBarsComponent } from './participant-profile.component';

/** -1 is the sentinel for a hand-picked range; every other value is a rolling window. */
const CUSTOM_PERIOD = -1;

const PERIODS: { value: number; label: string }[] = [
  { value: 0, label: 'All time' },
  { value: 3, label: 'Last 3 months' },
  { value: 6, label: 'Last 6 months' },
  { value: 12, label: 'Last 12 months' },
  { value: CUSTOM_PERIOD, label: 'Custom range…' },
];

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    StatCardComponent,
    BarChartComponent,
    CascadeSelectComponent,
    IconComponent,
    StateCoverageMapComponent,
    GenderDonutComponent,
    ShareBarsComponent,
  ],
  template: `
    <app-page-header [title]="'Welcome, ' + auth.displayName()" icon="dashboard" />

    <section class="card mb-md">
      <div class="card__body card__body--tight">
        <form [formGroup]="filterForm" class="filter-bar filter-bar--two-rows">
          <app-cascade-select [group]="filterForm" anyLabel="All" />
          <div class="field">
            <label class="field-label" for="dashAgency">Implementing Agency</label>
            <select id="dashAgency" class="select" formControlName="agencyId">
              <option [ngValue]="null">All Agencies</option>
              @for (agency of agencies(); track agency.id) {
                <option [ngValue]="agency.id">{{ agency.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="dashState">State/UT</label>
            <select id="dashState" class="select" formControlName="state">
              <option [ngValue]="null">All States/UTs</option>
              @for (state of states(); track state.id) {
                <option [ngValue]="state.name">{{ state.name }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="dashMode">Mode of Program</label>
            <select id="dashMode" class="select" formControlName="mode">
              <option [ngValue]="null">All Modes</option>
              @for (mode of modes; track mode) {
                <option [ngValue]="mode">{{ mode }}</option>
              }
            </select>
          </div>
          <div class="field">
            <label class="field-label" for="dashPeriod">Period</label>
            <select id="dashPeriod" class="select" formControlName="months">
              @for (period of periods; track period.value) {
                <option [ngValue]="period.value">{{ period.label }}</option>
              }
            </select>
          </div>
          @if (isCustomPeriod()) {
            <div class="field">
              <label class="field-label" for="dashFrom">From</label>
              <input
                id="dashFrom"
                type="date"
                class="input"
                formControlName="fromDate"
                [max]="filterForm.controls.toDate.value || today"
              />
            </div>
            <div class="field">
              <label class="field-label" for="dashTo">To</label>
              <input
                id="dashTo"
                type="date"
                class="input"
                formControlName="toDate"
                [min]="filterForm.controls.fromDate.value || null"
                [max]="today"
              />
            </div>
          }
          <div class="filter-bar__actions">
            <button type="button" class="btn btn--primary" (click)="apply()">
              <app-icon name="filter" [size]="15" /> Apply
            </button>
            <button type="button" class="btn btn--ghost" (click)="reset()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          </div>
        </form>
      </div>
    </section>

    @if (data(); as model) {
      <div class="kpi-grid">
        @for (kpi of model.kpis; track kpi.key) {
          <app-stat-card
            [label]="kpi.label"
            [value]="kpi.value"
            [icon]="iconFor(kpi.icon)"
            [tone]="kpi.tone"
          />
        }
      </div>

      <div class="mt-lg">
        <app-state-coverage-map [data]="coverage() ?? null" />
      </div>

      <div class="dash-row mt-lg">
        <section class="card">
          <div class="card__header">
            <div class="stack stack-xs">
              <span class="card__title">{{ copy.text('charts.monthly.title') }}</span>
              <span class="card__subtitle">{{ copy.text('charts.monthly.subtitle') }}</span>
            </div>
          </div>
          <div class="card__body">
            <app-bar-chart [data]="model.programsByMonth" />
          </div>
        </section>

        <section class="card">
          <div class="card__header">
            <div class="stack stack-xs">
              <span class="card__title">{{ copy.text('charts.gender.title') }}</span>
              <span class="card__subtitle">{{ copy.text('charts.gender.subtitle') }}</span>
            </div>
          </div>
          <div class="card__body">
            @if (hasParticipants()) {
              <app-gender-donut [data]="model.participantsByGender" />
            } @else {
              <p class="text-sm text-muted">No participants recorded for this selection.</p>
            }
          </div>
        </section>

        <section class="card">
          <div class="card__header">
            <div class="stack stack-xs">
              <span class="card__title">{{ copy.text('charts.social.title') }}</span>
              <span class="card__subtitle">{{ copy.text('charts.social.subtitle') }}</span>
            </div>
          </div>
          <div class="card__body">
            @if (hasParticipants()) {
              <app-share-bars [data]="model.participantsBySocialCategory" />
            } @else {
              <p class="text-sm text-muted">No participants recorded for this selection.</p>
            }
          </div>
        </section>
      </div>
    } @else {
      <div class="kpi-grid">
        @for (n of [1, 2, 3, 4, 5, 6]; track n) {
          <div class="card" style="height: 96px"></div>
        }
      </div>
    }
  `,
  styles: [
    `
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 1rem;
      }
      /* The three panels read as one band across the page. The month chart
         scrolls, so it keeps a little more width than the two profile cards
         beside it. */
      .dash-row {
        display: grid;
        grid-template-columns: 1.25fr 1fr 1fr;
        gap: 1rem;
        align-items: stretch;
      }
      /* The cards are all the height of the tallest, so each body takes the
         room left under its header and centres its chart in it — otherwise the
         shorter charts hang from the top with a pool of white beneath. */
      .dash-row > .card {
        display: flex;
        flex-direction: column;
        /* A grid item defaults to min-width:auto, which lets wide content push
           the track open. The month chart is deliberately wider than its card,
           so without this it stretched the whole band instead of scrolling. */
        min-width: 0;
      }
      .dash-row > .card > .card__body {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
      }
      /* The donut and its legend stop fitting side by side well before the
         month chart does, so the band folds in two steps rather than one. */
      @media (max-width: 1400px) {
        .dash-row { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 900px) {
        .dash-row { grid-template-columns: 1fr; }
      }
    `,
  ],
})
export class DashboardComponent {
  /** Section wording, maintained under Administration → Site text. */
  protected readonly copy = inject(SiteTextService);

  private readonly service = inject(DashboardService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);

  protected readonly periods = PERIODS;
  protected readonly modes = PROGRAM_MODES;
  protected readonly agencies = toSignal(this.lookups.agencies(), { initialValue: [] as LookupItem[] });
  protected readonly states = toSignal(this.lookups.states(), { initialValue: [] as LookupItem[] });

  protected readonly filterForm = this.fb.group({
    categoryId: [null as number | null],
    subCategoryId: [null as number | null],
    programTypeId: [null as number | null],
    agencyId: [null as number | null],
    state: [null as string | null],
    mode: [null as string | null],
    months: [0 as number | null],
    fromDate: [null as string | null],
    toDate: [null as string | null],
  });

  private readonly applied = new BehaviorSubject<DashboardFilters>({});
  protected readonly data = toSignal<DashboardData | undefined>(
    this.applied.pipe(switchMap((filters) => this.service.load(filters))),
  );

  /* Loaded alongside the rest of the dashboard and re-fetched with the same
     filters, so the map never disagrees with the figures beside it. */
  protected readonly coverage = toSignal<StateCoverageResult | undefined>(
    this.applied.pipe(switchMap((filters) => this.service.stateCoverage(filters))),
  );

  /* An empty profile and an all-zero profile look the same on a chart, so the
     card says so in words rather than drawing a ring of nothing. */
  protected readonly hasParticipants = computed(
    () => (this.data()?.participantsByGender ?? []).some((point) => point.value > 0),
  );

  /** Today, so neither end of a custom range can be set in the future. */
  protected readonly today = new Date().toISOString().slice(0, 10);

  /** Tracks the Period control so the two date inputs appear only when wanted. */
  private readonly periodValue = toSignal(this.filterForm.controls.months.valueChanges, {
    initialValue: this.filterForm.controls.months.value,
  });

  protected readonly isCustomPeriod = computed(() => this.periodValue() === CUSTOM_PERIOD);

  protected apply(): void {
    const raw = this.filterForm.getRawValue();
    const custom = raw.months === CUSTOM_PERIOD;

    this.applied.next({
      categoryId: raw.categoryId,
      subCategoryId: raw.subCategoryId,
      programTypeId: raw.programTypeId,
      agencyId: raw.agencyId,
      state: raw.state,
      mode: raw.mode,
      /* The sentinel is a UI concern; the server sees either a rolling window
         or two dates, never both. */
      months: custom ? null : raw.months,
      fromDate: custom ? raw.fromDate : null,
      toDate: custom ? raw.toDate : null,
    });
  }

  protected reset(): void {
    this.filterForm.reset({
      categoryId: null,
      subCategoryId: null,
      programTypeId: null,
      agencyId: null,
      state: null,
      mode: null,
      months: 0,
      fromDate: null,
      toDate: null,
    });
    this.applied.next({});
  }

  protected iconFor(name: string): IconName {
    return name as IconName;
  }
}
