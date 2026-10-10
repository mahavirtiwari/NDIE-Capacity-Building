import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { MonitoringPhoto } from '../../core/models';
import { ProgramService } from '../../core/services/workflow.service';
import { IconComponent } from '../../shared/components/icon.component';

/**
 * One photograph off the monitoring record, with what is known about it.
 *
 * Fetched rather than pointed at. The endpoint wants the bearer token and
 * an `<img src>` cannot carry one, so the bytes come back as a blob and
 * become an object URL — which is a handle on memory the browser only
 * releases when told, hence the teardown.
 *
 * Each picture fetches itself when it is rendered, so a programme with
 * forty session photographs costs forty small requests rather than one
 * enormous one, and a tab nobody opens costs none.
 */
@Component({
  selector: 'app-monitoring-photo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IconComponent],
  template: `
    <figure class="shot">
      @if (objectUrl(); as src) {
        <button type="button" class="shot__frame" (click)="openFullSize(src)" [title]="'Open ' + photo().fileName">
          <img [src]="src" [alt]="caption()" loading="lazy" />
        </button>
      } @else if (failed()) {
        <div class="shot__frame shot__frame--empty">
          <app-icon name="alert" [size]="18" />
          <span class="text-xs">Could not load</span>
        </div>
      } @else {
        <div class="shot__frame shot__frame--empty skeleton"></div>
      }

      <figcaption class="shot__meta">
        <strong class="text-xs">{{ caption() }}</strong>
        <span class="text-xs text-muted">
          Taken {{ photo().capturedOn | date: 'dd MMM yyyy, HH:mm' }}
        </span>

        <!-- The gap between taking a photograph and handing it in is the
             thing anybody checking a record looks for, so it is printed
             rather than left in the database. -->
        @if (photo().syncedOn) {
          <span class="text-xs text-muted">
            Synced {{ photo().syncedOn | date: 'dd MMM yyyy, HH:mm' }}
            @if (photo().deviceModel) { · {{ photo().deviceModel }} }
          </span>
        }

        @if (place(); as where) {
          <a
            class="text-xs"
            [href]="'https://www.google.com/maps?q=' + where"
            target="_blank"
            rel="noopener"
          >
            {{ where }} <app-icon name="external" [size]="11" />
          </a>
        }

        <!-- An unstamped picture is not a worse picture, but the time and
             place on a stamped one travel with the image wherever it is
             copied to, and that is worth being able to tell apart. -->
        @if (!photo().stamped) {
          <span class="text-xs text-muted">Not stamped</span>
        }
      </figcaption>
    </figure>
  `,
  styles: [
    `
      .shot {
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        min-width: 0;
      }
      .shot__frame {
        display: block;
        width: 100%;
        aspect-ratio: 4 / 3;
        padding: 0;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
        background: var(--surface-muted);
        cursor: zoom-in;
      }
      .shot__frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
      .shot__frame--empty {
        display: grid;
        place-items: center;
        gap: 0.3rem;
        color: var(--ink-500);
        cursor: default;
      }
      .shot__meta { display: flex; flex-direction: column; gap: 0.1rem; }
    `,
  ],
})
export class MonitoringPhotoComponent {
  readonly programmeId = input.required<number>();
  readonly photo = input.required<MonitoringPhoto>();
  readonly caption = input<string>('Photograph');

  private readonly service = inject(ProgramService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly objectUrl = signal<string | null>(null);
  protected readonly failed = signal(false);

  /* The same handle, off to the side.

     The effect below must not read objectUrl: an effect that reads a
     signal it also writes re-runs on its own write, and this one fetches
     a photograph each time round — which it duly did, several hundred
     times, before anybody looked at the network tab. So revocation works
     from a plain field and the signal is only ever written. */
  private held: string | null = null;

  /** Six places, which is a few metres — enough to say where, not who. */
  protected readonly place = computed(() => {
    const shot = this.photo();
    if (shot.latitude == null || shot.longitude == null) return null;
    return `${Number(shot.latitude).toFixed(6)}, ${Number(shot.longitude).toFixed(6)}`;
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.release());

    effect(() => {
      const id = this.photo().id;
      const programme = this.programmeId();
      if (!id || !programme) return;

      this.release();
      this.failed.set(false);

      this.service.photo(programme, id).subscribe({
        next: (blob) => {
          this.held = URL.createObjectURL(blob);
          this.objectUrl.set(this.held);
        },
        /* One picture that will not load must not take the gallery with
           it; the rest still tell the reader most of what they need. */
        error: () => this.failed.set(true),
      });
    });
  }

  private release(): void {
    if (this.held) URL.revokeObjectURL(this.held);
    this.held = null;
    this.objectUrl.set(null);
  }

  protected openFullSize(src: string): void {
    window.open(src, '_blank', 'noopener');
  }
}
