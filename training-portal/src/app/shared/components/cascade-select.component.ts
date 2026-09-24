import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { LookupItem } from '../../core/models';
import { LookupService } from '../../core/services/masters.service';

/**
 * Category -> Sub-category -> Program type cascade bound to an existing form
 * group. The group must expose `categoryId`, `subCategoryId` and, when
 * `showProgramType` is on, `programTypeId`.
 */
@Component({
  selector: 'app-cascade-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <ng-container [formGroup]="group()">
      <div class="field">
        <label class="field-label" [for]="idFor('category')">
          Category @if (required()) { <span class="req">*</span> }
        </label>
        <select
          class="select"
          [id]="idFor('category')"
          formControlName="categoryId"
          (change)="onCategoryChange()"
        >
          <option [ngValue]="null">{{ anyLabel() }}</option>
          @for (item of categories(); track item.id) {
            <option [ngValue]="item.id">{{ item.name }}</option>
          }
        </select>
      </div>

      <div class="field">
        <label class="field-label" [for]="idFor('sub')">
          Sub-category @if (required()) { <span class="req">*</span> }
        </label>
        <select
          class="select"
          [id]="idFor('sub')"
          formControlName="subCategoryId"
          (change)="onSubCategoryChange()"
        >
          <option [ngValue]="null">{{ anyLabel() }}</option>
          @for (item of subCategories(); track item.id) {
            <option [ngValue]="item.id">{{ item.name }}</option>
          }
        </select>
      </div>

      @if (showProgramType()) {
        <div class="field">
          <label class="field-label" [for]="idFor('pt')">
            Program type @if (required()) { <span class="req">*</span> }
          </label>
          <select class="select" [id]="idFor('pt')" formControlName="programTypeId">
            <option [ngValue]="null">{{ anyLabel() }}</option>
            @for (item of programTypes(); track item.id) {
              <option [ngValue]="item.id">{{ item.name }}</option>
            }
          </select>
        </div>
      }
    </ng-container>
  `,
  /* `contents` lets the three selects become direct children of the parent
     grid so filter bars and form grids align them like any other field. */
  styles: [':host { display: contents; }'],
})
export class CascadeSelectComponent {
  private readonly lookups = inject(LookupService);
  private static seq = 0;
  private readonly uid = `cascade-${++CascadeSelectComponent.seq}`;

  readonly group = input.required<FormGroup>();
  readonly showProgramType = input(true);
  readonly required = input(false);
  readonly anyLabel = input('All');

  protected readonly categories = toSignal(this.lookups.categories(), { initialValue: [] as LookupItem[] });
  protected readonly subCategories = signal<LookupItem[]>([]);
  protected readonly programTypes = signal<LookupItem[]>([]);

  constructor() {
    /* Re-hydrate the dependent lists when the group is patched from outside. */
    effect(() => {
      const group = this.group();
      const categoryId = group.get('categoryId')?.value ?? null;
      const subCategoryId = group.get('subCategoryId')?.value ?? null;
      this.loadSubCategories(categoryId);
      this.loadProgramTypes(subCategoryId);
    });
  }

  protected idFor(part: string): string {
    return `${this.uid}-${part}`;
  }

  protected onCategoryChange(): void {
    const group = this.group();
    group.patchValue({ subCategoryId: null, programTypeId: null }, { emitEvent: false });
    this.programTypes.set([]);
    this.loadSubCategories(group.get('categoryId')?.value ?? null);
  }

  protected onSubCategoryChange(): void {
    const group = this.group();
    group.patchValue({ programTypeId: null }, { emitEvent: false });
    this.loadProgramTypes(group.get('subCategoryId')?.value ?? null);
  }

  private loadSubCategories(categoryId: number | null): void {
    this.lookups.subCategories(categoryId).subscribe((items) => this.subCategories.set(items));
  }

  private loadProgramTypes(subCategoryId: number | null): void {
    if (!this.showProgramType()) return;
    this.lookups.programTypes(subCategoryId).subscribe((items) => this.programTypes.set(items));
  }
}
