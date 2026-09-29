import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminRole,
  Applicant,
  GeneratedCredentials,
  Id,
  PortalUser,
  RecordStatus,
  UserHistory,
} from '../models';
import { CrudService } from './crud.service';

@Injectable({ providedIn: 'root' })
export class RoleService extends CrudService<AdminRole> {
  protected readonly resource = 'roles';
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

  setBlocked(id: Id, isBlocked: boolean): Observable<Applicant> {
    return this.api.patch<Applicant>(`${this.resource}/${id}/blocked`, { isBlocked });
  }
}
