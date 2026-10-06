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

interface FlatRow {
  serial: number;
  session: CurriculumSession;
  topic: CurriculumTopic | null;
  isFirstTopic: boolean;
  rowSpan: number;
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

        <div class="table-wrap">
          <table class="table table--compact">
            <thead>
              <tr>
                <th style="width: 70px">S.No</th>
                <th style="width: 190px">Session code</th>
                <th>Session name</th>
                <th style="width: 210px">Topic code</th>
                <th>Topic name</th>
                <th style="width: 110px">Status</th>
                <th class="col-actions" style="width: 96px">Topic</th>
                <th class="col-actions" style="width: 130px">Session</th>
              </tr>
            </thead>
            <tbody>
              @for (row of flatRows(); track row.session.id + '-' + (row.topic?.id ?? 0)) {
                <tr [class.row--off]="isOff(row.session, row.topic)">
                  @if (row.isFirstTopic) {
                    <td [attr.rowspan]="row.rowSpan" class="cell-muted tabular">{{ row.serial }}</td>
                    <td [attr.rowspan]="row.rowSpan" class="cell-primary">{{ row.session.sessionCode }}</td>
                    <td [attr.rowspan]="row.rowSpan">{{ row.session.sessionName }}</td>
                  }
                  <td class="cell-muted">{{ row.topic?.topicCode || '—' }}</td>
                  <td>{{ row.topic?.topicName || 'No topic added' }}</td>
                  <td>
                    @if (row.topic) {
                      <app-status-badge [value]="row.topic.status ?? 'Active'" />
                    }
                  </td>
                  <td class="col-actions">
                    @if (row.topic; as topic) {
                      <div class="btn-row btn-row--end">
                        <button
                          type="button"
                          class="btn btn--icon"
                          title="Edit topic"
                          (click)="openTopic(row.session, topic)"
                        >
                          <app-icon name="edit" [size]="15" />
                        </button>
                        <ng-container *appCan="'curriculum.manage'">
                          <app-status-toggle
                          [status]="topic.status ?? 'Active'"
                          (toggled)="setTopicStatus(row.session, topic, $event)"
                        />
                        </ng-container>
                      </div>
                    }
                  </td>
                  @if (row.isFirstTopic) {
                    <td [attr.rowspan]="row.rowSpan" class="col-actions">
                      <div class="btn-row btn-row--end">
                        <button type="button" class="btn btn--icon" title="Add topic" (click)="openTopic(row.session)">
                          <app-icon name="plus" [size]="15" />
                        </button>
                        <button type="button" class="btn btn--icon" title="Edit session" (click)="openSession(row.session)">
                          <app-icon name="edit" [size]="15" />
                        </button>
                        <ng-container *appCan="'curriculum.manage'">
                          <app-status-toggle
                          [status]="row.session.status ?? 'Active'"
                          (toggled)="setSessionStatus(row.session, $event)"
                        />
                        </ng-container>
                      </div>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
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
  });

  protected readonly topicForm = this.fb.group({
    topicCode: [''],
    topicName: ['', Validators.required],
    durationMinutes: [60],
  });

  protected readonly topicTotal = computed(() =>
    (this.curriculum()?.sessions ?? []).reduce((n, s) => n + s.topics.length, 0),
  );

  /** One row per topic, with the session cells merged via rowspan. */
  protected readonly flatRows = computed<FlatRow[]>(() => {
    const programme = this.curriculum();
    if (!programme) return [];
    const term = this.search().toLowerCase();
    const rows: FlatRow[] = [];
    let serial = 0;

    for (const session of programme.sessions) {
      if (term && !session.sessionName.toLowerCase().includes(term)) continue;
      serial += 1;
      const topics = session.topics.length ? session.topics : [null];
      topics.forEach((topic, i) => {
        rows.push({
          serial,
          session,
          topic,
          isFirstTopic: i === 0,
          rowSpan: topics.length,
        });
      });
    }
    return rows;
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
    });
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
      return;
    }
    const value = this.sessionForm.getRawValue();
    const existing = this.editingSession();
    const sessions = existing
      ? programme.sessions.map((s) =>
          s.id === existing.id
            ? { ...s, sessionName: value.sessionName ?? '', day: value.day ?? null }
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
