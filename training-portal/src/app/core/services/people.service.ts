import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminRole,
  Applicant,
  ApplicantExportRow,
  ApplicantHistory,
  AccessReasonKind,
  BlockReason,
  BlockReasonUpsert,
  GeneratedCredentials,
  Id,
  PortalUser,
  RecordStatus,
  UserHistory,
} from '../models';
import { ApiService } from './api.service';
import { CrudService } from './crud.service';

@Injectable({ providedIn: 'root' })
export class RoleService extends CrudService<AdminRole> {
  protected readonly resource = 'roles';

  /**
   * Roles whose holders this account can see listed.
   *
   * Wider than `all()`, which answers "what may I settle". The user
   * register lists everyone beneath this tier, so a filter drawn from the
   * narrower question leaves rows on screen that cannot be filtered for.
   */
  visible(): Observable<AdminRole[]> {
    return this.api.get<AdminRole[]>(`${this.resource}/visible`);
  }
}

@Injectable({ providedIn: 'root' })
export class UserService extends CrudService<PortalUser> {
  protected readonly resource = 'users';

  /**
   * Overridden to carry the reason.
   *
   * Switching an account off is the one master change somebody is asked about
   * afterwards, so the grounds go with it rather than being reconstructed
   * from who was on shift.
   */
  override setStatus(id: Id, status: RecordStatus, reason = ''): Observable<PortalUser> {
    return this.api.patch<PortalUser>(`${this.resource}/${id}/status`, { status, reason });
  }

  /** Why the account was switched on or off, every time, with its login. */
  history(id: Id): Observable<UserHistory> {
    return this.api.get<UserHistory>(`${this.resource}/${id}/history`);
  }

  /**
   * Creating a user returns the generated ID and one-time password, not the
   * user record — the base class's return type would be wrong here, and the
   * password is the whole point of the response.
   */
  createUser(payload: Record<string, unknown>): Observable<GeneratedCredentials> {
    return this.api.post<GeneratedCredentials>(this.resource, payload);
  }

  resetPassword(id: Id): Observable<GeneratedCredentials> {
    return this.api.post<GeneratedCredentials>(`${this.resource}/${id}/reset-password`, {});
  }
}

@Injectable({ providedIn: 'root' })
export class ApplicantService extends CrudService<Applicant> {
  protected readonly resource = 'applicants';

  /** Blocking needs a reason from the master; unblocking needs a note. */
  setBlocked(
    id: Id,
    isBlocked: boolean,
    blockReasonId: Id | null,
    remarks: string,
  ): Observable<Applicant> {
    return this.api.patch<Applicant>(`${this.resource}/${id}/blocked`, {
      isBlocked,
      blockReasonId,
      remarks,
    });
  }

  history(id: Id): Observable<ApplicantHistory> {
    return this.api.get<ApplicantHistory>(`${this.resource}/${id}/history`);
  }

  /** Everything the filters match, flattened for a spreadsheet. */
  exportRows(query: Record<string, unknown>): Observable<ApplicantExportRow[]> {
    return this.api.get<ApplicantExportRow[]>(`${this.resource}/export`, query);
  }
}

/**
 * The reasons an account may be blocked.
 *
 * Read by anybody who may block one, written from System Settings.
 */
@Injectable({ providedIn: 'root' })
export class BlockReasonService {
  private readonly api = inject(ApiService);
  private readonly resource = 'block-reasons';

  list(activeOnly = false, kind?: AccessReasonKind): Observable<BlockReason[]> {
    return this.api.get<BlockReason[]>(this.resource, { activeOnly, kind });
  }

  create(payload: BlockReasonUpsert): Observable<BlockReason> {
    return this.api.post<BlockReason>(this.resource, payload);
  }

  update(id: Id, payload: BlockReasonUpsert): Observable<BlockReason> {
    return this.api.put<BlockReason>(`${this.resource}/${id}`, payload);
  }

  remove(id: Id): Observable<boolean> {
    return this.api.delete<boolean>(`${this.resource}/${id}`);
  }
}
