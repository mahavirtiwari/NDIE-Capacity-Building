import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Curriculum,
  ExamPaper,
  FeeStructure,
  Id,
  RegistrationForm,
  TrainingMaterial,
} from '../models';
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
