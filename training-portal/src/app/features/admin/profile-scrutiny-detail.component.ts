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
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  LoadedPhoto,
  ProfileField,
  ProfileForm,
  ProfileSection,
  ProfileSubmission,
  RejectionReason,
} from '../../core/models';
import { ProfileFormService } from '../../core/services/academics.service';
import {
  ProfileSubmissionService,
  RejectionReasonService,
} from '../../core/services/workflow.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { DynamicFormComponent } from '../../shared/components/dynamic-form.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { StatusBadgeComponent } from '../../shared/components/status-badge.component';
import { TimelineComponent } from '../../shared/components/timeline.component';

/**
 * A document fetched for reading.
 *
 * `kind` decides how it is shown; `safeUrl` exists only because an
 * <iframe src> is a resource URL and Angular will not take a blob: one
 * without being told it is trusted. It is trusted: this component made it,
 * from bytes this account was served.
 */
interface OpenAttachment {
  name: string;
  url: string;
  safeUrl?: SafeResourceUrl;
  kind: 'image' | 'pdf' | 'other';
}

/**
 * One profile, read in full and decided on.
 *
 * Laid out the way the application sheet was, because it answers the same
 * question and reading them should feel the same: the form down the middle
 * under its own sections, who the applicant is and where the profile stands
 * down the side, and the decision at the top where it is not hunted for.
 *
 * The form is rendered by the same component the applicant filled it in, in
 * read-only mode. A scrutiny officer sees the sections, the labels and the
 * order the applicant saw — not a list of storage keys, which is what a flat
 * dump of the answers amounts to.
 */
@Component({
  selector: 'app-profile-scrutiny-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    DynamicFormComponent,
    IconComponent,
    ModalComponent,
    PageHeaderComponent,
    StatusBadgeComponent,
    TimelineComponent,
  ],
  template: `
    @if (submission(); as record) {
      <app-page-header
        [title]="record.applicantName ?? 'Profile'"
        [subtitle]="
          (record.applicantCode ?? '') + ' · ' + record.categoryName + ' · ' +
          record.subCategoryName + ' · attempt ' + record.attemptNo
        "
        icon="user-check"
        [breadcrumbs]="[
          { label: 'Administration' },
          { label: 'Profile scrutiny', link: '/admin/profile-scrutiny' },
          { label: record.applicantCode ?? 'Profile' }
        ]"
      >
        <a class="btn btn--secondary" routerLink="/admin/profile-scrutiny">
          <app-icon name="chevron-left" [size]="15" /> Back to profile scrutiny
        </a>
<!-- The decision belongs to the Operation Manager the profile was
             placed with, and to nobody else. The tiers above read the
             register to see where things stand; offering them buttons the
             server refuses only invites the question of why they failed. -->
        @if (canDecide(record)) {
          <button type="button" class="btn btn--danger" (click)="askToReject()" [disabled]="saving()">
            <app-icon name="x" [size]="15" /> Reject
          </button>
          <button type="button" class="btn btn--success" (click)="accept()" [disabled]="saving()">
            <app-icon name="check" [size]="15" /> Accept
          </button>
        }
      </app-page-header>

      <section class="card sheet">
        <!-- A section at a time, named down the side.

             A profile runs to eight sections and forty answers. Reading
             one by scrolling - down to the qualifications, back up to
             the identity to check a name against them - was the whole
             of the job. The names were a row of tabs across the top
             until there were eight of them and the row wrapped, or
             scrolled sideways, which is no way to show a list. Down the
             left they are a list, they fit, and each one is a click
             away without the reader losing their place. -->
        <nav class="sheet__nav" aria-label="Profile sections">
          <button
            type="button"
            class="sheet__tab"
            [class.is-active]="tab() === 'overview'"
            (click)="tab.set('overview')"
          >
            <app-icon name="flag" [size]="14" /> Overview
          </button>
          @for (section of sections(); track section.id) {
            <button
              type="button"
              class="sheet__tab"
              [class.is-active]="tab() === section.id"
              (click)="tab.set(section.id)"
            >{{ section.title }}</button>
          }
          <button
            type="button"
            class="sheet__tab"
            [class.is-active]="tab() === 'history'"
            (click)="tab.set('history')"
          >History ({{ record.history.length }})</button>
        </nav>

        <div class="sheet__body">
            @if (tab() === 'overview') {
              <!-- Who this is, where it stands, and what the profile
                   holds. These facts were a column down the right of
                   every section: beside answers they have nothing to do
                   with, and taking a third of the width from the ones
                   being read. As a section of their own they can be
                   what somebody opening a profile actually wants first -
                   the face, the identity, and a way into the rest. -->
              <div class="summary">
                <header class="who">
                  @if (portrait(); as shot) {
                    <img class="who__face" [src]="shot" alt="" />
                  } @else {
                    <div class="who__face who__face--none" aria-hidden="true">
                      <app-icon name="user-check" [size]="26" />
                    </div>
                  }
                  <div class="who__id">
                    <h2 class="who__name">{{ record.applicantName }}</h2>
                    <p class="who__meta">
                      <code>{{ record.applicantCode }}</code>
                      <span>{{ record.categoryName }}</span>
                      <span>{{ record.subCategoryName }}</span>
                      <span>Attempt {{ record.attemptNo }}</span>
                    </p>
                  </div>
                  <app-status-badge class="who__state" [value]="record.status" />
                </header>

                <dl class="facts">
                  <div class="facts__one">
                    <dt>Submitted on</dt>
                    <dd>
                      {{ record.submittedOn ? (record.submittedOn | date: 'dd MMM yyyy') : '—' }}
                    </dd>
                  </div>
                  <div class="facts__one">
                    <dt>Assigned to</dt>
                    <dd>
                      {{ record.assignedToName || 'Unassigned' }}
                      <!-- The account and what it is, rather than a
                           sentence about how the desk was picked: two
                           managers can share a name, and what the
                           reader needs is which one. -->
                      @if (record.assignedToCode) {
                        <span class="text-xs text-muted">
                          <code>{{ record.assignedToCode }}</code>
                          @if (record.assignedToRole) { · {{ record.assignedToRole }} }
                        </span>
                      }
                    </dd>
                  </div>
                  <!-- What was decided, once it has been. Everybody sees
                       this, the manager who decided included: it is the
                       record of the outcome rather than the means of
                       reaching one, and why an applicant was turned down
                       is the part the rest of the office needs. Nothing
                       stands here while a profile is still open. -->
                  @if (record.decidedOn) {
                    <div class="facts__one">
                      <dt>Decided</dt>
                      <dd>
                        {{ record.decidedOn | date: 'dd MMM yyyy, h:mm a' }}
                        @if (record.decidedByUserName) {
                          <span class="text-xs text-muted">
                            by {{ record.decidedByUserName }}
                          </span>
                        }
                      </dd>
                    </div>
                    @if (record.rejectionReasonLabel) {
                      <div class="facts__one">
                        <dt>Reason</dt>
                        <dd class="text-danger">{{ record.rejectionReasonLabel }}</dd>
                      </div>
                    }
                    @if (record.remarks) {
                      <div class="facts__one facts__one--wide">
                        <dt>Remarks</dt>
                        <dd>{{ record.remarks }}</dd>
                      </div>
                    }
                  }
                </dl>

                <!-- And the way in. A reader who has just been handed a
                     profile wants to know what is in it before they start
                     clicking through, and how much of each section was
                     actually answered is the thing the list down the side
                     cannot say. -->
                @if (sections().length > 0) {
                  <section class="contents">
                    <h3 class="contents__head">What this profile holds</h3>
                    <div class="contents__grid">
                      @for (section of sections(); track section.id) {
                        <button
                          type="button"
                          class="contents__one"
                          (click)="tab.set(section.id)"
                        >
                          <span class="contents__title">{{ section.title }}</span>
                          <span class="contents__count">{{ filledIn(section) }}</span>
                          <app-icon name="chevron-right" [size]="14" />
                        </button>
                      }
                    </div>
                  </section>
                }
              </div>
            } @else if (tab() === 'history') {
              <div class="card__body">
                <app-timeline
                  [events]="historyEvents(record)"
                  emptyMessage="No activity recorded yet."
                />
              </div>
            } @else if (definition(); as form) {
              <app-dynamic-form
                [definition]="form"
                [values]="$any(record.responses)"
                [photos]="photos()"
                [attachments]="record.attachments ?? []"
                [readonly]="true"
                [openable]="true"
                [only]="$any(tab())"
                (openFile)="openAttachment(record.id, $event.fieldKey, $event.entry)"
              />
            } @else {
              <div class="card__body">
                <p class="text-sm text-muted">
                  Loading the profile form for this discipline…
                </p>
              </div>
            }
        </div>
      </section>

    <!-- What the applicant attached, shown rather than downloaded.
         An officer deciding a profile is looking at a marksheet, and
         making them find it in a downloads folder and come back is the
         slow way of answering one question. Anything the browser cannot
         render inline - a .docx, say - still has the link under it. -->
    @if (attachment(); as held) {
      <app-modal [title]="held.name" size="lg" (closed)="closeAttachment()">
        <div class="viewer">
          @if (held.kind === 'image') {
            <img class="viewer__image" [src]="held.url" [alt]="held.name" />
          } @else if (held.kind === 'pdf') {
            <iframe class="viewer__frame" [src]="held.safeUrl" [title]="held.name"></iframe>
          } @else {
            <p class="text-sm text-muted">
              This document cannot be shown here. Download it to read it.
            </p>
          }
        </div>

        <div footer>
          <a class="btn btn--secondary" [href]="held.url" [download]="held.name">
            <app-icon name="download" [size]="15" /> Download
          </a>
          <button type="button" class="btn btn--primary" (click)="closeAttachment()">Close</button>
        </div>
      </app-modal>
    }

<!-- Asked for at the moment of rejecting, rather than sitting open
           beside a profile nobody has decided on. A reason is required: the
           applicant is told why and has to be able to put it right. -->
      @if (rejecting()) {
        <app-modal
          title="Reject this profile"
          [subtitle]="(record.applicantName ?? '') + ' · ' + (record.applicantCode ?? '')"
          size="sm"
          (closed)="rejecting.set(false)"
        >
          <form [formGroup]="decision" class="stack stack-sm">
            <div class="field">
              <label class="field-label" for="pdReason">Reason <span class="req">*</span></label>
              <select id="pdReason" class="select" formControlName="rejectionReasonId">
                <option [ngValue]="null">Select a reason</option>
                @for (reason of reasons(); track reason.id) {
                  <option [ngValue]="reason.id">{{ reason.label }}</option>
                }
              </select>
              <span class="field-hint">The applicant is told this, and can send it again.</span>
            </div>
            <div class="field">
              <label class="field-label" for="pdRemarks">Remarks</label>
              <textarea
                id="pdRemarks"
                class="input"
                rows="4"
                formControlName="remarks"
                placeholder="Anything the applicant should know"
              ></textarea>
            </div>
          </form>

          <div footer>
            <button type="button" class="btn btn--secondary" (click)="rejecting.set(false)">
              Cancel
            </button>
            <button type="button" class="btn btn--danger" (click)="reject()" [disabled]="saving()">
              <app-icon name="x" [size]="15" />
              {{ saving() ? 'Rejecting…' : 'Reject profile' }}
            </button>
          </div>
        </app-modal>
      }
    } @else {
      <div class="card" style="height: 320px"></div>
    }
  `,
  styles: [
    `
      /* Tall enough that a marksheet is readable without scrolling the
         page behind the dialog, and capped so a long document scrolls
         inside the viewer rather than pushing the buttons off screen. */
      .viewer { display: grid; }
      .viewer__image {
        max-width: 100%;
        max-height: 70vh;
        margin: 0 auto;
        object-fit: contain;
        border-radius: var(--radius);
      }
      .viewer__frame {
        width: 100%;
        height: 70vh;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
      }

      /* The sheet: names down the left, one section to the right. */
      .sheet {
        display: grid;
        grid-template-columns: 232px minmax(0, 1fr);
        align-items: stretch;
        overflow: hidden;
      }
      .sheet__nav {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 0.6rem;
        background: var(--surface-muted);
        border-right: 1px solid var(--border);
      }
      /* The list stays put while a long section scrolls past it, which
         is the point of having it down the side. Only where there is
         the height for it: on a short window a stuck list is a list
         with its own scrollbar, which is worse than one that moves. */
      @media (min-height: 720px) {
        .sheet__nav {
          position: sticky;
          top: 0;
          align-self: start;
          max-height: 100vh;
          overflow: auto;
        }
      }
      .sheet__tab {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        width: 100%;
        padding: 0.5rem 0.7rem;
        border: 0;
        border-radius: var(--radius);
        background: transparent;
        font: inherit;
        font-size: var(--fs-sm);
        font-weight: 500;
        color: var(--ink-700);
        text-align: left;
        cursor: pointer;
        /* A long section name wraps rather than being cut off: the
           names are the navigation and half a name navigates nowhere. */
        white-space: normal;
        line-height: 1.35;
      }
      .sheet__tab:hover { background: var(--ink-100); color: var(--ink-900); }
      .sheet__tab.is-active {
        background: var(--brand-700);
        color: #fff;
        font-weight: 600;
      }
      .sheet__body { min-width: 0; }

      /* On a narrow window the rail goes back to being a row across the
         top, because 232px of a phone is most of the phone. */
      @media (max-width: 860px) {
        .sheet { grid-template-columns: minmax(0, 1fr); }
        .sheet__nav {
          flex-direction: row;
          flex-wrap: wrap;
          border-right: 0;
          border-bottom: 1px solid var(--border);
          position: static;
          max-height: none;
        }
        .sheet__tab { width: auto; }
      }

      /* Overview --------------------------------------------------- */

      .summary { padding: 1.1rem 1.25rem 1.25rem; }

      /* Who this is. The face, the name, and the handful of codes that
         identify them, on one line across the top. */
      .who {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--border);
      }
      .who__face {
        width: 76px;
        height: 76px;
        flex: none;
        object-fit: cover;
        border-radius: var(--radius);
        border: 1px solid var(--border);
        background: var(--surface-muted);
      }
      .who__face--none {
        display: grid;
        place-items: center;
        color: var(--ink-400, var(--ink-500));
      }
      .who__id { min-width: 0; }
      .who__name {
        margin: 0;
        font-size: var(--fs-xl);
        font-weight: 600;
        color: var(--ink-900);
        line-height: 1.2;
      }
      .who__meta {
        margin: 0.3rem 0 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.3rem 0.5rem;
        font-size: var(--fs-sm);
        color: var(--ink-600);
      }
      /* Separated by a dot rather than by a comma, because one of these
         is a code and the rest are names. */
      .who__meta > span + span::before { content: '·'; margin-right: 0.5rem; }
      .who__state { margin-left: auto; align-self: flex-start; }

      /* The facts, across rather than down: there are four or five of
         them and a column of four short answers is mostly whitespace. */
      .facts {
        margin: 0;
        padding: 1rem 0 0;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
        gap: 0.9rem 1.5rem;
      }
      .facts__one { min-width: 0; display: grid; gap: 0.15rem; }
      .facts__one--wide { grid-column: 1 / -1; }
      .facts dt {
        font-size: var(--fs-xs);
        font-weight: 600;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: var(--ink-500);
      }
      .facts dd {
        margin: 0;
        display: grid;
        gap: 0.1rem;
        justify-items: start;
        font-size: var(--fs-sm);
        color: var(--ink-800);
        overflow-wrap: anywhere;
      }

      /* And the way in. */
      .contents { margin-top: 1.4rem; }
      .contents__head {
        margin: 0 0 0.6rem;
        font-size: var(--fs-xs);
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--brand-700);
      }
      .contents__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 0.5rem;
      }
      .contents__one {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        padding: 0.6rem 0.75rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        background: var(--surface);
        font: inherit;
        font-size: var(--fs-sm);
        color: var(--ink-800);
        text-align: left;
        cursor: pointer;
      }
      .contents__one:hover {
        border-color: var(--brand-300, var(--brand-100));
        background: var(--brand-50);
      }
      .contents__title { flex: 1; min-width: 0; font-weight: 600; }
      .contents__count {
        font-size: var(--fs-xs);
        color: var(--ink-500);
        white-space: nowrap;
      }
      .contents__one app-icon { color: var(--ink-400, var(--ink-500)); }
      /* A panel heading is a flex row, so anything after the title goes
         to the far end of it rather than trailing the words. */
      .panel__aside { margin-left: auto; }

      .text-danger { color: var(--danger-700); }
      .req { color: var(--danger-600); }
    `,
  ],
})
export class ProfileScrutinyDetailComponent {
  readonly id = input.required<string>();

  private readonly service = inject(ProfileSubmissionService);
  private readonly forms = inject(ProfileFormService);
  private readonly reasonService = inject(RejectionReasonService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly submission = signal<ProfileSubmission | null>(null);
  protected readonly definition = signal<ProfileForm | null>(null);
  /**
   * Which tab is open: a section's id, or the history.
   *
   * Set to the first section as soon as the form arrives, because a
   * profile opens on its first section the way a paper one opens on its
   * first page.
   */
  /**
   * The section on screen. Overview to begin with: where a profile
   * stands and whose desk it is on are what somebody opening one wants
   * first, and it is the one section that is there before the form
   * definition has arrived.
   */
  protected readonly tab = signal<number | 'history' | 'overview'>('overview');

  /** The sections of the form this profile was filled against. */
  protected readonly sections = computed(
    () => this.definition()?.sections.filter((one) => one.isEnabled !== false) ?? [],
  );

  /**
   * The applicant's own photograph, where the form asked for one.
   *
   * The first picture of the first camera field, which on every profile
   * form in use is the passport photograph. An officer deciding a
   * profile checks the face against the name and the ID, and having to
   * open a section to see it is one click in the way of the first thing
   * they do.
   *
   * Null where the form has no camera field, or the picture has not
   * come down yet; the summary draws a placeholder rather than a gap.
   */
  protected readonly portrait = computed(() => {
    const camera = this.sections()
      .flatMap((section) => section.fields ?? [])
      .find((field) => field.type === 'photos' && field.isEnabled !== false);

    if (!camera) return null;

    const held = this.photos()[DynamicFormComponent.photoKey(camera.key, 0)] ?? [];
    return held[0]?.url ?? null;
  });

  /**
   * How much of a section was answered, in the words a reader wants.
   *
   * A repeating section is counted in entries - three qualifications is
   * what somebody wants to know, not twelve of fifteen boxes. A plain
   * one is counted in answers, so a section left half-filled says so
   * before it is opened.
   */
  protected filledIn(section: ProfileSection): string {
    const answers = (this.submission()?.responses ?? {}) as Record<string, unknown>;

    if (section.isRepeatable) {
      const held = answers[section.key?.trim() || `section${section.id}`];
      const many = Array.isArray(held) ? held.length : 0;
      return many === 1 ? '1 entry' : `${many} entries`;
    }

    const fields = (section.fields ?? []).filter(
      (one: ProfileField) => one.isEnabled !== false);

    const given = fields.filter((one: ProfileField) => {
      const value = answers[one.key];
      if (value === null || value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      return String(value).trim() !== '';
    }).length;

    return `${given} of ${fields.length}`;
  }
  protected readonly saving = signal(false);
  protected readonly rejecting = signal(false);

  /** The pictures for every camera field, keyed by field and row. */
  protected readonly photos = signal<Record<string, LoadedPhoto[]>>({});

  /** The one attachment being read, if any. */
  protected readonly attachment = signal<OpenAttachment | null>(null);
  protected readonly fetching = signal(false);

  /* Only the reasons still switched on: a retired one stays on the
     submissions that cite it but must not be handed out again. */
  protected readonly reasons = toSignal(this.reasonService.list(true), {
    initialValue: [] as RejectionReason[],
  });

  protected readonly decision = this.fb.group({
    rejectionReasonId: [null as number | null],
    remarks: [''],
  });

  constructor() {
    /* Registered once, not inside the effect: the effect re-runs whenever
       the route id changes, and a teardown added on each run would be a
       handler per visit for the lifetime of the screen. */
    this.destroyRef.onDestroy(() => {
      this.revokePhotos();
      this.closeAttachment();
    });

    effect(() => {
      const id = Number(this.id());
      if (!id) return;

      this.service.getById(id).subscribe((record) => {
        this.submission.set(record);

        /* The form it was filled against, so the answers read in their own
           sections rather than as a list of keys. */
        this.forms.bySubCategory(record.subCategoryId).subscribe({
          next: (form) => {
            this.definition.set(form);
            if (form) this.loadPhotos(record.id, form);

            /* The page opens on Overview and stays there. It used to
               jump to the first section as soon as the form arrived,
               which moved the page under somebody who had already
               started reading. */
          },
          error: () => this.definition.set(null),
        });
      });
    });
  }

  /**
   * Fetches every picture the form's camera fields hold.
   *
   * Two steps per field: the register of what is there, then the bytes of
   * each one. The images need the bearer token, which an <img src> cannot
   * carry, so each becomes an object URL — and every one of those is a
   * handle on memory that the browser only releases when told, which is
   * what the teardown below is for.
   */
  private loadPhotos(id: number, form: ProfileForm): void {
    this.revokePhotos();
    this.photos.set({});

    const record = this.submission();

    for (const section of form.sections) {
      const camera = (section.fields as ProfileField[])
        .filter((field) => field.type === 'photos');
      if (camera.length === 0) continue;

      /* How many rows this section was answered on. A repeating section
         holds a list under its own key, and the same camera field is
         asked once on each row - so the pictures are fetched per row and
         kept apart by it. A section asked once has one row, numbered
         nought, which is what everything filled in before the rows
         existed is stored as. */
      const answered = record?.responses?.[this.keyOf(section)];
      const rows = section.isRepeatable && Array.isArray(answered)
        ? Math.max(answered.length, 1)
        : 1;

      for (const field of camera) {
        for (let entry = 0; entry < rows; entry += 1) {
          this.loadField(id, field.key, entry);
        }
      }
    }
  }

  /** Where the form's section stores its entries. */
  private keyOf(section: { key?: string | null; id: number }): string {
    return section.key?.trim() || `section${section.id}`;
  }

  private loadField(id: number, fieldKey: string, entry: number): void {
    const held = DynamicFormComponent.photoKey(fieldKey, entry);

    this.service.photos(id, fieldKey, entry).subscribe({
        next: (shots) => {
          for (const shot of shots) {
            this.service.photo(id, fieldKey, shot.displayOrder, entry).subscribe({
              next: (blob) => {
                const loaded: LoadedPhoto = { ...shot, url: URL.createObjectURL(blob) };
                this.photos.update((kept) => {
                  const forField = [...(kept[held] ?? []), loaded]
                    .sort((a, b) => a.displayOrder - b.displayOrder);
                  return { ...kept, [held]: forField };
                });
              },
              /* One picture that will not load must not take the others
                 with it; the rest of the set still tells the officer
                 most of what they need. */
              error: () => undefined,
            });
          }
        },
        error: () => undefined,
      });
  }

  /**
   * Fetches one attached document and puts it on screen.
   *
   * The endpoint wants the bearer token, so this cannot be an href: the
   * bytes come back as a blob and become an object URL, which is also
   * what the Download button hands to the browser. One at a time, and
   * the previous one is released before the next is made.
   */
  protected openAttachment(id: number, fieldKey: string, entry: number): void {
    if (this.fetching()) return;
    this.fetching.set(true);

    this.service.file(id, fieldKey, entry).subscribe({
      next: (blob) => {
        this.fetching.set(false);
        this.closeAttachment();

        const type = blob.type || 'application/octet-stream';
        const url = URL.createObjectURL(blob);

        this.attachment.set({
          name: this.nameOf(fieldKey) ?? fieldKey,
          url,
          safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(url),
          kind: type.startsWith('image/')
            ? 'image'
            : type === 'application/pdf'
              ? 'pdf'
              : 'other',
        });
      },
      error: () => {
        this.fetching.set(false);
        this.toast.error(
          'Nothing attached',
          'No document is held for this field. The applicant may have typed the name without sending the file.',
        );
      },
    });
  }

  protected closeAttachment(): void {
    const held = this.attachment();
    if (!held) return;
    URL.revokeObjectURL(held.url);
    this.attachment.set(null);
  }

  /** The label the form gives a field, so the viewer is titled in its words. */
  private nameOf(fieldKey: string): string | null {
    const form = this.definition();
    if (!form) return null;

    for (const section of form.sections) {
      for (const field of section.fields as ProfileField[]) {
        if (field.key === fieldKey) return field.label;
      }
    }
    return null;
  }

  private revokePhotos(): void {
    for (const shots of Object.values(this.photos())) {
      for (const shot of shots) URL.revokeObjectURL(shot.url);
    }
  }

  protected isOpen(record: ProfileSubmission): boolean {
    return record.status === 'Submitted' || record.status === 'UnderScrutiny';
  }

  /**
   * Whether this account may decide this profile.
   *
   * The Operation Manager it was placed with, and only while it is still
   * open. The server holds the same rule — this hides a button that would
   * not work, which is not the same thing as enforcing anything.
   */
  protected canDecide(record: ProfileSubmission): boolean {
    return this.isOpen(record) && this.auth.hasRole('OperationManager');
  }

  /** The scrutiny events, in the shape the shared timeline reads. */
  protected historyEvents(record: ProfileSubmission) {
    return record.history.map((event) => ({
      on: event.on,
      area: 'Profile',
      title: event.action,
      detail: event.remarks ?? undefined,
      reference: event.rejectionReasonLabel ?? undefined,
      by: event.byUserName,
    }));
  }

  protected askToReject(): void {
    this.decision.reset({ rejectionReasonId: null, remarks: '' });
    this.rejecting.set(true);
  }

  protected accept(): void {
    this.decide('approve');
  }

  protected reject(): void {
    if (!this.decision.getRawValue().rejectionReasonId) {
      this.toast.error('Choose a reason', 'A profile turned down has to say what for.');
      return;
    }
    this.decide('reject');
  }

  private decide(kind: 'approve' | 'reject'): void {
    const record = this.submission();
    if (!record) return;

    const raw = this.decision.getRawValue();
    const remarks = (raw.remarks ?? '').trim();

    this.saving.set(true);
    const call =
      kind === 'approve'
        ? this.service.approve(record.id, { remarks })
        : this.service.reject(record.id, {
            remarks,
            rejectionReasonId: raw.rejectionReasonId,
          });

    call.subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.rejecting.set(false);
        this.submission.set(updated);
        this.toast.success(
          kind === 'approve' ? 'Profile accepted' : 'Profile rejected',
          record.applicantCode ?? '',
        );
        void this.router.navigate(['/admin/profile-scrutiny']);
      },
      error: () => this.saving.set(false),
    });
  }
}
