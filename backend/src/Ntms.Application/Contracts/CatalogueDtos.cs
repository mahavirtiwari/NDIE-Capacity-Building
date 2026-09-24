using Ntms.Application.Common;

namespace Ntms.Application.Contracts;

/// <summary>
/// A batch as the public sees it, behind the shareable link an agency hands
/// out.
///
/// Deliberately thin. This is served without a sign-in, so it carries what
/// somebody deciding whether to attend needs — what it is, when, where, and
/// whether there is room — and nothing about who is already on it, who is
/// running it or how to reach them.
/// </summary>
public class PublicProgrammeDto
{
    /// <summary>The system generated code, which is what the link is keyed on.</summary>
    public string ProgrammeId { get; set; } = string.Empty;
    public string ProgrammeName { get; set; } = string.Empty;
    public string ProgramTypeName { get; set; } = string.Empty;
    public string? ShortDescription { get; set; }
    public string CategoryName { get; set; } = string.Empty;
    public string SubCategoryName { get; set; } = string.Empty;

    public string Mode { get; set; } = "Physical";
    /// <summary>Only on a physical batch; a virtual one says so instead.</summary>
    public string? Venue { get; set; }
    public string? City { get; set; }
    public string? District { get; set; }
    public string? State { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int DurationDays { get; set; }

    public int MaxParticipants { get; set; }
    public int Enrolled { get; set; }
    /// <summary>Never negative, even if a cap was lowered after enrolment.</summary>
    public int SeatsLeft { get; set; }

    /// <summary>
    /// Where the batch sits in time: Upcoming, Ongoing or Completed.
    ///
    /// Separate from <see cref="RegistrationStatus"/> on purpose — a batch can
    /// be upcoming with registration already closed because it filled, and the
    /// listing has to be able to say both.
    /// </summary>
    public string ScheduleStatus { get; set; } = string.Empty;

    public bool RegistrationsOpen { get; set; }
    /// <summary>Why it is closed, when it is — full, not yet approved, already run.</summary>
    public string RegistrationStatus { get; set; } = string.Empty;

    /// <summary>The empanelled body running it. Named, but not contactable from here.</summary>
    public string? AgencyName { get; set; }

    /// <summary>What an applicant needs before they can apply for this track.</summary>
    public string? MinQualificationLabel { get; set; }
    public int MinExperienceYears { get; set; }
    public bool IsFeeApplicable { get; set; }
}

/// <summary>A batch offered to a signed-in applicant, with their standing on it.</summary>
public class ApplicantBatchDto : PublicProgrammeDto
{
    /// <summary>The programme's own id, for applying.</summary>
    public int Id { get; set; }
    public int ProgramTypeId { get; set; }

    /// <summary>True once this applicant is enrolled on it.</summary>
    public bool IsEnrolled { get; set; }
    /// <summary>True where they have an application in flight for this track.</summary>
    public bool HasApplied { get; set; }
}

/// <summary>What narrows the public programme listing.</summary>
public class PublicProgrammeFilterDto
{
    public int? ProgramTypeId { get; set; }
    public int? StateCode { get; set; }
    public int? DistrictCode { get; set; }
    /// <summary>Upcoming, Ongoing or Completed; blank for all of them.</summary>
    public string? Status { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    /// <summary>Matches the batch code, its name or the venue.</summary>
    public string? Search { get; set; }
}

/// <summary>The names the public listing's filters are built from.</summary>
public class PublicFilterOptionsDto
{
    public List<LookupItemDto> ProgramTypes { get; set; } = [];
    public List<LookupItemDto> States { get; set; } = [];
    /// <summary>Every district, each carrying its state code as the parent.</summary>
    public List<LookupItemDto> Districts { get; set; } = [];
}
