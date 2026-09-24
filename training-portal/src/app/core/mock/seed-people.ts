import {
  ALL_PERMISSIONS,
  APPLICANT_GENDERS,
  APPLICANT_SOCIAL_CATEGORIES,
  AdminRole,
  Applicant,
  LGD_STATES,
  Permission,
  PortalUser,
  districtsOfState,
} from '../models';
import { AGENCIES, PROGRAM_TYPES, SUB_CATEGORIES } from './seed-masters';

export const ROLES: AdminRole[] = [
  {
    id: 1,
    name: 'Super Admin',
    code: 'SUPER_ADMIN',
    baseRole: 'SuperAdmin',
    description: 'Full control over masters, curriculum, fee, exams and material.',
    permissions: ALL_PERMISSIONS,
    isSystemRole: true,
    status: 'Active',
  },
  {
    id: 2,
    name: 'Admin',
    code: 'ADMIN',
    baseRole: 'Admin',
    description: 'Creates implementing agencies and operation managers, scrutinises applications.',
    permissions: [
      'masters.view', 'curriculum.view', 'fees.view', 'exams.view', 'materials.view',
      'agencies.view', 'agencies.manage', 'users.view', 'users.manage',
      'applications.view', 'applications.scrutinise', 'programs.view', 'reports.view',
    ],
    isSystemRole: true,
    status: 'Active',
  },
  {
    id: 3,
    name: 'Operation Manager',
    code: 'OPS_MANAGER',
    baseRole: 'OperationManager',
    description: 'Adds coordinators and oversees programs within the assigned master scope.',
    permissions: [
      'masters.view', 'curriculum.view', 'materials.view', 'applications.view',
      'programs.view', 'programs.manage', 'coordinators.view', 'coordinators.manage',
      'reports.view',
    ],
    isSystemRole: true,
    status: 'Active',
  },
  {
    id: 4,
    name: 'Coordinator',
    code: 'COORDINATOR',
    baseRole: 'Coordinator',
    description: 'Captures programs conducted physically or virtually and marks attendance.',
    permissions: ['programs.view', 'programs.manage', 'materials.view'],
    isSystemRole: true,
    status: 'Active',
  },
  {
    id: 5,
    name: 'Scrutiny Officer',
    code: 'SCRUTINY_OFFICER',
    baseRole: 'Admin',
    description: 'Custom role limited to application scrutiny and reporting.',
    permissions: ['applications.view', 'applications.scrutinise', 'reports.view', 'masters.view'],
    isSystemRole: false,
    status: 'Active',
  },
  {
    id: 6,
    name: 'Content Manager',
    code: 'CONTENT_MANAGER',
    baseRole: 'Admin',
    description: 'Custom role for curriculum, exam paper and training material upkeep.',
    permissions: [
      'curriculum.view', 'curriculum.manage', 'exams.view', 'exams.manage',
      'materials.view', 'materials.manage', 'masters.view',
    ],
    isSystemRole: false,
    status: 'Inactive',
  },
];

interface UserSeed {
  id: number;
  name: string;
  roleId: number;
  base: PortalUser['baseRole'];
  cats: number[];
  subs: number[];
  pts: number[];
  agencyId?: number | null;
  reportsTo?: number | null;
  designation: string;
  state: string;
  city: string;
}

const USER_SEED: UserSeed[] = [
  { id: 1, name: 'Arvind Kulkarni', roleId: 1, base: 'SuperAdmin', cats: [], subs: [], pts: [], designation: 'Director (Training)', state: 'DELHI', city: 'New Delhi' },
  { id: 2, name: 'Meera Iyer', roleId: 2, base: 'Admin', cats: [1, 2], subs: [1, 2, 3, 4, 5], pts: [1, 2, 3, 4, 5, 6], designation: 'Joint Director', state: 'DELHI', city: 'New Delhi' },
  { id: 3, name: 'Rakesh Sahu', roleId: 2, base: 'Admin', cats: [3, 4], subs: [6, 7, 8, 9], pts: [7, 8, 9, 10], designation: 'Deputy Director', state: 'MAHARASHTRA', city: 'Mumbai' },
  { id: 4, name: 'Neha Bansal', roleId: 5, base: 'Admin', cats: [1], subs: [1, 2, 3], pts: [1, 2, 3, 4], designation: 'Scrutiny Officer', state: 'DELHI', city: 'New Delhi' },
  { id: 5, name: 'Suresh Pillai', roleId: 3, base: 'OperationManager', cats: [1], subs: [1, 2], pts: [1, 2], agencyId: 1, reportsTo: 2, designation: 'Operations Manager - North', state: 'DELHI', city: 'New Delhi' },
  { id: 6, name: 'Kavitha Rao', roleId: 3, base: 'OperationManager', cats: [1], subs: [3], pts: [3, 4], agencyId: 1, reportsTo: 2, designation: 'Operations Manager - Gold track', state: 'KARNATAKA', city: 'Bengaluru' },
  { id: 7, name: 'Imran Shaikh', roleId: 3, base: 'OperationManager', cats: [2], subs: [4, 5], pts: [5, 6], agencyId: 3, reportsTo: 2, designation: 'Operations Manager - Lean', state: 'TAMIL NADU', city: 'Chennai' },
  { id: 8, name: 'Deepa Nair', roleId: 3, base: 'OperationManager', cats: [3], subs: [6, 7], pts: [7, 8], agencyId: 4, reportsTo: 3, designation: 'Operations Manager - Digital', state: 'KERALA', city: 'Kochi' },
  { id: 9, name: 'Vikram Chauhan', roleId: 3, base: 'OperationManager', cats: [4], subs: [8, 9], pts: [9, 10], agencyId: 5, reportsTo: 3, designation: 'Operations Manager - ESD', state: 'GUJARAT', city: 'Ahmedabad' },
  { id: 10, name: 'Pooja Mishra', roleId: 4, base: 'Coordinator', cats: [1], subs: [1, 2], pts: [1, 2], agencyId: 1, reportsTo: 5, designation: 'Program Coordinator', state: 'UTTAR PRADESH', city: 'Lucknow' },
  { id: 11, name: 'Sandeep Yadav', roleId: 4, base: 'Coordinator', cats: [1], subs: [1], pts: [1], agencyId: 6, reportsTo: 5, designation: 'Program Coordinator', state: 'UTTAR PRADESH', city: 'Kanpur' },
  { id: 12, name: 'Ritu Malhotra', roleId: 4, base: 'Coordinator', cats: [1], subs: [3], pts: [3, 4], agencyId: 1, reportsTo: 6, designation: 'Program Coordinator', state: 'KARNATAKA', city: 'Bengaluru' },
  { id: 13, name: 'Manoj Gowda', roleId: 4, base: 'Coordinator', cats: [2], subs: [4], pts: [5], agencyId: 3, reportsTo: 7, designation: 'Program Coordinator', state: 'TAMIL NADU', city: 'Coimbatore' },
  { id: 14, name: 'Farhan Qureshi', roleId: 4, base: 'Coordinator', cats: [2], subs: [5], pts: [6], agencyId: 2, reportsTo: 7, designation: 'Program Coordinator', state: 'MAHARASHTRA', city: 'Pune' },
  { id: 15, name: 'Lakshmi Menon', roleId: 4, base: 'Coordinator', cats: [3], subs: [6, 7], pts: [7, 8], agencyId: 4, reportsTo: 8, designation: 'Program Coordinator', state: 'KERALA', city: 'Thiruvananthapuram' },
  { id: 16, name: 'Alok Trivedi', roleId: 4, base: 'Coordinator', cats: [4], subs: [8], pts: [9], agencyId: 5, reportsTo: 9, designation: 'Program Coordinator', state: 'GUJARAT', city: 'Surat' },
];

const roleName = (id: number) => ROLES.find((r) => r.id === id)?.name ?? '';
const agencyName = (id?: number | null) => AGENCIES.find((a) => a.id === id)?.name;

export const PORTAL_USERS: PortalUser[] = USER_SEED.map((u) => ({
  id: u.id,
  userCode: `${u.base === 'SuperAdmin' ? 'SA' : u.base === 'Admin' ? 'AD' : u.base === 'OperationManager' ? 'OM' : 'CO'}${String(u.id).padStart(4, '0')}`,
  fullName: u.name,
  email: `${u.name.toLowerCase().replace(/[^a-z]+/g, '.')}@msme.gov.in`,
  mobile: `9${String(700000000 + u.id * 1234567).slice(0, 9)}`,
  designation: u.designation,
  roleId: u.roleId,
  roleName: roleName(u.roleId),
  baseRole: u.base,
  categoryIds: u.cats,
  subCategoryIds: u.subs,
  programTypeIds: u.pts,
  /* The sample data predates state and district allocation; left empty so the
     mock mirrors a freshly created account that has not been allocated yet. */
  stateCodes: [],
  districtCodes: [],
  agencyId: u.agencyId ?? null,
  agencyName: agencyName(u.agencyId),
  reportsToUserId: u.reportsTo ?? null,
  reportsToName: USER_SEED.find((x) => x.id === u.reportsTo)?.name,
  state: u.state,
  city: u.city,
  lastLoginOn: `2026-09-${String(10 + (u.id % 12)).padStart(2, '0')}T09:${String(10 + u.id).padStart(2, '0')}:00`,
  status: u.id === 16 ? 'Inactive' : 'Active',
  createdBy: 'Super Admin',
  createdOn: '2025-04-10T10:00:00',
}));

/** Credentials accepted by the mock login endpoint. */
export const DEMO_CREDENTIALS: { username: string; password: string; userId: number }[] =
  PORTAL_USERS.map((u) => ({ username: u.userCode, password: 'Password@123', userId: u.id }));

export const DEFAULT_PERMISSIONS_FOR: Record<string, Permission[]> = Object.fromEntries(
  ROLES.map((r) => [r.code, r.permissions]),
);

/* ------------------------------------------------------------------ */
/* Applicants                                                          */
/* ------------------------------------------------------------------ */

const FIRST_NAMES = ['Aarav', 'Ishita', 'Rohan', 'Sneha', 'Kabir', 'Ananya', 'Vivek', 'Divya', 'Nikhil', 'Pallavi', 'Arjun', 'Swati', 'Rahul', 'Meghna', 'Siddharth', 'Tanvi', 'Karan', 'Shreya', 'Amit', 'Nandini'];
const LAST_NAMES = ['Sharma', 'Patel', 'Reddy', 'Banerjee', 'Joshi', 'Kulkarni', 'Nair', 'Gupta', 'Das', 'Chopra'];


/** Pick a real LGD state and one of its own districts so the pair is valid. */
function placeFor(index: number): { state: string; district: string } {
  const state = LGD_STATES[index % LGD_STATES.length];
  const districts = districtsOfState(state.code);
  return {
    state: state.name,
    district: districts.length ? districts[index % districts.length].name : state.name,
  };
}

function pan(i: number): string {
  const l = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const pick = (n: number) => l[n % l.length];
  return `${pick(i)}${pick(i + 3)}${pick(i + 7)}P${pick(i + 11)}${String(1000 + ((i * 787) % 9000))}${pick(i + 5)}`;
}

export const APPLICANTS: Applicant[] = Array.from({ length: 48 }, (_, idx) => {
  const i = idx + 1;
  const first = FIRST_NAMES[idx % FIRST_NAMES.length];
  const last = LAST_NAMES[(idx * 3) % LAST_NAMES.length];
  const sub = SUB_CATEGORIES[idx % SUB_CATEGORIES.length];
  return {
    id: i,
    applicantCode: `APP${String(240000 + i)}`,
    fullName: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
    mobile: `9${String(810000000 + i * 12345).slice(0, 9)}`,
    pan: pan(i),
    /* Spread across the options so the dashboard profile charts have something
       to draw in the offline mock; the real figures come from the API. */
    gender: APPLICANT_GENDERS[idx % 3],
    socialCategory: APPLICANT_SOCIAL_CATEGORIES[idx % 4],
    categoryId: sub.categoryId,
    subCategoryId: sub.id,
    emailVerified: idx % 9 !== 0,
    mobileVerified: idx % 7 !== 0,
    kycStatus: idx % 5 === 0 ? 'Pending' : idx % 11 === 0 ? 'Rejected' : 'Verified',
    state: placeFor(idx).state,
    city: placeFor(idx).district,
    registeredOn: `2026-0${(idx % 8) + 1}-${String((idx % 27) + 1).padStart(2, '0')}T11:05:00`,
    lastLoginOn: `2026-09-${String((idx % 22) + 1).padStart(2, '0')}T18:40:00`,
    isBlocked: idx % 23 === 0,
  } satisfies Applicant;
});

export const PROGRAM_TYPE_IDS = PROGRAM_TYPES.map((p) => p.id);
