import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Id, LookupItem } from '../../core/models';
import { LookupService } from '../../core/services/masters.service';

/**
 * The Category and Sub-category a chosen programme type belongs to, shown
 * beside the selector and not editable.
 *
 * Display only, deliberately. The linkage is a property of the programme type,
 * so offering it as a second place to set it would create two answers to one
 * question. Showing it makes the consequence of the choice legible without
 * asking anyone to re-state it.
 */
@Component({
  selector: 'app-program-type-linkage',
  changeDetection: ChangeDetectionStrategy.OnPush,
  /* The host box is dissolved so the two fields sit directly in the form grid rather than in a box of their own. */
  styles: ':host { display: contents; }',
  template: `
    <div class="field">
      <label class="field-label" [attr.for]="id + 'Cat'">Category</label>
      <input
        [id]="id + 'Cat'"
        class="input"
        [value]="category()"
        disabled
        [placeholder]="placeholder()"
      />
    </div>
    <div class="field">
      <label class="field-label" [attr.for]="id + 'Sub'">Sub-category</label>
      <input
        [id]="id + 'Sub'"
        class="input"
        [value]="subCategory()"
        disabled
        [placeholder]="placeholder()"
      />
    </div>
  `,
})
export class ProgramTypeLinkageComponent {
  private readonly lookups = inject(LookupService);

  /** The programme type currently chosen, or null before one is picked. */
  readonly programTypeId = input<Id | null | undefined>(null);
  readonly placeholder = input('Follows the programme type');

  /** Keeps ids unique when more than one of these appears on a page. */
  readonly id = `ptl${Math.random().toString(36).slice(2, 7)}`;

  private readonly programTypes = toSignal(this.lookups.programTypes(null), {
    initialValue: [] as LookupItem[],
  });
  private readonly subCategories = toSignal(this.lookups.subCategories(null), {
    initialValue: [] as LookupItem[],
  });
  private readonly categories = toSignal(this.lookups.categories(), {
    initialValue: [] as LookupItem[],
  });

  /* A programme type points at its sub-category, which points at its category,
     so both are resolved by following that chain rather than stored twice. */
  private readonly chosenSubCategory = computed(() => {
    const chosen = this.programTypes().find((type) => type.id === this.programTypeId());
    return this.subCategories().find((sub) => sub.id === chosen?.parentId) ?? null;
  });

  protected readonly subCategory = computed(() => this.chosenSubCategory()?.name ?? '');

  protected readonly category = computed(() => {
    const parent = this.chosenSubCategory()?.parentId;
    return this.categories().find((cat) => cat.id === parent)?.name ?? '';
  });
}
