/**
 * Design tokens mirroring the Angular portal, so the two clients look like one
 * system. Values are plain objects rather than a styling library, keeping the
 * dependency list short.
 */
export const colors = {
  brand900: '#4a1017',
  brand800: '#6b1a25',
  brand700: '#82232f',
  brand600: '#9b2c3c',
  brand500: '#b84152',
  brand100: '#f7dce0',
  brand50: '#fdf3f4',

  accent500: '#c9971a',

  /* A leaf green, kept clearly apart from the pine brand green. */
  success700: '#3d6b11',
  success500: '#639922',
  success50: '#f0f7e6',
  warning700: '#a16207',
  warning50: '#fefce8',
  /* Brighter and more orange than the crimson brand, so destructive actions
     never read as just another primary one. */
  danger700: '#b3300d',
  danger500: '#e2500f',
  danger50: '#fef1ea',
  info700: '#0e7490',
  info50: '#ecfeff',

  ink900: '#1c1a1a',
  ink800: '#2a2626',
  ink700: '#3f3a3a',
  ink600: '#57514f',
  ink500: '#7a716f',
  ink400: '#a39a97',
  ink300: '#ccc4c1',
  ink200: '#e6e0de',
  ink100: '#f4f0ef',
  ink50: '#faf8f7',
  white: '#ffffff',

  /* Muted text for use on the dark brand panels. */
  onBrandMuted: '#c49aa2',

  /* The pale blush the portal puts behind its navigation: brand100 at 55%
     over white. Light enough to carry ink text, tinted enough that a screen
     using it still reads as part of the same product. */
  blush: '#fbecee',

  page: '#f8f5f4',
  border: '#e6e0de',
  borderStrong: '#ccc4c1',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const font = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

/** Tone used by status chips, matching the portal's badge palette. */
export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export const toneColors: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: colors.ink100, fg: colors.ink600 },
  primary: { bg: colors.brand50, fg: colors.brand700 },
  success: { bg: colors.success50, fg: colors.success700 },
  warning: { bg: colors.warning50, fg: colors.warning700 },
  danger: { bg: colors.danger50, fg: colors.danger700 },
  info: { bg: colors.info50, fg: colors.info700 },
};

const STATUS_TONES: Record<string, Tone> = {
  Draft: 'neutral',
  Submitted: 'info',
  UnderScrutiny: 'warning',
  Clarification: 'warning',
  Approved: 'success',
  Rejected: 'danger',
  Enrolled: 'primary',
  Active: 'success',
  Inactive: 'neutral',
  Pending: 'warning',
  Verified: 'success',
  Paid: 'success',
  NotApplicable: 'neutral',
  Refunded: 'neutral',
  Failed: 'danger',
  Pass: 'success',
  Fail: 'danger',
  New: 'info',
  PermissionAccepted: 'primary',
  CalendarCreated: 'warning',
  Conducted: 'success',
  PermissionRejected: 'danger',
  QCRejected: 'danger',
  Postponed: 'neutral',
  Physical: 'primary',
  Virtual: 'info',
  Hybrid: 'warning',
};

const STATUS_LABELS: Record<string, string> = {
  UnderScrutiny: 'Under scrutiny',
  NotApplicable: 'Not applicable',
  New: 'New programme',
  PermissionAccepted: 'Permission accepted',
  CalendarCreated: 'Calendar created',
  PermissionRejected: 'Permission rejected',
  QCRejected: 'QC rejected',
};

export const toneFor = (status: string): Tone => STATUS_TONES[status] ?? 'neutral';
export const labelFor = (status: string): string => STATUS_LABELS[status] ?? status;
