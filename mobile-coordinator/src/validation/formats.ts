/**
 * The same format registry the portal and the API use. The API is what finally
 * decides; these rules exist so the applicant is told before they submit.
 */
export const FORMAT_PATTERNS = {
  email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/,
  mobile: /^[6-9][0-9]{9}$/,
  pan: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
  tan: /^[A-Z]{4}[0-9]{5}[A-Z]$/,
  gstin: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  aadhaar: /^[2-9][0-9]{11}$/,
  pincode: /^[1-9][0-9]{5}$/,
  ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
} as const;

export type FormatName = keyof typeof FORMAT_PATTERNS;

export const FORMAT_MESSAGES: Record<FormatName, string> = {
  email: 'Enter a valid email address.',
  mobile: 'Enter a 10 digit mobile number starting with 6-9.',
  pan: 'PAN must be 10 characters, e.g. ABCDE1234F.',
  tan: 'TAN must be 10 characters, e.g. DELA12345B.',
  gstin: 'GSTIN must be 15 characters, e.g. 27AABCU9603R1ZX.',
  aadhaar: 'Aadhaar must be 12 digits and cannot start with 0 or 1.',
  pincode: 'Pincode must be 6 digits and cannot start with 0.',
  ifsc: 'IFSC must be 11 characters, e.g. SBIN0001234.',
};

/** Field types the applicant types in upper case. */
export const UPPERCASE_TYPES: readonly string[] = ['pan', 'tan', 'gstin', 'ifsc'];

export const MAX_LENGTHS: Record<string, number> = {
  pan: 10,
  tan: 10,
  gstin: 15,
  ifsc: 11,
  aadhaar: 12,
  pincode: 6,
  mobile: 10,
};

/** Empty passes, so this composes with a separate required check. */
export function matchesFormat(name: FormatName, value: string | null | undefined): boolean {
  if (value === null || value === undefined || value.trim() === '') return true;
  return FORMAT_PATTERNS[name].test(value.trim());
}

export const isEmail = (value?: string | null) => matchesFormat('email', value);
export const isMobile = (value?: string | null) => matchesFormat('mobile', value);
export const isPan = (value?: string | null) => matchesFormat('pan', value?.toUpperCase());
export const isTan = (value?: string | null) => matchesFormat('tan', value?.toUpperCase());
export const isAadhaar = (value?: string | null) => matchesFormat('aadhaar', value);

/** Validates one dynamic form value against its field type. */
export function formatErrorFor(type: string, value: string): string | null {
  const name = type as FormatName;
  if (!(name in FORMAT_PATTERNS)) return null;

  const candidate = UPPERCASE_TYPES.includes(type) ? value.toUpperCase() : value;
  return matchesFormat(name, candidate) ? null : FORMAT_MESSAGES[name];
}
