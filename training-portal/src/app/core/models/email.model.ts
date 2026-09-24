/**
 * Outgoing mail configuration, maintained by Super Admin under
 * Administration → Email.
 */
export interface EmailSettings {
  enabled: boolean;
  host?: string | null;
  port: number;
  useSsl: boolean;
  userName?: string | null;
  /** True when a password is stored. The value itself is never sent back. */
  hasPassword: boolean;
  fromAddress?: string | null;
  fromName?: string | null;
  replyTo?: string | null;
  redirectAllTo?: string | null;
  timeoutSeconds: number;
  otpValidityMinutes: number;
  /** True when appsettings, not the portal, is supplying the host. */
  usingConfigFallback: boolean;
  updatedOn: string;
}

export interface EmailSettingsUpdate {
  enabled: boolean;
  host?: string | null;
  port: number;
  useSsl: boolean;
  userName?: string | null;
  /** Omit to keep the stored password; send `''` to clear it. */
  password?: string | null;
  fromAddress?: string | null;
  fromName?: string | null;
  replyTo?: string | null;
  redirectAllTo?: string | null;
  timeoutSeconds: number;
  otpValidityMinutes: number;
}

export interface EmailTemplate {
  id: number;
  key: string;
  name: string;
  description: string;
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  /** Token names this template understands, e.g. `name`, `userCode`. */
  placeholders: string[];
  isEnabled: boolean;
  /** Credential and one-time-code messages cannot be switched off. */
  canDisable: boolean;
  updatedOn: string;
}

export interface EmailTemplateUpdate {
  subject: string;
  htmlBody: string;
  plainTextBody: string;
  isEnabled: boolean;
}

export interface EmailPreview {
  subject: string;
  html: string;
  plainText: string;
}

/** One delivery attempt, as recorded by the server. */
export interface EmailLogEntry {
  id: number;
  sentOn: string;
  templateKey: string;
  recipient: string;
  subject: string;
  /** `Sent`, `Failed` or `Suppressed`. */
  status: string;
  /** What the mail server said when it refused. */
  error?: string | null;
  host?: string | null;
}
