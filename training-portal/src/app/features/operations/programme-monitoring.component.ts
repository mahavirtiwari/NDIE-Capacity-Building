import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ProgrammeMonitoring } from '../../core/models';
import { IconComponent } from '../../shared/components/icon.component';
import { MonitoringPhotoComponent } from './monitoring-photo.component';

/**
 * What was taught, by whom, and the photograph taken while it was.
 *
 * The office's record says a batch of five days happened. This says what
 * went on in each of the sessions, with a time-stamped picture of the room
 * against each one — which is the part a manager is actually checking.
 */
@Component({
  selector: 'app-programme-monitoring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IconComponent, MonitoringPhotoComponent],
  template: `
    @if (record(); as data) {
      @if (data.sessions.length === 0 && data.attendanceSheets.length === 0) {
        <div class="card__body">
          <span class="text-sm text-muted">
            Nothing has been recorded against this program from the field yet.
          </span>
        </div>
      } @else {
        @if (data.sessions.length > 0) {
          <div class="table-wrap">
            <table class="table table--compact monitoring-table">
              <thead>
                <tr>
                  <th style="width: 60px" class="text-center">#</th>
                  <th style="width: 125px">Date</th>
                  <th>Session</th>
                  <th>Topic</th>
                  <th style="width: 170px">Trainer</th>
                  <th>Comments</th>
                  <th style="width: 190px">Photograph</th>
                </tr>
              </thead>
              <tbody>
                @for (session of ordered(); track session.id; let i = $index) {
                  <tr>
                    <td class="text-center cell-muted tabular">{{ i + 1 }}</td>
                    <td class="tabular">{{ session.conductedOn | date: 'dd MMM yyyy' }}</td>
                    <td class="cell-primary">{{ session.topicName || '—' }}</td>
                    <td>{{ session.subTopicName || '—' }}</td>
                    <td class="cell-muted">{{ session.trainerName || '—' }}</td>
                    <td class="cell-muted wrap-text">{{ session.comments || '—' }}</td>
                    <td>
                      @if (session.photo; as shot) {
                        <app-monitoring-photo
                          [programmeId]="programmeId()"
                          [photo]="shot"
                          [caption]="session.subTopicName || session.topicName || 'Session'"
                        />
                      } @else {
                        <span class="text-xs text-muted">None</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (data.attendanceSheets.length > 0) {
          <div class="card__body stack stack-sm">
            <div class="row row-sm">
              <app-icon name="clipboard" [size]="15" />
              <strong class="text-sm">
                Signed attendance sheets ({{ data.attendanceSheets.length }})
              </strong>
            </div>
            <div class="gallery">
              @for (sheet of data.attendanceSheets; track sheet.id; let i = $index) {
                <app-monitoring-photo
                  [programmeId]="programmeId()"
                  [photo]="sheet"
                  [caption]="'Sheet ' + (i + 1)"
                />
              }
            </div>
          </div>
        }
      }
    } @else {
      <div class="card__body"><span class="text-sm text-muted">Loading the field record…</span></div>
    }
  `,
  styles: [
    `
      /* The photograph column needs a usable width before anything else
         gets any, and seven columns do not fit a narrow window. */
      .monitoring-table { min-width: 1020px; }
      .gallery {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
        gap: 1rem;
      }
    `,
  ],
})
export class ProgrammeMonitoringComponent {
  readonly programmeId = input.required<number>();
  readonly record = input<ProgrammeMonitoring | null>(null);

  /** As they happened, which is not the order they were entered in. */
  protected readonly ordered = computed(() =>
    [...(this.record()?.sessions ?? [])].sort(
      (a, b) => new Date(a.conductedOn).getTime() - new Date(b.conductedOn).getTime(),
    ),
  );
}
