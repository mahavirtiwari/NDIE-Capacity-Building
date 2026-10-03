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
    label: 'Delivery',
    items: [
      { label: 'Programs', route: '/operations/programs', icon: 'calendar', permissions: ['programs.view'] },
      { label: 'Applicants', route: '/admin/applicants', icon: 'graduation', permissions: ['applications.view'] },
      { label: 'Profile scrutiny', route: '/admin/profile-scrutiny', icon: 'user-check', permissions: ['applications.view'] },
      { label: 'Applications', route: '/admin/applications', icon: 'inbox', permissions: ['applications.view'] },
      { label: 'Qualified professionals', route: '/admin/qualified-professionals', icon: 'award', permissions: ['professionals.view'] },
    ],
  },
  {
    label: 'People and access',
    items: [
      { label: 'Portal users', route: '/access/users', icon: 'users', permissions: ['users.view'] },
      { label: 'Roles & permissions', route: '/access/roles', icon: 'shield', permissions: ['roles.view'] },
      { label: 'Implementing agencies', route: '/admin/agencies', icon: 'building', permissions: ['agencies.view'] },
      { label: 'Coordinators', route: '/operations/coordinators', icon: 'user-check', permissions: ['coordinators.view'] },
    ],
  },
  {
    label: 'Reports',
    items: [
      { label: 'View reports', route: '/reports', icon: 'file', permissions: ['reports.view'] },
      { label: 'Trainers', route: '/trainers', icon: 'user-check', permissions: ['trainers.view'] },
    ],
  },
  /*
   * The masters are the Super Admin's, so their editors are gated on the
   * manage permission rather than on view. Admin and the Operation Manager
   * keep masters.view — Profile scrutiny reads the profile form definition
   * through it to render an applicant's answers, and every picker on their
   * own screens depends on it. What they lose is the editor in the sidebar,
   * not the ability to see the data where it is actually used.
   */
  {
    label: 'Program setup',
    items: [
      { label: 'Categories', route: '/masters/categories', icon: 'folder', permissions: ['masters.manage'] },
      { label: 'Sub-categories', route: '/masters/sub-categories', icon: 'tag', permissions: ['masters.manage'] },
      { label: 'Program types', route: '/masters/program-types', icon: 'layers', permissions: ['masters.manage'] },
      { label: 'Sign-up form', route: '/academics/signup-form', icon: 'form', permissions: ['masters.manage'] },
      { label: 'Profile forms', route: '/academics/profile-forms', icon: 'form', permissions: ['masters.manage'] },
      { label: 'Feedback forms', route: '/academics/feedback-forms', icon: 'clipboard', permissions: ['curriculum.manage'] },
      { label: 'Fee structures', route: '/academics/fees', icon: 'rupee', permissions: ['fees.view'] },
      { label: 'Choice lists', route: '/masters/option-sets', icon: 'form', permissions: ['masters.manage'] },
      { label: 'Qualifications', route: '/masters/qualifications', icon: 'book', permissions: ['masters.manage'] },
      { label: 'Evaluation Skills', route: '/masters/evaluation-skills', icon: 'clipboard', permissions: ['masters.manage'] },
      { label: 'Curriculum', route: '/academics/curriculum', icon: 'book', permissions: ['curriculum.manage'] },
      { label: 'Exam papers', route: '/academics/exam-papers', icon: 'clipboard', permissions: ['exams.view'] },
      { label: 'Training material', route: '/academics/materials', icon: 'video', permissions: ['materials.view'] },
    ],
  },
  {
    label: 'Configuration',
    items: [
      { label: 'Branding', route: '/access/branding', icon: 'settings', permissions: ['settings.manage'] },
      { label: 'Site text', route: '/access/site-text', icon: 'form', permissions: ['settings.manage'] },
      { label: 'Email', route: '/access/email', icon: 'mail', permissions: ['settings.manage'] },
      { label: 'System settings', route: '/access/system-settings', icon: 'settings', permissions: ['settings.manage'] },
    ],
  },
];
