import {
  Curriculum,
  CurriculumSession,
  ExamPaper,
  ExamQuestion,
  FeeStructure,
  TdsRate,
  RegistrationField,
  RegistrationForm,
  RegistrationSection,
  TrainingMaterial,
} from '../models';
import { PROGRAM_TYPES } from './seed-masters';

/* ------------------------------------------------------------------ */
/* Curriculum - programme -> sessions -> topics                        */
/* ------------------------------------------------------------------ */

/** Day plan mirrored from the live register: registration, four sessions, close. */
const DAY_PLAN: string[] = ['Session 1', 'Session 2', 'Session 3', 'Session 4'];

function buildSessions(programmeCode: string, days: number, seed: number): CurriculumSession[] {
  const sessions: CurriculumSession[] = [];
  let index = 0;
  let topicId = seed * 1000;

  const push = (day: number, name: string, topics: string[]) => {
    index += 1;
    const sessionCode = `${programmeCode}/S${String(index).padStart(2, '0')}`;
    sessions.push({
      id: seed * 100 + index,
      sessionCode,
      sessionName: `Day ${day}: ${name}`,
      displayOrder: index,
      day,
      topics: topics.map((topicName, ti) => ({
        id: (topicId += 1),
        topicCode: `${sessionCode}/T${String(ti + 1).padStart(2, '0')}`,
        topicName,
        displayOrder: ti + 1,
        durationMinutes: 60,
      })),
    });
  };

  for (let day = 1; day <= days; day++) {
    push(day, day === 1 ? 'Registration' : 'Attendance', [day === 1 ? 'Registration' : 'Attendance']);
    if (day === 1) push(1, 'Participants Introduction', ['Participants Introduction']);
    for (const slot of DAY_PLAN) push(day, slot, [`Day ${day}: ${slot}`]);
    if (day === days) push(day, 'Vote of Thanks', ['Vote of Thanks', 'Group Picture']);
  }
  return sessions;
}

export const CURRICULA: Curriculum[] = PROGRAM_TYPES.map((pt, i) => {
  /* Session codes hang off the programme type's code, as they do on the server. */
  const programmeCode = pt.code;
  const days = Math.min(pt.durationDays, 5);
  return {
    id: i + 1,
    programTypeId: pt.id,
    programTypeCode: pt.code,
    programTypeName: pt.name,
    objective: `Equip participants to discharge the ${pt.name} role as per scheme guidelines.`,
    durationDays: days,
    effectiveFrom: '2025-04-01',
    status: pt.status,
    sessions: buildSessions(programmeCode, days, pt.id),
    createdBy: 'Super Admin',
    createdOn: '2025-03-12T10:20:00',
  } satisfies Curriculum;
});

/* ------------------------------------------------------------------ */
/* Applicant registration forms (dynamic, per program type)            */
/* ------------------------------------------------------------------ */

let fieldSeq = 0;
function field(
  partial: Partial<RegistrationField> & Pick<RegistrationField, 'key' | 'label' | 'type'>,
): RegistrationField {
  fieldSeq += 1;
  return {
    id: fieldSeq,
    displayOrder: fieldSeq,
    colSpan: 1,
    isEnabled: true,
    options: [],
    validation: { required: false },
    ...partial,
  };
}

const opts = (...labels: string[]) =>
  labels.map((label) => ({ value: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label }));

const ID_PROOF_TYPES = opts('Bank', 'PAN', 'Passport', 'Driving License', 'Election Card');
const LANGUAGES = opts('English', 'Hindi', 'Tamil', 'Telugu', 'Marathi', 'Gujarati', 'Bengali', 'Kannada');
const ZED_DISCIPLINES = opts(
  'A - Quality & Process',
  'B - Environment, Energy & Safety',
  'C - Management & Compliance',
);

/**
 * Baseline sections mirroring the live ZED Master Trainer / Assessor /
 * Consultant application form. Super Admin can enable, disable, extend or
 * replicate these per program type.
 */
function baseSections(): RegistrationSection[] {
  return [
    {
      id: 1,
      title: 'Applying for',
      description: 'Select every track you wish to be considered for.',
      displayOrder: 1,
      isEnabled: true,
      fields: [
        field({ key: 'applyMasterTrainer', label: 'Master Trainer', type: 'checkbox', helpText: 'Apply as a Master Trainer' }),
        field({ key: 'applyAssessor', label: 'ZED Assessor', type: 'checkbox', helpText: 'Apply as a ZED Assessor' }),
        field({ key: 'applyConsultant', label: 'ZED Consultant', type: 'checkbox', helpText: 'Apply as a ZED Consultant' }),
      ],
    },
    {
      id: 2,
      title: 'Photo & ID proof details',
      displayOrder: 2,
      isEnabled: true,
      fields: [
        field({ key: 'photo', label: 'Upload photo', type: 'file', helpText: 'Passport size, JPG or PNG up to 1 MB.', validation: { required: true, allowedExtensions: ['jpg', 'jpeg', 'png'], maxFileSizeMb: 1 } }),
        field({ key: 'idProofType', label: 'Document type', type: 'select', options: ID_PROOF_TYPES, validation: { required: true } }),
        field({ key: 'idProofNumber', label: 'Document number', type: 'text', validation: { required: true } }),
        field({ key: 'idProofName', label: 'Name as per document', type: 'text', validation: { required: true } }),
        field({ key: 'idProofFile', label: 'Upload ID proof', type: 'file', colSpan: 2, validation: { required: true, allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'], maxFileSizeMb: 2 } }),
      ],
    },
    {
      id: 3,
      title: 'Nomination',
      description: 'How the applicant is nominated for the program.',
      displayOrder: 3,
      isEnabled: true,
      fields: [
        field({ key: 'nominatedThrough', label: 'Nominated through', type: 'radio', colSpan: 2, options: opts('Certification Body (CB)', 'Credit Rating Agency (CRA)', 'Inspection Body (IB)', 'Freelancer', 'Consulting Organization'), validation: { required: true } }),
        field({ key: 'associatedWith', label: 'Associated with', type: 'radio', colSpan: 2, options: opts('Consulting Organization', 'Freelancer'), validation: { required: true } }),
        field({ key: 'nominatingBodyName', label: 'CB / IB / CRA name', type: 'text', colSpan: 2, visibleWhenFieldKey: 'associatedWith', visibleWhenValues: ['consulting-organization'] }),
        field({ key: 'coordinatorName', label: 'Coordinator name', type: 'text' }),
        field({ key: 'coordinatorEmail', label: 'Coordinator email', type: 'email' }),
        field({ key: 'coordinatorPhone', label: 'Coordinator phone', type: 'mobile' }),
      ],
    },
    {
      id: 4,
      title: 'Personal details',
      description: 'As printed on the ID proof submitted above.',
      displayOrder: 4,
      isEnabled: true,
      fields: [
        field({ key: 'firstName', label: 'First name', type: 'text', validation: { required: true, maxLength: 40 } }),
        field({ key: 'middleName', label: 'Middle name', type: 'text' }),
        field({ key: 'lastName', label: 'Last name', type: 'text', validation: { required: true, maxLength: 40 } }),
        field({ key: 'fatherName', label: "Father's name", type: 'text', validation: { required: true } }),
        field({ key: 'dateOfBirth', label: 'Date of birth', type: 'date', validation: { required: true } }),
        field({ key: 'gender', label: 'Gender', type: 'radio', options: opts('Male', 'Female', 'Other'), validation: { required: true } }),
        field({ key: 'pan', label: 'PAN', type: 'pan', validation: { required: true, pattern: '^[A-Z]{5}[0-9]{4}[A-Z]$' } }),
        field({ key: 'aadhaarNo', label: 'Aadhaar number', type: 'aadhaar', validation: { required: true, pattern: '^[0-9]{12}$' } }),
        field({ key: 'email', label: 'Email', type: 'email', helpText: 'Used for notifications. Can be changed later; it is not your login ID.', validation: { required: true } }),
        field({ key: 'mobileNo', label: 'Mobile number', type: 'mobile', validation: { required: true, pattern: '^[6-9][0-9]{9}$' } }),
        field({ key: 'street', label: 'Street / address', type: 'textarea', colSpan: 2, validation: { required: true, maxLength: 250 } }),
        field({ key: 'state', label: 'State', type: 'select', options: opts('Delhi', 'Maharashtra', 'Tamil Nadu', 'Gujarat', 'Karnataka', 'Uttar Pradesh'), validation: { required: true } }),
        field({ key: 'district', label: 'District', type: 'text', validation: { required: true } }),
        field({ key: 'city', label: 'City', type: 'text', validation: { required: true } }),
        field({ key: 'pinCode', label: 'Pincode', type: 'text', validation: { required: true, pattern: '^[1-9][0-9]{5}$' } }),
      ],
    },
    {
      id: 5,
      title: 'Language proficiency',
      displayOrder: 5,
      isEnabled: true,
      fields: [
        field({ key: 'spokenLanguagePrimary', label: 'Spoken language (primary)', type: 'select', options: LANGUAGES, validation: { required: true } }),
        field({ key: 'spokenLanguageOthers', label: 'Spoken language (others)', type: 'multiselect', options: LANGUAGES }),
        field({ key: 'writtenLanguagePrimary', label: 'Written language (primary)', type: 'select', options: LANGUAGES, validation: { required: true } }),
        field({ key: 'writtenLanguageOthers', label: 'Written language (others)', type: 'multiselect', options: LANGUAGES }),
      ],
    },
    {
      id: 6,
      title: 'Educational qualifications',
      description: 'Graduation / Diploma and above.',
      displayOrder: 6,
      isEnabled: true,
      fields: [
        field({ key: 'qualification', label: 'Highest qualification', type: 'select', options: opts('Diploma', 'Graduate', 'Post Graduate', 'Doctorate'), validation: { required: true } }),
        field({ key: 'specialisation', label: 'Specialisation', type: 'text', validation: { required: true } }),
        field({ key: 'university', label: 'University / Board', type: 'text', validation: { required: true } }),
        field({ key: 'yearOfPassing', label: 'Year of passing', type: 'number', validation: { required: true, min: 1970, max: 2026 } }),
        field({ key: 'degreeCertificate', label: 'Upload degree certificate', type: 'file', colSpan: 2, validation: { required: true, allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'], maxFileSizeMb: 2 } }),
      ],
    },
    {
      id: 7,
      title: 'Additional qualification & work experience',
      displayOrder: 7,
      isEnabled: true,
      fields: [
        field({ key: 'totalExperience', label: 'Total experience (years)', type: 'number', validation: { required: true, min: 0, max: 50 } }),
        field({ key: 'currentEmployer', label: 'Current organisation', type: 'text', validation: { required: true } }),
        field({ key: 'designation', label: 'Designation', type: 'text', validation: { required: true } }),
        field({ key: 'industryExperience', label: 'Industry experience summary', type: 'textarea', colSpan: 2, validation: { required: true, maxLength: 1000 } }),
        field({ key: 'sectors', label: 'Sectors worked in', type: 'multiselect', colSpan: 2, options: opts('Automotive', 'Engineering & fabrication', 'Food processing', 'Pharmaceutical', 'Textile', 'Electrical & electronics'), validation: { required: true } }),
        field({ key: 'experienceProof', label: 'Upload experience certificate', type: 'file', colSpan: 2, validation: { required: true, allowedExtensions: ['pdf'], maxFileSizeMb: 5 } }),
      ],
    },
    {
      id: 8,
      title: 'Technical skills as per ZED disciplines',
      description: 'Refer to the ZED parameter list before selecting.',
      displayOrder: 8,
      isEnabled: true,
      fields: [
        field({ key: 'zedDisciplines', label: 'ZED disciplines', type: 'multiselect', colSpan: 2, options: ZED_DISCIPLINES, validation: { required: true } }),
        field({ key: 'skillEvidence', label: 'Supporting certificates', type: 'file', colSpan: 2, validation: { required: false, allowedExtensions: ['pdf', 'jpg', 'png'], maxFileSizeMb: 5 } }),
      ],
    },
  ];
}

/** Track specific block appended after the common sections. */
function roleSection(programTypeName: string): RegistrationSection {
  if (/Assessor/i.test(programTypeName)) {
    return {
      id: 9,
      title: 'Assessment experience',
      description: 'Applicable to assessor applicants.',
      displayOrder: 9,
      isEnabled: true,
      fields: [
        field({ key: 'assessmentsConducted', label: 'Number of assessments conducted', type: 'number', validation: { required: true, min: 0 } }),
        field({ key: 'assessmentStandards', label: 'Standards assessed against', type: 'multiselect', colSpan: 2, options: opts('ISO 9001', 'ISO 14001', 'ISO 45001', 'ZED'), validation: { required: true } }),
        field({ key: 'leadAuditor', label: 'Hold a valid lead auditor card?', type: 'checkbox' }),
        field({ key: 'auditorCard', label: 'Upload lead auditor card', type: 'file', visibleWhenFieldKey: 'leadAuditor', visibleWhenValues: ['true'], validation: { required: true, allowedExtensions: ['pdf', 'jpg', 'png'], maxFileSizeMb: 2 } }),
      ],
    };
  }
  if (/Consultant/i.test(programTypeName)) {
    return {
      id: 9,
      title: 'Consultancy experience',
      description: 'Applicable to consultant applicants.',
      displayOrder: 9,
      isEnabled: true,
      fields: [
        field({ key: 'unitsHandheld', label: 'MSME units hand-held', type: 'number', validation: { required: true, min: 0 } }),
        field({ key: 'consultancyDomain', label: 'Primary consultancy domain', type: 'select', options: opts('Quality systems', 'Energy & environment', 'Productivity', 'Occupational safety'), validation: { required: true } }),
        field({ key: 'assignmentSummary', label: 'Summary of two flagship assignments', type: 'textarea', colSpan: 2, validation: { required: true, maxLength: 1000 } }),
      ],
    };
  }
  return {
    id: 9,
    title: 'Training faculty details',
    description: 'Applicable to master trainer / faculty applicants.',
    displayOrder: 9,
    isEnabled: true,
    fields: [
      field({ key: 'trainingDaysDelivered', label: 'Training days delivered', type: 'number', validation: { required: true, min: 0 } }),
      field({ key: 'languagesOfDelivery', label: 'Languages of delivery', type: 'multiselect', colSpan: 2, options: LANGUAGES, validation: { required: true } }),
      field({ key: 'sampleContent', label: 'Upload sample training deck', type: 'file', colSpan: 2, validation: { required: false, allowedExtensions: ['pdf', 'ppt', 'pptx'], maxFileSizeMb: 10 } }),
    ],
  };
}

/**
 * TDS is the applicant's choice: they declare whether tax is to be deducted at
 * source and, if so, supply their own TAN. Admin only decides which rates the
 * fee structure offers.
 */
function tdsSection(): RegistrationSection {
  return {
    id: 10,
    title: 'Payment & TDS declaration',
    description: 'Complete only if your organisation deducts tax at source on this payment.',
    displayOrder: 10,
    isEnabled: true,
    fields: [
      field({
        key: 'tdsApplicable',
        label: 'TDS deduction applicable?',
        type: 'radio',
        colSpan: 2,
        options: [
          { value: 'none', label: 'No TDS' },
          { value: '2', label: 'Yes - 2% (Section 194C)' },
          { value: '10', label: 'Yes - 10% (Section 194J)' },
        ],
        validation: { required: true },
      }),
      field({
        key: 'tan',
        label: 'TAN',
        type: 'tan',
        placeholder: 'DELA12345B',
        helpText: 'Mandatory when TDS is deducted.',
        visibleWhenFieldKey: 'tdsApplicable',
        visibleWhenValues: ['2', '10'],
        validation: { required: true },
      }),
      field({
        key: 'deductorName',
        label: 'Name of deductor',
        type: 'text',
        visibleWhenFieldKey: 'tdsApplicable',
        visibleWhenValues: ['2', '10'],
        validation: { required: true },
      }),
    ],
  };
}

function declarationSection(): RegistrationSection {
  return {
    id: 11,
    title: 'Declaration',
    displayOrder: 11,
    isEnabled: true,
    fields: [
      field({ key: 'declaration', label: 'I hereby declare that all the particulars furnished above are true.', type: 'checkbox', colSpan: 2, validation: { required: true } }),
    ],
  };
}

export const REGISTRATION_FORMS: RegistrationForm[] = PROGRAM_TYPES.map((pt, i) => ({
  id: i + 1,
  programTypeId: pt.id,
  version: 'v1.0',
  status: pt.status,
  sections: [...baseSections(), roleSection(pt.name), tdsSection(), declarationSection()],
  createdBy: 'Super Admin',
  createdOn: '2025-03-15T09:00:00',
}));

/* ------------------------------------------------------------------ */
/* Fee structures                                                      */
/* ------------------------------------------------------------------ */

export const FEE_STRUCTURES: FeeStructure[] = PROGRAM_TYPES.filter((p) => p.isFeeApplicable).map(
  (pt, i) => {
    const base = 4000 + pt.durationDays * 900;
    return {
      id: i + 1,
      programTypeId: pt.id,
      title: `${pt.name} - Fee ${new Date().getFullYear()}`,
      currency: 'INR' as const,
      gstPercent: 18,
      tdsOptions: (i % 3 === 0 ? [2, 10] : i % 3 === 1 ? [10] : []) as TdsRate[],
      effectiveFrom: '2025-04-01',
      effectiveTo: null,
      status: 'Active' as const,
      components: [
        { id: i * 10 + 1, kind: 'Base' as const, label: 'Course fee', amount: base, isTaxable: true },
        { id: i * 10 + 2, kind: 'Exam' as const, label: 'Examination fee', amount: pt.isExamMandatory ? 1200 : 0, isTaxable: true },
        { id: i * 10 + 3, kind: 'Certification' as const, label: 'Certificate & badge', amount: 800, isTaxable: false },
        { id: i * 10 + 4, kind: 'Material' as const, label: 'Courseware kit', amount: 650, isTaxable: true },
      ],
      concessions: [
        { id: i * 10 + 1, label: 'SC / ST / Women applicant', percentage: 25, remarks: 'Subject to valid certificate upload.' },
        { id: i * 10 + 2, label: 'North Eastern region applicant', percentage: 20 },
      ],
      createdBy: 'Super Admin',
      createdOn: '2025-03-20T12:00:00',
    };
  },
);

/* ------------------------------------------------------------------ */
/* Exam papers                                                         */
/* ------------------------------------------------------------------ */

const QUESTION_BANK: [string, string[], number][] = [
  ['Which of the following is NOT a ZED assessment parameter?', ['Leadership', 'Swachh Workplace', 'Share buy-back policy', 'Occupational Safety'], 2],
  ['The primary objective of 5S is to', ['Increase inventory', 'Create a disciplined and organised workplace', 'Reduce manpower', 'Raise selling price'], 1],
  ['Evidence for a scored parameter must be', ['Verbal only', 'Documented and verifiable', 'Optional', 'Provided after certification'], 1],
  ['Value Stream Mapping primarily helps identify', ['Financial ratios', 'Non value adding activities', 'Export incentives', 'Tax liabilities'], 1],
  ['An assessor finding a non-conformity should first', ['Suspend the unit', 'Record objective evidence and inform the unit', 'Ignore minor issues', 'Publish it publicly'], 1],
  ['Maximum validity of the certification issued under the scheme is', ['12 months', '24 months', '36 months', 'Lifetime'], 2],
  ['Kaizen refers to', ['One large breakthrough project', 'Continuous incremental improvement', 'Annual audit', 'Statutory compliance'], 1],
  ['Which document establishes the scope of an on-site assessment?', ['Assessment plan', 'Purchase order', 'Salary register', 'Sales invoice'], 0],
  ['Cyber hygiene for a small unit least involves', ['Patch management', 'Password policy', 'Brand redesign', 'Data backup'], 2],
  ['A trainer should evaluate learning primarily through', ['Attendance only', 'Pre and post assessment', 'Feedback forms only', 'Duration of session'], 1],
];

function buildQuestions(paperId: number): ExamQuestion[] {
  return QUESTION_BANK.map((q, i) => ({
    id: paperId * 100 + i + 1,
    displayOrder: i + 1,
    text: q[0],
    type: 'SingleChoice' as const,
    difficulty: i % 3 === 0 ? ('Easy' as const) : i % 3 === 1 ? ('Moderate' as const) : ('Hard' as const),
    marks: 2,
    negativeMarks: 0.5,
    moduleRef: `Day ${(i % 5) + 1}`,
    options: q[1].map((text, oi) => ({ id: paperId * 1000 + i * 10 + oi, text, isCorrect: oi === q[2] })),
    explanation: 'Refer to the scheme guidelines and the module handout.',
  }));
}

export const EXAM_PAPERS: ExamPaper[] = PROGRAM_TYPES.filter((p) => p.isExamMandatory).map(
  (pt, i) => ({
    id: i + 1,
    programTypeId: pt.id,
    code: `EXM-${pt.code}`,
    title: `${pt.name} - Certification Examination`,
    instructions:
      'All questions are compulsory. Each question carries 2 marks with 0.5 negative marking. Calculators are not permitted.',
    durationMinutes: 60,
    passPercentage: 60,
    maxAttempts: 3,
    shuffleQuestions: true,
    negativeMarking: true,
    status: 'Active' as const,
    questions: buildQuestions(i + 1),
    createdBy: 'Super Admin',
    createdOn: '2025-03-22T11:30:00',
  }),
);

/* ------------------------------------------------------------------ */
/* Training material                                                   */
/* ------------------------------------------------------------------ */

const MATERIAL_BLUEPRINT: [string, 'Document' | 'Video' | 'Presentation' | 'Link'][] = [
  ['Scheme guidelines handbook', 'Document'],
  ['Parameter scoring rubric', 'Document'],
  ['Orientation session recording', 'Video'],
  ['Shop floor walk-through demonstration', 'Video'],
  ['Trainer deck - core modules', 'Presentation'],
  ['Reference portal for scheme circulars', 'Link'],
];

export const TRAINING_MATERIALS: TrainingMaterial[] = PROGRAM_TYPES.flatMap((pt, pi) =>
  MATERIAL_BLUEPRINT.map((m, mi) => {
    const kind = m[1];
    const id = pi * 10 + mi + 1;
    return {
      id,
      title: `${m[0]} - ${pt.code}`,
      description: `${m[0]} issued for the ${pt.name} track.`,
      kind,
      categoryId: pt.categoryId,
      subCategoryId: pt.subCategoryId,
      programTypeId: pt.id,
      curriculumModuleId: null,
      fileName:
        kind === 'Link' ? undefined : `${pt.code.toLowerCase()}-${mi + 1}.${kind === 'Video' ? 'mp4' : kind === 'Presentation' ? 'pptx' : 'pdf'}`,
      fileSizeKb: kind === 'Link' ? undefined : kind === 'Video' ? 184320 : 2480,
      mimeType:
        kind === 'Link'
          ? undefined
          : kind === 'Video'
            ? 'video/mp4'
            : kind === 'Presentation'
              ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
              : 'application/pdf',
      url: kind === 'Link' ? 'https://msme.gov.in/circulars' : undefined,
      durationMinutes: kind === 'Video' ? 35 + mi * 5 : null,
      language: mi % 4 === 3 ? 'Hindi' : 'English',
      visibleToRoles:
        kind === 'Video'
          ? (['SuperAdmin', 'Admin', 'OperationManager', 'Coordinator', 'Applicant'] as const).slice()
          : mi % 2 === 0
            ? (['SuperAdmin', 'Admin', 'OperationManager', 'Applicant'] as const).slice()
            : (['SuperAdmin', 'Admin', 'OperationManager', 'Coordinator'] as const).slice(),
      version: 'v1.0',
      publishedOn: '2025-04-05',
      downloadAllowed: kind !== 'Video',
      status: 'Active' as const,
      createdBy: 'Super Admin',
      createdOn: '2025-04-05T08:00:00',
    };
  }),
);
