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
    public int StateCode { get; set; }
    public LgdState? State { get; set; }
    public int? DistrictCode { get; set; }
    public LgdDistrict? District { get; set; }

    public string? MeetingPlatform { get; set; }
    public string? MeetingLink { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int SeatCapacity { get; set; }
    public int ParticipantCount { get; set; }
    public decimal? CumulativeFeedback { get; set; }
    public string? Comments { get; set; }

    public bool RegistrationsOpen { get; set; }
    public DateTime? ExamDateTime { get; set; }
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
    public decimal? ExamScore { get; set; }
    public ParticipantResult Result { get; set; } = ParticipantResult.Pending;
    public string? CertificateNo { get; set; }
    public int? FeedbackRating { get; set; }

    public ICollection<AttendanceRecord> Attendance { get; set; } = [];
}
