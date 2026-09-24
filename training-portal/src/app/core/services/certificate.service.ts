import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Certificate,
  CertificateKind,
  CertificateVerification,
  Id,
  ProgrammeCertificateSummary,
} from '../models';
import { ApiService } from './api.service';

/**
 * Awarding certificates and getting at the printable documents.
 *
 * The documents are HTML pages served by the API, opened in a tab rather than
 * fetched here — they are meant to be looked at and printed, and the browser
 * already does both.
 */
@Injectable({ providedIn: 'root' })
export class CertificateService {
  private readonly api = inject(ApiService);

  summary(programmeId: Id): Observable<ProgrammeCertificateSummary> {
    return this.api.get<ProgrammeCertificateSummary>(`certificates/programme/${programmeId}`);
  }

  issue(participantId: Id): Observable<Certificate> {
    return this.api.post<Certificate>(`certificates/participants/${participantId}`, {});
  }

  issueProgramme(programmeId: Id): Observable<ProgrammeCertificateSummary> {
    return this.api.post<ProgrammeCertificateSummary>(`certificates/programme/${programmeId}`, {});
  }

  revoke(id: Id, reason: string): Observable<Certificate> {
    return this.api.post<Certificate>(`certificates/${id}/revoke`, { reason });
  }

  verify(number: string): Observable<CertificateVerification> {
    return this.api.get<CertificateVerification>('certificates/verify', { number });
  }

  /* -------------------------------------------------------- documents */

  documentUrl(id: Id): string {
    return this.api.fileUrl(`certificates/${id}/document`);
  }

  programmeDocumentUrl(programmeId: Id): string {
    return this.api.fileUrl(`certificates/programme/${programmeId}/document`);
  }

  previewUrl(programTypeId: Id, kind: CertificateKind): string {
    return this.api.fileUrl(`certificates/preview/${programTypeId}/${kind}`);
  }
}
