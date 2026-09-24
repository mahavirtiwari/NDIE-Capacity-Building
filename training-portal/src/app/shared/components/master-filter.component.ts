import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { LookupItem } from '../../core/models';
import { LookupService } from '../../core/services/masters.service';
import { ListState } from '../list-state';

/**
 * The Category → Sub-category → Programme type filter trio, which nearly every
 * register needs.
 *
 * Each level narrows the one below it, and choosing a broader level clears the
 * finer ones — otherwise a sub-category could stay selected under a category it
 * does not belong to, and the list would quietly return nothing with no visible
 * reason why.
 *
 * It writes straight into the screen's `ListState`, so a register adopts the
 * whole behaviour with one tag and cannot drift from the others.
 */
@Component({
  selector: 'app-master-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  /* The host box is dissolved so the three selects sit directly in the filter bar rather than in a box of their own. */
  styles: ':host { display: contents; }',
  template: `
    <div class="field">
      <label class="field-label" [attr.for]="id + 'Cat'">Category</label>
      <select
        [id]="id + 'Cat'"
        class="select"
        [value]="categoryId() ?? ''"
        (change)="onCategory($event)"
      >
        <option value="">All categories</option>
        @for (category of categories(); track category.id) {
          <option [value]="category.id">{{ category.name }}</option>
        }
      </select>
    </div>

    <div class="field">
      <label class="field-label" [attr.for]="id + 'Sub'">Sub-category</label>
      <select
        [id]="id + 'Sub'"
        class="select"
        [value]="subCategoryId() ?? ''"
        (change)="onSubCategory($event)"
      >
        <option value="">All sub-categories</option>
        @for (sub of subCategories(); track sub.id) {
          <option [value]="sub.id">{{ sub.name }}</option>
        }
      </select>
    </div>

    @if (showProgramType()) {
      <div class="field">
        <label class="field-label" [attr.for]="id + 'Pt'">{{ programTypeLabel() }}</label>
        <select
          [id]="id + 'Pt'"
          class="select"
          [value]="programTypeId() ?? ''"
          (change)="onProgramType($event)"
        >
          <option value="">All {{ programTypeLabel().toLowerCase() }}s</option>
          @for (type of programTypes(); track type.id) {
            <option [value]="type.id">{{ type.name }}</option>
          }
        </select>
      </div>
    }
  `,
})
export class MasterFilterComponent {
  private readonly lookups = inject(LookupService);

  /** The register's list state; the filters are written straight into it. */
  readonly list = input.required<ListState<unknown>>();

  /** Distinguishes the control ids when two filter bars share a page. */
  readonly id = `mf${Math.random().toString(36).slice(2, 7)}`;

  readonly showProgramType = input(true);
  /** "Program type" on the masters, "Programme type" on the academic screens. */
  readonly programTypeLabel = input('Programme type');

  private readonly allCategories = toSignal(this.lookups.categories(), {
    initialValue: [] as LookupItem[],
  });
  private readonly allSubCategories = toSignal(this.lookups.subCategories(null), {
    initialValue: [] as LookupItem[],
  });
  private readonly allProgramTypes = toSignal(this.lookups.programTypes(null), {
    initialValue: [] as LookupItem[],
  });

  protected readonly categoryId = signal<number | null>(null);
  protected readonly subCategoryId = signal<number | null>(null);
  protected readonly programTypeId = signal<number | null>(null);

  protected readonly categories = this.allCategories;

  protected readonly subCategories = computed(() => {
    const category = this.categoryId();
    const all = this.allSubCategories();
    return category === null ? all : all.filter((sub) => sub.parentId === category);
  });

  protected readonly programTypes = computed(() => {
    const subCategory = this.subCategoryId();
    const withinCategory = this.subCategories().map((sub) => sub.id);
    return this.allProgramTypes().filter((type) =>
      subCategory !== null
        ? type.parentId === subCategory
        : withinCategory.includes(type.parentId as number),
    );
  });

  protected onCategory(event: Event): void {
    const raw = value(event);
    this.categoryId.set(toId(raw));
    this.subCategoryId.set(null);
    this.programTypeId.set(null);
    this.list().setFilter('categoryId', raw || null);
    this.list().setFilter('subCategoryId', null);
    this.list().setFilter('programTypeId', null);
  }

  protected onSubCategory(event: Event): void {
    const raw = value(event);
    this.subCategoryId.set(toId(raw));
    this.programTypeId.set(null);
    this.list().setFilter('subCategoryId', raw || null);
    this.list().setFilter('programTypeId', null);
  }

  protected onProgramType(event: Event): void {
    const raw = value(event);
    this.programTypeId.set(toId(raw));
    this.list().setFilter('programTypeId', raw || null);
  }

  /** Called by the screen's Reset, so the dropdowns follow the cleared list. */
  clear(): void {
    this.categoryId.set(null);
    this.subCategoryId.set(null);
    this.programTypeId.set(null);
  }
}

const value = (event: Event): string => (event.target as HTMLSelectElement).value;
const toId = (raw: string): number | null => (raw ? Number(raw) : null);
