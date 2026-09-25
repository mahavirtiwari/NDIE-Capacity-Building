import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { ExamAttemptReview, ExamAttemptSummary, Id } from '../../core/models';
import { MarksheetService } from '../../core/services/marksheet.service';
import { IconComponent, IconName } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';

/**
 * What a candidate answered on the paper they sat.
 *
 * Opened from the written mark on the marksheet, because that is where the
 * question is asked: somebody is looking at a score and wants to know what is
 * behind it. The sittings come first, then one of them in full — each question,
 * what was chosen, and what it scored.
 *
 * Read only by construction. There is nothing here to change a mark with: a
 * wrong answer key is corrected on the paper and the sitting retaken.
 */
@Component({
  selector: 'app-exam-review',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IconComponent, ModalComponent],
  template: `
    <app-modal
      [title]="'Examination · ' + candidateName()"
      [subtitle]="review()?.paperTitle ?? 'Sittings of the online paper'"
      size="lg"
      (closed)="closed.emit()"
    >
      @if (attempts().length > 1) {
        <div class="sittings">
          @for (attempt of attempts(); track attempt.attemptId) {
            <button
              type="button"
              class="sitting"
              [class.is-active]="attempt.attemptId === openId()"
              (click)="open(attempt.attemptId)"
            >
              <strong>Attempt {{ attempt.attemptNo }}</strong>
              <span class="text-xs text-muted">
                {{ attempt.score }}/{{ attempt.paperTotal }} · {{ attempt.percentage }}%
                @if (attempt.isBest) { · counted }
              </span>
            </button>
          }
        </div>
      }

      @if (loading()) {
        <p class="text-sm text-muted">Loading the sitting…</p>
      } @else if (review(); as sitting) {
        <div class="summary">
          <div class="stat">
            <span class="stat__label">Score</span>
            <span class="stat__value">{{ sitting.score }} of {{ sitting.paperTotal }}</span>
          </div>
          <div class="stat">
            <span class="stat__label">Percentage</span>
            <span class="stat__value">{{ sitting.percentage }}%</span>
          </div>
          <div class="stat">
            <span class="stat__label">Answered</span>
            <span class="stat__value">{{ sitting.answered }} of {{ sitting.questionCount }}</span>
          </div>
          <div class="stat">
            <span class="stat__label">Taken</span>
            <span class="stat__value">
              {{ sitting.minutesTaken != null ? sitting.minutesTaken + ' min' : '—' }}
            </span>
          </div>
          <div class="stat">
            <span class="stat__label">Submitted</span>
            <span class="stat__value">
              {{ sitting.submittedOn ? (sitting.submittedOn | date: 'dd MMM yyyy, HH:mm') : '—' }}
            </span>
          </div>
        </div>

        @if (sitting.status === 'Expired') {
          <div class="alert alert--warning mb-md">
            <app-icon name="alert" [size]="16" />
            <span>
              The clock ran out. This sitting was marked on what had been answered by then.
            </span>
          </div>
        }

        @if (!sitting.showsAnswerKey) {
          <div class="alert alert--info mb-md">
            <app-icon name="info" [size]="16" />
            <span>
              What the candidate chose is shown; which option was correct is not. That needs
              permission to read the question papers.
            </span>
          </div>
        }

        <div class="stack stack-md">
          @for (question of sitting.questions; track question.id) {
            <section class="question" [class.is-wrong]="question.answered && !question.isCorrect">
              <div class="question__head">
                <span class="question__no">{{ question.displayOrder }}</span>
                <p class="question__text">{{ question.text }}</p>
                <span class="question__marks" [class.is-loss]="question.marksAwarded < 0">
                  {{ question.marksAwarded }} / {{ question.marks }}
                </span>
              </div>

              <ul class="options">
                @for (option of question.options; track option.id) {
                  <li
                    class="option"
                    [class.is-chosen]="option.chosen"
                    [class.is-key]="option.isCorrect === true"
                  >
                    @if (mark(option.chosen, option.isCorrect); as icon) {
                      <app-icon [name]="icon" [size]="14" />
                    } @else {
                      <span class="option__gap"></span>
                    }
                    <span>{{ option.text }}</span>
                    @if (option.chosen) { <span class="tag">chosen</span> }
                    @if (option.isCorrect === true) { <span class="tag tag--key">correct</span> }
                  </li>
                }
              </ul>

              @if (!question.answered) {
                <p class="note">Not answered.</p>
              }
              @if (question.explanation) {
                <p class="note">{{ question.explanation }}</p>
              }
            </section>
          }
        </div>
      } @else {
        <p class="text-sm text-muted">This candidate has not sat the paper.</p>
      }

      <div footer>
        <button type="button" class="btn btn--secondary" (click)="closed.emit()">Close</button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      .sittings {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .sitting {
        background: var(--surface, #fff);
        border: 1px solid var(--border, #e6e0de);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 0.4rem 0.7rem;
        text-align: left;
      }
      .sitting.is-active {
        border-color: var(--brand-600, #9b2c3c);
        box-shadow: inset 0 0 0 1px var(--brand-600, #9b2c3c);
      }
      .summary {
        display: flex;
        flex-wrap: wrap;
        gap: 1.25rem;
        margin-bottom: 1rem;
      }
      .stat {
        display: flex;
        flex-direction: column;
      }
      .stat__label {
        color: var(--ink-500, #6d6360);
        font-size: 0.72rem;
        text-transform: uppercase;
      }
      .stat__value {
        font-weight: 600;
      }
      .question {
        border: 1px solid var(--border, #e6e0de);
        border-left: 3px solid var(--success-500, #3f9142);
        border-radius: 8px;
        padding: 0.75rem 0.9rem;
      }
      .question.is-wrong {
        border-left-color: var(--danger-500, #e2500f);
      }
      .question__head {
        align-items: baseline;
        display: flex;
        gap: 0.6rem;
      }
      .question__no {
        color: var(--ink-500, #6d6360);
        font-size: 0.8rem;
        font-weight: 700;
        min-width: 1.2rem;
      }
      .question__text {
        flex: 1;
        margin: 0;
      }
      .question__marks {
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        white-space: nowrap;
      }
      .question__marks.is-loss {
        color: var(--danger-700, #b3300d);
      }
      .options {
        list-style: none;
        margin: 0.5rem 0 0;
        padding: 0 0 0 1.8rem;
      }
      .option {
        align-items: center;
        color: var(--ink-600, #575050);
        display: flex;
        font-size: 0.86rem;
        gap: 0.4rem;
        padding: 0.15rem 0;
      }
      .option.is-chosen,
      .option.is-key {
        color: var(--ink-900, #241f1e);
        font-weight: 600;
      }
      .tag {
        background: var(--ink-100, #f1ecea);
        border-radius: 999px;
        font-size: 0.68rem;
        padding: 0 0.45rem;
        text-transform: uppercase;
      }
      .tag--key {
        background: var(--success-50, #eef7ee);
      }
      .option__gap {
        display: inline-block;
        width: 14px;
      }
      .note {
        color: var(--ink-500, #6d6360);
        font-size: 0.8rem;
        margin: 0.5rem 0 0 1.8rem;
      }
    `,
  ],
})
export class ExamReviewComponent {
  private readonly service = inject(MarksheetService);

  readonly programmeId = input.required<Id>();
  readonly participantId = input.required<Id>();
  /** Shown while the sitting loads, so the modal opens with a name on it. */
  readonly name = input<string>('');

  readonly closed = output<void>();

  protected readonly attempts = signal<ExamAttemptSummary[]>([]);
  protected readonly review = signal<ExamAttemptReview | null>(null);
  protected readonly openId = signal<Id | null>(null);
  protected readonly loading = signal(true);

  protected readonly candidateName = computed(
    () => this.review()?.candidateName || this.name(),
  );

  constructor() {
    effect(() => {
      const programme = this.programmeId();
      const participant = this.participantId();
      this.loading.set(true);

      this.service.attempts(programme, participant).subscribe((rows) => {
        this.attempts.set(rows);
        /* The sitting that counted, which is the one being asked about — not
           simply the last one they had. */
        const best = rows.find((row) => row.isBest) ?? rows[rows.length - 1];
        if (best) this.open(best.attemptId);
        else this.loading.set(false);
      });
    });
  }

  protected open(attemptId: Id): void {
    this.openId.set(attemptId);
    this.loading.set(true);
    this.service.attempt(this.programmeId(), attemptId).subscribe({
      next: (sitting) => {
        this.review.set(sitting);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /**
   * The mark beside one option.
   *
   * A tick for the right answer and a cross for a wrong one that was chosen.
   * An option that is neither gets nothing, so the eye goes to the two that
   * matter rather than down a column of identical bullets.
   */
  protected mark(chosen: boolean, isCorrect?: boolean | null): IconName | null {
    if (isCorrect === true) return 'check';
    if (chosen) return isCorrect === false ? 'x' : 'check';
    return null;
  }
}
