import {
  Application,
  ApplicationStatus,
  PaymentStatus,
  Program,
  ProgramMode,
  ProgramParticipant,
  ProgramStatus,
  ScrutinyEvent,
} from '../models';
import { AGENCIES, PROGRAM_TYPES, SUB_CATEGORIES } from './seed-masters';
import { APPLICANTS, PORTAL_USERS } from './seed-people';

const STATUS_CYCLE: ApplicationStatus[] = [
  'Submitted',
  'UnderScrutiny',
  'Approved',
  'Clarification',
  'Enrolled',
  'Rejected',
  'Submitted',
  'Approved',
  'UnderScrutiny',
  'Enrolled',
];

const SCRUTINY_USERS = PORTAL_USERS.filter((u) => u.baseRole === 'Admin');

function programTypeFor(subCategoryId: number) {
  return (
    PROGRAM_TYPES.find((p) => p.subCategoryId === subCategoryId && p.status === 'Active') ??
    PROGRAM_TYPES[0]
  );
}

function historyFor(status: ApplicationStatus, no: string, when: string): ScrutinyEvent[] {
  const officer = SCRUTINY_USERS[no.length % SCRUTINY_USERS.length];
  const events: ScrutinyEvent[] = [
    { id: 1, action: 'Submitted', byUserName: 'Applicant', byRole: 'Applicant', on: when, remarks: 'Application submitted from the mobile app.' },
  ];
  if (status === 'Draft') return [];
  if (status !== 'Submitted') {
    events.push({ id: 2, action: 'Assigned', byUserName: 'System', byRole: 'System', on: when, remarks: `Assigned to ${officer.fullName} for scrutiny.` });
  }
  if (status === 'Clarification') {
    events.push({ id: 3, action: 'Clarification', byUserName: officer.fullName, byRole: 'Scrutiny Officer', on: when, remarks: 'Experience certificate is illegible. Please re-upload a clear copy.' });
  }
  if (status === 'Approved' || status === 'Enrolled') {
    events.push({ id: 3, action: 'Approved', byUserName: officer.fullName, byRole: 'Scrutiny Officer', on: when, remarks: 'Documents verified. Eligibility criteria met.' });
  }
  if (status === 'Enrolled') {
    events.push({ id: 4, action: 'Enrolled', byUserName: 'Operations', byRole: 'Operation Manager', on: when, remarks: 'Enrolled into the upcoming batch.' });
  }
  if (status === 'Rejected') {
    events.push({ id: 3, action: 'Rejected', byUserName: officer.fullName, byRole: 'Scrutiny Officer', on: when, remarks: 'Minimum experience requirement not met.' });
  }
  return events;
}

export const APPLICATIONS: Application[] = APPLICANTS.slice(0, 44).map((applicant, idx) => {
  const status = STATUS_CYCLE[idx % STATUS_CYCLE.length];
  const sub = SUB_CATEGORIES.find((s) => s.id === applicant.subCategoryId) ?? SUB_CATEGORIES[0];
  const pt = programTypeFor(sub.id);
  const submittedOn = `2026-0${(idx % 8) + 1}-${String((idx % 26) + 2).padStart(2, '0')}T14:20:00`;
  const applicationNo = `APL/2026/${String(1000 + idx + 1)}`;
  const officer = SCRUTINY_USERS[idx % SCRUTINY_USERS.length];
  const paid = pt.isFeeApplicable;
  const paymentStatus: PaymentStatus = !paid
    ? 'NotApplicable'
    : status === 'Rejected'
      ? 'Refunded'
      : idx % 6 === 0
        ? 'Pending'
        : 'Paid';

  return {
    id: idx + 1,
    applicationNo,
    applicantId: applicant.id,
    applicantName: applicant.fullName,
    applicantEmail: applicant.email,
    applicantMobile: applicant.mobile,
    pan: applicant.pan,
    /* From the sub-category the application is for, not from the account:
       an applicant's own category is only the first one they entered. */
    categoryId: sub.categoryId,
    subCategoryId: sub.id,
    programTypeId: pt.id,
    status,
    submittedOn,
    assignedToUserId: status === 'Submitted' ? null : officer.id,
    assignedToName: status === 'Submitted' ? undefined : officer.fullName,
    paymentStatus,
    feeAmount: paid ? 4000 + pt.durationDays * 900 : 0,
    score: status === 'Enrolled' ? 62 + (idx % 30) : null,
    state: applicant.state,
    city: applicant.city,
    responses: {
      applyMasterTrainer: /Master Trainer/i.test(pt.name),
      applyAssessor: /Assessor/i.test(pt.name),
      applyConsultant: /Consultant/i.test(pt.name),
      idProofType: 'pan',
      idProofNumber: applicant.pan,
      idProofName: applicant.fullName,
      idProofFile: 'id-proof.pdf',
      photo: 'photo.jpg',
      nominatedThrough: idx % 3 === 0 ? 'freelancer' : 'certification-body-cb',
      associatedWith: idx % 3 === 0 ? 'freelancer' : 'consulting-organization',
      nominatingBodyName: idx % 3 === 0 ? '' : 'Quality Council of India',
      coordinatorName: 'R. Narayanan',
      coordinatorEmail: 'coordinator@agency.gov.in',
      coordinatorPhone: '9810012345',
      firstName: applicant.fullName.split(' ')[0],
      middleName: '',
      lastName: applicant.fullName.split(' ').slice(1).join(' '),
      fatherName: `${['Ramesh', 'Suresh', 'Mahesh', 'Dinesh'][idx % 4]} ${applicant.fullName.split(' ').slice(1).join(' ')}`,
      dateOfBirth: `19${75 + (idx % 20)}-0${(idx % 9) + 1}-1${idx % 9}`,
      gender: idx % 3 === 0 ? 'female' : 'male',
      pan: applicant.pan,
      aadhaarNo: `${4000 + idx}${String(10000000 + idx * 37)}`.slice(0, 12),
      email: applicant.email,
      mobileNo: applicant.mobile,
      street: `${12 + idx}, Sector ${idx % 20}, Industrial Area`,
      state: (applicant.state ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      district: applicant.city ?? '',
      city: applicant.city ?? '',
      pinCode: `${110000 + idx * 137}`.slice(0, 6),
      spokenLanguagePrimary: 'english',
      spokenLanguageOthers: idx % 2 === 0 ? ['hindi'] : ['tamil'],
      writtenLanguagePrimary: 'english',
      writtenLanguageOthers: ['hindi'],
      qualification: idx % 4 === 0 ? 'post-graduate' : 'graduate',
      specialisation: idx % 2 === 0 ? 'Mechanical Engineering' : 'Industrial Engineering',
      university: 'State Technological University',
      yearOfPassing: 2000 + (idx % 22),
      degreeCertificate: 'degree.pdf',
      totalExperience: 3 + (idx % 15),
      currentEmployer: `${['Precision', 'Unitech', 'Shakti', 'Global', 'Sunrise'][idx % 5]} Industries Pvt Ltd`,
      designation: ['Plant Head', 'Quality Manager', 'Consultant', 'Senior Engineer'][idx % 4],
      industryExperience:
        'Led quality and productivity improvement projects across multiple MSME clusters, including 5S rollouts and parameter-wise gap closure.',
      sectors: idx % 2 === 0 ? ['automotive', 'engineering-fabrication'] : ['food-processing', 'pharmaceutical'],
      experienceProof: 'experience.pdf',
      zedDisciplines: idx % 2 === 0 ? ['a-quality-process'] : ['b-environment-energy-safety', 'c-management-compliance'],
      skillEvidence: 'certificates.pdf',
      assessmentsConducted: idx % 25,
      assessmentStandards: ['iso-9001', 'zed'],
      leadAuditor: idx % 4 === 0,
      unitsHandheld: idx % 40,
      consultancyDomain: 'quality-systems',
      assignmentSummary: 'Hand-held two units through ZED Bronze to Silver within nine months.',
      trainingDaysDelivered: 10 + (idx % 60),
      languagesOfDelivery: idx % 2 === 0 ? ['english', 'hindi'] : ['english', 'tamil'],
      declaration: true,
    },
    documents: [
      { id: idx * 10 + 1, fieldKey: 'photo', label: 'Passport size photograph', fileName: 'photo.jpg', fileSizeKb: 184, uploadedOn: submittedOn, verified: status === 'Approved' || status === 'Enrolled' },
      { id: idx * 10 + 2, fieldKey: 'idProof', label: 'Government photo ID', fileName: 'aadhaar.pdf', fileSizeKb: 640, uploadedOn: submittedOn, verified: status === 'Approved' || status === 'Enrolled' },
      { id: idx * 10 + 3, fieldKey: 'degreeCertificate', label: 'Degree certificate', fileName: 'degree.pdf', fileSizeKb: 980, uploadedOn: submittedOn, verified: status === 'Approved' || status === 'Enrolled' },
      { id: idx * 10 + 4, fieldKey: 'experienceProof', label: 'Experience certificate', fileName: 'experience.pdf', fileSizeKb: 1240, uploadedOn: submittedOn, verified: status === 'Enrolled', remarks: status === 'Clarification' ? 'Scanned copy is not legible.' : undefined },
    ],
    history: historyFor(status, applicationNo, submittedOn),
    createdOn: submittedOn,
  } satisfies Application;
});

/* ------------------------------------------------------------------ */
/* Programmes (batches) captured by coordinators                       */
/* ------------------------------------------------------------------ */

const COORDINATORS = PORTAL_USERS.filter((u) => u.baseRole === 'Coordinator');
const OPS_MANAGERS = PORTAL_USERS.filter((u) => u.baseRole === 'OperationManager');
const VENUES = [
  'MSME Technology Centre',
  'District Industries Hall',
  'Chamber of Commerce Auditorium',
  'Cluster Training Annexe',
];
const PLATFORMS = ['Microsoft Teams', 'Zoom', 'Google Meet'];

function participantsFor(programId: number, count: number): ProgramParticipant[] {
  return Array.from({ length: count }, (_, i) => {
    const applicant = APPLICANTS[(programId * 5 + i) % APPLICANTS.length];
    const attendance = 60 + ((programId * 7 + i * 11) % 41);
    const score = 45 + ((programId * 13 + i * 7) % 55);
    return {
      id: programId * 100 + i + 1,
      applicantId: applicant.id,
      applicationNo: `APL/2026/${String(1000 + applicant.id)}`,
      name: applicant.fullName,
      email: applicant.email,
      mobile: applicant.mobile,
      enrolledOn: '2026-08-12',
      attendancePercent: attendance,
      examScore: score,
      result: score >= 60 && attendance >= 75 ? 'Pass' : score >= 60 ? 'Pending' : 'Fail',
      certificateNo:
        score >= 60 && attendance >= 75 ? `CERT/2026/${programId}${String(i).padStart(3, '0')}` : null,
      feedbackRating: 3 + ((programId + i) % 3),
    } satisfies ProgramParticipant;
  });
}

/** Status is derived from how far in the past the batch sits. */
function statusFor(month: number, index: number): ProgramStatus {
  if (index % 17 === 0) return 'Postponed';
  if (index % 19 === 0) return 'PermissionRejected';
  if (index % 23 === 0) return 'QCRejected';
  if (month < 9) return 'Conducted';
  if (month === 9) return index % 3 === 0 ? 'CalendarCreated' : 'Conducted';
  return index % 4 === 0 ? 'New' : 'PermissionAccepted';
}

export const PROGRAMS: Program[] = Array.from({ length: 26 }, (_, idx) => {
  const id = idx + 1;
  const coordinator = COORDINATORS[idx % COORDINATORS.length];
  const ptId = coordinator.programTypeIds[idx % Math.max(coordinator.programTypeIds.length, 1)] ?? 1;
  const pt = PROGRAM_TYPES.find((p) => p.id === ptId) ?? PROGRAM_TYPES[0];
  const agency = AGENCIES.find((a) => a.id === coordinator.agencyId) ?? AGENCIES[0];
  const manager = OPS_MANAGERS.find((m) => m.id === coordinator.reportsToUserId) ?? OPS_MANAGERS[0];
  const mode: ProgramMode = idx % 3 === 0 ? 'Physical' : 'Virtual';
  const month = (idx % 10) + 1;
  const startDay = (idx % 20) + 1;
  const status = statusFor(month, idx);
  const days = Math.min(pt.durationDays, 5);
  const capacity = 30 + (idx % 4) * 5;
  const participantCount =
    status === 'PermissionRejected' || status === 'Postponed' || status === 'QCRejected'
      ? 1
      : status === 'New'
        ? 0
        : 20 + (idx % 25);

  return {
    id,
    programmeId: `ZEDTP${4500 + id}`,
    programmeName: `${days}-Day ${pt.name} Training Program`,
    curriculumId: pt.id,
    programmeCode: `ZED/TP${String(10 + pt.id)}`,
    categoryId: pt.categoryId,
    subCategoryId: pt.subCategoryId,
    programTypeId: pt.id,
    agencyId: agency.id,
    coordinatorId: coordinator.id,
    operationManagerId: manager.id,
    mode,
    venue: mode === 'Virtual' ? 'Virtual' : `${VENUES[idx % VENUES.length]}, ${coordinator.city}`,
    city: mode === 'Virtual' ? undefined : coordinator.city,
    state: (coordinator.state ?? 'Delhi').toUpperCase(),
    meetingPlatform: mode === 'Virtual' ? PLATFORMS[idx % PLATFORMS.length] : undefined,
    meetingLink: mode === 'Virtual' ? `https://meet.example.gov.in/batch-${id}` : undefined,
    startDate: `2026-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`,
    endDate: `2026-${String(month).padStart(2, '0')}-${String(Math.min(28, startDay + days - 1)).padStart(2, '0')}`,
    maxParticipants: capacity,
    participantCount,
    cumulativeFeedback: status === 'Conducted' ? Math.round((38 + (idx % 12)) / 10) : null,
    comments:
      status === 'Postponed'
        ? 'Postponed — insufficient enrolment.'
        : status === 'PermissionRejected'
          ? 'Duplicate request.'
          : status === 'QCRejected'
            ? 'Venue documentation incomplete.'
            : undefined,
    registrationsOpen: status === 'PermissionAccepted',
    examDateTime: status === 'CalendarCreated' || status === 'Conducted' ? `2026-${String(month).padStart(2, '0')}-${String(Math.min(28, startDay + days - 1)).padStart(2, '0')}T15:00` : null,
    status,
    sessions: Array.from({ length: days }, (_, si) => ({
      id: id * 100 + si + 1,
      sessionCode: `ZED/TP${String(10 + pt.id)}/S${String(si + 1).padStart(2, '0')}`,
      title: `Day ${si + 1} - ${['Orientation', 'Core parameters', 'Case studies', 'Field practice', 'Reporting'][si]}`,
      sessionDate: `2026-${String(month).padStart(2, '0')}-${String(Math.min(28, startDay + si)).padStart(2, '0')}`,
      startTime: '10:00',
      endTime: '17:00',
      facultyName: ['Dr. S. Venkatesh', 'Prof. Anjali Deb', 'Mr. H. Bhatt'][si % 3],
      presentCount: status === 'Conducted' ? Math.max(0, participantCount - (si % 4)) : 0,
      isAttendanceLocked: status === 'Conducted',
    })),
    participants: participantsFor(id, Math.min(participantCount, 10)),
    createdBy: coordinator.fullName,
    createdOn: `2026-0${Math.max(1, month - 1)}-15T09:30:00`,
  } satisfies Program;
});
