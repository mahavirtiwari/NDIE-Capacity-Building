import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Curriculum,
  ExamPaper,
  FeeStructure,
  Id,
  RecordStatus,
  RegistrationForm,
  SignupField,
  SignupFieldUpsert,
  TrainingMaterial,
} from '../models';
import { ApiService } from './api.service';
import { CrudService } from './crud.service';

@Injectable({ providedIn: 'root' })
export class CurriculumService extends CrudService<Curriculum> {
  protected readonly resource = 'curricula';
}

@Injectable({ providedIn: 'root' })
export class RegistrationFormService extends CrudService<RegistrationForm> {
  protected readonly resource = 'registration-forms';

  /** Used by the applicant app and by the scrutiny screen to render answers. */
  byProgramType(programTypeId: Id): Observable<RegistrationForm> {
    return this.api.get<RegistrationForm>(`${this.resource}/by-program-type/${programTypeId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class FeeService extends CrudService<FeeStructure> {
  protected readonly resource = 'fees';
}

@Injectable({ providedIn: 'root' })
export class ExamPaperService extends CrudService<ExamPaper> {
  protected readonly resource = 'exam-papers';
}

@Injectable({ providedIn: 'root' })
export class TrainingMaterialService extends CrudService<TrainingMaterial> {
  protected readonly resource = 'materials';
}

/**
 * The account sign-up form.
 *
 * Not a CrudService: there is one form, so there is no paging and no id in the
 * collection route - the whole thing is read as an ordered list of fields.
 */
@Injectable({ providedIn: 'root' })
export class SignupFormService {
  private readonly api = inject(ApiService);
  private readonly resource = 'signup-form';

  list(): Observable<SignupField[]> {
    return this.api.get<SignupField[]>(this.resource);
  }

  create(body: SignupFieldUpsert): Observable<SignupField> {
    return this.api.post<SignupField>(this.resource, body);
  }

  update(id: Id, body: SignupFieldUpsert): Observable<SignupField> {
    return this.api.put<SignupField>(`${this.resource}/${id}`, body);
  }

  setStatus(id: Id, status: RecordStatus): Observable<SignupField> {
    return this.api.patch<SignupField>(`${this.resource}/${id}/status`, { status });
  }

  remove(id: Id): Observable<boolean> {
    return this.api.delete<boolean>(`${this.resource}/${id}`);
  }

  reorder(ids: Id[]): Observable<SignupField[]> {
    return this.api.put<SignupField[]>(`${this.resource}/order`, { ids });
  }
}
