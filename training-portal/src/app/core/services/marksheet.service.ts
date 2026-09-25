import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ExamAttemptReview,
  ExamAttemptSummary,
  Id,
  Marksheet,
  MarksheetSave,
} from '../models';
import { ApiService } from './api.service';

/**
 * The trainer's marksheet for one programme.
 *
 * A pass of the sheet is sent as one list, the way it is marked: down a row of
 * candidates, then saved. The server returns the whole sheet back with the
 * results recomputed, so the screen never has to work out for itself who
 * passed.
 */
@Injectable({ providedIn: 'root' })
export class MarksheetService {
  private readonly api = inject(ApiService);

  get(programmeId: Id): Observable<Marksheet> {
    return this.api.get<Marksheet>(`programs/${programmeId}/marksheet`);
  }

  save(programmeId: Id, payload: MarksheetSave): Observable<Marksheet> {
    return this.api.put<Marksheet>(`programs/${programmeId}/marksheet`, payload);
  }

  /** Every sitting one candidate has had on this programme. */
  attempts(programmeId: Id, participantId: Id): Observable<ExamAttemptSummary[]> {
    return this.api.get<ExamAttemptSummary[]>(`programs/${programmeId}/exam-attempts`, {
      participantId,
    });
  }

  /** One sitting in full — the evidence behind a written mark. */
  attempt(programmeId: Id, attemptId: Id): Observable<ExamAttemptReview> {
    return this.api.get<ExamAttemptReview>(`programs/${programmeId}/exam-attempts/${attemptId}`);
  }
}
