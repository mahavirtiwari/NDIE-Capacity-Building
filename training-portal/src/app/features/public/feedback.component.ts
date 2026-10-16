import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { FeedbackLink, FeedbackQuestion } from '../../core/models';
import { PublicCatalogueService } from '../../core/services/public-catalogue.service';

/** What has come back from the link, or why nothing has. */
interface Opened {
  link: FeedbackLink | null;
  dead: boolean;
}

/**
 * The feedback form behind the link in a participant's e-mail.
 *
 * Open to anybody holding the address and nothing else: somebody who
 * finished a course three weeks ago has no reason to be signed in to the
 * portal, and asking them to sign in to answer an anonymous form is the
 * surest way of making them believe it is not anonymous.
 *
 * So the page says so, in as many words, and names nobody. It shows which
 * batch is being asked about — a link that has sat in an inbox for a month
 * has to explain itself — and then the questions the programme type asks.
 *
 * A link that has been used, has expired, or never existed ends here
 * politely rather than at a sign-in screen.
 */
@Component({
  selector: 'app-public-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="fb">
      <div class="fb__sheet">
        @if (opened(); as state) {
          @if (state.link; as link) {
            <header class="fb__head">
              <span class="fb__eyebrow">{{ link.programTypeName }}</span>
              <h1 class="fb__title">{{ link.form?.title ?? 'Your feedback' }}</h1>
              <p class="fb__lead">
                About <strong>{{ link.programmeName }}</strong> ({{ link.programmeCode }}), which
                finished on {{ link.endedOn | date: 'dd MMM yyyy' }}.
              </p>
            </header>

            @if (sent()) {
              <div class="fb__done">
                <h2 class="fb__thanks">Thank you</h2>
                <p>
                  Your answers have been recorded. They are held without your name against them,
                  so nobody can see who said what.
                </p>
              </div>
            } @else if (link.given) {
              <div class="fb__done">
                <h2 class="fb__thanks">Already answered</h2>
                <p>
                  Feedback for this program has been given from this link. There is nothing more
                  to do, and the answers cannot be read back — they are not stored against
                  anybody.
                </p>
              </div>
            } @else if (!link.form) {
              <div class="fb__done">
                <h2 class="fb__thanks">Nothing to ask just now</h2>
                <p>
                  The feedback form for this program is not available. You can close this page.
                </p>
              </div>
            } @else {
              <p class="fb__note">
                Answers are recorded anonymously. Nothing on this page is stored against your
                name.
              </p>

              @if (link.form.intro) {
                <p class="fb__lead">{{ link.form.intro }}</p>
              }

              @for (q of link.form.questions; track q.id) {
                <div class="fb__q">
                  <label class="fb__label" [for]="'q-' + q.key">
                    {{ q.text }}
                    @if (q.required) {
                      <span class="fb__req" aria-hidden="true">*</span>
                    }
                  </label>
                  @if (q.helpText) {
                    <p class="fb__help">{{ q.helpText }}</p>
                  }

                  @switch (q.type) {
                    @case ('Rating') {
                      <div class="fb__scale" role="group" [attr.aria-label]="q.text">
                        @for (n of scale(q); track n) {
                          <button
                            type="button"
                            class="fb__dot"
                            [class.is-on]="answers()[q.key] === n"
                            (click)="answer(q.key, n)"
                          >
                            {{ n }}
                          </button>
                        }
                      </div>
                    }
                    @case ('Text') {
                      <textarea
                        class="fb__input"
                        [id]="'q-' + q.key"
                        rows="3"
                        [value]="text(q.key)"
                        (input)="answer(q.key, asText($event))"
                      ></textarea>
                    }
                    @case ('Select') {
                      <select
                        class="fb__input"
                        [id]="'q-' + q.key"
                        [value]="text(q.key)"
                        (change)="answer(q.key, asText($event))"
                      >
                        <option value="">Choose…</option>
                        @for (o of q.options; track o.value) {
                          <option [value]="o.value">{{ o.label }}</option>
                        }
                      </select>
                    }
                    @default {
                      <div class="fb__choices" role="group" [attr.aria-label]="q.text">
                        @for (o of choices(q); track o.value) {
                          <button
                            type="button"
                            class="fb__choice"
                            [class.is-on]="answers()[q.key] === o.value"
                            (click)="answer(q.key, o.value)"
                          >
                            {{ o.label }}
                          </button>
                        }
                      </div>
                    }
                  }
                </div>
              }

              @if (failure()) {
                <p class="fb__error">{{ failure() }}</p>
              }

              <button class="fb__submit" type="button" [disabled]="busy()" (click)="submit()">
                {{ busy() ? 'Sending…' : 'Send my feedback' }}
              </button>
            }
          } @else if (state.dead) {
            <div class="fb__empty">
              <h1 class="fb__title">This link is no longer open</h1>
              <p class="fb__lead">
                It may have been used already, or it may have expired — feedback links work for
                sixty days. Nothing further is needed from you.
              </p>
            </div>
          } @else {
            <p class="fb__lead">Loading…</p>
          }
        } @else {
          <p class="fb__lead">Loading…</p>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .fb {
        min-height: 100vh;
        background: var(--brand-50);
        padding: 2rem 1rem;
        display: flex;
        justify-content: center;
        align-items: flex-start;
      }
      .fb__sheet {
        width: 100%;
        max-width: 640px;
        background: #fff;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 2rem;
      }
      .fb__head {
        border-bottom: 1px solid var(--border);
        padding-bottom: 1.2rem;
        margin-bottom: 1.4rem;
      }
      .fb__eyebrow {
        font-size: var(--fs-xs);
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--brand-700);
        font-weight: 600;
      }
      .fb__title { margin: 0.4rem 0 0; font-size: 1.5rem; color: var(--ink-900); }
      .fb__lead { margin: 0.6rem 0 0; color: var(--ink-600); line-height: 1.6; }
      .fb__note {
        margin: 0 0 1.4rem;
        padding: 0.7rem 0.9rem;
        border-radius: var(--radius);
        background: var(--success-50);
        color: var(--success-700);
        font-size: var(--fs-sm);
        line-height: 1.5;
      }
      .fb__q { padding: 1rem 0; border-bottom: 1px solid var(--border); }
      .fb__label {
        display: block;
        font-size: var(--fs-sm);
        font-weight: 600;
        color: var(--ink-800);
        line-height: 1.5;
      }
      .fb__req { color: var(--danger-600); margin-left: 2px; }
      .fb__help { margin: 0.25rem 0 0; font-size: var(--fs-xs); color: var(--ink-500); }
      .fb__input {
        margin-top: 0.6rem;
        width: 100%;
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        font: inherit;
        color: var(--ink-900);
        background: #fff;
      }
      .fb__scale, .fb__choices {
        margin-top: 0.6rem;
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
      }
      .fb__dot {
        width: 2.4rem;
        height: 2.4rem;
        border-radius: 50%;
        border: 1px solid var(--border);
        background: #fff;
        font: inherit;
        font-weight: 600;
        color: var(--ink-700);
        cursor: pointer;
      }
      .fb__choice {
        padding: 0.45rem 0.9rem;
        border-radius: 999px;
        border: 1px solid var(--border);
        background: #fff;
        font: inherit;
        font-size: var(--fs-sm);
        color: var(--ink-700);
        cursor: pointer;
      }
      .fb__dot.is-on, .fb__choice.is-on {
        background: var(--brand-700);
        border-color: var(--brand-700);
        color: #fff;
      }
      .fb__error {
        margin: 1rem 0 0;
        padding: 0.7rem 0.9rem;
        border-radius: var(--radius);
        background: var(--danger-50);
        color: var(--danger-700);
        font-size: var(--fs-sm);
      }
      .fb__submit {
        margin-top: 1.6rem;
        width: 100%;
        padding: 0.8rem 1rem;
        border: none;
        border-radius: var(--radius);
        background: var(--brand-700);
        color: #fff;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
      .fb__submit[disabled] { opacity: 0.6; cursor: default; }
      .fb__done, .fb__empty { text-align: center; padding: 1.5rem 0; }
      .fb__thanks { margin: 0 0 0.5rem; font-size: 1.2rem; color: var(--ink-900); }
      .fb__done p, .fb__empty p { margin: 0; color: var(--ink-600); line-height: 1.6; }
    `,
  ],
})
export class PublicFeedbackComponent {
  private readonly catalogue = inject(PublicCatalogueService);

  /** The token from the address, bound by withComponentInputBinding. */
  readonly token = input.required<string>();

  protected readonly answers = signal<Record<string, unknown>>({});
  protected readonly busy = signal(false);
  protected readonly sent = signal(false);
  protected readonly failure = signal<string | null>(null);

  protected readonly opened = toSignal(
    toObservable(this.token).pipe(
      switchMap((token) =>
        this.catalogue.feedbackByToken(token).pipe(
          map((link) => ({ link, dead: false }) as Opened),
          tap(() => this.answers.set({})),
          /* An expired or spent link is an ordinary outcome, not a
             failure: these addresses sit in inboxes for weeks. */
          catchError(() => of({ link: null, dead: true } as Opened)),
        ),
      ),
    ),
  );

  /** 1…max, for a rating. */
  protected scale(q: FeedbackQuestion): number[] {
    const top = q.maxRating > 1 ? q.maxRating : 5;
    return Array.from({ length: top }, (_, i) => i + 1);
  }

  /** A yes/no question carries no option rows of its own. */
  protected choices(q: FeedbackQuestion): { value: string; label: string }[] {
    if (q.options.length > 0) return q.options;
    return [
      { value: 'Yes', label: 'Yes' },
      { value: 'No', label: 'No' },
    ];
  }

  protected text(key: string): string {
    const held = this.answers()[key];
    return held === undefined || held === null ? '' : String(held);
  }

  protected asText(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  }

  protected answer(key: string, value: unknown): void {
    this.answers.update((held) => ({ ...held, [key]: value }));
    this.failure.set(null);
  }

  protected submit(): void {
    const link = this.opened()?.link;
    if (!link?.form) return;

    /* Checked here as well as on the server, so somebody who missed a
       question is told which one rather than handed a list back. */
    const missing = link.form.questions
      .filter((q) => q.required)
      .filter((q) => {
        const held = this.answers()[q.key];
        return held === undefined || held === null || String(held).trim() === '';
      });

    if (missing.length > 0) {
      this.failure.set(
        missing.length === 1
          ? `Please answer: ${missing[0].text}`
          : `Please answer ${missing.length} more question${missing.length === 1 ? '' : 's'}.`,
      );
      return;
    }

    this.busy.set(true);
    this.failure.set(null);
    this.catalogue.submitFeedback(this.token(), this.answers()).subscribe({
      next: () => {
        this.busy.set(false);
        this.sent.set(true);
      },
      error: (caught: { error?: { message?: string } }) => {
        this.busy.set(false);
        this.failure.set(
          caught?.error?.message ?? 'Could not send your feedback. Please try again.',
        );
      },
    });
  }
}
