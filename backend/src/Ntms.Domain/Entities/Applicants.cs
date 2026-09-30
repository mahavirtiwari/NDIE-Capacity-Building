using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// Created from the mobile app at sign-up. Identity is the system generated
/// <see cref="ApplicantCode"/>; e-mail is editable profile data, never a key.
/// </summary>
public class Applicant : AuditableEntity
{
    /// <summary>System generated, e.g. APP240012. Unique, immutable.</summary>
    public string ApplicantCode { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Pan { get; set; } = string.Empty;

    /* Self-declared, and nullable so an unanswered question stays visibly
       unanswered. The scheme reports on reach by gender and social category, and
       a default of "Male" or "General" would quietly invent that reach. */
    public Gender? Gender { get; set; }
    public SocialCategory? SocialCategory { get; set; }

    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    public int SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }

    public string PasswordHash { get; set; } = string.Empty;
    public bool EmailVerified { get; set; }
    public bool MobileVerified { get; set; }
    public KycStatus KycStatus { get; set; } = KycStatus.Pending;

    public int? StateCode { get; set; }
    public LgdState? State { get; set; }
    public int? DistrictCode { get; set; }
    public LgdDistrict? District { get; set; }
    public string? City { get; set; }

    public DateTime RegisteredOn { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginOn { get; set; }
    public bool IsBlocked { get; set; }

    /* The current block, kept alongside the flag so a list or an export can
       say why without reading the history for every row. The history is
       still the record; these two are the latest page of it. */
    public DateTime? BlockedOn { get; set; }
    public string? BlockReasonLabel { get; set; }

    /// <summary>Every time this account was blocked or let back in.</summary>
    public ICollection<ApplicantStatusEvent> StatusEvents { get; set; } = [];

    public ICollection<TrainingApplication> Applications { get; set; } = [];

    /// <summary>Answers to the custom questions on the sign-up form.</summary>
    public ICollection<ApplicantAnswer> Answers { get; set; } = [];
}

/// <summary>
/// A one-time code sent to verify an applicant's e-mail or mobile at sign-up.
/// </summary>
public class OtpChallenge
{
    public int Id { get; set; }
    /// <summary>"Email" or "Mobile".</summary>
    public string Channel { get; set; } = "Email";
    public string Destination { get; set; } = string.Empty;
    public string CodeHash { get; set; } = string.Empty;
    public DateTime ExpiresOn { get; set; }
    public int Attempts { get; set; }
    public bool IsUsed { get; set; }
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// One time an applicant's account was blocked or let back in.
///
/// Kept because a block is a decision taken about a person, and the question
/// asked about it afterwards is always who, when and on what grounds. A flag
/// on the account answers none of those.
/// </summary>
public class ApplicantStatusEvent : AuditableEntity
{
    public int ApplicantId { get; set; }
    public Applicant? Applicant { get; set; }

    /// <summary>The state this moved the account to.</summary>
    public bool Blocked { get; set; }

    /* The chosen reason, where there was a list to choose from. Unblocking
       has no master list - it is a judgement rather than a category - so it
       carries the note alone. */
    public int? BlockReasonId { get; set; }
    public BlockReason? BlockReason { get; set; }
    public string? ReasonLabel { get; set; }

    public string? Remarks { get; set; }

    public int? ByUserId { get; set; }
    public string ByUserName { get; set; } = string.Empty;
    public string ByUserCode { get; set; } = string.Empty;

    public DateTime On { get; set; } = DateTime.UtcNow;
}
