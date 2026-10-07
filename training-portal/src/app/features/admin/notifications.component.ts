import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AppNotification,
  LookupItem,
  NOTIFICATION_AUDIENCES,
  NotificationAudience,
} from '../../core/models';
import { LookupService } from '../../core/services/masters.service';
import { AppNotificationService } from '../../core/services/notification.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmService } from '../../shared/components/confirm.service';
import {
  CellTemplateDirective,
  ColumnDef,
  DataTableComponent,
} from '../../shared/components/data-table.component';
import { IconComponent } from '../../shared/components/icon.component';
import { ModalComponent } from '../../shared/components/modal.component';
import { PageHeaderComponent } from '../../shared/components/page-header.component';
import { CanDirective } from '../../shared/directives/can.directive';
import { ListState, searchTerm } from '../../shared/list-state';

const COLUMNS: ColumnDef[] = [
  { key: 'title', header: 'Notification', sortable: true, variant: 'primary' },
  { key: 'audienceLabel', header: 'Sent to', width: '190px' },
  { key: 'kind', header: 'Raised by', width: '130px' },
  { key: 'sentOn', header: 'Sent', width: '150px' },
  { key: 'reach', header: 'Handsets', width: '140px', align: 'right' },
  { key: 'actions', header: '', width: '90px', align: 'right' },
];

/**
 * What the scheme says to the handsets.
 *
 * Two kinds of row sit in the same register. One somebody wrote and sent
 * from here; one the system raised because a programme opened or a track
 * was added. They are the same act — a notice went out — and reading them
 * apart is what the "Raised by" column is for.
 *
 * Sending is one button. A notice is written and gone in the same breath,
 * because an announcement held as a draft to be sent later is a thing
 * somebody forgets to send.
 */
@Component({
  selector: 'app-notifications',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CanDirective,
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    DataTableComponent,
    CellTemplateDirective,
    ModalComponent,
    IconComponent,
  ],
  template: `
    <app-page-header
      title="Notifications"
      subtitle="What goes to the handsets: an announcement you write, and the notices the system raises by itself."
      icon="bell"
      [breadcrumbs]="[{ label: 'Administration' }, { label: 'Notifications' }]"
    >
      <button *appCan="'notifications.send'" type="button" class="btn btn--primary" (click)="openForm()">
        <app-icon name="send" [size]="15" /> New notification
      </button>
    </app-page-header>

    <section class="card">
      <div class="card__body card__body--tight">
        <div class="filter-bar">
          <div class="field field--search">
            <div class="input-group">
              <span class="input-icon"><app-icon name="search" [size]="15" /></span>
              <input
                class="input"
                placeholder="Search what was sent"
                (input)="list.setSearch(term($event))"
              />
            </div>
          </div>
        </div>
      </div>

      <app-data-table
        [columns]="columns"
        [rows]="list.rows()"
        [loading]="list.loading()"
        [total]="list.total()"
        [page]="list.page()"
        [pageSize]="list.pageSize()"
        [sortBy]="list.sortBy()"
        [sortDir]="list.sortDir()"
        emptyTitle="Nothing has been sent yet"
        emptyMessage="An announcement you write here, and the notices raised when a programme opens, both appear in this list."
        (pageChange)="list.page.set($event)"
        (pageSizeChange)="list.pageSize.set($event)"
        (sortChange)="list.setSort($event)"
      >
        <ng-template appCell="title" let-row>
          <div class="stack stack-xs">
            <strong>{{ $any(row).title }}</strong>
            <span class="cell-muted">{{ $any(row).body }}</span>
            @if ($any(row).subCategoryName || $any(row).state) {
              <span class="text-xs text-muted">
                @if ($any(row).subCategoryName) { {{ $any(row).subCategoryName }} }
                @if ($any(row).subCategoryName && $any(row).state) { · }
                @if ($any(row).state) { {{ $any(row).state }} }
              </span>
            }
          </div>
        </ng-template>

        <ng-template appCell="kind" let-row>
          @if ($any(row).kind === 'Custom') {
            <span class="chip chip--muted">Written</span>
          } @else {
            <span class="chip">{{ $any(row).kind }}</span>
          }
        </ng-template>

        <ng-template appCell="sentOn" let-row>
          @if ($any(row).sentOn) {
            {{ $any(row).sentOn | date: 'dd MMM yyyy, HH:mm' }}
          } @else {
            <span class="cell-muted">Not sent</span>
          }
        </ng-template>

        <!-- What the push service took, not what the screen hoped for. -->
        <ng-template appCell="reach" let-row>
          <div class="stack stack-xs text-right">
            <span>{{ $any(row).delivered }} of {{ $any(row).handsets }}</span>
            @if ($any(row).failed > 0) {
              <span class="text-xs text-danger" [title]="$any(row).note ?? ''">
                {{ $any(row).failed }} refused
              </span>
            }
          </div>
        </ng-template>

        <ng-template appCell="actions" let-row>
          <div class="btn-row btn-row--end">
            @if ($any(row).status !== 'Sent') {
              <button
                *appCan="'notifications.send'"
                type="button"
                class="btn btn--icon"
                title="Send now"
                (click)="sendNow($any(row))"
              >
                <app-icon name="send" [size]="15" />
              </button>
              <button
                *appCan="'notifications.send'"
                type="button"
                class="btn btn--icon is-danger"
                title="Remove"
                (click)="remove($any(row))"
              >
                <app-icon name="trash" [size]="15" />
              </button>
            }
          </div>
        </ng-template>
      </app-data-table>
    </section>

    @if (formOpen()) {
      <app-modal
        title="New notification"
        subtitle="It goes out the moment you send it, and appears in the app's notification list."
        size="md"
        (closed)="formOpen.set(false)"
      >
        <form [formGroup]="form" id="notification-form" class="stack stack-md" (ngSubmit)="save()">
          <div class="field">
            <label class="field-label" for="nfTitle">Title <span class="req">*</span></label>
            <input
              id="nfTitle"
              class="input"
              formControlName="title"
              maxlength="120"
              placeholder="Registration opens for the March batches"
            />
          </div>

          <div class="field">
            <label class="field-label" for="nfBody">Message <span class="req">*</span></label>
            <textarea
              id="nfBody"
              class="textarea"
              rows="4"
              maxlength="500"
              formControlName="body"
              placeholder="What you want them to know, in a line or two."
            ></textarea>
            <span class="field-hint">
              {{ 500 - (form.value.body?.length ?? 0) }} characters left. A notification is read on a
              lock screen, so the first few words carry it.
            </span>
          </div>

          <div class="form-grid">
            <div class="field">
              <label class="field-label" for="nfAudience">Send to <span class="req">*</span></label>
              <select id="nfAudience" class="select" formControlName="audience">
                @for (option of audiences; track option.value) {
                  <option [value]="option.value">{{ option.label }}</option>
                }
              </select>
            </div>

            <!-- A track narrows applicants and nobody else, so it is only
                 offered where it would mean something. -->
            @if (narrowsByTrack()) {
              <div class="field">
                <label class="field-label" for="nfTrack">Only one track</label>
                <select id="nfTrack" class="select" formControlName="subCategoryId">
                  <option [ngValue]="null">Every track</option>
                  @for (track of subCategories(); track track.id) {
                    <option [ngValue]="track.id">{{ track.name }}</option>
                  }
                </select>
              </div>
            }

            <div class="field">
              <label class="field-label" for="nfState">Only one State/UT</label>
              <select id="nfState" class="select" formControlName="stateCode">
                <option [ngValue]="null">Everywhere</option>
                @for (state of states(); track state.id) {
                  <option [ngValue]="state.id">{{ state.name }}</option>
                }
              </select>
            </div>

            <div class="field">
              <label class="field-label" for="nfLink">Opens</label>
              <select id="nfLink" class="select" formControlName="linkPath">
                <option value="">The notification list</option>
                <option value="/programs">Programmes</option>
                <option value="/apply">Apply</option>
                <option value="/profile-form">The profile form</option>
              </select>
              <span class="field-hint">Where tapping it takes them in the app.</span>
            </div>
          </div>
        </form>

        <div footer>
          <button type="button" class="btn btn--secondary" (click)="formOpen.set(false)">
            Cancel
          </button>
          <button
            type="submit"
            form="notification-form"
            class="btn btn--primary"
            [disabled]="saving()"
          >
            @if (saving()) { <span class="spinner"></span> }
            Send now
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class NotificationsComponent {
  private readonly service = inject(AppNotificationService);
  private readonly lookups = inject(LookupService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly columns = COLUMNS;
  protected readonly audiences = NOTIFICATION_AUDIENCES;
  protected term = searchTerm;

  protected readonly list = new ListState<AppNotification>(
    (request) => this.service.list(request),
    { sortBy: 'createdOn', sortDir: 'desc' },
  );

  protected readonly subCategories = toSignal(this.lookups.subCategories(null), {
    initialValue: [] as LookupItem[],
  });
  protected readonly states = toSignal(this.lookups.states(), {
    initialValue: [] as LookupItem[],
  });

  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    title: ['', Validators.required],
    body: ['', Validators.required],
    audience: ['Everyone' as NotificationAudience, Validators.required],
    subCategoryId: [null as number | null],
    stateCode: [null as number | null],
    linkPath: [''],
  });

  /**
   * Only an audience of applicants can be narrowed to one track.
   *
   * Driven off the control rather than off `form.value`: a reactive form
   * is not a signal, so a computed reading it is evaluated once and never
   * again, and the track picker sat there on an audience it means nothing
   * for.
   */
  private readonly audience = toSignal(this.form.controls.audience.valueChanges, {
    initialValue: this.form.controls.audience.value,
  });

  protected readonly narrowsByTrack = computed(() => {
    const audience = this.audience();
    return audience === 'Everyone' || audience === 'Applicants';
  });

  protected openForm(): void {
    this.form.reset({
      title: '',
      body: '',
      audience: 'Everyone',
      subCategoryId: null,
      stateCode: null,
      linkPath: '',
    });
    this.formOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();
    this.service
      .create({
        title: raw.title ?? '',
        body: raw.body ?? '',
        audience: (raw.audience ?? 'Everyone') as NotificationAudience,
        subCategoryId: this.narrowsByTrack() ? raw.subCategoryId : null,
        stateCode: raw.stateCode,
        linkPath: raw.linkPath || null,
        sendNow: true,
      })
      .subscribe({
        next: (sent) => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.toast.success(
            'Notification sent',
            `${sent.delivered} of ${sent.handsets} handsets took it.`,
          );
          this.list.reload();
        },
        error: () => this.saving.set(false),
      });
  }

  protected sendNow(row: AppNotification): void {
    this.service.send(row.id).subscribe(() => {
      this.toast.success('Notification sent', row.title);
      this.list.reload();
    });
  }

  protected async remove(row: AppNotification): Promise<void> {
    const sure = await this.confirm.ask({
      title: 'Remove this notification?',
      message: `"${row.title}" has not gone out. Removing it leaves no record of it.`,
      confirmLabel: 'Remove',
      tone: 'danger',
    });
    if (!sure) return;

    this.service.remove(row.id).subscribe(() => {
      this.toast.success('Removed', row.title);
      this.list.reload();
    });
  }
}
