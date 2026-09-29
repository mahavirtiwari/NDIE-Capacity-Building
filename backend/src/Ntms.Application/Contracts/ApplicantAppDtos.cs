namespace Ntms.Application.Contracts;

/// <summary>
/// Contracts used only by the mobile applicant app. Applicants sign in with the
/// generated applicant ID; the e-mail is editable profile data.
/// </summary>
public class ApplicantLoginRequestDto
{
    public string ApplicantCode { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class ApplicantLoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public int ExpiresInSeconds { get; set; }
    public ApplicantDto Applicant { get; set; } = new();
}

public class ApplicantProfileUpdateDto
{
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    /* Correctable by the applicant: it was their own declaration to begin with. */
    public string? Gender { get; set; }
    public string? SocialCategory { get; set; }
    public int? StateCode { get; set; }
    public int? DistrictCode { get; set; }
    public string? City { get; set; }
}

/// <summary>A programme as the applicant sees it on the home screen.</summary>
public class ApplicantProgramDto
{
    public int ProgramTypeId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ShortDescription { get; set; }
    public string? CategoryName { get; set; }
    public string? SubCategoryName { get; set; }
    public int DurationDays { get; set; }
    public string DeliveryMode { get; set; } = "Physical";
    public string? MinQualification { get; set; }
    /// <summary>Display text; the mobile app shows this, not the code.</summary>
    public string? MinQualificationLabel { get; set; }
    public int MinExperienceYears { get; set; }
    public bool IsExamMandatory { get; set; }
    public decimal FeePayable { get; set; }
    public List<int> TdsOptions { get; set; } = [];
    /// <summary>
    /// False when the track cannot be applied to yet: it wants a registration
    /// form and none is published.
    /// </summary>
    public bool AcceptingApplications { get; set; }

    /// <summary>
    /// Whether applying means filling in a form. False and the app submits
    /// straight away — there is nothing to ask.
    /// </summary>
    public bool RequiresRegistrationForm { get; set; } = true;
    /// <summary>Set when this applicant has already applied for the track.</summary>
    public string? ExistingApplicationStatus { get; set; }
}

/// <summary>A batch the applicant is enrolled in.</summary>
public class ApplicantEnrolmentDto
{
    /// <summary>
    /// The enrolment's own id, which the exam endpoints are scoped by. Not the
    /// applicant's and not the batch's: one person on one batch.
    /// </summary>
    public int ParticipantId { get; set; }

    public string ProgrammeId { get; set; } = string.Empty;
    public string ProgrammeName { get; set; } = string.Empty;
    public string? AgencyName { get; set; }
    public string Mode { get; set; } = "Physical";
    public string Venue { get; set; } = string.Empty;
    public string? State { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string? MeetingLink { get; set; }
    public DateTime? ExamDateTime { get; set; }
    public string Status { get; set; } = "New";
    public decimal AttendancePercent { get; set; }
    public decimal? ExamScore { get; set; }
    public string Result { get; set; } = "Pending";
    public string? CertificateNo { get; set; }
}
