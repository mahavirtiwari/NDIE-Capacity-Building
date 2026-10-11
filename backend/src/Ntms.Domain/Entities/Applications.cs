using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>One applicant submission against one program type.</summary>
public class TrainingApplication : AuditableEntity
{
    public string ApplicationNo { get; set; } = string.Empty;

    public int ApplicantId { get; set; }
    public Applicant? Applicant { get; set; }

    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    public int SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }

    /// <summary>The profile form version the answers were captured against.</summary>
    public int? ProfileFormId { get; set; }
    public ProfileForm? ProfileForm { get; set; }

    /// <summary>
    /// The batch this registration was made for, where it was made for one.
    ///
    /// A fee is owed before the seat is taken, so between pressing Register
    /// and the money arriving there is an application and no participant
    /// row — and nothing recorded which batch had been wanted, so the
    /// applicant's own list of programmes had nothing to show them. Null on
    /// an application raised against a program type rather than a batch,
    /// and on every application made before this was kept.
    /// </summary>
    public int? ProgrammeId { get; set; }
    public Programme? Programme { get; set; }

    public ApplicationStatus Status { get; set; } = ApplicationStatus.Draft;
    public DateTime? SubmittedOn { get; set; }

    public int? AssignedToUserId { get; set; }
    public PortalUser? AssignedToUser { get; set; }

    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.NotApplicable;
    public decimal FeeAmount { get; set; }

    /* The gross above split as it stood when the application was made. TDS is
       deducted on the taxable value and not on the tax, so what the payer
       remits cannot be worked out from the gross alone — and the fee
       structure may well have been superseded by the time they pay.

       Null on applications made before this was recorded; the fee structure
       in force is read instead, and the payment says so. */
    public decimal? FeeTaxable { get; set; }
    public decimal? FeeGst { get; set; }
    /// <summary>TDS rate the applicant opted for; 0 when none.</summary>
    public decimal TdsPercent { get; set; }
    /// <summary>The applicant's own TAN, mandatory when TDS is claimed.</summary>
    public string? Tan { get; set; }
    public string? DeductorName { get; set; }

    public decimal? Score { get; set; }

    /* Why it was turned down, where it was. The id is the master row; the
       label is what that row said at the time, because a reason can be
       reworded or retired afterwards and a rejection has to keep reading the
       way it was given. */
    public int? RejectionReasonId { get; set; }
    public RejectionReason? RejectionReason { get; set; }
    public string? RejectionReasonLabel { get; set; }
    public int? StateCode { get; set; }
    public LgdState? State { get; set; }
    public int? DistrictCode { get; set; }
    public LgdDistrict? District { get; set; }

    /// <summary>
    /// Answers keyed by the dynamic registration field key, stored as JSON so the
    /// shape can change with the form without a schema migration.
    /// </summary>
    public string ResponsesJson { get; set; } = "{}";

    public ICollection<ApplicationDocument> Documents { get; set; } = [];
    public ICollection<ScrutinyEvent> History { get; set; } = [];

    /// <summary>Every attempt to pay the fee, successful or not.</summary>
    public ICollection<PaymentTransaction> Payments { get; set; } = [];
}

public class ApplicationDocument : AuditableEntity
{
    public int ApplicationId { get; set; }
    public TrainingApplication? Application { get; set; }

    /// <summary>The registration field this upload answers.</summary>
    public string FieldKey { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSizeKb { get; set; }
    public string? ContentType { get; set; }
    public string? StoragePath { get; set; }
    public DateTime UploadedOn { get; set; } = DateTime.UtcNow;
    public bool Verified { get; set; }
    public string? Remarks { get; set; }
}

public class ScrutinyEvent : AuditableEntity
{
    public int ApplicationId { get; set; }
    public TrainingApplication? Application { get; set; }

    public ScrutinyAction Action { get; set; }
    public string ByUserName { get; set; } = string.Empty;
    public string ByRole { get; set; } = string.Empty;
    public DateTime On { get; set; } = DateTime.UtcNow;
    public string? Remarks { get; set; }

    /// <summary>
    /// The chosen reason on a rejection, worded as it was at the time, so
    /// the history reads on its own without joining back to a master that
    /// may since have changed.
    /// </summary>
    public string? RejectionReasonLabel { get; set; }
}
