import { AppRole, Permission } from '../core/models';
import { IconName } from '../shared/components/icon.component';

export interface NavItem {
  label: string;
  route: string;
  icon: IconName;
  permissions?: Permission[];
  roles?: AppRole[];
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Overview',
    items: [{ label: 'Dashboard', route: '/dashboard', icon: 'dashboard' }],
  },
  {
    label: 'Programme setup',
    items: [
      { label: 'Categories', route: '/masters/categories', icon: 'folder', permissions: ['masters.view'] },
      { label: 'Sub-categories', route: '/masters/sub-categories', icon: 'tag', permissions: ['masters.view'] },
      { label: 'Program types', route: '/masters/program-types', icon: 'layers', permissions: ['masters.view'] },
      { label: 'Evaluation Skills', route: '/masters/evaluation-skills', icon: 'clipboard', permissions: ['masters.view'] },
      { label: 'Curriculum', route: '/academics/curriculum', icon: 'book', permissions: ['curriculum.view'] },
      { label: 'Registration forms', route: '/academics/registration-forms', icon: 'form', permissions: ['masters.view'] },
      { label: 'Fee structures', route: '/academics/fees', icon: 'rupee', permissions: ['fees.view'] },
      { label: 'Exam papers', route: '/academics/exam-papers', icon: 'clipboard', permissions: ['exams.view'] },
      { label: 'Training material', route: '/academics/materials', icon: 'video', permissions: ['materials.view'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Roles & permissions', route: '/access/roles', icon: 'shield', permissions: ['roles.view'] },
      { label: 'Portal users', route: '/access/users', icon: 'users', permissions: ['users.view'] },
      { label: 'Branding', route: '/access/branding', icon: 'settings', permissions: ['settings.manage'] },
      { label: 'Site text', route: '/access/site-text', icon: 'form', permissions: ['settings.manage'] },
      { label: 'Email', route: '/access/email', icon: 'mail', permissions: ['settings.manage'] },
      { label: 'Implementing agencies', route: '/admin/agencies', icon: 'building', permissions: ['agencies.view'] },
      { label: 'Sign-up form', route: '/academics/signup-form', icon: 'form', permissions: ['masters.view'] },
      { label: 'Applicants', route: '/admin/applicants', icon: 'graduation', permissions: ['applications.view'] },
      { label: 'Application scrutiny', route: '/admin/applications', icon: 'inbox', permissions: ['applications.view'] },
    ],
  },
  {
    label: 'Operations',
    items: [
      { label: 'Coordinators', route: '/operations/coordinators', icon: 'user-check', permissions: ['coordinators.view'] },
      { label: 'Programs', route: '/operations/programs', icon: 'calendar', permissions: ['programs.view'] },
    ],
  },
];
