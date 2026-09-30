import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { Observable, delay, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  APPLICANT_GENDERS,
  APPLICANT_SOCIAL_CATEGORIES,
  ApiEnvelope,
  AppRole,
  Applicant,
  Application,
  ApplicationStatus,
  AuthUser,
  Branding,
  BrandingUpdate,
  Id,
  LoginRequest,
  LoginResponse,
  LGD_STATES,
  LookupItem,
  Program,
  ScrutinyDecision,
  districtsOfState,
  stateByName,
} from '../models';
import { DashboardData, DashboardKpi, SeriesPoint } from '../services/workflow.service';
import { COLLECTIONS, MockState, applyQuery, db, decorate, nextId, paginate } from './mock-db';

const LATENCY_MS = 220;

/**
 * Serves the whole API in the browser so the portal is demonstrable before the
 * .NET Core backend is deployed. Disabled by `environment.useMockApi = false`.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.useMockApi || !req.url.includes('/api/')) return next(req);

  const url = new URL(req.url, window.location.origin);
  const path = url.pathname.replace(/^.*\/api\//, '').replace(/\/$/, '');
  const segments = path.split('/').filter(Boolean);
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => (query[key] = value));
  const body = (req.body ?? {}) as Record<string, unknown>;

  try {
    const data = route(req.method, segments, query, body);
    return respond(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Mock API error';
    const status = message.startsWith('404') ? 404 : message.startsWith('401') ? 401 : 400;
    return throwError(
      () =>
        new HttpErrorResponse({
          status,
          statusText: message,
          url: req.url,
          error: { success: false, message: message.replace(/^\d{3}\s?/, ''), data: null },
        }),
    ).pipe(delay(LATENCY_MS));
  }
};

function respond<T>(data: T): Observable<HttpResponse<ApiEnvelope<T>>> {
  return of(new HttpResponse({ status: 200, body: { success: true, data } })).pipe(
    delay(LATENCY_MS),
  );
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

function route(
  method: string,
  segments: string[],
  query: Record<string, string>,
  body: Record<string, unknown>,
): unknown {
  const [head, ...rest] = segments;

  if (head === 'auth') return authRoutes(method, rest, body);
  if (head === 'lookups') return lookupRoutes(rest[0] ?? '', query);
  if (head === 'dashboard') return dashboard(query);
  if (head === 'branding') return brandingRoutes(method, rest, body);

  const collectionKey = COLLECTIONS[head ?? ''];
  if (!collectionKey) throw new Error(`404 Unknown resource "${head}"`);

  const custom = customRoutes(head!, method, rest, body);
  if (custom !== undefined) return custom;

  return crud(head!, collectionKey, method, rest, query, body);
}

/* ------------------------------------------------------------------ */
/* Branding                                                            */
/* ------------------------------------------------------------------ */

/* Mock mode has no file store, so the logo is held as a data URL in memory. */
let mockBranding: Branding = {
  organisationName: environment.organisation,
  shortName: environment.appShortName,
  portalTitle: environment.appName,
  tagline: 'One platform for the entire training and certification lifecycle.',
  supportEmail: environment.supportEmail,
  hasLogo: false,
  logoFileName: null,
  logoUrl: null,
  logoVersion: 0,
  hasReversedLogo: false,
  reversedLogoFileName: null,
  reversedLogoUrl: null,
  reversedLogoVersion: 0,
  partnerName: null,
  hasPartnerLogo: false,
  partnerLogoFileName: null,
  partnerLogoUrl: null,
  partnerLogoVersion: 0,
  updatedOn: new Date().toISOString(),
};

function brandingRoutes(method: string, rest: string[], body: Record<string, unknown>): Branding {
  if (method === 'GET' && rest.length === 0) return mockBranding;

  if (method === 'PUT' && rest.length === 0) {
    const update = body as unknown as BrandingUpdate;
    mockBranding = { ...mockBranding, ...update, updatedOn: new Date().toISOString() };
    return mockBranding;
  }

  if (method === 'DELETE' && rest[0] === 'logo') {
    mockBranding = {
      ...mockBranding,
      hasLogo: false,
      logoFileName: null,
      logoUrl: null,
      updatedOn: new Date().toISOString(),
    };
    return mockBranding;
  }

  if (method === 'DELETE' && rest[0] === 'reversed-logo') {
    mockBranding = {
      ...mockBranding,
      hasReversedLogo: false,
      reversedLogoFileName: null,
      reversedLogoUrl: null,
      updatedOn: new Date().toISOString(),
    };
    return mockBranding;
  }

  if (method === 'DELETE' && rest[0] === 'partner-logo') {
    mockBranding = {
      ...mockBranding,
      hasPartnerLogo: false,
      partnerLogoFileName: null,
      partnerLogoUrl: null,
      updatedOn: new Date().toISOString(),
    };
    return mockBranding;
  }

  throw new Error('Logo upload needs the .NET API. Turn off useMockApi first.');
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

const ALIASES: Record<string, string> = {
  superadmin: 'SA0001',
  admin: 'AD0002',
  scrutiny: 'AD0004',
  manager: 'OM0005',
  coordinator: 'CO0010',
};

/* Matches the invariant "MMM" the API formats its month labels with. */
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function authRoutes(method: string, rest: string[], body: Record<string, unknown>): unknown {
  if (method === 'POST' && rest[0] === 'login') {
    const request = body as unknown as LoginRequest;
    const raw = (request.username ?? '').trim();
    /* Sign-in is by the system generated user ID only. Email is profile data
       the user can change, so it is never an identity key. */
    const username = (ALIASES[raw.toLowerCase()] ?? raw).toLowerCase();
    const user = db.users.find((u) => u.userCode.toLowerCase() === username);
    if (!user || request.password !== 'Password@123') {
      throw new Error('401 Invalid user ID or password.');
    }
    if (user.status === 'Inactive') throw new Error('401 This account has been deactivated.');

    const role = db.roles.find((r) => r.id === user.roleId);
    const authUser: AuthUser = {
      id: user.id,
      userCode: user.userCode,
      fullName: user.fullName,
      email: user.email,
      mobile: user.mobile,
      role: user.baseRole as AppRole,
      roleName: role?.name ?? user.baseRole,
      permissions: role?.permissions ?? [],
      categoryIds: user.categoryIds,
      subCategoryIds: user.subCategoryIds,
      programTypeIds: user.programTypeIds,
      agencyId: user.agencyId ?? null,
      avatarInitials: initials(user.fullName),
      mustChangePassword: false,
    };
    user.lastLoginOn = new Date().toISOString();

    return {
      token: `mock.${btoa(user.userCode)}.token`,
      refreshToken: `mock.${btoa(user.userCode)}.refresh`,
      expiresInSeconds: 3600,
      user: authUser,
    } satisfies LoginResponse;
  }
  throw new Error('404 Unknown auth route');
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

function lookupRoutes(kind: string, query: Record<string, string>): LookupItem[] {
  const num = (key: string) => (query[key] ? Number(query[key]) : null);
  const categoryId = query['categoryId'] ? Number(query['categoryId']) : null;
  const subCategoryId = query['subCategoryId'] ? Number(query['subCategoryId']) : null;
  const agencyId = query['agencyId'] ? Number(query['agencyId']) : null;

  switch (kind) {
    case 'categories':
      return db.categories
        .filter((c) => c.status === 'Active')
        .map((c) => ({ id: c.id, name: c.name, code: c.code }));
    case 'sub-categories':
      return db.subCategories
        .filter((s) => s.status === 'Active' && (!categoryId || s.categoryId === categoryId))
        .map((s) => ({ id: s.id, name: s.name, code: s.code, parentId: s.categoryId }));
    case 'program-types':
      return db.programTypes
        .filter(
          (p) =>
            p.status === 'Active' &&
            (!subCategoryId || p.subCategoryId === subCategoryId) &&
            (!categoryId || p.categoryId === categoryId),
        )
        .map((p) => ({ id: p.id, name: p.name, code: p.code, parentId: p.subCategoryId }));
    case 'agencies':
      return db.agencies
        .filter((a) => a.status === 'Active')
        .map((a) => ({ id: a.id, name: a.name, code: a.code }));
    case 'coordinators':
      return db.users
        .filter(
          (u) =>
            u.baseRole === 'Coordinator' &&
            u.status === 'Active' &&
            (!agencyId || u.agencyId === agencyId),
        )
        .map((u) => ({ id: u.id, name: u.fullName, code: u.userCode, parentId: u.agencyId }));
    case 'operation-managers':
      return db.users
        .filter((u) => u.baseRole === 'OperationManager' && u.status === 'Active')
        .map((u) => ({ id: u.id, name: u.fullName, code: u.userCode }));
    case 'roles':
      return db.roles
        .filter((r) => r.status === 'Active')
        .map((r) => ({ id: r.id, name: r.name, code: r.code }));
    case 'states':
      /* LGD is the authority for the state master; the id is the LGD code. */
      return LGD_STATES.map((state) => ({
        id: state.code,
        name: state.name,
        code: String(state.code),
      }));
    case 'districts': {
      const stateCode =
        num('stateCode') ?? (query['state'] ? (stateByName(query['state'])?.code ?? null) : null);
      return districtsOfState(stateCode).map((district) => ({
        id: district.code,
        name: district.name,
        code: String(district.code),
        parentId: district.stateCode,
      }));
    }
    default:
      throw new Error(`404 Unknown lookup "${kind}"`);
  }
}

/* ------------------------------------------------------------------ */
/* Resource specific routes                                            */
/* ------------------------------------------------------------------ */

function customRoutes(
  resource: string,
  method: string,
  rest: string[],
  body: Record<string, unknown>,
): unknown {
  if (resource === 'registration-forms' && rest[0] === 'by-program-type') {
    const programTypeId = Number(rest[1]);
    const form = db.registrationForms.find((f) => f.programTypeId === programTypeId);
    if (!form) throw new Error('404 No registration form configured for this program type.');
    return decorate(resource, form as unknown as Record<string, unknown>);
  }

  if (resource === 'users' && method === 'POST' && rest[1] === 'reset-password') {
    const user = db.users.find((u) => u.id === Number(rest[0]));
    if (!user) throw new Error('404 User not found');
    return { temporaryPassword: `Tmp@${Math.floor(1000 + Math.random() * 9000)}` };
  }

  if (resource === 'applicants' && method === 'PATCH' && rest[1] === 'blocked') {
    const applicant = db.applicants.find((a) => a.id === Number(rest[0]));
    if (!applicant) throw new Error('404 Applicant not found');
    applicant.isBlocked = Boolean(body['isBlocked']);
    return applicant;
  }

  if (resource === 'applications') {
    const application = rest[0] ? db.applications.find((a) => a.id === Number(rest[0])) : undefined;
    if (method === 'POST' && rest[1] === 'scrutiny') {
      if (!application) throw new Error('404 Application not found');
      return applyScrutiny(application, body as unknown as ScrutinyDecision);
    }
    if (method === 'PATCH' && rest[1] === 'assign') {
      if (!application) throw new Error('404 Application not found');
      const userId = Number(body['userId']);
      application.assignedToUserId = userId;
      application.status = application.status === 'Submitted' ? 'UnderScrutiny' : application.status;
      application.history.push({
        id: application.history.length + 1,
        action: 'Assigned',
        byUserName: 'Admin',
        byRole: 'Admin',
        on: new Date().toISOString(),
        remarks: `Assigned to ${db.users.find((u) => u.id === userId)?.fullName ?? 'officer'}.`,
      });
      return decorate(resource, application as unknown as Record<string, unknown>);
    }
    if (method === 'PATCH' && rest[1] === 'documents') {
      if (!application) throw new Error('404 Application not found');
      const doc = application.documents.find((d) => d.id === Number(rest[2]));
      if (!doc) throw new Error('404 Document not found');
      doc.verified = Boolean(body['verified']);
      doc.remarks = (body['remarks'] as string) ?? doc.remarks;
      return decorate(resource, application as unknown as Record<string, unknown>);
    }
  }

  if (resource === 'programs' && rest[0]) {
    const program = db.programs.find((p) => p.id === Number(rest[0]));
    if (program && method === 'POST' && rest[1] === 'sessions' && !rest[2]) {
      const session = {
        id: nextId(program.sessions),
        title: String(body['title'] ?? 'New session'),
        sessionDate: String(body['sessionDate'] ?? program.startDate),
        startTime: String(body['startTime'] ?? '10:00'),
        endTime: String(body['endTime'] ?? '17:00'),
        facultyName: (body['facultyName'] as string) ?? '',
        presentCount: 0,
        isAttendanceLocked: false,
      };
      program.sessions.push(session);
      return decorate(resource, program as unknown as Record<string, unknown>);
    }
    if (program && method === 'POST' && rest[2] && rest[3] === 'attendance') {
      const session = program.sessions.find((s) => s.id === Number(rest[2]));
      if (!session) throw new Error('404 Session not found');
      const marks = (body['marks'] ?? []) as { participantId: Id; present: boolean }[];
      session.presentCount = marks.filter((m) => m.present).length;
      session.isAttendanceLocked = true;
      recomputeAttendance(program);
      return decorate(resource, program as unknown as Record<string, unknown>);
    }
    if (program && method === 'POST' && rest[1] === 'enrol') {
      const ids = (body['applicationIds'] ?? []) as Id[];
      for (const appId of ids) {
        const application = db.applications.find((a) => a.id === appId);
        if (!application || program.participants.some((p) => p.applicantId === application.applicantId)) continue;
        program.participants.push({
          id: nextId(program.participants),
          applicantId: application.applicantId,
          applicationNo: application.applicationNo,
          name: application.applicantName,
          email: application.applicantEmail,
          mobile: application.applicantMobile,
          enrolledOn: new Date().toISOString().slice(0, 10),
          attendancePercent: 0,
          examScore: null,
          result: 'Pending',
          certificateNo: null,
        });
        application.status = 'Enrolled';
      }
      program.participantCount = program.participants.length;
      return decorate(resource, program as unknown as Record<string, unknown>);
    }
  }

  return undefined;
}

function applyScrutiny(application: Application, decision: ScrutinyDecision): Application {
  const nextStatus: ApplicationStatus =
    decision.decision === 'Approve'
      ? 'Approved'
      : decision.decision === 'Reject'
        ? 'Rejected'
        : 'Clarification';
  application.status = nextStatus;
  application.history.push({
    id: application.history.length + 1,
    action:
      decision.decision === 'Approve'
        ? 'Approved'
        : decision.decision === 'Reject'
          ? 'Rejected'
          : 'Clarification',
    byUserName: 'Scrutiny Officer',
    byRole: 'Admin',
    on: new Date().toISOString(),
    remarks: decision.remarks,
  });
  if (decision.documentIdsVerified?.length) {
    for (const doc of application.documents) {
      if (decision.documentIdsVerified.includes(doc.id)) doc.verified = true;
    }
  }
  return decorate('applications', application as unknown as Record<string, unknown>) as unknown as Application;
}

function recomputeAttendance(program: Program): void {
  const held = program.sessions.filter((s) => s.isAttendanceLocked).length;
  if (!held) return;
  program.participants = program.participants.map((p, i) => ({
    ...p,
    attendancePercent: Math.min(100, Math.round(((held - (i % 2)) / held) * 100)),
  }));
}

/* ------------------------------------------------------------------ */
/* Generic CRUD                                                        */
/* ------------------------------------------------------------------ */

function crud(
  resource: string,
  key: keyof MockState,
  method: string,
  rest: string[],
  query: Record<string, string>,
  body: Record<string, unknown>,
): unknown {
  const rows = db[key] as unknown as Record<string, unknown>[];

  if (method === 'GET' && rest[0] === 'all') {
    return applyQuery(rows, query).map((r) => decorate(resource, r));
  }
  if (method === 'GET' && !rest.length) {
    const filtered = applyQuery(rows, query);
    const page = paginate(filtered, query);
    return { ...page, items: page.items.map((r) => decorate(resource, r)) };
  }
  if (method === 'GET' && rest[0]) {
    const row = rows.find((r) => r['id'] === Number(rest[0]));
    if (!row) throw new Error('404 Record not found');
    return decorate(resource, row);
  }
  if (method === 'POST' && !rest.length) {
    const created: Record<string, unknown> = {
      ...body,
      id: nextId(rows as { id: Id }[]),
      createdBy: 'Current User',
      createdOn: new Date().toISOString(),
    };
    if (!('status' in created)) created['status'] = 'Active';
    rows.unshift(created);
    return decorate(resource, created);
  }
  if (method === 'PUT' && rest[0]) {
    const index = rows.findIndex((r) => r['id'] === Number(rest[0]));
    if (index < 0) throw new Error('404 Record not found');
    rows[index] = {
      ...rows[index],
      ...body,
      id: Number(rest[0]),
      modifiedBy: 'Current User',
      modifiedOn: new Date().toISOString(),
    };
    return decorate(resource, rows[index]!);
  }
  if (method === 'PATCH' && rest[1] === 'status') {
    const row = rows.find((r) => r['id'] === Number(rest[0]));
    if (!row) throw new Error('404 Record not found');
    row['status'] = body['status'];
    return decorate(resource, row);
  }
  if (method === 'DELETE' && rest[0]) {
    const index = rows.findIndex((r) => r['id'] === Number(rest[0]));
    if (index < 0) throw new Error('404 Record not found');
    rows.splice(index, 1);
    return null;
  }
  throw new Error(`404 ${method} /${resource}/${rest.join('/')} is not supported`);
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

function dashboard(query: Record<string, string>): DashboardData {
  const num = (key: string) => (query[key] ? Number(query[key]) : null);
  const categoryId = num('categoryId');
  const subCategoryId = num('subCategoryId');
  const programTypeId = num('programTypeId');
  const agencyId = num('agencyId');
  const mode = query['mode'] || null;
  const state = query['state'] || null;
  const windowMonths = num('months');
  const cutoff = windowMonths
    ? new Date(Date.now() - windowMonths * 30 * 24 * 3600 * 1000).toISOString().slice(0, 10)
    : null;

  const applications = db.applications.filter(
    (a) =>
      (!categoryId || a.categoryId === categoryId) &&
      (!subCategoryId || a.subCategoryId === subCategoryId) &&
      (!programTypeId || a.programTypeId === programTypeId) &&
      (!state || a.state === state) &&
      (!cutoff || (a.submittedOn ?? '') >= cutoff),
  );
  const programs = db.programs.filter(
    (p) =>
      (!categoryId || p.categoryId === categoryId) &&
      (!subCategoryId || p.subCategoryId === subCategoryId) &&
      (!programTypeId || p.programTypeId === programTypeId) &&
      (!agencyId || p.agencyId === agencyId) &&
      (!mode || p.mode === mode) &&
      (!state || p.state === state) &&
      (!cutoff || p.startDate >= cutoff),
  );
  const approved = applications.filter((a) => a.status === 'Approved' || a.status === 'Enrolled');
  const conducted = programs.filter((p) => p.status === 'Conducted');
  const participants = programs.flatMap((p) => p.participants);
  const trainedCount = conducted.reduce(
    (sum, p) => sum + p.participants.filter((x) => x.result === 'Pass').length,
    0,
  );

  /* Same five figures, in the same order and wording, as the API returns. */
  const kpis: DashboardKpi[] = [
    { key: 'applications', label: 'Applications received', value: applications.length, tone: 'primary', icon: 'inbox' },
    { key: 'approved', label: 'Approved applications', value: approved.length, tone: 'success', icon: 'check' },
    { key: 'programs', label: 'Programs conducted', value: conducted.length, tone: 'info', icon: 'calendar' },
    { key: 'participated', label: 'Candidates participated', value: participants.length, tone: 'primary', icon: 'users' },
    { key: 'certified', label: 'Candidates certified', value: trainedCount, tone: 'success', icon: 'award' },
  ];

  /* Counted over the same participant rows as the headline above, so the mock
     cannot disagree with itself any more than the API can. */
  const profileOf = <T extends string>(options: readonly T[], of: (a: Applicant) => T | undefined) => {
    const people = participants
      .map((x) => db.applicants.find((a) => a.id === x.applicantId))
      .filter((a): a is Applicant => !!a);
    const points: SeriesPoint[] = options.map((option) => ({
      label: option === 'Other' ? 'Others' : option,
      value: people.filter((a) => of(a) === option).length,
    }));
    const unstated = people.filter((a) => !of(a)).length;
    return unstated > 0 ? [...points, { label: 'Not stated', value: unstated }] : points;
  };

  /* Newest month first over a two year lookback, matching the API. */
  const programsByMonth: SeriesPoint[] = Array.from({ length: 24 }, (_, back) => {
    const when = new Date();
    when.setDate(1);
    when.setMonth(when.getMonth() - back);
    const stamp = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`;
    return {
      label: `${MONTH_LABELS[when.getMonth()]} ${String(when.getFullYear()).slice(2)}`,
      value: programs.filter((p) => p.startDate.slice(0, 7) === stamp).length,
    };
  });

  return {
    kpis,
    programsByMonth,
    participantsByGender: profileOf(APPLICANT_GENDERS, (a) => a.gender),
    participantsBySocialCategory: profileOf(APPLICANT_SOCIAL_CATEGORIES, (a) => a.socialCategory),
  };
}
