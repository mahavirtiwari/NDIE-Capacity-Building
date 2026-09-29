namespace Ntms.Application.Contracts;

/// <summary>
/// One programme as it appears in the report index — the register you pick a
/// report from, filtered by programme type.
/// </summary>
public class ReportProgrammeDto
{
    public int Id { get; set; }
    public string ProgrammeCode { get; set; } = string.Empty;
    public string ProgrammeName { get; set; } = string.Empty;

    public string? AgencyName { get; set; }
    public int ProgramTypeId { get; set; }
    public string? ProgramTypeName { get; set; }
    public string? CategoryName { get; set; }
    public string? SubCategoryName { get; set; }

    public string Mode { get; set; } = string.Empty;
    public string Venue { get; set; } = string.Empty;
    public string? StateName { get; set; }
    public string? DistrictName { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }

    public int ParticipantCount { get; set; }
    public string Status { get; set; } = string.Empty;
}

/* ------------------------------------------------- the programme dossier */

/// <summary>
/// Everything one programme is answerable for, in one document.
///
/// Assembled per request and never stored. A report is a view of the record
/// as it stands, and a copy kept on disk is a second version of the truth
/// that goes stale the moment a mark is corrected.
/// </summary>
public class ProgrammeReportDto
{
    /// <summary>Who it is about, for the letterhead.</summary>
    public string OrganisationName { get; set; } = string.Empty;
    public DateTime GeneratedOn { get; set; }
    public string GeneratedBy { get; set; } = string.Empty;

    public ReportProgrammeDto Programme { get; set; } = new();

    public ReportVenueDto? Venue { get; set; }
    public string? CoordinatorName { get; set; }
    public string? CoordinatorEmail { get; set; }
    public string? CoordinatorMobile { get; set; }

    public List<ReportTrainerDto> Trainers { get; set; } = [];
    public List<ReportParticipantDto> Participants { get; set; } = [];
    public List<ReportSessionDto> Sessions { get; set; } = [];
    public List<ReportMonitoringDto> Monitoring { get; set; } = [];

    public ReportTotalsDto Totals { get; set; } = new();
}

public class ReportVenueDto
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? Landmark { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public DateTime? GeoTaggedOn { get; set; }
}

public class ReportTrainerDto
{
    public string FullName { get; set; } = string.Empty;
    public string? Designation { get; set; }
    public string? Organisation { get; set; }
    public string Mobile { get; set; } = string.Empty;
    public string? Email { get; set; }
}

public class ReportParticipantDto
{
    public int SerialNo { get; set; }
    public string ApplicantCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Gender { get; set; }
    public string? Mobile { get; set; }
    public string? Email { get; set; }

    public decimal AttendancePercent { get; set; }
    public decimal? WrittenMarks { get; set; }
    public decimal? VivaMarks { get; set; }
    public decimal? ExamScore { get; set; }
    public string Result { get; set; } = string.Empty;

    public string? CertificateNumber { get; set; }
    public int? FeedbackRating { get; set; }
}

public class ReportSessionDto
{
    public int SerialNo { get; set; }
    public string? SessionCode { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateOnly SessionDate { get; set; }
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public string? FacultyName { get; set; }
    public int PresentCount { get; set; }
    public int MarkedCount { get; set; }
}

public class ReportMonitoringDto
{
    public int SerialNo { get; set; }
    public DateTime ConductedOn { get; set; }
    public string? TrainerName { get; set; }
    public string? Topic { get; set; }
    public string? SubTopic { get; set; }
    public string? Comments { get; set; }
    public int PhotoCount { get; set; }
}

/// <summary>The figures the report is read for, counted once at the top.</summary>
public class ReportTotalsDto
{
    public int Enrolled { get; set; }
    public int Passed { get; set; }
    public int Failed { get; set; }
    public int Pending { get; set; }
    public int Certified { get; set; }

    public decimal AverageAttendance { get; set; }
    public decimal? AverageFeedback { get; set; }

    public int SessionsHeld { get; set; }
    public int MonitoringSessions { get; set; }
}
