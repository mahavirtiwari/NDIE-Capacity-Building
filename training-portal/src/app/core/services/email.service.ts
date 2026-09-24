import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  EmailLogEntry,
  EmailPreview,
  EmailSettings,
  EmailSettingsUpdate,
  EmailTemplate,
  EmailTemplateUpdate,
} from '../models';
import { ApiService } from './api.service';

/** Sender configuration and transactional template editing. */
@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly api = inject(ApiService);

  settings(): Observable<EmailSettings> {
    return this.api.get<EmailSettings>('email/settings');
  }

  saveSettings(update: EmailSettingsUpdate): Observable<EmailSettings> {
    return this.api.put<EmailSettings>('email/settings', update);
  }

  sendTest(to: string): Observable<boolean> {
    return this.api.post<boolean>('email/settings/test', { to });
  }

  /** Recent delivery attempts, newest first. */
  log(take = 25): Observable<EmailLogEntry[]> {
    return this.api.get<EmailLogEntry[]>('email/log', { take });
  }

  templates(): Observable<EmailTemplate[]> {
    return this.api.get<EmailTemplate[]>('email/templates');
  }

  saveTemplate(key: string, update: EmailTemplateUpdate): Observable<EmailTemplate> {
    return this.api.put<EmailTemplate>(`email/templates/${key}`, update);
  }

  resetTemplate(key: string): Observable<EmailTemplate> {
    return this.api.post<EmailTemplate>(`email/templates/${key}/reset`, {});
  }

  /** Renders a draft with sample values without sending anything. */
  preview(key: string, draft: EmailTemplateUpdate): Observable<EmailPreview> {
    return this.api.post<EmailPreview>(`email/templates/${key}/preview`, draft);
  }
}
