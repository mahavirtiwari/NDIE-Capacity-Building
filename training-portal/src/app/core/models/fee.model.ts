import { AuditInfo, Id, RecordStatus } from './common.model';

export type FeeComponentKind = 'Base' | 'Exam' | 'Certification' | 'Material' | 'Other';
export const FEE_COMPONENT_KINDS: FeeComponentKind[] = [
  'Base',
  'Exam',
  'Certification',
  'Material',
  'Other',
];

export interface FeeComponent {
  id: Id;
  kind: FeeComponentKind;
  label: string;
  amount: number;
  isTaxable: boolean;
}

export interface FeeConcession {
  id: Id;
  label: string;
  percentage: number;
  remarks?: string;
}

/** TDS is deducted at source by the payer on the taxable value, excluding GST. */
export type TdsRate = 0 | 2 | 10;

export const TDS_RATES: { value: TdsRate; label: string; section: string }[] = [
  { value: 2, label: '2%', section: 'Section 194C — contractual payments' },
  { value: 10, label: '10%', section: 'Section 194J — professional / technical fees' },
];

/** TAN format issued by the Income Tax Department, e.g. DELA12345B. */
export const TAN_PATTERN = '^[A-Z]{4}[0-9]{5}[A-Z]$';

export interface FeeStructure extends AuditInfo {
  id: Id;
  programTypeId: Id;
  programTypeName?: string;
  /** Derived from the program type; returned by the API for edit forms. */
  categoryId?: Id | null;
  categoryName?: string;
  subCategoryId?: Id | null;
  subCategoryName?: string;
  title: string;
  currency: 'INR';
  gstPercent: number;
  /**
   * TDS rates the applicant may opt for. The applicant chooses one on the
   * profile form and supplies their own TAN there — the portal never
   * stores a TAN against the fee structure.
   */
  tdsOptions: TdsRate[];
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: RecordStatus;
  components: FeeComponent[];
  concessions: FeeConcession[];
}

export interface FeeTotals {
  taxable: number;
  nonTaxable: number;
  gst: number;
  gross: number;
  tds: number;
  /** Gross less TDS — what actually reaches the agency. */
  netPayable: number;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

export function computeFeeTotals(
  fee: Pick<FeeStructure, 'components' | 'gstPercent'> & { tdsPercent?: TdsRate | number | null },
): FeeTotals {
  const taxable = fee.components.filter((c) => c.isTaxable).reduce((s, c) => s + (c.amount || 0), 0);
  const nonTaxable = fee.components
    .filter((c) => !c.isTaxable)
    .reduce((s, c) => s + (c.amount || 0), 0);
  const gst = round2(taxable * (fee.gstPercent / 100));
  const gross = round2(taxable + nonTaxable + gst);
  /* TDS applies to the value of the service, not to the GST charged on it. */
  const tds = round2((taxable + nonTaxable) * ((Number(fee.tdsPercent) || 0) / 100));
  return { taxable, nonTaxable, gst, gross, tds, netPayable: round2(gross - tds) };
}
