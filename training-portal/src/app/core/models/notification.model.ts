import { AuditInfo, Id } from './common.model';

/** Who a notification is addressed to. */
export type NotificationAudience =
  | 'Everyone'
  | 'Applicants'
  | 'Coordinators'
  | 'ImplementingAgencies'
  | 'OperationManagers'
  | 'PortalUsers';

export type NotificationStatus = 'Draft' | 'Sent' | 'Failed';

export interface AppNotification extends AuditInfo {
  id: Id;
  title: string;
  body: string;
  audience: NotificationAudience;
  audienceLabel: string;
  subCategoryId?: Id | null;
  subCategoryName?: string | null;
  stateCode?: number | null;
  state?: string | null;
  /** Where tapping it lands inside the app. */
  linkPath?: string | null;
  /** Custom, or the name of the event that raised it. */
  kind: string;
  status: NotificationStatus;
  sentOn?: string | null;
  handsets: number;
  delivered: number;
  failed: number;
  note?: string | null;
}

export interface NotificationUpsert {
  title: string;
  body: string;
  audience: NotificationAudience;
  subCategoryId?: Id | null;
  stateCode?: number | null;
  linkPath?: string | null;
  sendNow: boolean;
}

export const NOTIFICATION_AUDIENCES: { value: NotificationAudience; label: string }[] = [
  { value: 'Everyone', label: 'Everyone with the app' },
  { value: 'Applicants', label: 'Applicants' },
  { value: 'Coordinators', label: 'Coordinators' },
  { value: 'ImplementingAgencies', label: 'Implementing agencies' },
  { value: 'OperationManagers', label: 'Operation managers' },
  { value: 'PortalUsers', label: 'Every portal account' },
];
