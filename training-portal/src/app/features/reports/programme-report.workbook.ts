import { ProgrammeReport } from '../../core/models';
import { ExportColumn, ExportSheet } from '../../shared/excel';

/**
 * The programme report as workbook sheets — one per section of the printed
 * document, so what is on the page and what is in the spreadsheet are the same
 * report in two forms.
 *
 * Exported as sheets rather than as a file, so the same function serves the
 * single-programme download and the combined export across many programmes.
 */
export function programmeReportSheets(
  report: ProgrammeReport,
  options: { prefix?: string; sections?: ReportSection[] } = {},
): ExportSheet[] {
  const wanted = new Set(options.sections ?? ALL_SECTIONS);
  const name = (section: string) =>
    options.prefix ? `${options.prefix} ${section}` : section;

  const sheets: ExportSheet[] = [];

  if (wanted.has('summary')) {
    sheets.push({ name: name('Summary'), columns: PAIR_COLUMNS, rows: summaryRows(report) });
  }
  if (wanted.has('participants')) {
    sheets.push({ name: name('Participants'), columns: PARTICIPANTS, rows: rows(report.participants, report) });
  }
  if (wanted.has('attendance')) {
    sheets.push({ name: name('Attendance'), columns: SESSIONS, rows: rows(report.sessions, report) });
  }
  if (wanted.has('trainers')) {
    sheets.push({ name: name('Trainers'), columns: TRAINERS, rows: rows(report.trainers, report) });
  }
  if (wanted.has('monitoring')) {
    sheets.push({ name: name('Monitoring'), columns: MONITORING, rows: rows(report.monitoring, report) });
  }

  return sheets;
}

export type ReportSection = 'summary' | 'participants' | 'attendance' | 'trainers' | 'monitoring';

export const ALL_SECTIONS: ReportSection[] = [
  'summary', 'participants', 'attendance', 'trainers', 'monitoring',
];

export const SECTION_LABELS: Record<ReportSection, string> = {
  summary: 'Summary',
  participants: 'Participants',
  attendance: 'Attendance by session',
  trainers: 'Trainers',
  monitoring: 'Monitoring',
};

/**
 * Every sheet carries the programme it belongs to.
 *
 * Without it a combined export is a heap of names with no way to tell which
 * batch each came from — and sorting the sheet destroys even the ordering
 * that might have hinted at it.
 */
function rows<T extends object>(list: T[], report: ProgrammeReport): Record<string, unknown>[] {
  return list.map((row) => ({
    programmeCode: report.programme.programmeCode,
    programmeName: report.programme.programmeName,
    programTypeName: report.programme.programTypeName,
    ...row,
  }));
}

const OWNER: ExportColumn[] = [
  { key: 'programmeCode', header: 'Program ID' },
  { key: 'programmeName', header: 'Program' },
  { key: 'programTypeName', header: 'Program type' },
];

const PAIR_COLUMNS: ExportColumn[] = [
  { key: 'item', header: 'Item' },
  { key: 'value', header: 'Value' },
];

const PARTICIPANTS: ExportColumn[] = [
  ...OWNER,
  { key: 'serialNo', header: '#' },
  { key: 'applicantCode', header: 'Applicant ID' },
  { key: 'fullName', header: 'Name' },
  { key: 'gender', header: 'Gender' },
  { key: 'mobile', header: 'Mobile' },
  { key: 'email', header: 'Email' },
  { key: 'attendancePercent', header: 'Attendance %' },
  { key: 'writtenMarks', header: 'Written' },
  { key: 'vivaMarks', header: 'Viva' },
  { key: 'examScore', header: 'Total' },
  { key: 'result', header: 'Result' },
  { key: 'certificateNumber', header: 'Certificate' },
  { key: 'feedbackRating', header: 'Feedback' },
];

const SESSIONS: ExportColumn[] = [
  ...OWNER,
  { key: 'serialNo', header: '#' },
  { key: 'sessionDate', header: 'Date' },
  { key: 'sessionCode', header: 'Session' },
  { key: 'title', header: 'Title' },
  { key: 'startTime', header: 'From' },
  { key: 'endTime', header: 'To' },
  { key: 'facultyName', header: 'Faculty' },
  { key: 'presentCount', header: 'Present' },
  { key: 'markedCount', header: 'Marked' },
];

const TRAINERS: ExportColumn[] = [
  ...OWNER,
  { key: 'fullName', header: 'Name' },
  { key: 'designation', header: 'Designation' },
  { key: 'organisation', header: 'Organisation' },
  { key: 'mobile', header: 'Mobile' },
  { key: 'email', header: 'Email' },
];

const MONITORING: ExportColumn[] = [
  ...OWNER,
  { key: 'serialNo', header: '#' },
  { key: 'conductedOn', header: 'Conducted on' },
  { key: 'trainerName', header: 'Trainer' },
  { key: 'topic', header: 'Topic' },
  { key: 'subTopic', header: 'Sub-topic' },
  { key: 'photoCount', header: 'Photos' },
  { key: 'comments', header: 'Comments' },
];

function summaryRows(report: ProgrammeReport): Record<string, unknown>[] {
  const p = report.programme;
  const t = report.totals;

  return [
    ['Program ID', p.programmeCode],
    ['Program', p.programmeName],
    ['Program type', p.programTypeName],
    ['Category', p.categoryName],
    ['Sub-category', p.subCategoryName],
    ['Implementing agency', p.agencyName],
    ['Mode', p.mode],
    ['Venue', p.venue],
    ['State/UT', p.stateName],
    ['District', p.districtName],
    ['From', p.startDate],
    ['To', p.endDate],
    ['Status', p.status],
    ['Coordinator', report.coordinatorName],
    ['Enrolled', t.enrolled],
    ['Passed', t.passed],
    ['Failed', t.failed],
    ['Awaiting result', t.pending],
    ['Certified', t.certified],
    ['Average attendance %', t.averageAttendance],
    ['Average feedback', t.averageFeedback ?? 'Not rated'],
    ['Sessions held', t.sessionsHeld],
    ['Monitoring sessions', t.monitoringSessions],
    ['Generated on', report.generatedOn],
    ['Generated by', report.generatedBy],
  ].map(([item, value]) => ({ item, value }));
}
