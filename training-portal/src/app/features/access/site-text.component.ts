import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SiteText } from '../../core/models';
import { SiteTextService as SiteTextApi } from '../../core/services/content.service';
import { SiteTextService } from '../../core/services/site-text.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import { IconComponent } from '../../shared/components/icon.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';

/**
 * The wording of the screens that are not driven by data.
 *
 * Grouped by the screen each string appears on, because that is how somebody
 * arrives here: they have looked at a page and want to change a line on it,
 * not gone looking for a key.
 */
@Component({
  selector: 'app-site-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, IconComponent, PageHeaderComponent],
  template: `
    <app-page-header
      icon="form"
      title="Site text"
      subtitle="The headings and wording on the screens that are not driven by data. Change any of
                them, or put one back to how it shipped."
      [breadcrumbs]="[{ label: 'Administration' }, { label: 'Site text' }]"
    >
      <button type="button" class="btn" [disabled]="overridden() === 0" (click)="restoreAll()">
        <app-icon name="refresh" [size]="15" />
        Restore all originals
      </button>
    </app-page-header>

    @if (overridden() > 0) {
      <div class="alert alert--info mb-md">
        <app-icon name="info" [size]="16" />
        <span>
          {{ overridden() }} {{ overridden() === 1 ? 'string has' : 'strings have' }} been
          reworded. The rest read as the product shipped them.
        </span>
      </div>
    }

    @if (loading()) {
      <p class="text-muted">Loading the wording...</p>
    }

    @for (group of groups(); track group.name) {
      <section class="card mb-md">
        <div class="card__header"><span class="card__title">{{ group.name }}</span></div>
        <div class="card__body stack stack-lg">
          @for (item of group.items; track item.key) {
            <div class="field">
              <label class="field-label" [attr.for]="item.key">
                {{ item.label }}
                @if (item.isOverridden) { <span class="chip">Changed</span> }
              </label>

              @if (item.multiline) {
                <textarea
                  [id]="item.key"
                  class="input"
                  rows="2"
                  [ngModel]="draft()[item.key] ?? item.value"
                  (ngModelChange)="edit(item.key, $event)"
                ></textarea>
              } @else {
                <input
                  [id]="item.key"
                  class="input"
                  [ngModel]="draft()[item.key] ?? item.value"
                  (ngModelChange)="edit(item.key, $event)"
                />
              }

              @if (item.hint) { <span class="field-hint">{{ item.hint }}</span> }

              <div class="row row-sm mt-sm">
                <button
                  type="button"
                  class="btn btn--sm btn--primary"
                  [disabled]="!changed(item)"
                  (click)="save(item)"
                >
                  Save
                </button>
                @if (item.isOverridden || changed(item)) {
                  <button type="button" class="btn btn--sm btn--ghost" (click)="restore(item)">
                    Restore original
                  </button>
                }
                @if (item.isOverridden) {
                  <span class="field-hint shipped">Shipped as: {{ item.default }}</span>
                }
              </div>
            </div>
          }
        </div>
      </section>
    }
  `,
  styles: [
    `
      .shipped {
        align-self: center;
        font-style: italic;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .mt-sm { margin-top: 0.4rem; }
    `,
  ],
})
export class SiteTextComponent {
  private readonly api = inject(SiteTextApi);
  private readonly live = inject(SiteTextService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly items = signal<SiteText[]>([]);
  protected readonly loading = signal(true);
  /** Edits not yet saved, by key. */
  protected readonly draft = signal<Record<string, string>>({});

  protected readonly overridden = computed(() => this.items().filter((i) => i.isOverridden).length);

  /** Grouped in registry order, which is the order the screens read in. */
  protected readonly groups = computed(() => {
    const out: { name: string; items: SiteText[] }[] = [];
    for (const item of this.items()) {
      const last = out[out.length - 1];
      if (last && last.name === item.group) last.items.push(item);
      else out.push({ name: item.group, items: [item] });
    }
    return out;
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (items) => {
        this.items.set(items);
        this.draft.set({});
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected edit(key: string, value: string): void {
    this.draft.update((d) => ({ ...d, [key]: value }));
  }

  protected changed(item: SiteText): boolean {
    const draft = this.draft()[item.key];
    return draft !== undefined && draft !== item.value;
  }

  protected save(item: SiteText): void {
    const value = this.draft()[item.key] ?? item.value;
    this.api.set(item.key, value).subscribe(() => {
      this.toast.success('Wording saved');
      /* Re-read the live map so the change shows wherever it is used without
         a reload — this screen is often open next to the one being reworded. */
      this.live.refresh();
      this.load();
    });
  }

  protected restore(item: SiteText): void {
    /* Blank means "back to the shipped wording" on the server, so restoring
       and clearing are the same call. */
    this.api.set(item.key, '').subscribe(() => {
      this.toast.success('Original wording restored');
      this.live.refresh();
      this.load();
    });
  }

  protected async restoreAll(): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Restore every original?',
      message:
        `${this.overridden()} reworded ${this.overridden() === 1 ? 'string goes' : 'strings go'} ` +
        'back to how the product shipped. Nothing else is affected.',
      confirmLabel: 'Restore all',
      tone: 'danger',
    });
    if (!ok) return;

    this.api.restoreAll().subscribe(() => {
      this.toast.success('Every string is back to the original wording');
      this.live.refresh();
      this.load();
    });
  }
}
