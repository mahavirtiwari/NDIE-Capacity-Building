namespace Ntms.Application.Contracts;

/// <summary>
/// Where one applicant stands with the profile form, as the app needs it.
///
/// Everything the screen has to decide is answered here rather than left for
/// the app to work out: whether to show the form at all, whether it may be
/// sent, what scrutiny said last time, and how many tries are left.
/// </summary>
public class ProfileStandingDto
{
    /// <summary>False where the sub-category asks for no profile form.</summary>
    public bool Required { get; set; }

    /// <summary>True once the programs beneath the discipline are open.</summary>
    public bool Cleared { get; set; }

    /// <summary>Null before the first attempt.</summary>
    public string? Status { get; set; }

    public int SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }

    public int AttemptNo { get; set; }
    public int AttemptsAllowed { get; set; }
    public int AttemptsLeft { get; set; }

    public DateTime? SubmittedOn { get; set; }
    public DateTime? DecidedOn { get; set; }
    public string? RejectionReasonLabel { get; set; }
    public string? Remarks { get; set; }

    /// <summary>Set while the discipline is shut to them, null once it passes.</summary>
    public DateTime? BlockedUntil { get; set; }
    public string? BlockReason { get; set; }

    /// <summary>
    /// The last answers given, so a correction starts from what was said
    /// rather than from an empty form.
    /// </summary>
    public Dictionary<string, object?>? Responses { get; set; }

    public bool CanSubmit { get; set; }

    public List<ScrutinyEventDto> History { get; set; } = [];
}

public class ProfileSubmitDto
{
    public Dictionary<string, object?> Responses { get; set; } = [];
}

/// <summary>One profile submission, as the scrutiny queue shows it.</summary>
public class ProfileSubmissionDto
{
    public int Id { get; set; }
    public int ApplicantId { get; set; }
    public string? ApplicantCode { get; set; }
    public string? ApplicantName { get; set; }
    public int SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }
    public int? ProfileFormId { get; set; }
    public int AttemptNo { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? SubmittedOn { get; set; }
    public DateTime? DecidedOn { get; set; }
    public string? DecidedByUserName { get; set; }
    public int? RejectionReasonId { get; set; }
    public string? RejectionReasonLabel { get; set; }
    public string? Remarks { get; set; }
    public Dictionary<string, object?> Responses { get; set; } = [];
    public List<ScrutinyEventDto> History { get; set; } = [];
}

public class ProfileDecisionDto
{
    /// <summary>Required on a rejection, ignored on an approval.</summary>
    public int? RejectionReasonId { get; set; }
    public string? Remarks { get; set; }
}
