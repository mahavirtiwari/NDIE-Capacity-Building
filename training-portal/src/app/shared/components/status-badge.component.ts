import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { PROGRAM_STATUS_LABELS } from '../../core/models/program.model';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

const TONE_BY_VALUE: Record<string, Tone> = {
  Active: 'success',
  Inactive: 'neutral',
  Draft: 'neutral',
  Submitted: 'info',
  UnderScrutiny: 'warning',
  Clarification: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  /* An applicant's standing, read from their applications. */
  Registered: 'neutral',
  ApplicationReceived: 'info',
  Enrolled: 'primary',
  New: 'info',
  PermissionAccepted: 'primary',
  CalendarCreated: 'warning',
  Conducted: 'success',
  PermissionRejected: 'danger',
  QCRejected: 'danger',
  Postponed: 'neutral',
  Paid: 'success',
  Pending: 'warning',
  Failed: 'danger',
  Refunded: 'neutral',
  /* The two the payment enum really has beside Paid and Failed. Without
     them an attempt somebody abandoned at the gateway read as neutral
     grey, the same as "not applicable". */
  Cancelled: 'warning',
  Abandoned: 'neutral',
  Initiated: 'info',
  Processing: 'info',
  NotApplicable: 'neutral',
  Verified: 'success',
  Pass: 'success',
  Fail: 'danger',
  Physical: 'primary',
  Virtual: 'info',
  Hybrid: 'warning',
};

/*
 * What each state is called.
 *
 * The programme states come from the model that defines them rather
 * than being written out a second time here. They were duplicated, and
 * the two copies disagreed the moment one was changed: the register was
 * relabelled "Program created by IA" and every badge on it went on
 * saying "New program", because the badge was reading this list.
 */
const LABELS: Record<string, string> = {
  UnderScrutiny: 'Under scrutiny',
  NotApplicable: 'Not applicable',
  ApplicationReceived: 'Application received',
  ...PROGRAM_STATUS_LABELS,
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="'badge badge--' + tone()">
      <span class="badge-dot"></span>{{ label() }}
    </span>
  `,
  styles: [
    `
      /* Without this the host is display: inline, and an inline box does
         not grow to hold the badge inside it - the host measured 18px
         tall around a 24px badge, so the badge hung six pixels below its
         own element. That is what set the alignment off in every table
         cell and detail row the badge appears in, on every screen.

         vertical-align: middle because it almost always sits beside text
         or in a cell, and the baseline of a flex box is not where the
         reader expects it. */
      :host {
        display: inline-flex;
        vertical-align: middle;
      }
    `,
  ],
})
export class StatusBadgeComponent {
  readonly value = input.required<string>();
  readonly overrideTone = input<Tone>();

  protected readonly tone = computed<Tone>(
    () => this.overrideTone() ?? TONE_BY_VALUE[this.value()] ?? 'neutral',
  );
  protected readonly label = computed(() => LABELS[this.value()] ?? this.value());
}
