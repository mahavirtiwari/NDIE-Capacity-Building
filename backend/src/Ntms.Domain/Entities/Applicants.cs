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

    public ICollection<TrainingApplication> Applications { get; set; } = [];
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
