import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AdminRole, Applicant, GeneratedCredentials, Id, PortalUser } from '../models';
import { CrudService } from './crud.service';

@Injectable({ providedIn: 'root' })
export class RoleService extends CrudService<AdminRole> {
  protected readonly resource = 'roles';
}

@Injectable({ providedIn: 'root' })
export class UserService extends CrudService<PortalUser> {
  protected readonly resource = 'users';

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
