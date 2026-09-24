import {
  AdminRole,
  Applicant,
  Application,
  Category,
  Curriculum,
  ExamPaper,
  FeeStructure,
  Id,
  ImplementingAgency,
  PortalUser,
  Program,
  ProgramType,
  RegistrationForm,
  SubCategory,
  TrainingMaterial,
} from '../models';
import {
  CURRICULA,
  EXAM_PAPERS,
  FEE_STRUCTURES,
  REGISTRATION_FORMS,
  TRAINING_MATERIALS,
} from './seed-academics';
import { AGENCIES, CATEGORIES, PROGRAM_TYPES, STATES, SUB_CATEGORIES } from './seed-masters';
import { APPLICANTS, PORTAL_USERS, ROLES } from './seed-people';
import { APPLICATIONS, PROGRAMS } from './seed-operations';

export interface MockState {
  categories: Category[];
  subCategories: SubCategory[];
  programTypes: ProgramType[];
  agencies: ImplementingAgency[];
  roles: AdminRole[];
  users: PortalUser[];
  applicants: Applicant[];
  curricula: Curriculum[];
  registrationForms: RegistrationForm[];
  fees: FeeStructure[];
  examPapers: ExamPaper[];
  materials: TrainingMaterial[];
  applications: Application[];
  programs: Program[];
  states: string[];
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/**
 * Mutable in-memory database backing the mock API. Swapped out entirely the
 * moment `environment.useMockApi` is set to false.
 */
export const db: MockState = {
  categories: clone(CATEGORIES),
  subCategories: clone(SUB_CATEGORIES),
  programTypes: clone(PROGRAM_TYPES),
  agencies: clone(AGENCIES),
  roles: clone(ROLES),
  users: clone(PORTAL_USERS),
  applicants: clone(APPLICANTS),
  curricula: clone(CURRICULA),
  registrationForms: clone(REGISTRATION_FORMS),
  fees: clone(FEE_STRUCTURES),
  examPapers: clone(EXAM_PAPERS),
  materials: clone(TRAINING_MATERIALS),
  applications: clone(APPLICATIONS),
  programs: clone(PROGRAMS),
  states: clone(STATES),
};

export function nextId(rows: { id: Id }[]): Id {
  return rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;
}

const categoryName = (id?: Id | null) => db.categories.find((c) => c.id === id)?.name;
const subCategoryName = (id?: Id | null) => db.subCategories.find((c) => c.id === id)?.name;
const programTypeName = (id?: Id | null) => db.programTypes.find((c) => c.id === id)?.name;
const agencyName = (id?: Id | null) => db.agencies.find((c) => c.id === id)?.name;
const userName = (id?: Id | null) => db.users.find((c) => c.id === id)?.fullName;
const roleName = (id?: Id | null) => db.roles.find((c) => c.id === id)?.name;

/**
 * The real API returns joined display names; the mock mirrors that so no
 * component has to resolve foreign keys itself.
 */
export function decorate<T extends Record<string, unknown>>(resource: string, row: T): T {
  const r = { ...row } as Record<string, unknown>;
  if ('categoryId' in r) r['categoryName'] = categoryName(r['categoryId'] as Id);
  if ('subCategoryId' in r) r['subCategoryName'] = subCategoryName(r['subCategoryId'] as Id);
  if ('programTypeId' in r) {
    r['programTypeName'] = programTypeName(r['programTypeId'] as Id);
    const pt = db.programTypes.find((p) => p.id === (r['programTypeId'] as Id));
    if (pt) {
      r['categoryName'] = categoryName(pt.categoryId);
      r['subCategoryName'] = subCategoryName(pt.subCategoryId);
      /* Edit forms need the ids to pre-select the cascading dropdowns. */
      if (r['categoryId'] === undefined) r['categoryId'] = pt.categoryId;
      if (r['subCategoryId'] === undefined) r['subCategoryId'] = pt.subCategoryId;
    }
  }
  if ('agencyId' in r) r['agencyName'] = agencyName(r['agencyId'] as Id);
  if ('coordinatorId' in r) r['coordinatorName'] = userName(r['coordinatorId'] as Id);
  if ('operationManagerId' in r) r['operationManagerName'] = userName(r['operationManagerId'] as Id);
  if ('assignedToUserId' in r) r['assignedToName'] = userName(r['assignedToUserId'] as Id);
  if ('reportsToUserId' in r) r['reportsToName'] = userName(r['reportsToUserId'] as Id);
  if ('roleId' in r) r['roleName'] = roleName(r['roleId'] as Id);

  if (resource === 'categories') {
    r['subCategoryCount'] = db.subCategories.filter((s) => s.categoryId === (r['id'] as Id)).length;
  }
  if (resource === 'roles') {
    r['userCount'] = db.users.filter((u) => u.roleId === (r['id'] as Id)).length;
  }
  return r as T;
}

/** Collection name -> array on the state object. */
export const COLLECTIONS: Record<string, keyof MockState> = {
  categories: 'categories',
  'sub-categories': 'subCategories',
  'program-types': 'programTypes',
  agencies: 'agencies',
  roles: 'roles',
  users: 'users',
  applicants: 'applicants',
  curricula: 'curricula',
  'registration-forms': 'registrationForms',
  fees: 'fees',
  'exam-papers': 'examPapers',
  materials: 'materials',
  applications: 'applications',
  programs: 'programs',
};

/** Keys excluded from the generic equality filter. */
const RESERVED_QUERY_KEYS = new Set(['page', 'pageSize', 'search', 'sortBy', 'sortDir']);

export function applyQuery<T extends Record<string, unknown>>(
  rows: T[],
  query: Record<string, string>,
): T[] {
  let result = rows;

  for (const [key, raw] of Object.entries(query)) {
    if (RESERVED_QUERY_KEYS.has(key) || raw === '' || raw === undefined) continue;
    const wanted = raw.split(',');
    result = result.filter((row) => {
      const value = row[key];
      if (value === undefined || value === null) return false;
      if (Array.isArray(value)) return value.some((v) => wanted.includes(String(v)));
      return wanted.includes(String(value));
    });
  }

  const search = (query['search'] ?? '').trim().toLowerCase();
  if (search) {
    result = result.filter((row) =>
      Object.values(row).some(
        (v) => typeof v === 'string' && v.toLowerCase().includes(search),
      ),
    );
  }

  const sortBy = query['sortBy'];
  if (sortBy) {
    const dir = query['sortDir'] === 'desc' ? -1 : 1;
    result = [...result].sort((a, b) => {
      const av = a[sortBy];
      const bv = b[sortBy];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  return result;
}

export function paginate<T>(rows: T[], query: Record<string, string>) {
  const page = Number(query['page'] ?? 1) || 1;
  const pageSize = Number(query['pageSize'] ?? 10) || 10;
  const start = (page - 1) * pageSize;
  return { items: rows.slice(start, start + pageSize), total: rows.length, page, pageSize };
}
