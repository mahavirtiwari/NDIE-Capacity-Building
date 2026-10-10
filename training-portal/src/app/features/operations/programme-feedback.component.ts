import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FeedbackQuestionSummary, FeedbackSummary, Id } from '../../core/models';
import { FeedbackFormService } from '../../core/services/masters.service';
import { IconComponent } from '../../shared/components/icon.component';

/**
 * What the room thought of this programme.
 *
 * Deliberately not per participant, which is where the reference portal
 * differs. A feedback response in this system carries the batch and the
 * programme type and nothing else — no applicant, no participant, no
 * account — and the receipt that records who has finished is written as a
 * separate row that cannot be matched to it. Anonymity here is a property
 * of the data rather than a promise about who looks, and printing a grid
 * of answers against names would mean undoing it.
 *
 * So: the average per question, the tally per option, and the free text
 * on its own, shuffled by the server so the order cannot be lined up
 * against the order people answered in.
 */
@Component({
  selector: 'app-programme-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, IconComponent],
  template: `
    @if (loading()) {
      <div class="card__body"><span class="text-sm text-muted">Reading the feedback…</span></div>
    } @else if (summary(); as data) {
      <div class="card__body stack stack-md">
        <div class="row row-between row-wrap">
          <div class="stack stack-xs">
            <strong class="text-sm">
              {{ data.responseCount }}
              response{{ data.responseCount === 1 ? '' : 's' }}
            </strong>
            <span class="text-xs text-muted">
              Given anonymously. Nothing here is stored against a participant, so nothing
              here can be read back to one.
            </span>
          </div>
          @if (overall(); as mean) {
            <div class="overall">
              <span class="overall__value tabular">{{ mean.toFixed(1) }}</span>
              <span class="overall__label">average rating</span>
            </div>
          }
        </div>

        @if (data.responseCount === 0) {
          <div class="alert alert--info">
            <app-icon name="info" [size]="16" />
            <span>Nobody on this program has given feedback yet.</span>
          </div>
        } @else {
          <div class="questions">
            @for (question of data.questions; track question.key) {
              <section class="panel">
                <h3 class="panel__head">{{ question.text }}</h3>
                <div class="panel__body">
                  @if (question.type === 'Rating') {
                    <div class="fact">
                      <span class="fact__value">
                        <strong class="score tabular">
                          {{ question.average != null ? (question.average | number: '1.1-1') : '—' }}
                        </strong>
                        <span class="text-xs text-muted">
                          out of 5 · {{ question.answered }} answered
                        </span>
                      </span>
                    </div>
                    <div class="meter">
                      <span class="meter__fill" [style.width.%]="percent(question)"></span>
                    </div>
                  } @else if (question.tally.length > 0) {
                    @for (option of question.tally; track option.value) {
                      <div class="tally">
                        <span class="tally__label">{{ option.label }}</span>
                        <span class="tally__bar">
                          <span
                            class="tally__fill"
                            [style.width.%]="share(option.count, question.answered)"
                          ></span>
                        </span>
                        <span class="tally__count tabular">{{ option.count }}</span>
                      </div>
                    }
                  } @else if (question.comments.length > 0) {
                    <!-- In no particular order, and with nothing attached. -->
                    @for (note of question.comments; track $index) {
                      <blockquote class="note">{{ note }}</blockquote>
                    }
                  } @else {
                    <span class="text-xs text-muted">Nobody answered this one.</span>
                  }
                </div>
              </section>
            }
          </div>
        }
      </div>
    } @else {
      <div class="card__body">
        <span class="text-sm text-muted">
          No feedback form is set up for this program type, so there is nothing to report.
        </span>
      </div>
    }
  `,
  styles: [
    `
      .questions {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 0.9rem;
        align-items: start;
      }
      .panel__head { text-transform: none; letter-spacing: 0; font-size: var(--fs-sm); }
      .score { font-size: var(--fs-2xl); color: var(--brand-700); line-height: 1; }

      .overall { text-align: right; }
      .overall__value { font-size: var(--fs-2xl); font-weight: 600; color: var(--brand-700); }
      .overall__label { display: block; font-size: var(--fs-xs); color: var(--ink-500); }

      .meter { height: 6px; border-radius: 999px; background: var(--brand-100); overflow: hidden; }
      .meter__fill { display: block; height: 100%; background: var(--brand-600); }

      .tally { display: grid; grid-template-columns: 1fr 90px 32px; gap: 0.5rem; align-items: center; }
      .tally__label { font-size: var(--fs-sm); }
      .tally__bar { height: 6px; border-radius: 999px; background: var(--ink-100); overflow: hidden; }
      .tally__fill { display: block; height: 100%; background: var(--brand-500); }
      .tally__count { font-size: var(--fs-sm); text-align: right; color: var(--ink-600); }

      .note {
        margin: 0;
        padding: 0.5rem 0.7rem;
        border-left: 3px solid var(--brand-200);
        background: var(--surface-muted);
        border-radius: 0 var(--radius) var(--radius) 0;
        font-size: var(--fs-sm);
        color: var(--ink-800);
      }
    `,
  ],
})
export class ProgrammeFeedbackComponent {
  readonly programmeId = input.required<number>();
  readonly programTypeId = input.required<number>();

  private readonly service = inject(FeedbackFormService);

  protected readonly summary = signal<FeedbackSummary | null>(null);
  protected readonly loading = signal(false);

  /** The mean of the means, for the one number anybody quotes. */
  protected readonly overall = computed(() => {
    const rated = (this.summary()?.questions ?? []).filter(
      (q) => q.type === 'Rating' && q.average != null,
    );
    if (rated.length === 0) return null;
    return rated.reduce((sum, q) => sum + Number(q.average), 0) / rated.length;
  });

  constructor() {
    effect(() => {
      const programme = this.programmeId();
      const type = this.programTypeId();
      if (!programme || !type) return;

      this.loading.set(true);
      this.service.summary(type as Id, programme as Id).subscribe({
        next: (data) => {
          this.summary.set(data);
          this.loading.set(false);
        },
        /* A program type with no feedback form 404s, which is not a fault:
           it means nobody is asked for feedback on this track. */
        error: () => {
          this.summary.set(null);
          this.loading.set(false);
        },
      });
    });
  }

  protected percent(question: FeedbackQuestionSummary): number {
    return question.average == null ? 0 : Math.min(100, (Number(question.average) / 5) * 100);
  }

  protected share(count: number, total: number): number {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }
}
