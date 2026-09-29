import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PagedRequest,
  PagedResult,
  QualifiedProfessional,
  SystemSettings,
  SystemSettingsUpdate,
} from '../models';
import { ApiService } from './api.service';

/** The register of everybody the scheme has qualified. Read only. */
@Injectable({ providedIn: 'root' })
export class QualifiedProfessionalService {
  private readonly api = inject(ApiService);

  list(request: PagedRequest): Observable<PagedResult<QualifiedProfessional>> {
    return this.api.get<PagedResult<QualifiedProfessional>>('qualified-professionals', request);
  }
}

/** Maintenance mode and the payment gateway's configuration. */
@Injectable({ providedIn: 'root' })
export class SystemSettingsService {
  private readonly api = inject(ApiService);

  get(): Observable<SystemSettings> {
    return this.api.get<SystemSettings>('system/settings');
  }

  gateways(): Observable<string[]> {
    return this.api.get<string[]>('system/settings/gateways');
  }

  update(body: SystemSettingsUpdate): Observable<SystemSettings> {
    return this.api.put<SystemSettings>('system/settings', body);
  }
}
