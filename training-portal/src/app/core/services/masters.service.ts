import { Injectable, inject } from '@angular/core';
import { Observable, catchError, of, shareReplay } from 'rxjs';
import {
  AllocatableScope,
  Category,
  CertificateKind,
  EvaluationSkill,
  Id,
  ImplementingAgency,
  LookupItem,
  ProgramType,
  Qualification,
  SubCategory,
} from '../models';
import { ApiService } from './api.service';
import { CrudService } from './crud.service';

@Injectable({ providedIn: 'root' })
export class CategoryService extends CrudService<Category> {
  protected readonly resource = 'categories';
}

@Injectable({ providedIn: 'root' })
export class QualificationService extends CrudService<Qualification> {
  protected readonly resource = 'qualifications';
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

/**
 * The skills a viva or practical is marked against, per program type.
 *
 * Its own resource rather than part of the program type, because it is
 * maintained on its own screen and read on its own by the trainer's app.
 */
@Injectable({ providedIn: 'root' })
export class EvaluationSkillService extends CrudService<EvaluationSkill> {
  protected readonly resource = 'evaluation-skills';

  byProgramType(programTypeId?: Id | null, status?: string): Observable<EvaluationSkill[]> {
    return this.api.get<EvaluationSkill[]>(this.resource, { programTypeId, status });
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

  /**
   * Narrowed by sub-category, by category, or neither. The API has always
   * accepted both; only the sub-category was reachable from here.
   */
  programTypes(subCategoryId?: Id | null, categoryId?: Id | null): Observable<LookupItem[]> {
    return this.cached(
      `program-types:${subCategoryId ?? 'all'}:${categoryId ?? 'all'}`,
      () => this.api.get<LookupItem[]>('lookups/program-types', { subCategoryId, categoryId }),
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

  /**
   * The LGD masters for a postal address, which are deliberately not
   * narrowed to the caller. Where somebody lives, or where an agency's
   * office is, is a fact about them rather than a slice of the estate -
   * an Admin working two states may appoint a manager who lives in a
   * third.
   */
  addressStates(): Observable<LookupItem[]> {
    return this.cached('address-states', () =>
      this.api.get<LookupItem[]>('lookups/address/states'),
    );
  }

  addressDistricts(stateCode?: Id | null): Observable<LookupItem[]> {
    return this.cached(`address-districts:${stateCode ?? 'none'}`, () =>
      this.api.get<LookupItem[]>('lookups/address/districts', { stateCode }),
    );
  }

  /**
   * What the signed-in account may allocate to somebody beneath it, on
   * every axis at once. Not cached: the answer is who you are, and a
   * cached one would survive a sign-out into the next account.
   */
  allocatableScope(): Observable<AllocatableScope> {
    return this.api.get<AllocatableScope>('lookups/allocatable-scope');
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
