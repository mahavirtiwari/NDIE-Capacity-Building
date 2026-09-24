import { AuditInfo, Id } from './common.model';

export type ApplicationStatus =
  | 'Draft'
  | 'Submitted'
  | 'UnderScrutiny'
  | 'Clarification'
  | 'Approved'
  | 'Rejected'
  | 'Enrolled';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Draft',
  'Submitted',
  'UnderScrutiny',
  'Clarification',
  'Approved',
  'Rejected',
  'Enrolled',
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  Draft: 'Draft',
  Submitted: 'Submitted',
  UnderScrutiny: 'Under scrutiny',
  Clarification: 'Clarification sought',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Enrolled: 'Enrolled',
};

export type PaymentStatus = 'NotApplicable' | 'Pending' | 'Paid' | 'Failed' | 'Refunded';

export interface ApplicationDocument {
  id: Id;
  fieldKey: string;
  label: string;
  fileName: string;
  fileSizeKb: number;
  uploadedOn: string;
  verified: boolean;
  remarks?: string;
}

export interface ScrutinyEvent {
  id: Id;
  action: 'Submitted' | 'Assigned' | 'Clarification' | 'Approved' | 'Rejected' | 'Enrolled' | 'Comment';
  byUserName: string;
  byRole: string;
  on: string;
  remarks?: string;
}

/** One applicant submission against one program type. */
export interface Application extends AuditInfo {
  id: Id;
  applicationNo: string;
  applicantId: Id;
  applicantName: string;
  applicantEmail: string;
  applicantMobile: string;
  pan: string;
  categoryId: Id;
  categoryName?: string;
  subCategoryId: Id;
  subCategoryName?: string;
  programTypeId: Id;
  programTypeName?: string;
  status: ApplicationStatus;
  submittedOn?: string | null;
  assignedToUserId?: Id | null;
  assignedToName?: string;
  paymentStatus: PaymentStatus;
  feeAmount: number;
  score?: number | null;
  state?: string;
  city?: string;
  /** Answers keyed by the dynamic registration field key. */
  responses: Record<string, string | string[] | number | boolean | null>;
  documents: ApplicationDocument[];
  history: ScrutinyEvent[];
}

export interface ScrutinyDecision {
  applicationId: Id;
  decision: 'Approve' | 'Reject' | 'Clarification';
  remarks: string;
  documentIdsVerified?: Id[];
}
