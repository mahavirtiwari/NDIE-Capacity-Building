import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { OnSpotParticipant, ProgrammeMonitoring } from '../../core/models';

/** One person's mark on one day, as the grid reads it. */
type Mark = 'present' | 'absent' | 'untaken';

@Component({
  selector: 'app-programme-attendance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    @if (record(); as data) {
      @if (data.participants.length === 0) {
        <div class="card__body">
          <span class="text-sm text-muted">Nobody has been registered in the room yet.</span>
        </div>
      } @else {
        <div class="card__body card__body--tight">
          <div class="row row-sm row-wrap text-xs text-muted">
            <span class="key"><span class="pip pip--p">P</span> present</span>
            <span class="key"><span class="pip pip--a">A</span> absent</span>
            <!-- A day nobody took is not a day everybody missed, and a grid
                 that showed the two the same would be evidence of absence
                 that nobody recorded. -->
            <span class="key"><span class="pip">—</span> register not taken</span>
          </div>
        </div>

        <div class="table-wrap">
          <table class="table table--compact register">
            <thead>
              <tr>
                <th style="width: 56px" class="text-center">#</th>
                <th style="min-width: 190px">Participant</th>
                @for (day of days(); track day) {
                  <th class="text-center day">
                    <span class="day__dom tabular">{{ day | date: 'dd' }}</span>
                    <span class="day__mon">{{ day | date: 'MMM' }}</span>
                  </th>
                }
                <th style="width: 90px" class="text-center">Days</th>
              </tr>
            </thead>
            <tbody>
              @for (person of data.participants; track person.id; let i = $index) {
                <tr>
                  <td class="text-center cell-muted tabular">{{ i + 1 }}</td>
                  <td>
                    <div class="cell-primary">{{ person.fullName }}</div>
                    <div class="cell-muted text-xs">{{ person.enterpriseName }}</div>
                  </td>
                  @for (day of days(); track day) {
                    <td class="text-center">
                      @switch (markOn(person, day)) {
                        @case ('present') { <span class="pip pip--p">P</span> }
                        @case ('absent') { <span class="pip pip--a">A</span> }
                        @default { <span class="pip">—</span> }
                      }
                    </td>
                  }
                  <td class="text-center tabular">
                    <strong>{{ presentDays(person) }}</strong>
                    <span class="text-xs text-muted"> / {{ days().length }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    } @else {
      <div class="card__body"><span class="text-sm text-muted">Loading the register…</span></div>
    }
  `,
  styles: [
    `
      /* A column per day plus a name that has to stay readable: on a
         fortnight's programme this is wider than any window, so it scrolls
         rather than squeezing the names to nothing. */
      .register { min-width: 640px; }
      .day { padding-left: 0.3rem; padding-right: 0.3rem; }
      .day__dom { display: block; font-size: var(--fs-sm); }
      .day__mon { display: block; font-size: var(--fs-xs); color: var(--ink-500); font-weight: 400; }

      .pip {
        display: inline-grid;
        place-items: center;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        font-size: var(--fs-xs);
        font-weight: 700;
        color: var(--ink-400);
      }
      .pip--p { background: var(--success-50); color: var(--success-700); }
      .pip--a { background: var(--danger-50); color: var(--danger-700); }
      .key { display: inline-flex; align-items: center; gap: 0.3rem; }
    `,
  ],
})
export class ProgrammeAttendanceComponent {
  readonly record = input<ProgrammeMonitoring | null>(null);

  /**
   * Every day the programme ran, start to end.
   *
   * Taken from the dates rather than from the marks: a day nobody marked
   * still has to appear, or a register with the middle Wednesday missing
   * looks complete when it is the thing that is wrong.
   */
  protected readonly days = computed<string[]>(() => {
    const data = this.record();
    if (!data) return [];

    const from = new Date(data.startDate);
    const to = new Date(data.endDate);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || to < from) return [];

    const out: string[] = [];
    for (let d = new Date(from); d <= to && out.length < 120; d.setDate(d.getDate() + 1)) {
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  });

  protected markOn(person: OnSpotParticipant, day: string): Mark {
    const held = person.days?.find((entry) => entry.day.slice(0, 10) === day);
    if (!held) return 'untaken';
    return held.isPresent ? 'present' : 'absent';
  }

  protected presentDays(person: OnSpotParticipant): number {
    return (person.days ?? []).filter((entry) => entry.isPresent).length;
  }
}
