import { ProgrammeReport, ReportParticipant } from '../../core/models';

/**
 * Builds the programme report as one standalone HTML document.
 *
 * One builder, three uses: it is what the screen shows in an iframe, what the
 * browser prints to PDF, and what the Download HTML button saves. Rendering
 * the report twice — once as an Angular template to look at and once as a
 * string to print — is how the printed copy quietly stops matching the one on
 * screen, so there is only the string.
 *
 * Nothing about this is stored. The server returns the figures, this turns
 * them into a page, and the file that results belongs to whoever asked for it.
 */
export function buildProgrammeReport(report: ProgrammeReport, logo?: string | null): string {
  const p = report.programme;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(p.programmeCode)} — programme report</title>
<style>${STYLES}</style>
</head>
<body>
<article class="sheet">
  ${cover(report, logo)}

  <header class="masthead">
    <div>
      <p class="org">${esc(report.organisationName)}</p>
      <h1>Program report</h1>
      <p class="code">${esc(p.programmeCode)} · ${esc(p.programmeName)}</p>
    </div>
    <dl class="issued">
      <dt>Generated</dt><dd>${dateTime(report.generatedOn)}</dd>
      <dt>By</dt><dd>${esc(report.generatedBy) || '—'}</dd>
    </dl>
  </header>

  ${summary(report)}
  ${programmeSection(report)}
  ${venueSection(report)}
  ${trainersSection(report)}
  ${participantsSection(report)}
  ${attendanceSection(report)}
  ${monitoringSection(report)}

  <footer class="foot">
    <p>
      Assembled from the record on ${dateTime(report.generatedOn)}. Figures change as marks
      are entered and certificates issued, so this page states the position on that date and
      is not a substitute for the live record.
    </p>
  </footer>
</article>
</body>
</html>`;
}

/* ------------------------------------------------------------- sections */

/**
 * The first page, and on its own.
 *
 * A report that is printed, signed and filed needs a face: who issued it,
 * what it is about, and the figures somebody will want before they read the
 * detail. Everything after it starts on page two.
 *
 * The logo is inlined as a data URI rather than linked. A downloaded report
 * is opened from somebody's desktop, often with no way back to the portal,
 * and a linked image would be a broken box on an official document.
 */
function cover(report: ProgrammeReport, logo?: string | null): string {
  const p = report.programme;
  const t = report.totals;

  return `<section class="cover">
    <div class="cover__top">
      ${logo ? `<img class="cover__logo" src="${esc(logo)}" alt="">` : ''}
      <p class="cover__org">${esc(report.organisationName)}</p>
    </div>

    <div class="cover__middle">
      <p class="cover__kicker">Program report</p>
      <h1 class="cover__code">${esc(p.programmeCode)}</h1>
      <p class="cover__name">${esc(p.programmeName)}</p>
      <p class="cover__type">${esc(p.programTypeName)}</p>
    </div>

    <dl class="cover__facts">
      <dt>Implementing agency</dt><dd>${esc(p.agencyName) || '\u2014'}</dd>
      <dt>Category</dt><dd>${esc(p.categoryName) || '\u2014'} \u00b7 ${esc(p.subCategoryName) || '\u2014'}</dd>
      <dt>Conducted</dt><dd>${date(p.startDate)} \u2013 ${date(p.endDate)}</dd>
      <dt>Mode and venue</dt><dd>${esc(p.mode)} \u00b7 ${esc(p.venue) || '\u2014'}</dd>
      <dt>Location</dt><dd>${[esc(p.districtName), esc(p.stateName)].filter(Boolean).join(', ') || '\u2014'}</dd>
      <dt>Coordinator</dt><dd>${esc(report.coordinatorName) || '\u2014'}</dd>
    </dl>

    <div class="cover__figures">
      <div><span>${t.enrolled}</span>Enrolled</div>
      <div><span>${t.passed}</span>Passed</div>
      <div><span>${t.certified}</span>Certified</div>
      <div><span>${t.averageAttendance}%</span>Attendance</div>
    </div>

    <p class="cover__issued">
      Generated ${dateTime(report.generatedOn)}${report.generatedBy ? ` by ${esc(report.generatedBy)}` : ''}
    </p>
  </section>`;
}

function summary(report: ProgrammeReport): string {
  const t = report.totals;
  const cards: [string, string][] = [
    ['Enrolled', String(t.enrolled)],
    ['Passed', String(t.passed)],
    ['Failed', String(t.failed)],
    ['Awaiting result', String(t.pending)],
    ['Certified', String(t.certified)],
    ['Average attendance', `${t.averageAttendance}%`],
    ['Sessions held', String(t.sessionsHeld)],
    ['Average feedback', t.averageFeedback === null || t.averageFeedback === undefined
      ? 'Not rated'
      : `${t.averageFeedback} / 5`],
  ];

  return `<section class="cards">
    ${cards.map(([label, value]) => `
      <div class="card"><span class="card__value">${esc(value)}</span>
      <span class="card__label">${esc(label)}</span></div>`).join('')}
  </section>`;
}

function programmeSection(report: ProgrammeReport): string {
  const p = report.programme;
  return block('Program', pairs([
    ['Program ID', p.programmeCode],
    ['Name', p.programmeName],
    ['Category', p.categoryName],
    ['Sub-category', p.subCategoryName],
    ['Program type', p.programTypeName],
    ['Implementing agency', p.agencyName],
    ['Mode', p.mode],
    ['From – to', `${date(p.startDate)} – ${date(p.endDate)}`],
    ['State/UT', p.stateName],
    ['District', p.districtName],
    ['Status', p.status],
    ['Coordinator', report.coordinatorName],
    ['Coordinator email', report.coordinatorEmail],
    ['Coordinator mobile', report.coordinatorMobile],
  ]));
}

function venueSection(report: ProgrammeReport): string {
  const v = report.venue;
  if (!v) {
    return block('Venue', `<p class="none">The coordinator has not recorded the venue.</p>`);
  }

  const fix = v.latitude !== null && v.latitude !== undefined
      && v.longitude !== null && v.longitude !== undefined
    ? `${v.latitude}, ${v.longitude}`
    : null;

  return block('Venue', pairs([
    ['Name', v.name],
    ['Address', v.address],
    ['Landmark', v.landmark],
    ['Geo-tag', fix],
    ['Tagged on', v.geoTaggedOn ? dateTime(v.geoTaggedOn) : null],
  ]));
}

function trainersSection(report: ProgrammeReport): string {
  if (report.trainers.length === 0) {
    return block('Trainers', `<p class="none">No trainer was registered for this program.</p>`);
  }

  return block('Trainers', table(
    ['#', 'Name', 'Designation', 'Organisation', 'Mobile', 'Email'],
    report.trainers.map((t, i) => [
      String(i + 1), t.fullName, t.designation, t.organisation, t.mobile, t.email,
    ]),
  ));
}

function participantsSection(report: ProgrammeReport): string {
  if (report.participants.length === 0) {
    return block('Participants', `<p class="none">Nobody is enrolled on this program.</p>`);
  }

  return block(`Participants (${report.participants.length})`, table(
    ['#', 'Applicant ID', 'Name', 'Gender', 'Mobile', 'Attendance',
     'Written', 'Viva', 'Total', 'Result', 'Certificate'],
    report.participants.map((r: ReportParticipant) => [
      String(r.serialNo), r.applicantCode, r.fullName, r.gender, r.mobile,
      `${r.attendancePercent}%`,
      mark(r.writtenMarks), mark(r.vivaMarks), mark(r.examScore),
      r.result, r.certificateNumber,
    ]),
  ));
}

function attendanceSection(report: ProgrammeReport): string {
  if (report.sessions.length === 0) {
    return block('Attendance', `<p class="none">No session has been held yet.</p>`);
  }

  return block('Attendance by session', table(
    ['#', 'Date', 'Session', 'Title', 'From', 'To', 'Faculty', 'Present', 'Marked'],
    report.sessions.map((s) => [
      String(s.serialNo), date(s.sessionDate), s.sessionCode, s.title,
      s.startTime, s.endTime, s.facultyName,
      String(s.presentCount), String(s.markedCount),
    ]),
  ));
}

function monitoringSection(report: ProgrammeReport): string {
  if (report.monitoring.length === 0) {
    return block('Monitoring', `<p class="none">No monitoring session was recorded.</p>`);
  }

  return block('Monitoring', table(
    ['#', 'Conducted on', 'Trainer', 'Topic', 'Sub-topic', 'Photos', 'Comments'],
    report.monitoring.map((m) => [
      String(m.serialNo), dateTime(m.conductedOn), m.trainerName,
      m.topic, m.subTopic, String(m.photoCount), m.comments,
    ]),
  ));
}

/* -------------------------------------------------------------- plumbing */

function block(heading: string, body: string): string {
  return `<section class="block">
    <h2>${esc(heading)}</h2>
    ${body}
  </section>`;
}

function pairs(rows: [string, string | null | undefined][]): string {
  return `<dl class="pairs">${rows
    .map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value) || '—'}</dd>`)
    .join('')}</dl>`;
}

function table(headings: string[], rows: (string | null | undefined)[][]): string {
  return `<table>
    <thead><tr>${headings.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map((row) => `<tr>${row.map((cell) => `<td>${esc(cell) || '—'}</td>`).join('')}</tr>`)
      .join('')}</tbody>
  </table>`;
}

/** Unmarked is not zero: a blank says the mark has not been given. */
function mark(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : String(value);
}

function date(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dateTime(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
}

/**
 * Everything written into the document goes through here.
 *
 * The values are somebody's name, a venue address, a coordinator's remark —
 * all typed by people, all capable of containing a bracket. Escaped so the
 * page cannot be broken by one, and so nothing typed into the system can
 * carry markup into the printed copy.
 */
function esc(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Self-contained, because the document is printed and saved on its own. A
 * stylesheet fetched from the portal would leave a downloaded copy unstyled
 * the moment it is opened somewhere without a network.
 */
const STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f3f1f0;
    color: #1f1b1a;
    font: 13px/1.5 "Segoe UI", system-ui, -apple-system, sans-serif;
  }
  .sheet {
    max-width: 1000px;
    margin: 16px auto;
    padding: 28px 32px 20px;
    background: #fff;
  }

  .cover {
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-height: 240mm;
    padding-bottom: 20px;
    border-bottom: 3px double #9b2c3c;
  }
  .cover__top { display: flex; align-items: center; gap: 14px; }
  .cover__logo { height: 56px; width: auto; }
  .cover__org {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: .04em;
    text-transform: uppercase;
    color: #9b2c3c;
  }
  .cover__middle { margin-top: auto; }
  .cover__kicker {
    margin: 0 0 6px;
    font-size: 13px;
    letter-spacing: .22em;
    text-transform: uppercase;
    color: #7a716e;
  }
  .cover__code { margin: 0; font-size: 34px; letter-spacing: .01em; }
  .cover__name { margin: 6px 0 0; font-size: 19px; font-weight: 600; }
  .cover__type { margin: 2px 0 0; font-size: 14px; color: #5b5350; }

  .cover__facts {
    margin: 0;
    display: grid;
    grid-template-columns: 190px 1fr;
    gap: 6px 14px;
    padding: 16px 0;
    border-top: 1px solid #e6e0de;
    border-bottom: 1px solid #e6e0de;
  }
  .cover__facts dt { color: #7a716e; }
  .cover__facts dd { margin: 0; font-weight: 600; }

  .cover__figures { display: flex; gap: 10px; }
  .cover__figures div {
    flex: 1;
    padding: 12px 14px;
    border: 1px solid #e6e0de;
    border-radius: 6px;
    background: #faf8f7;
    font-size: 11px;
    color: #7a716e;
  }
  .cover__figures span { display: block; font-size: 24px; font-weight: 700; color: #1f1b1a; }
  .cover__issued { margin: auto 0 0; font-size: 11px; color: #7a716e; }

  .masthead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
    padding-bottom: 14px;
    border-bottom: 2px solid #9b2c3c;
  }
  .org { margin: 0; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: #9b2c3c; font-weight: 700; }
  h1 { margin: 4px 0 2px; font-size: 21px; }
  .code { margin: 0; color: #5b5350; }
  .issued { margin: 0; display: grid; grid-template-columns: auto auto; gap: 2px 10px; font-size: 12px; text-align: right; }
  .issued dt { color: #7a716e; }
  .issued dd { margin: 0; font-weight: 600; }

  .cards { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 4px; }
  .card {
    flex: 1 1 110px;
    padding: 8px 10px;
    border: 1px solid #e6e0de;
    border-radius: 6px;
    background: #faf8f7;
  }
  .card__value { display: block; font-size: 18px; font-weight: 700; }
  .card__label { display: block; font-size: 11px; color: #7a716e; }

  .block { margin-top: 18px; break-inside: auto; }
  h2 {
    margin: 0 0 8px;
    font-size: 14px;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: #9b2c3c;
    border-bottom: 1px solid #e6e0de;
    padding-bottom: 4px;
  }

  .pairs { margin: 0; display: grid; grid-template-columns: 170px 1fr 170px 1fr; gap: 4px 12px; }
  .pairs dt { color: #7a716e; }
  .pairs dd { margin: 0; font-weight: 600; }

  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e6e0de; padding: 5px 7px; text-align: left; vertical-align: top; }
  th { background: #faf8f7; font-weight: 700; }
  tbody tr:nth-child(even) td { background: #fcfbfa; }

  .none { margin: 0; color: #7a716e; font-style: italic; }
  .foot { margin-top: 22px; padding-top: 10px; border-top: 1px solid #e6e0de; font-size: 11px; color: #7a716e; }

  @media print {
    body { background: #fff; }
    .sheet { margin: 0; max-width: none; padding: 0; }
    /* The cover has the first page to itself; the report proper starts on
       the second, the way a filed document is expected to read. */
    .cover { break-after: page; border-bottom: 0; min-height: 0; height: 245mm; }
    /* A table split across a page must repeat its headings, or the second
       page is a grid of numbers with nothing saying what they are. */
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    .block { break-inside: auto; }
    h2 { break-after: avoid; }
  }
  @page { size: A4 landscape; margin: 12mm; }
`;
