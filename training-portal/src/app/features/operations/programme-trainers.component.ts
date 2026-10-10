import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MonitoringTrainer, ProgrammeMonitoring } from '../../core/models';

/**
 * The faculty who actually took this programme.
 *
 * Registered by the coordinator in the room, which is why it can differ
 * from whatever was planned — and why the credentials are here rather than
 * only on the trainer master: this is the record of who stood up on the
 * day and what they were when they did.
 */
@Component({
  selector: 'app-programme-trainers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (record(); as data) {
      @if (data.trainers.length === 0) {
        <div class="card__body">
          <span class="text-sm text-muted">No faculty has been registered against this program.</span>
        </div>
      } @else {
        <div class="table-wrap">
          <table class="table table--compact faculty">
            <thead>
              <tr>
                <th style="width: 56px" class="text-center">#</th>
                <th>Trainer</th>
                <th style="width: 130px">Engagement</th>
                <th style="width: 110px" class="text-center">Experience</th>
                <th style="width: 160px">Qualification</th>
                <th style="width: 210px">Contact</th>
                <th style="width: 130px">Aadhaar</th>
              </tr>
            </thead>
            <tbody>
              @for (trainer of data.trainers; track trainer.id; let i = $index) {
                <tr>
                  <td class="text-center cell-muted tabular">{{ i + 1 }}</td>
                  <td>
                    <div class="cell-primary">{{ trainer.fullName }}</div>
                    @if (trainer.designation || trainer.organisation) {
                      <div class="cell-muted text-xs">{{ who(trainer) }}</div>
                    }
                  </td>
                  <td>
                    @switch (trainer.engagement) {
                      @case ('FullTime') { <span class="chip">Full time</span> }
                      @case ('PartTime') { <span class="chip chip--muted">Part time</span> }
                      @default { <span class="cell-muted">—</span> }
                    }
                  </td>
                  <td class="text-center tabular">
                    {{ trainer.yearsExperience != null ? trainer.yearsExperience + ' yrs' : '—' }}
                  </td>
                  <td class="cell-muted">{{ trainer.qualification || '—' }}</td>
                  <td>
                    <div class="tabular">{{ trainer.mobile }}</div>
                    @if (trainer.email) {
                      <div class="cell-muted text-xs">{{ trainer.email }}</div>
                    }
                  </td>
                  <!-- The last four digits, which is all any screen is ever
                       sent. The whole number goes up when a trainer is
                       registered and is never returned. -->
                  <td class="cell-muted tabular">
                    {{ trainer.aadhaarLast4 ? '•••• •••• ' + trainer.aadhaarLast4 : '—' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else {
      <div class="card__body"><span class="text-sm text-muted">Loading the faculty…</span></div>
    }
  `,
  styles: [
    `
      .faculty { min-width: 920px; }
    `,
  ],
})
export class ProgrammeTrainersComponent {
  readonly record = input<ProgrammeMonitoring | null>(null);

  /** What they do and where, on one line, skipping whichever is missing. */
  protected who(trainer: MonitoringTrainer): string {
    return [trainer.designation, trainer.organisation].filter(Boolean).join(' · ');
  }
}
