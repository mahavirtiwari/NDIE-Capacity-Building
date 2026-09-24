import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { LookupItem } from '../../core/models';
import { IconComponent } from './icon.component';

/**
 * Multi-select for one axis of an allocation, with Select all.
 *
 * Select all is not cosmetic here: an empty allocation grants nothing, so full
 * reach has to be stated rather than left blank. The control therefore always
 * shows how many of how many are chosen, and warns when none are — that is the
 * state most likely to be an accident.
 *
 * The options handed in are already limited to what the signed-in user may
 * pass on, so the picker never has to reason about permission itself.
 */
@Component({
  selector: 'app-scope-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="scope" [class.scope--empty]="selected().length === 0">
      <div class="scope__head">
        <div class="scope__title">
          <span class="field-label">{{ label() }} <span class="req">*</span></span>
          <span class="scope__count" [class.scope__count--none]="selected().length === 0">
            {{ selected().length }} of {{ options().length }}
          </span>
        </div>

        @if (options().length > 0) {
          <div class="scope__actions">
            <button
              type="button"
              class="btn btn--ghost btn--tiny"
              [disabled]="allChosen()"
              (click)="selectAll()"
            >
              <app-icon name="check" [size]="13" /> Select all
            </button>
            <button
              type="button"
              class="btn btn--ghost btn--tiny"
              [disabled]="selected().length === 0"
              (click)="clear()"
            >
              Clear
            </button>
          </div>
        }
      </div>

      @if (options().length === 0) {
        <p class="scope__none">{{ emptyMessage() }}</p>
      } @else {
        <div class="scope__grid" role="group" [attr.aria-label]="label()">
          @for (option of options(); track option.id) {
            <label class="scope__item" [class.scope__item--on]="isChosen(option.id)">
              <input
                type="checkbox"
                [checked]="isChosen(option.id)"
                (change)="toggle(option.id)"
              />
              <span class="scope__name">{{ option.name }}</span>
              @if (option.code) {
                <span class="scope__code">{{ option.code }}</span>
              }
            </label>
          }
        </div>

        @if (selected().length === 0) {
          <p class="scope__warn">
            <app-icon name="alert" [size]="13" />
            Nothing selected means no access to any {{ label().toLowerCase() }}.
          </p>
        }
      }
    </div>
  `,
  styles: `
    .scope {
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      padding: 0.75rem 0.875rem 0.875rem;
      background: var(--surface);
    }
    .scope--empty {
      border-color: color-mix(in srgb, var(--warning-500) 45%, var(--border-strong));
    }
    .scope__head {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.625rem;
    }
    .scope__title {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }
    .scope__title .field-label {
      margin: 0;
    }
    .scope__count {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--brand-600);
      background: var(--brand-50);
      border-radius: 999px;
      padding: 0.1rem 0.5rem;
    }
    .scope__count--none {
      color: var(--warning-700, #8a5a00);
      background: var(--warning-100, #fdf2d9);
    }
    .scope__actions {
      display: flex;
      gap: 0.25rem;
    }
    .btn--tiny {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      min-height: 0;
    }
    .scope__grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
      gap: 0.25rem 0.75rem;
      max-height: 210px;
      overflow-y: auto;
    }
    .scope__item {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.25rem 0.375rem;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8125rem;
      color: var(--ink-700);
    }
    .scope__item:hover {
      background: var(--brand-50);
    }
    .scope__item--on {
      color: var(--ink-900);
      font-weight: 500;
    }
    .scope__name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .scope__code {
      margin-left: auto;
      font-size: 0.6875rem;
      color: var(--ink-500);
    }
    .scope__none,
    .scope__warn {
      margin: 0;
      font-size: 0.75rem;
      color: var(--ink-600);
    }
    .scope__warn {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      margin-top: 0.5rem;
      color: var(--warning-700, #8a5a00);
    }

    @media (max-width: 560px) {
      .scope__grid {
        grid-template-columns: 1fr;
        max-height: 170px;
      }
    }
  `,
})
export class ScopePickerComponent {
  readonly label = input.required<string>();
  readonly options = input.required<LookupItem[]>();
  readonly selected = model<number[]>([]);
  readonly emptyMessage = input('Nothing is available to allocate here.');

  protected readonly allChosen = computed(
    () => this.options().length > 0 && this.selected().length === this.options().length,
  );

  protected isChosen(id: number): boolean {
    return this.selected().includes(id);
  }

  protected toggle(id: number): void {
    const current = this.selected();
    this.selected.set(
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  /** Resolves to every option on offer — which is already only what the user holds. */
  protected selectAll(): void {
    this.selected.set(this.options().map((o) => Number(o.id)));
  }

  protected clear(): void {
    this.selected.set([]);
  }
}
