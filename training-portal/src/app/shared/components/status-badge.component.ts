import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

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
  NotApplicable: 'neutral',
  Verified: 'success',
  Pass: 'success',
  Fail: 'danger',
  Physical: 'primary',
  Virtual: 'info',
  Hybrid: 'warning',
};

const LABELS: Record<string, string> = {
  UnderScrutiny: 'Under scrutiny',
  NotApplicable: 'Not applicable',
  New: 'New programme',
  PermissionAccepted: 'Permission accepted',
  CalendarCreated: 'Calendar created',
  PermissionRejected: 'Permission rejected',
  QCRejected: 'QC rejected',
};

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="badge" [class]="'badge badge--' + tone()">
      <span class="badge-dot"></span>{{ label() }}
    </span>
  `,
})
export class StatusBadgeComponent {
  readonly value = input.required<string>();
  readonly overrideTone = input<Tone>();

  protected readonly tone = computed<Tone>(
    () => this.overrideTone() ?? TONE_BY_VALUE[this.value()] ?? 'neutral',
  );
  protected readonly label = computed(() => LABELS[this.value()] ?? this.value());
}
