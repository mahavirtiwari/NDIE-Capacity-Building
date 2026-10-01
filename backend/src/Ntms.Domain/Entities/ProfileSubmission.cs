using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// An applicant's answers to their sub-category's profile form, and where
/// scrutiny got to with them.
///
/// This is the gate. An applicant declares who they are once, for the
/// discipline they registered under, and until that has been read and
/// accepted the programs beneath it stay shut. It used to be read per
/// application, which meant the same declarations were scrutinised again
/// for every course somebody went near.
///
/// One row per attempt rather than one row edited in place. A rejection has
/// to survive the correction that follows it: the applicant is shown what
/// was wrong, the previous answers are carried into the new form, and the
/// scrutiny officer can see what changed between the two.
/// </summary>
public class ProfileSubmission : AuditableEntity
{
    public int ApplicantId { get; set; }
    public Applicant? Applicant { get; set; }

    /// <summary>
    /// The discipline this was submitted under, chosen by the applicant
    /// when they started it.
    ///
    /// An applicant may hold one profile per category, so this pair is what
    /// identifies a profile rather than the applicant alone. Written down
    /// here rather than read through the sub-category, because a submission
    /// is a record of what was asked at the time.
    /// </summary>
    public int CategoryId { get; set; }
    public Category? Category { get; set; }

    public int SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }

    /// <summary>The form version the answers were captured against.</summary>
    public int? ProfileFormId { get; set; }
    public ProfileForm? ProfileForm { get; set; }

    /// <summary>Which try this is at this discipline, counting from one.</summary>
    public int AttemptNo { get; set; } = 1;

    /// <summary>Answers as JSON, shaped by the form that was in force.</summary>
    public string Responses { get; set; } = "{}";

    public ProfileSubmissionStatus Status { get; set; } = ProfileSubmissionStatus.Draft;

    public DateTime? SubmittedOn { get; set; }
    public DateTime? DecidedOn { get; set; }
    public string? DecidedByUserName { get; set; }

    public int? RejectionReasonId { get; set; }
    public RejectionReason? RejectionReason { get; set; }

    /// <summary>
    /// The reason worded as it was at the time, so the history reads on its
    /// own without joining back to a master that may since have changed.
    /// </summary>
    public string? RejectionReasonLabel { get; set; }

    public string? Remarks { get; set; }

    public ICollection<ProfileScrutinyEvent> History { get; set; } = [];
}

/// <summary>Everything that happened to one profile submission.</summary>
public class ProfileScrutinyEvent : AuditableEntity
{
    public int SubmissionId { get; set; }
    public ProfileSubmission? Submission { get; set; }

    public ScrutinyAction Action { get; set; }
    public string ByUserName { get; set; } = string.Empty;
    public string ByRole { get; set; } = string.Empty;
    public DateTime On { get; set; } = DateTime.UtcNow;
    public string? Remarks { get; set; }
    public string? RejectionReasonLabel { get; set; }
}
