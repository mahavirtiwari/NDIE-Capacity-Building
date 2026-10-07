using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// A scheduled batch captured by a coordinator. Virtual batches carry the
/// meeting platform and show "Virtual" as their venue on the register.
/// </summary>
public class Programme : AuditableEntity
{
    /// <summary>System generated, e.g. ZEDTP4579.</summary>
    public string ProgrammeId { get; set; } = string.Empty;
    public string ProgrammeName { get; set; } = string.Empty;

    public int? CurriculumId { get; set; }
    public Curriculum? Curriculum { get; set; }

    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    public int SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }
    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }

    public int AgencyId { get; set; }
    public ImplementingAgency? Agency { get; set; }
    public int CoordinatorId { get; set; }
    public PortalUser? Coordinator { get; set; }
    public int? OperationManagerId { get; set; }
    public PortalUser? OperationManager { get; set; }

    public ProgramMode Mode { get; set; } = ProgramMode.Physical;
    /// <summary>"Virtual" for online batches, otherwise the physical address.</summary>
    public string Venue { get; set; } = string.Empty;
    public string? City { get; set; }
    /// <summary>The venue's pincode. Nothing to record for a virtual batch.</summary>
    public string? Pincode { get; set; }
    public int StateCode { get; set; }
    public LgdState? State { get; set; }
    public int? DistrictCode { get; set; }
    public LgdDistrict? District { get; set; }

    public string? MeetingPlatform { get; set; }
    public string? MeetingLink { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    /// <summary>
    /// The hours the batch runs each day, which the joining letter and the
    /// venue booking both need. The sessions keep their own times; these are
    /// the batch's, from the day it is raised.
    /// </summary>
    public TimeOnly StartTime { get; set; } = new(10, 0);
    public TimeOnly EndTime { get; set; } = new(17, 0);

    /// <summary>
    /// The registration cap. Once <see cref="ParticipantCount"/> reaches it,
    /// registrations close on their own — a batch that is full should stop
    /// taking names without anybody having to remember to turn it off.
    /// </summary>
    /// <summary>
    /// Why the agency has asked for this batch to be put off, if it has.
    ///
    /// A batch is postponed by the Operation Manager, and the agency
    /// running it is the one that knows the hall has flooded. So the
    /// agency asks, in writing, and the manager decides — the request
    /// sits here until it is granted or the batch runs anyway.
    /// </summary>
    public string? PostponementReason { get; set; }
    public DateTime? PostponementRequestedOn { get; set; }
    public int? PostponementRequestedByUserId { get; set; }

    public int MaxParticipants { get; set; }
    public int ParticipantCount { get; set; }
    public decimal? CumulativeFeedback { get; set; }
    public string? Comments { get; set; }

    public bool RegistrationsOpen { get; set; }
    public DateTime? ExamDateTime { get; set; }

    /// <summary>
    /// The paper this batch sits online, chosen when the exam is scheduled.
    ///
    /// Held per batch rather than taken from the programme type, because a type
    /// can have more than one live paper and which one a batch answered has to
    /// stay answerable long after both have been revised.
    /// </summary>
    public int? ExamPaperId { get; set; }
    public ExamPaper? ExamPaper { get; set; }
    public ProgramStatus Status { get; set; } = ProgramStatus.New;

    public ICollection<ProgrammeSession> Sessions { get; set; } = [];
    public ICollection<ProgrammeParticipant> Participants { get; set; } = [];
}

public class ProgrammeSession : AuditableEntity
{
    public int ProgrammeId { get; set; }
    public Programme? Programme { get; set; }

    public string? SessionCode { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateOnly SessionDate { get; set; }
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public string? FacultyName { get; set; }
    public int PresentCount { get; set; }
    public bool IsAttendanceLocked { get; set; }

    public ICollection<AttendanceRecord> Attendance { get; set; } = [];
}

public class AttendanceRecord
{
    public int Id { get; set; }
    public int SessionId { get; set; }
    public ProgrammeSession? Session { get; set; }
    public int ParticipantId { get; set; }
    public ProgrammeParticipant? Participant { get; set; }
    public bool Present { get; set; }
    public DateTime MarkedOn { get; set; } = DateTime.UtcNow;
    public string? MarkedBy { get; set; }
}

public class ProgrammeParticipant : AuditableEntity
{
    public int ProgrammeId { get; set; }
    public Programme? Programme { get; set; }

    public int ApplicantId { get; set; }
    public Applicant? Applicant { get; set; }
    public int? ApplicationId { get; set; }
    public TrainingApplication? Application { get; set; }

    public DateOnly EnrolledOn { get; set; }
    public decimal AttendancePercent { get; set; }

    /// <summary>
    /// The written paper, out of the marks the programme type allots it.
    ///
    /// Null means not marked yet, which is not the same as zero: a candidate
    /// who sat the paper and got nothing right has a result, and one who has
    /// not been marked does not.
    /// </summary>
    public decimal? WrittenMarks { get; set; }

    /// <summary>
    /// The viva or practical, added up from the skills the trainer marked.
    ///
    /// Stored rather than recomputed on every read because it is the figure
    /// that was reported: retiring a skill later must not silently restate a
    /// result that has already been declared.
    /// </summary>
    public decimal? VivaMarks { get; set; }

    /// <summary>Written and viva together — what the result was decided on.</summary>
    public decimal? ExamScore { get; set; }

    public ParticipantResult Result { get; set; } = ParticipantResult.Pending;

    /// <summary>When the marks last added up to a decided result.</summary>
    public DateTime? ResultRecordedOn { get; set; }

    public string? CertificateNo { get; set; }
    public int? FeedbackRating { get; set; }

    public ICollection<AttendanceRecord> Attendance { get; set; } = [];

    /// <summary>What the trainer gave for each skill in the viva.</summary>
    public ICollection<ParticipantSkillMark> SkillMarks { get; set; } = [];
}

/// <summary>
/// One skill, marked for one candidate.
///
/// The marksheet is kept per skill rather than as a single viva figure because
/// that is how it is marked and how it is disputed: a candidate asking why they
/// failed is owed the line that cost them, not a total.
///
/// Which trainer gave the mark is recorded where the coordinator said so. It is
/// nullable because the trainers on a workshop are registered on the day and a
/// mark can be entered from the portal, where there may be nobody to attribute
/// it to.
/// </summary>
public class ParticipantSkillMark : AuditableEntity
{
    public int ParticipantId { get; set; }
    public ProgrammeParticipant? Participant { get; set; }

    public int SkillId { get; set; }
    public EvaluationSkill? Skill { get; set; }

    /// <summary>Out of the skill's own maximum, never more.</summary>
    public decimal Marks { get; set; }

    public int? TrainerId { get; set; }
    public ProgrammeTrainer? Trainer { get; set; }

    public DateTime MarkedOn { get; set; } = DateTime.UtcNow;
}
