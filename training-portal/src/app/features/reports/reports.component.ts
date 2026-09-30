import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { Id, ProgrammeReport, ReportProgramme } from '../../core/models';
import { LookupService } from '../../core/services/masters.service';
import { ReportService } from '../../core/services/report.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
} from '../../shared/components/data-table.component';
import { IconComponent } from '../../shared/components/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { ListState, searchTerm } from '../../shared/list-state';
import { environment } from '../../../environments/environment';
import { downloadWorkbook, stampedName } from '../../shared/excel';
import { buildProgrammeReport } from './programme-report.document';
import {
  ALL_SECTIONS,
  ReportSection,
  SECTION_LABELS,
  programmeReportSheets,
} from './programme-report.workbook';

const COLUMNS: ColumnDef[] = [
  { key: 'code', header: 'Program ID', sortable: true, width: '150px', variant: 'primary' },
  { key: 'agency', header: 'Agency', sortable: true },
  { key: 'programme', header: 'Program' },
  { key: 'venue', header: 'Venue' },
  { key: 'dates', header: 'From – to', width: '190px' },
  { key: 'participantCount', header: 'Enrolled', align: 'center', sortable: true, width: '100px' },
  { key: 'actions', header: '', align: 'right', width: '120px' },
];

@Component({
  selector: 'app-reports',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    IconComponent,
  ],
  template: `
    <app-page-header
      [title]="copy.text('page.reports.title')"
      [subtitle]="copy.text('page.reports.subtitle')"
      icon="file"
      [breadcrumbs]="[{ label: 'Reports' }, { label: copy.text('page.reports.title') }]"
    />

    <section class="card">
      <div class="card__body card__body--tight">
        <p class="text-muted text-sm">
          Pick a program type to see its programmes, then open a report. Reports are put
          together when you ask for one and are not stored — what you see is the record as it
          stands now. Save it as a PDF from the print dialog, or download the page itself.
        </p>

        <div class="filter-bar">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input
                class="input"
                placeholder="Search by program ID, name or venue"
                (input)="list.setSearch(term($event))"
              />
            </div>
          </div>

          <div class="field">
            <label class="field-label" for="rpCategory">Category</label>
            <select id="rpCategory" class="select" (change)="onCategory(numberOrNull($event))">
              <option value="">All categories</option>
              @for (option of categories(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field-label" for="rpType">Program type</label>
            <select id="rpType" class="select" (change)="list.setFilter('programTypeId', value($event))">
              <option value="">All program types</option>
              @for (option of programTypes(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field-label" for="rpAgency">Agency</label>
            <select id="rpAgency" class="select" (change)="list.setFilter('agencyId', value($event))">
              <option value="">All agencies</option>
              @for (option of agencies(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field-label" for="rpState">State/UT</label>
            <select id="rpState" class="select" (change)="list.setFilter('stateCode', value($event))">
              <option value="">All states/UTs</option>
              @for (option of states(); track option.id) {
                <option [value]="option.id">{{ option.name }}</option>
              }
            </select>
          </div>

          <div class="field">
            <label class="field-label" for="rpFrom">From</label>
            <input id="rpFrom" type="date" class="input" (change)="list.setFilter('from', value($event))" />
          </div>

          <div class="field">
            <label class="field-label" for="rpTo">To</label>
            <input id="rpTo" type="date" class="input" (change)="list.setFilter('to', value($event))" />
          </div>

          @if (list.hasFilters) {
            <button type="button" class="btn btn--ghost" (click)="list.clearFilters()">
              <app-icon name="refresh" [size]="15" /> Reset
            </button>
          }
        </div>
      </div>

      <app-data-table
        exportName="Program register"
        [exportRows]="exportRows"
        [columns]="columns"
        [rows]="list.rows()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [loading]="list.loading()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="No programs to report on"
        emptyMessage="A program appears here as soon as it is set up."
        emptyIcon="file"
        (pageChange)="list.goToPage($event)"
        (pageSizeChange)="list.setPageSize($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="code" let-row>
          <strong>{{ $any(row).programmeCode }}</strong>
        </ng-template>

        <ng-template appCell="agency" let-row>
          {{ $any(row).agencyName || '—' }}
        </ng-template>

        <ng-template appCell="programme" let-row>
          <div class="stack stack-xs">
            <span>{{ $any(row).programTypeName }}</span>
            <span class="text-xs text-muted">{{ $any(row).programmeName }}</span>
          </div>
        </ng-template>

        <ng-template appCell="venue" let-row>
          <div class="stack stack-xs">
            <span>{{ $any(row).venue }}</span>
            <span class="text-xs text-muted">
              {{ $any(row).districtName ? $any(row).districtName + ', ' : '' }}{{ $any(row).stateName || $any(row).mode }}
            </span>
          </div>
        </ng-template>

        <ng-template appCell="dates" let-row>
          <span class="tabular">{{ $any(row).startDate }} – {{ $any(row).endDate }}</span>
        </ng-template>

        <ng-template appCell="actions" let-row>
          <button type="button" class="btn btn--sm btn--secondary" (click)="open($any(row))">
            <app-icon name="eye" [size]="14" /> Report
          </button>
        </ng-template>
      </app-data-table>
    </section>

    <section class="card mt-md">
      <div class="card__header">
        <div class="stack stack-xs">
          <span class="card__title">Download as Excel</span>
          <span class="card__subtitle">
            One workbook across every programme the filters above match. Choose what goes in it.
          </span>
        </div>
      </div>
      <div class="card__body stack stack-md">
        <div class="check-grid">
          @for (section of allSections; track section) {
            <label class="check">
              <input
                type="checkbox"
                [checked]="chosen().includes(section)"
                (change)="toggleSection(section, $event)"
              />
              <span>{{ label(section) }}</span>
            </label>
          }
        </div>

        <div class="row row-sm row-wrap">
          <button
            type="button"
            class="btn btn--primary"
            [disabled]="building() || chosen().length === 0 || list.total() === 0"
            (click)="downloadCombined()"
          >
            @if (building()) { <span class="spinner"></span> }
            <app-icon name="download" [size]="15" />
            Build workbook ({{ workbookCount() }} programme{{ workbookCount() === 1 ? '' : 's' }})
          </button>

          <span class="field-hint">
            @if (list.total() > programmeCap) {
              {{ list.total() }} match the filters; the first {{ programmeCap }} are included.
              Narrow the filters for the rest — a workbook of every programme ever run is a
              download nobody waits for.
            } @else if (list.total() === 0) {
              Nothing matches the filters above.
            } @else {
              Every sheet carries the programme it came from, so the rows stay attributable
              once they are sorted.
            }
          </span>
        </div>
      </div>
    </section>

    @if (viewing()) {
      <section class="card mt-md">
        <div class="card__header">
          <div class="stack stack-xs">
            <span class="card__title">{{ viewing()!.programme.programmeCode }}</span>
            <span class="card__subtitle">{{ viewing()!.programme.programmeName }}</span>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn--secondary btn--sm" (click)="downloadExcel()">
              <app-icon name="download" [size]="15" /> Excel
            </button>
            <button type="button" class="btn btn--secondary btn--sm" (click)="downloadHtml()">
              <app-icon name="download" [size]="15" /> HTML
            </button>
            <button type="button" class="btn btn--primary btn--sm" (click)="print()">
              <app-icon name="printer" [size]="15" /> Print / Save as PDF
            </button>
            <button type="button" class="btn btn--ghost btn--sm" (click)="close()">Close</button>
          </div>
        </div>
        <div class="card__body">
          <iframe #frame class="report-frame" title="Program report"></iframe>
        </div>
      </section>
    }
  `,
  styles: [
    `
      .report-frame {
        width: 100%;
        height: 70vh;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: #fff;
      }
    `,
  ],
})
export class ReportsComponent {
  protected readonly copy = inject(SiteTextService);
  private readonly service = inject(ReportService);
  private readonly lookups = inject(LookupService);
  private readonly toast = inject(ToastService);

  private readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  protected readonly columns = COLUMNS;

  /* Held rather than written inline: an arrow in the template is a new

     function on every change detection pass. */

  protected readonly exportRows = () => this.list.fetchAll();
  protected readonly list = new ListState<ReportProgramme>(
    (request) => this.service.programmes(request),
    { sortBy: 'startDate', sortDir: 'desc' },
  );

  protected readonly categories = toSignal(this.lookups.categories(), { initialValue: [] });
  protected readonly states = toSignal(this.lookups.states(), { initialValue: [] });
  protected readonly agencies = toSignal(this.lookups.agencies(), { initialValue: [] });
  protected readonly programTypes = signal<{ id: Id; name: string }[]>([]);

  protected readonly viewing = signal<ProgrammeReport | null>(null);
  private readonly documentHtml = signal('');

  /** undefined until looked up; null once we know there is not one. */
  private logoDataUrl: string | null | undefined = undefined;

  constructor() {
    this.loadProgramTypes(null);

    /* The iframe does not exist until the report section has rendered, which
       happens after the signal that reveals it is set — not by the next
       microtask. Waiting on the element and the document together writes it
       whenever the element actually turns up. */
    effect(() => {
      const frame = this.frame()?.nativeElement;
      const html = this.documentHtml();
      if (frame && html) frame.srcdoc = html;
    });
  }

  protected term = searchTerm;
  protected value = (event: Event) => (event.target as HTMLSelectElement).value;

  protected numberOrNull(event: Event): number | null {
    const raw = (event.target as HTMLSelectElement).value;
    return raw ? Number(raw) : null;
  }

  protected onCategory(categoryId: number | null): void {
    this.list.setFilter('categoryId', categoryId ? String(categoryId) : '');
    this.list.setFilter('programTypeId', '');
    this.loadProgramTypes(categoryId);
  }

  private loadProgramTypes(categoryId: number | null): void {
    this.lookups.programTypes(null, categoryId).subscribe((items) => {
      this.programTypes.set(items.map((item) => ({ id: item.id, name: item.name })));
    });
  }

  protected open(row: ReportProgramme): void {
    this.service.programme(row.id).subscribe(async (report) => {
      this.viewing.set(report);
      /* srcdoc rather than a blob URL, so the document has no address of its
         own to be bookmarked, shared, or left behind in the browser. */
      this.documentHtml.set(buildProgrammeReport(report, await this.logo()));
    });
  }

  /**
   * The organisation's logo, inlined so a downloaded report still carries it.
   *
   * Fetched once and kept: the same mark goes on every report, and a request
   * per report would put the letterhead at the mercy of the network on a page
   * that is otherwise entirely local.
   *
   * A deployment that has not uploaded one, or a request that fails, yields
   * null and the cover falls back to the organisation's name in type. A
   * missing logo is not a reason to withhold the report.
   */
  private async logo(): Promise<string | null> {
    if (this.logoDataUrl !== undefined) return this.logoDataUrl;

    try {
      const response = await fetch(`${environment.apiBaseUrl}/branding/logo`);
      if (!response.ok) {
        this.logoDataUrl = null;
        return null;
      }

      const blob = await response.blob();
      this.logoDataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      this.logoDataUrl = null;
    }

    return this.logoDataUrl;
  }

  protected close(): void {
    this.viewing.set(null);
    this.documentHtml.set('');
  }

  /**
   * Prints the iframe rather than the page, so the sidebar and the filter bar
   * are not part of the PDF. Whether it becomes paper or a file is the print
   * dialog's business, which is where "Save as PDF" lives on every platform.
   */
  protected print(): void {
    const frame = this.frame()?.nativeElement;
    if (!frame?.contentWindow) return;

    frame.contentWindow.focus();
    frame.contentWindow.print();
  }

  /* ----------------------------------------------------------- workbooks */

  protected readonly allSections = ALL_SECTIONS;
  protected readonly chosen = signal<ReportSection[]>([...ALL_SECTIONS]);
  protected readonly building = signal(false);

  /**
   * How many programmes a combined workbook will pull.
   *
   * Each one is a request for its full dossier, so this is a cap on the
   * server as much as on the file: "every programme ever run" would be
   * hundreds of round trips behind a button nobody would wait out.
   */
  protected readonly programmeCap = 25;

  protected workbookCount(): number {
    return Math.min(this.list.total(), this.programmeCap);
  }

  protected label(section: ReportSection): string {
    return SECTION_LABELS[section];
  }

  protected toggleSection(section: ReportSection, event: Event): void {
    const on = (event.target as HTMLInputElement).checked;
    this.chosen.update((current) =>
      on ? [...current, section] : current.filter((s) => s !== section),
    );
  }

  /** The open report, every section, as one workbook. */
  protected async downloadExcel(): Promise<void> {
    const report = this.viewing();
    if (!report) return;

    await downloadWorkbook(
      stampedName(`${report.programme.programmeCode.replace(/[^A-Za-z0-9]+/g, '-')}-report`),
      programmeReportSheets(report),
    );
    this.toast.success('Workbook downloaded', report.programme.programmeCode);
  }

  /**
   * Every filtered programme in one workbook, a sheet per section.
   *
   * The dossiers are fetched one at a time rather than all at once: twenty-five
   * parallel requests for the heaviest query in the system is a way to make
   * the portal unusable for everybody else while one person exports.
   */
  protected async downloadCombined(): Promise<void> {
    const sections = this.chosen();
    if (this.building() || sections.length === 0) return;

    this.building.set(true);
    try {
      const { rows } = await this.list.fetchAll(this.programmeCap);
      const wanted = rows.slice(0, this.programmeCap);

      const sheets = [];
      for (const programme of wanted) {
        const report = await firstValueFrom(this.service.programme(programme.id));
        sheets.push(...programmeReportSheets(report, {
          prefix: programme.programmeCode.replace(/[^A-Za-z0-9]+/g, '-'),
          sections,
        }));
      }

      if (sheets.length === 0) {
        this.toast.error('Nothing to export for these filters.');
        return;
      }

      await downloadWorkbook(stampedName('programme-reports'), sheets);
      this.toast.success(
        `${wanted.length} programme(s) exported`,
        `${sheets.length} sheet(s)`,
      );
    } catch {
      this.toast.error('The workbook could not be built.');
    } finally {
      this.building.set(false);
    }
  }

  /** The same document, saved as a file. Nothing round-trips to the server. */
  protected downloadHtml(): void {
    const report = this.viewing();
    const html = this.documentHtml();
    if (!report || !html) return;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${report.programme.programmeCode}-report.html`;
    link.click();

    /* Released once the browser has taken it; left behind it would hold the
       whole document in memory for as long as the tab is open. */
    URL.revokeObjectURL(url);
    this.toast.success('Report downloaded', `${report.programme.programmeCode}-report.html`);
  }
}
