import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Curriculum,
  ExamPaper,
  FeeStructure,
  Id,
  RecordStatus,
  ProfileForm,
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
export class ProfileFormService extends CrudService<ProfileForm> {
  protected readonly resource = 'profile-forms';

  /** Used by the applicant app and by the scrutiny screen to render answers. */
  bySubCategory(subCategoryId: Id): Observable<ProfileForm> {
    return this.api.get<ProfileForm>(`${this.resource}/by-sub-category/${subCategoryId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class FeeService extends CrudService<FeeStructure> {
  protected readonly resource = 'fees';

  /**
   * The structure in force today for one program type, or null where none
   * is. The same endpoint the applicant app quotes from, so a figure read
   * here is the figure an applicant would be charged.
   */
  current(programTypeId: number): Observable<FeeStructure | null> {
    return this.api.get<FeeStructure | null>(`fees/current/${programTypeId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ExamPaperService extends CrudService<ExamPaper> {
  protected readonly resource = 'exam-papers';
}

/** What an upload becomes, ready for the publish form to record. */
export interface MaterialFile {
  url: string;
  fileName: string;
  fileSizeKb: number;
  mimeType: string;
  canPreview: boolean;
}

@Injectable({ providedIn: 'root' })
export class TrainingMaterialService extends CrudService<TrainingMaterial> {
  protected readonly resource = 'materials';
  private readonly http = inject(HttpClient);

  /** Sends the file itself, before the row that will point at it is saved. */
  upload(file: File, programTypeId: Id): Observable<MaterialFile> {
    const form = new FormData();
    form.append('file', file);
    form.append('programTypeId', String(programTypeId));
    return this.api.upload<MaterialFile>(`${this.resource}/upload`, form);
  }

  /**
   * The published file, as a blob.
   *
   * Fetched rather than pointed at: the endpoint needs the bearer token, and
   * an <iframe src> would not carry one. The caller makes an object URL of
   * what comes back and revokes it when the preview closes.
   */
  file(id: Id, download = false): Observable<Blob> {
    return this.http.get(this.api.fileUrl(`${this.resource}/${id}/file`), {
      params: download ? { download: true } : undefined,
      responseType: 'blob',
    });
  }
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
