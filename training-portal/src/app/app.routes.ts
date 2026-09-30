import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    /* The public batch listing — the page an agency points people at. No guard:
       somebody choosing a programme has no account yet. */
    path: 'programmes',
    title: 'Training programs · CBMS',
    loadComponent: () =>
      import('./features/public/programme-list.component').then((m) => m.ProgrammeListComponent),
  },
  {
    /* The shareable registration link. Public on purpose — no guard — so a
       batch can be advertised to people who have no account yet. */
    path: 'p/:code',
    title: 'Training batch · CBMS',
    loadComponent: () =>
      import('./features/public/programme-link.component').then((m) => m.ProgrammeLinkComponent),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · CBMS',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    title: 'Reset password · CBMS',
    loadComponent: () =>
      import('./features/auth/forgot-password.component').then((m) => m.ForgotPasswordComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · CBMS',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },

      {
        path: 'reports',
        title: 'View reports · CBMS',
        canActivate: [permissionGuard('reports.view')],
        loadComponent: () =>
          import('./features/reports/reports.component').then((m) => m.ReportsComponent),
      },

      {
        path: 'trainers',
        title: 'Trainers · CBMS',
        canActivate: [permissionGuard('trainers.view')],
        loadComponent: () =>
          import('./features/reports/trainers.component').then((m) => m.TrainersComponent),
      },

      /* ---------------- Programme setup (Super Admin) ---------------- */
      {
        path: 'masters',
        canActivate: [permissionGuard('masters.view')],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'categories' },
          {
            path: 'categories',
            title: 'Categories · CBMS',
            loadComponent: () =>
              import('./features/masters/categories.component').then((m) => m.CategoriesComponent),
          },
          {
            path: 'sub-categories',
            title: 'Sub-categories · CBMS',
            loadComponent: () =>
              import('./features/masters/sub-categories.component').then(
                (m) => m.SubCategoriesComponent,
              ),
          },
          {
            path: 'program-types',
            title: 'Program types · CBMS',
            loadComponent: () =>
              import('./features/masters/program-types.component').then(
                (m) => m.ProgramTypesComponent,
              ),
          },
          {
            path: 'qualifications',
            title: 'Qualifications · CBMS',
            loadComponent: () =>
              import('./features/masters/qualifications.component').then(
                (m) => m.QualificationsComponent,
              ),
          },
          {
            path: 'evaluation-skills',
            title: 'Evaluation skills · CBMS',
            loadComponent: () =>
              import('./features/masters/evaluation-skills.component').then(
                (m) => m.EvaluationSkillsComponent,
              ),
          },
        ],
      },

      /* ---------------- Academics ---------------- */
      {
        path: 'academics',
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'curriculum' },
          {
            path: 'curriculum',
            title: 'Curriculum · CBMS',
            canActivate: [permissionGuard('curriculum.view')],
            loadComponent: () =>
              import('./features/academics/curriculum.component').then((m) => m.CurriculumComponent),
          },
          {
            path: 'curriculum/:id',
            title: 'Curriculum sessions · CBMS',
            canActivate: [permissionGuard('curriculum.view')],
            loadComponent: () =>
              import('./features/academics/curriculum-sessions.component').then(
                (m) => m.CurriculumSessionsComponent,
              ),
          },
          {
            path: 'profile-forms',
            title: 'Profile forms · CBMS',
            canActivate: [permissionGuard('masters.view')],
            loadComponent: () =>
              import('./features/academics/profile-forms.component').then(
                (m) => m.ProfileFormsComponent,
              ),
          },
          {
            path: 'signup-form',
            title: 'Applicant sign-up form · CBMS',
            canActivate: [permissionGuard('masters.view')],
            loadComponent: () =>
              import('./features/academics/signup-form.component').then(
                (m) => m.SignupFormComponent,
              ),
          },
          {
            path: 'fees',
            title: 'Fee structures · CBMS',
            canActivate: [permissionGuard('fees.view')],
            loadComponent: () => import('./features/academics/fees.component').then((m) => m.FeesComponent),
          },
          {
            path: 'exam-papers',
            title: 'Exam papers · CBMS',
            canActivate: [permissionGuard('exams.view')],
            loadComponent: () =>
              import('./features/academics/exam-papers.component').then((m) => m.ExamPapersComponent),
          },
          {
            path: 'materials',
            title: 'Training material · CBMS',
            canActivate: [permissionGuard('materials.view')],
            loadComponent: () =>
              import('./features/academics/materials.component').then((m) => m.MaterialsComponent),
          },
        ],
      },

      /* ---------------- Access control ---------------- */
      {
        path: 'access',
        children: [
          {
            path: 'roles',
            title: 'Roles & permissions · CBMS',
            canActivate: [permissionGuard('roles.view')],
            loadComponent: () => import('./features/access/roles.component').then((m) => m.RolesComponent),
          },
          {
            path: 'users',
            title: 'Portal users · CBMS',
            canActivate: [permissionGuard('users.view')],
            data: { scope: 'all' },
            loadComponent: () => import('./features/access/users.component').then((m) => m.UsersComponent),
          },
          {
            path: 'branding',
            title: 'Branding · CBMS',
            canActivate: [permissionGuard('settings.manage')],
            loadComponent: () =>
              import('./features/access/branding.component').then((m) => m.BrandingComponent),
          },
          {
            path: 'system-settings',
            title: 'System settings · CBMS',
            canActivate: [permissionGuard('settings.manage')],
            loadComponent: () =>
              import('./features/access/system-settings.component').then(
                (m) => m.SystemSettingsComponent,
              ),
          },
          {
            path: 'site-text',
            title: 'Site text · CBMS',
            canActivate: [permissionGuard('settings.manage')],
            loadComponent: () =>
              import('./features/access/site-text.component').then((m) => m.SiteTextComponent),
          },
          {
            path: 'email',
            title: 'Email · CBMS',
            canActivate: [permissionGuard('settings.manage')],
            loadComponent: () =>
              import('./features/access/email.component').then((m) => m.EmailSettingsComponent),
          },
        ],
      },

      /* ---------------- Administration ---------------- */
      {
        path: 'admin',
        children: [
          {
            path: 'agencies',
            title: 'Implementing agencies · CBMS',
            canActivate: [permissionGuard('agencies.view')],
            loadComponent: () => import('./features/admin/agencies.component').then((m) => m.AgenciesComponent),
          },
          {
            path: 'applicants',
            title: 'Applicants · CBMS',
            canActivate: [permissionGuard('applications.view')],
            loadComponent: () => import('./features/admin/applicants.component').then((m) => m.ApplicantsComponent),
          },
          {
            path: 'qualified-professionals',
            title: 'Qualified professionals · CBMS',
            canActivate: [permissionGuard('professionals.view')],
            loadComponent: () =>
              import('./features/admin/qualified-professionals.component').then(
                (m) => m.QualifiedProfessionalsComponent,
              ),
          },
          {
            path: 'applications',
            title: 'Application scrutiny · CBMS',
            canActivate: [permissionGuard('applications.view')],
            loadComponent: () =>
              import('./features/admin/applications.component').then((m) => m.ApplicationsComponent),
          },
          {
            path: 'applications/:id',
            title: 'Application · CBMS',
            canActivate: [permissionGuard('applications.view')],
            loadComponent: () =>
              import('./features/admin/application-detail.component').then(
                (m) => m.ApplicationDetailComponent,
              ),
          },
        ],
      },

      /* ---------------- Operations ---------------- */
      {
        path: 'operations',
        children: [
          {
            path: 'coordinators',
            title: 'Coordinators · CBMS',
            canActivate: [permissionGuard('coordinators.view')],
            data: { scope: 'coordinators' },
            loadComponent: () => import('./features/access/users.component').then((m) => m.UsersComponent),
          },
          {
            path: 'programs',
            title: 'Programs · CBMS',
            canActivate: [permissionGuard('programs.view')],
            loadComponent: () =>
              import('./features/operations/programs.component').then((m) => m.ProgramsComponent),
          },
          {
            path: 'programs/:id',
            title: 'Program · CBMS',
            canActivate: [permissionGuard('programs.view')],
            loadComponent: () =>
              import('./features/operations/program-detail.component').then(
                (m) => m.ProgramDetailComponent,
              ),
          },
        ],
      },

      {
        path: 'profile',
        title: 'My profile · CBMS',
        loadComponent: () => import('./features/misc/profile.component').then((m) => m.ProfileComponent),
      },

      { path: 'forbidden', loadComponent: () => import('./features/misc/forbidden.component').then((m) => m.ForbiddenComponent) },
      { path: '**', loadComponent: () => import('./features/misc/not-found.component').then((m) => m.NotFoundComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
