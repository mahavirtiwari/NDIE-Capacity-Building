import {
  AgencyType,
  LGD_STATES,
  Category,
  DeliveryMode,
  ImplementingAgency,
  ProgramType,
  SubCategory,
} from '../models';

/** Display list of state names, straight from the LGD master. */
export const STATES: string[] = LGD_STATES.map((s) => s.name);

export const CATEGORIES: Category[] = [
  { id: 1, code: 'ZED', name: 'ZED Certification', description: 'Zero Defect Zero Effect certification ecosystem for MSMEs.', displayOrder: 1, status: 'Active' },
  { id: 2, code: 'LMC', name: 'Lean Manufacturing Competitiveness', description: 'Lean tools and productivity improvement for manufacturing clusters.', displayOrder: 2, status: 'Active' },
  { id: 3, code: 'DGM', name: 'Digital MSME', description: 'Cloud, ERP and cyber security adoption programs.', displayOrder: 3, status: 'Active' },
  { id: 4, code: 'ESD', name: 'Entrepreneurship & Skill Development', description: 'Entrepreneurship development and skill upgradation programs.', displayOrder: 4, status: 'Active' },
];

export const SUB_CATEGORIES: SubCategory[] = [
  { id: 1, categoryId: 1, code: 'ZED-BRZ', name: 'Bronze', description: 'Entry level ZED maturity.', displayOrder: 1, status: 'Active' },
  { id: 2, categoryId: 1, code: 'ZED-SLV', name: 'Silver', description: 'Intermediate ZED maturity.', displayOrder: 2, status: 'Active' },
  { id: 3, categoryId: 1, code: 'ZED-GLD', name: 'Gold', description: 'Highest ZED maturity level.', displayOrder: 3, status: 'Active' },
  { id: 4, categoryId: 2, code: 'LMC-BAS', name: 'Basic Level', description: 'Foundation lean interventions.', displayOrder: 1, status: 'Active' },
  { id: 5, categoryId: 2, code: 'LMC-ADV', name: 'Advanced Level', description: 'Advanced lean and TPM interventions.', displayOrder: 2, status: 'Active' },
  { id: 6, categoryId: 3, code: 'DGM-CLD', name: 'Cloud & ERP Adoption', description: 'Cloud migration and ERP rollout for small units.', displayOrder: 1, status: 'Active' },
  { id: 7, categoryId: 3, code: 'DGM-CYB', name: 'Cyber Security', description: 'Cyber hygiene and security assessment.', displayOrder: 2, status: 'Active' },
  { id: 8, categoryId: 4, code: 'ESD-EDP', name: 'Entrepreneurship Development', description: 'EDP for first generation entrepreneurs.', displayOrder: 1, status: 'Active' },
  { id: 9, categoryId: 4, code: 'ESD-SKL', name: 'Skill Upgradation', description: 'Shop floor skill upgradation.', displayOrder: 2, status: 'Inactive' },
];

interface PtSeed {
  id: number;
  categoryId: number;
  subCategoryId: number;
  code: string;
  name: string;
  days: number;
  mode: DeliveryMode;
  exp: number;
  qual: string;
  exam: boolean;
  fee: boolean;
  desc: string;
}

const PT_SEED: PtSeed[] = [
  { id: 1, categoryId: 1, subCategoryId: 1, code: 'ZED-MT-B', name: 'Master Trainer - Bronze', days: 5, mode: 'Hybrid', exp: 5, qual: 'DIPLOMA', exam: true, fee: true, desc: 'Prepares experienced professionals to deliver ZED Bronze awareness and hand-holding sessions.' },
  { id: 2, categoryId: 1, subCategoryId: 2, code: 'ZED-AS-S', name: 'Assessor - Silver', days: 7, mode: 'Physical', exp: 7, qual: 'GRADUATION', exam: true, fee: true, desc: 'Certifies assessors to carry out on-site ZED Silver assessments of MSME units.' },
  { id: 3, categoryId: 1, subCategoryId: 3, code: 'ZED-CN-G', name: 'Consultant - Gold', days: 10, mode: 'Hybrid', exp: 10, qual: 'POST_GRADUATION', exam: true, fee: true, desc: 'Builds consultants capable of guiding units through the ZED Gold maturity journey.' },
  { id: 4, categoryId: 1, subCategoryId: 3, code: 'ZED-MT-G', name: 'Master Trainer - Gold', days: 8, mode: 'Physical', exp: 8, qual: 'GRADUATION', exam: true, fee: true, desc: 'Advanced train-the-trainer track for ZED Gold parameters.' },
  { id: 5, categoryId: 2, subCategoryId: 4, code: 'LMC-CN-B', name: 'Lean Consultant - Basic', days: 6, mode: 'Physical', exp: 4, qual: 'DIPLOMA', exam: true, fee: true, desc: 'Covers 5S, Kaizen, visual control and basic value stream mapping.' },
  { id: 6, categoryId: 2, subCategoryId: 5, code: 'LMC-MT-A', name: 'Lean Master Trainer - Advanced', days: 12, mode: 'Hybrid', exp: 8, qual: 'GRADUATION', exam: true, fee: true, desc: 'TPM, SMED, TOC and advanced lean deployment for cluster level interventions.' },
  { id: 7, categoryId: 3, subCategoryId: 6, code: 'DGM-TR-C', name: 'Digital Transformation Trainer', days: 5, mode: 'Virtual', exp: 3, qual: 'GRADUATION', exam: true, fee: false, desc: 'Cloud readiness, ERP selection and digital adoption roadmaps for MSMEs.' },
  { id: 8, categoryId: 3, subCategoryId: 7, code: 'DGM-AS-CY', name: 'Cyber Security Assessor', days: 6, mode: 'Virtual', exp: 5, qual: 'GRADUATION', exam: true, fee: true, desc: 'Cyber hygiene assessment methodology and reporting for small enterprises.' },
  { id: 9, categoryId: 4, subCategoryId: 8, code: 'ESD-FAC', name: 'EDP Facilitator', days: 4, mode: 'Physical', exp: 2, qual: 'GRADUATION', exam: false, fee: false, desc: 'Facilitator track for entrepreneurship development programs in districts.' },
  { id: 10, categoryId: 4, subCategoryId: 9, code: 'ESD-TOT', name: 'Trainer of Trainers', days: 5, mode: 'Hybrid', exp: 3, qual: 'GRADUATION', exam: true, fee: false, desc: 'Pedagogy, adult learning and assessment design for skill trainers.' },
];

export const PROGRAM_TYPES: ProgramType[] = PT_SEED.map((p) => ({
  id: p.id,
  categoryId: p.categoryId,
  subCategoryId: p.subCategoryId,
  code: p.code,
  name: p.name,
  shortDescription: p.desc,
  durationDays: p.days,
  deliveryMode: p.mode,
  minQualification: p.qual,
  minExperienceYears: p.exp,
  certificateValidityMonths: 36,
  isExamMandatory: p.exam,
  isFeeApplicable: p.fee,
  /* A spread across the policies so the offline mock exercises each branch:
     an exam-bearing programme certifies and also gives participation, one
     without an exam gives participation only. */
  certificationPolicy: p.exam ? 'QualificationAndParticipation' : 'ParticipationOnly',
  certificateKinds: p.exam ? ['Qualification', 'Participation'] : ['Participation'],
  certificateTemplates: [],
  /* Mirrors the spread above: an examined track is marked out of 100 across a
     written paper and a viva, one without an exam is marked out of nothing. */
  evaluation: p.exam
    ? {
        kind: 'WrittenAndViva',
        kindLabel: 'Written and viva / practical',
        totalMarks: 100,
        writtenMarks: 70,
        vivaMarks: 30,
        writtenPassMarks: 28,
        vivaPassMarks: 12,
        overallPassMarks: 40,
        hasWritten: true,
        hasViva: true,
      }
    : {
        kind: 'None',
        kindLabel: 'No examination',
        totalMarks: 0,
        writtenMarks: 0,
        vivaMarks: 0,
        writtenPassMarks: 0,
        vivaPassMarks: 0,
        overallPassMarks: 0,
        hasWritten: false,
        hasViva: false,
      },
  skillCount: 0,
  status: p.id === 10 ? 'Inactive' : 'Active',
}));

interface AgencySeed {
  id: number;
  code: string;
  name: string;
  type: AgencyType;
  person: string;
  city: string;
  state: string;
  cats: number[];
  subs: number[];
  pts: number[];
}

const AGENCY_SEED: AgencySeed[] = [
  { id: 1, code: 'QCI-DEL', name: 'Quality Council of India', type: 'Government Body', person: 'R. Narayanan', city: 'New Delhi', state: 'DELHI', cats: [1], subs: [1, 2, 3], pts: [1, 2, 3, 4] },
  { id: 2, code: 'NPC-MUM', name: 'National Productivity Council - West', type: 'Government Body', person: 'Shalini Deshpande', city: 'Mumbai', state: 'MAHARASHTRA', cats: [1, 2], subs: [1, 4, 5], pts: [1, 5, 6] },
  { id: 3, code: 'CII-CHE', name: 'CII Institute of Quality', type: 'Industry Association', person: 'K. Subramanian', city: 'Chennai', state: 'TAMIL NADU', cats: [2], subs: [4, 5], pts: [5, 6] },
  { id: 4, code: 'IITM-RP', name: 'IIT Madras Research Park', type: 'Academic Institute', person: 'Anita Raghavan', city: 'Chennai', state: 'TAMIL NADU', cats: [3], subs: [6, 7], pts: [7, 8] },
  { id: 5, code: 'EDII-AHM', name: 'Entrepreneurship Development Institute of India', type: 'Academic Institute', person: 'Praveen Mehta', city: 'Ahmedabad', state: 'GUJARAT', cats: [4], subs: [8, 9], pts: [9, 10] },
  { id: 6, code: 'MSME-DI-LKO', name: 'MSME Development Institute Lucknow', type: 'Government Body', person: 'Sunita Verma', city: 'Lucknow', state: 'UTTAR PRADESH', cats: [1, 4], subs: [1, 2, 8], pts: [1, 2, 9] },
];

export const AGENCIES: ImplementingAgency[] = AGENCY_SEED.map((a) => ({
  id: a.id,
  code: a.code,
  name: a.name,
  agencyType: a.type,
  contactPerson: a.person,
  email: `${a.code.toLowerCase().replace(/[^a-z]/g, '')}@agency.gov.in`,
  mobile: `98${String(10000000 + a.id * 137).slice(0, 8)}`,
  gstin: `27AABCU${9000 + a.id}L1Z${a.id}`,
  pan: `AABCU${9000 + a.id}L`,
  addressLine1: `Plot ${a.id * 11}, Industrial Estate`,
  city: a.city,
  state: a.state,
  stateCode: LGD_STATES.find((x) => x.name === a.state)?.code ?? 0,
  pincode: `${110000 + a.id * 137}`,
  categoryIds: a.cats,
  subCategoryIds: a.subs,
  programTypeIds: a.pts,
  categoryNames: a.cats
    .map((id) => CATEGORIES.find((c) => c.id === id)?.name ?? '')
    .filter(Boolean),
  programTypeNames: a.pts
    .map((id) => PROGRAM_TYPES.find((p) => p.id === id)?.name ?? '')
    .filter(Boolean),
  /* Sample data predates state allocation. */
  stateCodes: [],
  empanelledOn: '2024-04-01',
  empanelmentValidTill: '2027-03-31',
  status: 'Active' as const,
}));
