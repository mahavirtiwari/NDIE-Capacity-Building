/**
 * Workbook export, built in the browser.
 *
 * The same rule as the printed reports: nothing is generated on the server and
 * nothing is stored. The rows are already on their way to the screen, so the
 * file is assembled from them here and handed to the browser's own download.
 *
 * The library is imported where it is used rather than at the top, so the
 * three hundred kilobytes it weighs are fetched the first time somebody
 * exports something and never by somebody who does not.
 */

/** One column of an export. `value` is for a column the row does not hold plainly. */
export interface ExportColumn {
  key: string;
  header: string;
  value?: (row: Record<string, unknown>) => unknown;
}

/** One sheet of a workbook. */
export interface ExportSheet {
  /** Excel refuses a sheet name over 31 characters or containing : \\ / ? * [ ] */
  name: string;
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
}

/**
 * Writes one or more sheets to an .xlsx file and downloads it.
 *
 * A real workbook rather than a CSV renamed: a CSV loses the column widths,
 * turns an applicant ID into a number, and asks the reader which delimiter it
 * used. These are read in Excel by people who did not make them.
 */
export async function downloadWorkbook(
  fileName: string,
  sheets: ExportSheet[],
): Promise<void> {
  const XLSX = await import('xlsx');
  const book = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const header = sheet.columns.map((column) => column.header);
    const body = sheet.rows.map((row) =>
      sheet.columns.map((column) => cell(row, column)),
    );

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...body]);

    /* Widths from the content, so nothing arrives as ####. Capped, because one
       long remark should not push every other column off the screen. */
    worksheet['!cols'] = sheet.columns.map((column, index) => ({
      wch: Math.min(
        48,
        Math.max(
          column.header.length + 2,
          ...body.map((row) => String(row[index] ?? '').length + 2),
        ),
      ),
    }));

    XLSX.utils.book_append_sheet(book, worksheet, safeName(sheet.name));
  }

  XLSX.writeFile(book, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

/**
 * What goes in the cell.
 *
 * Dates and numbers are left as they are so Excel treats them as dates and
 * numbers. Everything else becomes text, because a value Excel guesses at is
 * a value somebody has to correct: an applicant ID beginning with a zero
 * loses it, and a code like 1-2 becomes a date in January.
 */
function cell(row: Record<string, unknown>, column: ExportColumn): unknown {
  const raw = column.value ? column.value(row) : row[column.key];

  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number' || typeof raw === 'boolean') return raw;
  if (raw instanceof Date) return raw;
  if (typeof raw === 'object') return JSON.stringify(raw);
  return String(raw);
}

/** Excel's own rules for what a sheet may be called. */
function safeName(name: string): string {
  const cleaned = name.replace(/[:\\/?*[\]]/g, ' ').trim();
  return (cleaned || 'Sheet').slice(0, 31);
}

/** A file name that carries what it is and when it was taken. */
export function stampedName(prefix: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;
}
