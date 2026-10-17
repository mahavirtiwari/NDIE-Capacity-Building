import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Curriculum,
  CurriculumSession,
  CurriculumTopic,
  nextSessionCode,
  nextTopicCode,
  RecordStatus,
} from '../../core/models';
import { CurriculumService } from '../../core/services/academics.service';
import { ToastService } from '../../core/services/toast.service';
import { IconComponent } from '../../shared/components/icon.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { StatusToggleComponent } from '../../shared/components/status-toggle.component';
import { describeFirstError } from '../../core/validation/formats';

/**
 * HH:mm, which is what a time input takes and what a timetable reads as.
 *
 * The API answers TimeOnly, which serialises with seconds — "09:30:00" is
 * refused by <input type="time"> on some browsers and shows the seconds on
 * the rest.
 */
function clock(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 5);
}

@Component({
  selector: 'app-curriculum-sessions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    PageHeaderComponent,
    StatusBadgeComponent,
    StatusToggleComponent,
    CanDirective,
    ModalComponent,
    IconComponent,
  ],
  template: `
    @if (curriculum(); as programme) {
      <app-page-header
        [title]="programme.programTypeName ?? 'Curriculum'"
        [subtitle]="(programme.programTypeCode ?? '') + ' · ' + programme.durationDays + ' days'"
        icon="book"
        [breadcrumbs]="[
          { label: 'Program setup' },
          { label: 'Curriculum', link: '/academics/curriculum' },
          { label: programme.programTypeCode ?? 'Curriculum' }
        ]"
      >
        <a class="btn btn--secondary" routerLink="/academics/curriculum">
          <app-icon name="chevron-left" [size]="15" /> Back
        </a>
        <button type="button" class="btn btn--primary" (click)="openSession()">
          <app-icon name="plus" [size]="15" /> Add session
        </button>
      </app-page-header>

      <section class="card mb-md">
        <div class="card__body">
          <div class="dl">
            <div>
              <div class="dl__term">Program type</div>
              <div class="dl__value">{{ programme.programTypeName }}</div>
            </div>
            <div>
              <div class="dl__term">Code</div>
              <div class="dl__value">{{ programme.programTypeCode }}</div>
            </div>
            <div>
              <div class="dl__term">Effective from</div>
              <div class="dl__value">{{ programme.effectiveFrom }}</div>
            </div>
            <div>
              <div class="dl__term">Status</div>
              <div class="dl__value"><app-status-badge [value]="programme.status" /></div>
            </div>
          </div>
          @if (programme.objective) {
            <p class="text-sm text-muted mt-md">{{ programme.objective }}</p>
          }
        </div>
      </section>

      <section class="card">
        <div class="card__header">
          <div class="stack stack-xs">
            <span class="card__title">Sessions</span>
            <span class="card__subtitle">
              {{ programme.sessions.length }} sessions · {{ topicTotal() }} topics
            </span>
          </div>
          <div class="field" style="min-width: 240px">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input class="input" placeholder="Session name" (input)="onSearch($event)" />
            </div>
          </div>
        </div>

        <!-- A session and its topics are two different things, and the
             nine-column table said otherwise: the session's own cells
             were merged down the rows of its topics, the Add-topic
             button sat at the far right of a line belonging to the
             first topic, and the two sets of codes and names read as
             one row of six. Each session is its own block now, with its
             topics listed beneath it and the button that adds one at
             the foot of that list. -->
        <div class="plan">
          @for (session of visible(); track session.id) {
            <article class="sess" [class.sess--off]="isOff(session, null)">
              <header class="sess__head">
                <span class="sess__serial tabular">{{ $index + 1 }}</span>
                <div class="sess__id">
                  <span class="sess__code tabular">{{ session.sessionCode }}</span>
                  <span class="sess__name">{{ session.sessionName }}</span>
                </div>
                <div class="sess__meta">
                  <span class="chip chip--muted tabular">
                    <app-icon name="clock" [size]="12" /> {{ timing(session) }}
                  </span>
                  <span class="chip chip--muted">
                    {{ session.topics.length }}
                    topic{{ session.topics.length === 1 ? '' : 's' }}
                  </span>
                  <app-status-badge [value]="session.status ?? 'Active'" />
                  <div class="btn-row btn-row--end">
                    <button
                      type="button"
                      class="btn btn--icon"
                      title="Edit session"
                      (click)="openSession(session)"
                    >
                      <app-icon name="edit" [size]="15" />
                    </button>
                    <ng-container *appCan="'curriculum.manage'">
                      <app-status-toggle
                        [status]="session.status ?? 'Active'"
                        (toggled)="setSessionStatus(session, $event)"
                      />
                    </ng-container>
                  </div>
                </div>
              </header>

              <div class="topics">
                @for (topic of session.topics; track topic.id) {
                  <div class="topic" [class.topic--off]="isOff(session, topic)">
                    <span class="topic__code tabular">{{ topic.topicCode || '—' }}</span>
                    <span class="topic__name">{{ topic.topicName }}</span>
                    @if (topic.durationMinutes) {
                      <span class="topic__mins text-xs text-muted tabular">
                        {{ topic.durationMinutes }} min
                      </span>
                    }
                    <app-status-badge [value]="topic.status ?? 'Active'" />
                    <div class="btn-row btn-row--end">
                      <button
                        type="button"
                        class="btn btn--icon"
                        title="Edit topic"
                        (click)="openTopic(session, topic)"
                      >
                        <app-icon name="edit" [size]="15" />
                      </button>
                      <ng-container *appCan="'curriculum.manage'">
                        <app-status-toggle
                          [status]="topic.status ?? 'Active'"
                          (toggled)="setTopicStatus(session, topic, $event)"
                        />
                      </ng-container>
                    </div>
                  </div>
                } @empty {
                  <p class="topic topic--none">No topic added to this session yet.</p>
                }

                <!-- Under the session it adds to, which is the whole
                     point of it being here rather than in a column. -->
                <button
                  type="button"
                  class="btn btn--ghost btn--sm topics__add"
                  (click)="openTopic(session)"
                >
                  <app-icon name="plus" [size]="14" /> Add topic to this session
                </button>
              </div>
            </article>
          } @empty {
            <p class="text-sm text-muted plan__none">
              {{ search() ? 'No session matches that name.' : 'No session added yet.' }}
            </p>
          }
        </div>
      </section>
    } @else {
      <div class="card" style="height: 220px"></div>
    }

    @if (sessionFormOpen()) {
      <app-modal
        [title]="editingSession() ? 'Edit session' : 'Add session'"
        [subtitle]="sessionForm.value.sessionCode || ''"
        size="sm"
        (closed)="sessionFormOpen.set(false)"
      >
        <form [formGroup]="sessionForm" id="session-form" (ngSubmit)="saveSession()" class="stack stack-md">
          <div class="field">
            <label class="field-label" for="sessionCode">Session code</label>
            <input id="sessionCode" class="input" formControlName="sessionCode" readonly />
            <span class="field-hint">Generated from the program code.</span>
          </div>
          <div class="field">
            <label class="field-label" for="sessionDay">Day</label>
            <input id="sessionDay" type="number" class="input" formControlName="day" min="1" />
          </div>
          <!-- The hours, side by side because they are one answer. Left
               empty on a curriculum written before the timetable is
               settled; the session is still a session. -->
          <div class="row row-md">
            <div class="field" style="flex: 1">
              <label class="field-label" for="sessionStart">Start time</label>
              <input id="sessionStart" type="time" class="input" formControlName="startTime" />
            </div>
            <div class="field" style="flex: 1">
              <label class="field-label" for="sessionEnd">End time</label>
              <input id="sessionEnd" type="time" class="input" formControlName="endTime" />
            </div>
          </div>
          @if (hoursBackwards()) {
            <span class="field-error">The end time has to be after the start time.</span>
          }
          <div class="field">
            <label class="field-label" for="sessionName">Session name <span class="req">*</span></label>
            <input id="sessionName" class="input" formControlName="sessionName" placeholder="Day 1: Session 1" />
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="sessionFormOpen.set(false)">Cancel</button>
          <button type="submit" form="session-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Save session
          </button>
        </div>
      </app-modal>
    }

    @if (topicFormOpen()) {
      <app-modal
        title="Add topic"
        [subtitle]="topicForm.value.topicCode || ''"
        size="sm"
        (closed)="topicFormOpen.set(false)"
      >
        <form [formGroup]="topicForm" id="topic-form" (ngSubmit)="saveTopic()" class="stack stack-md">
          <div class="field">
            <label class="field-label" for="topicCode">Topic code</label>
            <input id="topicCode" class="input" formControlName="topicCode" readonly />
          </div>
          <div class="field">
            <label class="field-label" for="topicName">Topic name <span class="req">*</span></label>
            <input id="topicName" class="input" formControlName="topicName" />
          </div>
          <div class="field">
            <label class="field-label" for="topicDuration">Duration (minutes)</label>
            <input id="topicDuration" type="number" class="input" formControlName="durationMinutes" />
          </div>
        </form>
        <div footer>
          <button type="button" class="btn btn--secondary" (click)="topicFormOpen.set(false)">Cancel</button>
          <button type="submit" form="topic-form" class="btn btn--primary" [disabled]="saving()">
            @if (saving()) { <span class="spinner"></span> }
            Save topic
          </button>
        </div>
      </app-modal>
    }
  `,
  styles: [
    `
      /* The plan, session by session.

         Nothing here is a table any more. A session's own particulars -
         its code, its name, its hours, whether it is switched on - are
         the header of a block, and its topics are the list inside it.
         The two sets of codes and names can no longer be read as one
         row, which is what they were when they shared nine columns. */
      .plan {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        padding: 0.9rem 1.15rem 1.15rem;
      }
      .plan__none { margin: 0; padding: 1.5rem 0; text-align: center; }

      .sess {
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        overflow: hidden;
      }
      /* Switched off: still listed, visibly not in use. */
      .sess--off { opacity: 0.62; }

      .sess__head {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        padding: 0.65rem 0.85rem;
        background: var(--surface-muted);
        border-bottom: 1px solid var(--border);
      }
      .sess__serial {
        display: grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        flex: none;
        border-radius: 50%;
        background: var(--brand-100);
        color: var(--brand-800);
        font-size: var(--fs-xs);
        font-weight: 700;
      }
      .sess__id {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
        min-width: 180px;
        flex: 1 1 240px;
      }
      .sess__code {
        font-size: var(--fs-xs);
        font-weight: 600;
        color: var(--brand-700);
        letter-spacing: 0.02em;
      }
      .sess__name { font-size: var(--fs-sm); font-weight: 600; color: var(--ink-900); }
      .sess__meta {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
        margin-left: auto;
      }

      /* The topics, indented under their session so the hierarchy is the
         first thing the eye gets rather than something to work out from
         the codes. */
      .topics {
        display: flex;
        flex-direction: column;
        padding: 0.35rem 0.85rem 0.6rem 2.9rem;
      }
      .topic {
        display: flex;
        align-items: center;
        gap: 0.65rem;
        flex-wrap: wrap;
        padding: 0.45rem 0;
        font-size: var(--fs-sm);
        color: var(--ink-800);
        border-bottom: 1px solid var(--ink-100);
      }
      .topic:last-of-type { border-bottom: 0; }
      .topic--off { opacity: 0.62; }
      .topic__code {
        min-width: 150px;
        font-size: var(--fs-xs);
        color: var(--ink-500);
      }
      .topic__name { flex: 1 1 220px; }
      .topic--none {
        margin: 0;
        padding: 0.5rem 0;
        color: var(--ink-500);
        font-style: italic;
        border-bottom: 0;
      }
      .topic .btn-row { margin-left: auto; }

      .topics__add { align-self: flex-start; margin-top: 0.4rem; }

      @media (max-width: 640px) {
        .topics { padding-left: 1rem; }
        .topic__code { min-width: 0; }
      }
    `,
  ],
})
export class CurriculumSessionsComponent {
  private readonly service = inject(CurriculumService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  /** Bound from the route via `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  protected readonly curriculum = signal<Curriculum | null>(null);
  protected readonly search = signal('');
  protected readonly saving = signal(false);

  protected readonly sessionFormOpen = signal(false);
  protected readonly topicFormOpen = signal(false);
  protected readonly editingSession = signal<CurriculumSession | null>(null);
  private readonly topicParent = signal<CurriculumSession | null>(null);
  private readonly editingTopic = signal<CurriculumTopic | null>(null);

  protected readonly sessionForm = this.fb.group({
    sessionCode: [''],
    sessionName: ['', Validators.required],
    day: [1],
    startTime: [''],
    endTime: [''],
  });

  /** Both given and the wrong way round, which the Save button refuses. */
  protected readonly hoursBackwards = signal(false);

  protected readonly topicForm = this.fb.group({
    topicCode: [''],
    topicName: ['', Validators.required],
    durationMinutes: [60],
  });

  /** The hours a session runs, or a dash where they are not set yet. */
  protected timing(session: CurriculumSession): string {
    if (!session.startTime) return '—';
    return session.endTime
      ? `${clock(session.startTime)} – ${clock(session.endTime)}`
      : clock(session.startTime);
  }

  protected readonly topicTotal = computed(() =>
    (this.curriculum()?.sessions ?? []).reduce((n, s) => n + s.topics.length, 0),
  );

  /**
   * The sessions the search leaves, each carrying its own topics.
   *
   * A topic's name counts as a match too: somebody looking for where a
   * subject is taught searches for the subject, and the session it sits
   * under is the answer.
   */
  protected readonly visible = computed<CurriculumSession[]>(() => {
    const programme = this.curriculum();
    if (!programme) return [];

    const term = this.search().toLowerCase();
    if (!term) return programme.sessions;

    return programme.sessions.filter(
      (session) =>
        session.sessionName.toLowerCase().includes(term)
        || session.sessionCode.toLowerCase().includes(term)
        || session.topics.some((topic) => topic.topicName.toLowerCase().includes(term)),
    );
  });

  constructor() {
    effect(() => {
      const id = Number(this.id());
      if (!id) return;
      this.service.getById(id).subscribe((row) => this.curriculum.set(row));
    });
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value.trim());
  }

  protected openSession(session?: CurriculumSession): void {
    const programme = this.curriculum();
    if (!programme) return;
    this.editingSession.set(session ?? null);
    this.sessionForm.reset({
      sessionCode:
        session?.sessionCode ??
        nextSessionCode(programme.programTypeCode ?? '', programme.sessions.length),
      sessionName: session?.sessionName ?? '',
      day: session?.day ?? 1,
      startTime: clock(session?.startTime),
      endTime: clock(session?.endTime),
    });
    this.hoursBackwards.set(false);
    this.sessionFormOpen.set(true);
  }

  protected openTopic(session: CurriculumSession, topic?: CurriculumTopic): void {
    this.topicParent.set(session);
    this.editingTopic.set(topic ?? null);
    this.topicForm.reset({
      /* The code is fixed once issued: renumbering a topic would break every
         reference to it. A new one continues the session's sequence. */
      topicCode: topic?.topicCode ?? nextTopicCode(session.sessionCode, session.topics.length),
      topicName: topic?.topicName ?? '',
      durationMinutes: topic?.durationMinutes ?? 60,
    });
    this.topicFormOpen.set(true);
  }

  /** Dims a row whose session or topic is switched off. */
  protected isOff(session: CurriculumSession, topic?: CurriculumTopic | null): boolean {
    return (session.status ?? 'Active') === 'Inactive' || (topic?.status ?? 'Active') === 'Inactive';
  }

  protected setSessionStatus(session: CurriculumSession, status: RecordStatus): void {
    const programme = this.curriculum();
    if (!programme) return;
    this.persist(
      {
        ...programme,
        sessions: programme.sessions.map((s) => (s.id === session.id ? { ...s, status } : s)),
      },
      status === 'Active' ? 'Session enabled' : 'Session disabled',
    );
  }

  protected setTopicStatus(
    session: CurriculumSession,
    topic: CurriculumTopic,
    status: RecordStatus,
  ): void {
    const programme = this.curriculum();
    if (!programme) return;
    this.persist(
      {
        ...programme,
        sessions: programme.sessions.map((s) =>
          s.id === session.id
            ? { ...s, topics: s.topics.map((t) => (t.id === topic.id ? { ...t, status } : t)) }
            : s,
        ),
      },
      status === 'Active' ? 'Topic enabled' : 'Topic disabled',
    );
  }

  protected saveSession(): void {
    const programme = this.curriculum();
    if (!programme || this.sessionForm.invalid) {
      this.sessionForm.markAllAsTouched();
      this.toast.error('Check the form', describeFirstError(this.sessionForm));
      return;
    }
    const value = this.sessionForm.getRawValue();

    const startTime = value.startTime || null;
    const endTime = value.endTime || null;
    if (startTime && endTime && endTime <= startTime) {
      this.hoursBackwards.set(true);
      return;
    }
    this.hoursBackwards.set(false);

    const existing = this.editingSession();
    const sessions = existing
      ? programme.sessions.map((s) =>
          s.id === existing.id
            ? {
                ...s,
                sessionName: value.sessionName ?? '',
                day: value.day ?? null,
                startTime,
                endTime,
              }
            : s,
        )
      : [
          ...programme.sessions,
          {
            id: Math.max(0, ...programme.sessions.map((s) => s.id)) + 1,
            sessionCode: value.sessionCode ?? '',
            sessionName: value.sessionName ?? '',
            displayOrder: programme.sessions.length + 1,
            day: value.day ?? null,
            startTime,
            endTime,
            status: 'Active' as RecordStatus,
            topics: [],
          } satisfies CurriculumSession,
        ];
    this.persist({ ...programme, sessions }, existing ? 'Session updated' : 'Session added');
    this.sessionFormOpen.set(false);
  }

  protected saveTopic(): void {
    const programme = this.curriculum();
    const parent = this.topicParent();
    if (!programme || !parent || this.topicForm.invalid) {
      this.topicForm.markAllAsTouched();
      this.toast.error('Check the form', describeFirstError(this.topicForm));
      return;
    }
    const value = this.topicForm.getRawValue();
    const existing = this.editingTopic();

    const sessions = programme.sessions.map((session) => {
      if (session.id !== parent.id) return session;

      const topics = existing
        ? session.topics.map((t) =>
            t.id === existing.id
              ? {
                  ...t,
                  topicName: value.topicName ?? '',
                  durationMinutes: value.durationMinutes ?? null,
                }
              : t,
          )
        : [
            ...session.topics,
            {
              id: Math.max(0, ...session.topics.map((t) => t.id)) + 1,
              topicCode: value.topicCode ?? '',
              topicName: value.topicName ?? '',
              displayOrder: session.topics.length + 1,
              durationMinutes: value.durationMinutes ?? null,
              status: 'Active' as RecordStatus,
            } satisfies CurriculumTopic,
          ];

      return { ...session, topics };
    });

    this.persist({ ...programme, sessions }, existing ? 'Topic updated' : 'Topic added');
    this.topicFormOpen.set(false);
  }

  private persist(next: Curriculum, message: string): void {
    this.saving.set(true);
    this.service.update(next.id, next as unknown as Record<string, unknown>).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.curriculum.set(saved);
        this.toast.success(message, next.programTypeCode ?? '');
      },
      error: () => this.saving.set(false),
    });
  }
}
