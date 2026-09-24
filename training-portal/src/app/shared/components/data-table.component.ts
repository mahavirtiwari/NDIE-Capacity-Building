import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  TemplateRef,
  computed,
  contentChildren,
  inject,
  input,
  output,
} from '@angular/core';
import { EmptyStateComponent } from './empty-state.component';
import { IconComponent, IconName } from './icon.component';

export interface ColumnDef {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
  /** Style applied to the plain-text rendering when no custom template exists. */
  variant?: 'default' | 'primary' | 'muted';
}

/** Supplies a custom cell renderer: `<ng-template appCell="status" let-row>`. */
@Directive({ selector: '[appCell]' })
export class CellTemplateDirective {
  readonly appCell = input.required<string>();
  readonly template = inject<TemplateRef<{ $implicit: unknown }>>(TemplateRef);
}

@Component({
  selector: 'app-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, IconComponent, EmptyStateComponent],
  template: `
    <div class="table-wrap">
      <table class="table" [class.table--compact]="compact()" [style.min-width]="minWidth() || null">
        <thead>
          <tr>
            @for (col of columns(); track col.key) {
              <th
                [style.width]="col.width || null"
                [style.text-align]="col.align || 'left'"
                [class.is-sortable]="col.sortable"
                [class.is-sorted]="sortBy() === col.key"
                (click)="col.sortable ? toggleSort(col.key) : null"
              >
                {{ col.header }}
                @if (col.sortable) {
                  <span class="sort-caret">
                    <app-icon [name]="caretFor(col.key)" [size]="12" />
                  </span>
                }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @if (loading()) {
            @for (skeleton of skeletonRows; track skeleton) {
              <tr>
                @for (col of columns(); track col.key) {
                  <td><span class="skeleton" [style.width.%]="60 + ($index % 3) * 12"></span></td>
                }
              </tr>
            }
          } @else {
            @for (row of rows(); track trackOf(row)) {
              <tr>
                @for (col of columns(); track col.key) {
                  <td
                    [style.text-align]="col.align || 'left'"
                    [class.cell-primary]="col.variant === 'primary'"
                    [class.cell-muted]="col.variant === 'muted'"
                  >
                    @if (templateFor(col.key); as tpl) {
                      <ng-container *ngTemplateOutlet="tpl; context: { $implicit: row }" />
                    } @else {
                      {{ display(cell(row, col.key)) }}
                    }
                  </td>
                }
              </tr>
            }
          }
        </tbody>
      </table>

      @if (!loading() && !rows().length) {
        <app-empty-state [title]="emptyTitle()" [message]="emptyMessage()" [icon]="emptyIcon()" />
      }
    </div>

    @if (showPager()) {
      <div class="pager">
        <span class="pager__info">
          @if (total()) {
            Showing {{ from() }}-{{ to() }} of {{ total() }}
          } @else {
            No records
          }
        </span>
        <div class="row row-sm">
          <select
            class="select"
            style="width: auto; padding: 0.25rem 1.8rem 0.25rem 0.5rem; font-size: var(--fs-sm)"
            [value]="pageSize()"
            (change)="onPageSize($event)"
            aria-label="Rows per page"
          >
            @for (size of pageSizes; track size) {
              <option [value]="size">{{ size }} / page</option>
            }
          </select>
          <div class="pager__controls">
            <button type="button" class="pager__btn" [disabled]="page() === 1" (click)="go(1)" aria-label="First page">
              <app-icon name="chevron-left" [size]="12" />
            </button>
            <button type="button" class="pager__btn" [disabled]="page() === 1" (click)="go(page() - 1)">
              Prev
            </button>
            @for (p of pageWindow(); track p) {
              <button
                type="button"
                class="pager__btn"
                [class.is-active]="p === page()"
                (click)="go(p)"
              >
                {{ p }}
              </button>
            }
            <button
              type="button"
              class="pager__btn"
              [disabled]="page() >= pageCount()"
              (click)="go(page() + 1)"
            >
              Next
            </button>
            <button
              type="button"
              class="pager__btn"
              [disabled]="page() >= pageCount()"
              (click)="go(pageCount())"
              aria-label="Last page"
            >
              <app-icon name="chevron-right" [size]="12" />
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DataTableComponent {
  readonly columns = input.required<ColumnDef[]>();
  readonly rows = input.required<readonly unknown[]>();
  readonly trackKey = input('id');
  readonly total = input(0);
  readonly page = input(1);
  readonly pageSize = input(10);
  readonly loading = input(false);
  readonly compact = input(false);
  /** Forces a horizontal scroll instead of squeezing a wide column set. */
  readonly minWidth = input<string>();
  readonly showPager = input(true);
  readonly sortBy = input<string | null>(null);
  readonly sortDir = input<'asc' | 'desc'>('asc');
  readonly emptyTitle = input('No records found');
  readonly emptyMessage = input<string>('Try changing the filters or add a new record.');
  readonly emptyIcon = input<IconName>('inbox');

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly sortChange = output<{ sortBy: string; sortDir: 'asc' | 'desc' }>();

  protected readonly cells = contentChildren(CellTemplateDirective);
  protected readonly skeletonRows = [1, 2, 3, 4, 5];
  protected readonly pageSizes = [10, 25, 50, 100];

  private readonly templateMap = computed(() => {
    const map = new Map<string, TemplateRef<{ $implicit: unknown }>>();
    for (const cell of this.cells()) map.set(cell.appCell(), cell.template);
    return map;
  });

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(this.pageSize(), 1))),
  );
  protected readonly from = computed(() => (this.page() - 1) * this.pageSize() + 1);
  protected readonly to = computed(() => Math.min(this.page() * this.pageSize(), this.total()));

  protected readonly pageWindow = computed(() => {
    const count = this.pageCount();
    const current = this.page();
    const start = Math.max(1, Math.min(current - 2, count - 4));
    const end = Math.min(count, start + 4);
    const pages: number[] = [];
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  });

  protected templateFor(key: string): TemplateRef<{ $implicit: unknown }> | null {
    return this.templateMap().get(key) ?? null;
  }

  protected cell(row: unknown, key: string): unknown {
    return (row as Record<string, unknown>)[key];
  }

  protected trackOf(row: unknown): unknown {
    return (row as Record<string, unknown>)[this.trackKey()];
  }

  protected display(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  protected caretFor(key: string): IconName {
    if (this.sortBy() !== key) return 'chevron-down';
    return this.sortDir() === 'asc' ? 'chevron-up' : 'chevron-down';
  }

  protected toggleSort(key: string): void {
    const dir = this.sortBy() === key && this.sortDir() === 'asc' ? 'desc' : 'asc';
    this.sortChange.emit({ sortBy: key, sortDir: dir });
  }

  protected go(page: number): void {
    const target = Math.min(Math.max(1, page), this.pageCount());
    if (target !== this.page()) this.pageChange.emit(target);
  }

  protected onPageSize(event: Event): void {
    this.pageSizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
