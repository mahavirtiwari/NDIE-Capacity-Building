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
  SignupForm,
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

  /** The form a sub-category uses, and whether it is its own or the default. */
  forSubCategory(subCategoryId: Id): Observable<SignupForm> {
    return this.api.get<SignupForm>(`${this.resource}/sub-category/${subCategoryId}`);
  }

  /** Gives a sub-category its own form, copied from the default. */
  adopt(subCategoryId: Id): Observable<SignupForm> {
    return this.api.post<SignupForm>(`${this.resource}/sub-category/${subCategoryId}`, {});
  }

  /** Drops a sub-category's own form, putting it back on the default. */
  reset(subCategoryId: Id): Observable<SignupForm> {
    return this.api.delete<SignupForm>(`${this.resource}/sub-category/${subCategoryId}`);
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

  reorder(ids: Id[], subCategoryId?: Id | null): Observable<SignupField[]> {
    const suffix = subCategoryId ? `?subCategoryId=${subCategoryId}` : '';
    return this.api.put<SignupField[]>(`${this.resource}/order${suffix}`, { ids });
  }
}
