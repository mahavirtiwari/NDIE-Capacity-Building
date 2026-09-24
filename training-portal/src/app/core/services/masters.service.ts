import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import {
  Category,
  CertificateKind,
  Id,
  ImplementingAgency,
  LookupItem,
  ProgramType,
  SubCategory,
} from '../models';
import { ApiService } from './api.service';
import { CrudService } from './crud.service';

@Injectable({ providedIn: 'root' })
export class CategoryService extends CrudService<Category> {
  protected readonly resource = 'categories';
}

@Injectable({ providedIn: 'root' })
export class SubCategoryService extends CrudService<SubCategory> {
  protected readonly resource = 'sub-categories';

  byCategory(categoryId: Id): Observable<SubCategory[]> {
    return this.api.get<SubCategory[]>(`${this.resource}/all`, { categoryId });
  }
}

@Injectable({ providedIn: 'root' })
export class ProgramTypeService extends CrudService<ProgramType> {
  protected readonly resource = 'program-types';

  bySubCategory(subCategoryId: Id): Observable<ProgramType[]> {
    return this.api.get<ProgramType[]>(`${this.resource}/all`, { subCategoryId });
  }

  /* ------------------------------------------- certificate templates */

  /** Uploads the artwork for one kind of certificate, replacing what is there. */
  uploadTemplate(id: Id, kind: CertificateKind, file: File): Observable<ProgramType> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.api.upload<ProgramType>(
      `${this.resource}/${id}/certificate-templates/${kind}`,
      form,
    );
  }

  removeTemplate(id: Id, kind: CertificateKind): Observable<ProgramType> {
    return this.api.delete<ProgramType>(`${this.resource}/${id}/certificate-templates/${kind}`);
  }

  /** Where the stored template can be downloaded from. */
  templateUrl(id: Id, kind: CertificateKind): string {
    return this.api.fileUrl(`${this.resource}/${id}/certificate-templates/${kind}`);
  }
}

@Injectable({ providedIn: 'root' })
export class AgencyService extends CrudService<ImplementingAgency> {
  protected readonly resource = 'agencies';
}

/**
 * Cached dropdown source for the cascading Category -> Sub-category ->
 * Program type selectors used on nearly every screen.
 */
@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly api = inject(ApiService);
  private cache = new Map<string, Observable<LookupItem[]>>();

  categories(): Observable<LookupItem[]> {
    return this.cached('categories', () => this.api.get<LookupItem[]>('lookups/categories'));
  }

  subCategories(categoryId?: Id | null): Observable<LookupItem[]> {
    return this.cached(`sub-categories:${categoryId ?? 'all'}`, () =>
      this.api.get<LookupItem[]>('lookups/sub-categories', { categoryId }),
    );
  }

  programTypes(subCategoryId?: Id | null): Observable<LookupItem[]> {
    return this.cached(`program-types:${subCategoryId ?? 'all'}`, () =>
      this.api.get<LookupItem[]>('lookups/program-types', { subCategoryId }),
    );
  }

  agencies(): Observable<LookupItem[]> {
    return this.cached('agencies', () => this.api.get<LookupItem[]>('lookups/agencies'));
  }

  coordinators(agencyId?: Id | null): Observable<LookupItem[]> {
    return this.cached(`coordinators:${agencyId ?? 'all'}`, () =>
      this.api.get<LookupItem[]>('lookups/coordinators', { agencyId }),
    );
  }

  operationManagers(): Observable<LookupItem[]> {
    return this.cached('operation-managers', () =>
      this.api.get<LookupItem[]>('lookups/operation-managers'),
    );
  }

  /** Educational qualification ladder, lowest first. `code` is what is stored. */
  qualifications(): Observable<LookupItem[]> {
    return this.cached('qualifications', () =>
      this.api.get<LookupItem[]>('lookups/qualifications'),
    );
  }

  /** LGD state master. The lookup id is the LGD state code. */
  states(): Observable<LookupItem[]> {
    return this.cached('states', () => this.api.get<LookupItem[]>('lookups/states'));
  }

  /** LGD district master for one state. */
  districts(stateCode?: Id | null): Observable<LookupItem[]> {
    return this.cached(`districts:${stateCode ?? 'none'}`, () =>
      this.api.get<LookupItem[]>('lookups/districts', { stateCode }),
    );
  }

  /** Call after a master is created so the next dropdown read is fresh. */
  invalidate(prefix?: string): void {
    if (!prefix) {
      this.cache.clear();
      return;
    }
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  /**
   * Lookups are shared and replayed, since half a dozen screens want the same
   * category list.
   *
   * Two things a plain shareReplay gets wrong here. A failure would be
   * replayed to every later subscriber for the life of the app, and because
   * these feed `toSignal` — which re-throws a failed source on every read — a
   * single unavailable lookup froze the screen on every render pass. So a
   * failure yields an empty list and evicts itself, letting the next visit try
   * again. The error interceptor has already reported it.
   */
  private cached(key: string, factory: () => Observable<LookupItem[]>): Observable<LookupItem[]> {
    let stream = this.cache.get(key);
    if (!stream) {
      stream = factory().pipe(
        catchError((error: unknown) => {
          console.warn(`Lookup "${key}" failed; continuing with an empty list.`, error);
          this.cache.delete(key);
          return of([] as LookupItem[]);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.cache.set(key, stream);
    }
    return stream;
  }
}
