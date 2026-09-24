import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { PublicProgramme } from '../../core/models';
import { PublicCatalogueService } from '../../core/services/public-catalogue.service';

/**
 * The page behind the registration link an agency shares.
 *
 * Served to anyone, signed in or not, so it deliberately shows only what
 * somebody deciding whether to attend needs: what the training is, when and
 * where, and whether there is room. Nobody's name appears on it.
 *
 * A batch that has filled up or already run still resolves and says so. A link
 * that was posted to a WhatsApp group weeks ago should explain itself rather
 * than turn into a dead end.
 */
@Component({
  selector: 'app-programme-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="pl">
      <div class="pl__sheet">
        @if (result(); as state) {
          @if (state.programme; as p) {
            <header class="pl__head">
              <span class="pl__eyebrow">{{ p.categoryName }} · {{ p.subCategoryName }}</span>
              <h1 class="pl__title">{{ p.programTypeName }}</h1>
              @if (p.shortDescription) {
                <p class="pl__lead">{{ p.shortDescription }}</p>
              }
            </header>

            <div class="pl__status" [class.is-open]="p.registrationsOpen">
              <strong>{{ p.registrationsOpen ? 'Registration open' : p.registrationStatus }}</strong>
              @if (p.registrationsOpen) {
                <span>
                  {{ p.seatsLeft }} of {{ p.maxParticipants }} place{{
                    p.maxParticipants === 1 ? '' : 's'
                  }}
                  left
                </span>
              } @else if (p.registrationStatus === 'Full') {
                <span>All {{ p.maxParticipants }} places have been taken.</span>
              }
            </div>

            <dl class="pl__facts">
              <div><dt>Batch</dt><dd class="tabular">{{ p.programmeId }}</dd></div>
              <div>
                <dt>Dates</dt>
                <dd>
                  {{ p.startDate | date: 'dd MMM yyyy' }} – {{ p.endDate | date: 'dd MMM yyyy' }}
                  <span class="pl__muted">({{ p.durationDays }} days)</span>
                </dd>
              </div>
              <div>
                <dt>Delivered</dt>
                <dd>
                  {{ p.mode === 'Virtual' ? 'Online' : 'In person' }}
                  @if (place(p); as where) {
                    <span class="pl__muted">— {{ where }}</span>
                  }
                </dd>
              </div>
              @if (p.agencyName) {
                <div><dt>Conducted by</dt><dd>{{ p.agencyName }}</dd></div>
              }
              @if (p.minQualificationLabel) {
                <div><dt>Minimum qualification</dt><dd>{{ p.minQualificationLabel }}</dd></div>
              }
              @if (p.minExperienceYears > 0) {
                <div>
                  <dt>Minimum experience</dt>
                  <dd>{{ p.minExperienceYears }} years</dd>
                </div>
              }
              <div><dt>Fee</dt><dd>{{ p.isFeeApplicable ? 'Applicable' : 'No fee' }}</dd></div>
            </dl>

            @if (p.registrationsOpen) {
              <div class="pl__cta">
                <strong>To register</strong>
                <p>
                  Sign up in the applicant app with the batch code
                  <code>{{ p.programmeId }}</code
                  >. Places are given in the order applications are approved, and this page stops
                  accepting them once the batch is full.
                </p>
              </div>
            }
          } @else {
            <div class="pl__empty">
              <h1 class="pl__title">Batch not found</h1>
              <p class="pl__lead">
                This link does not match any batch. It may have been mistyped, or the batch may
                have been withdrawn before it was approved.
              </p>
            </div>
          }
        } @else {
          <p class="pl__lead">Loading…</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .pl {
        min-height: 100vh;
        background: var(--brand-50);
        padding: 2rem 1rem;
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }
      .pl__sheet {
        width: 100%;
        max-width: 680px;
        background: #fff;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 2rem;
      }
      .pl__head { border-bottom: 1px solid var(--border); padding-bottom: 1.2rem; }
      .pl__eyebrow {
        font-size: var(--fs-xs);
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--brand-700);
        font-weight: 600;
      }
      .pl__title { margin: 0.4rem 0 0; font-size: 1.6rem; color: var(--ink-900); }
      .pl__lead { margin: 0.6rem 0 0; color: var(--ink-600); line-height: 1.6; }
      .pl__status {
        margin: 1.2rem 0;
        padding: 0.8rem 1rem;
        border-radius: var(--radius);
        background: var(--ink-100);
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        font-size: var(--fs-sm);
        color: var(--ink-700);
      }
      .pl__status.is-open { background: var(--success-50); color: var(--success-700); }
      .pl__facts { margin: 0; display: grid; gap: 0.75rem; }
      .pl__facts > div {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 1rem;
        align-items: baseline;
      }
      .pl__facts dt { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.5px; color: var(--ink-500); }
      .pl__facts dd { margin: 0; color: var(--ink-800); font-size: var(--fs-sm); }
      .pl__muted { color: var(--ink-500); }
      .pl__cta {
        margin-top: 1.6rem;
        padding: 1rem 1.2rem;
        border: 1px dashed var(--brand-300);
        border-radius: var(--radius);
        background: var(--brand-50);
      }
      .pl__cta p { margin: 0.4rem 0 0; font-size: var(--fs-sm); color: var(--ink-700); line-height: 1.6; }
      .pl__cta code { font-family: ui-monospace, monospace; font-weight: 700; }
      .pl__empty { text-align: center; padding: 2rem 0; }
      @media (max-width: 560px) {
        .pl__facts > div { grid-template-columns: 1fr; gap: 0.2rem; }
      }
    `,
  ],
})
export class ProgrammeLinkComponent {
  private readonly catalogue = inject(PublicCatalogueService);

  /** The batch code, bound from the route by withComponentInputBinding. */
  readonly code = input.required<string>();

  protected readonly result = toSignal(
    toObservable(this.code).pipe(
      switchMap((code) =>
        this.catalogue.byCode(code).pipe(
          map((programme) => ({ programme }) as { programme: PublicProgramme | null }),
          /* A missing batch is an ordinary outcome here, not a failure: links
             get mistyped and batches get withdrawn before they are approved. */
          catchError(() => of({ programme: null })),
        ),
      ),
    ),
  );

  /** The venue line, with the parts that are actually present. */
  protected place(programme: PublicProgramme): string {
    if (programme.mode === 'Virtual') return '';
    return [programme.venue, programme.city, programme.state].filter(Boolean).join(', ');
  }
}
