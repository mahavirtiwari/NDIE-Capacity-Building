using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// One attempt to pay one application's fee.
///
/// A row per attempt, not a flag on the application: a payment that failed at
/// the bank, one the payer abandoned, and the one that finally went through
/// are three different things, and the question asked afterwards is always
/// "what happened" rather than "is it paid". The application keeps the
/// one-word answer; this keeps the account of how it got there.
///
/// Nothing the gateway would call sensitive is kept here. There is no card
/// number, no UPI handle beyond what the gateway echoes as the method, and no
/// bank credential: the payer types those on the gateway's own page, which is
/// the whole reason for sending them there.
/// </summary>
public class PaymentTransaction : AuditableEntity
{
    /// <summary>
    /// What the gateway knows this attempt as, and what comes back on the
    /// response. Generated here, unique, and never reused — a retry is a new
    /// attempt with a new order, because a gateway that sees the same order
    /// twice is entitled to treat the second as a duplicate.
    /// </summary>
    public string OrderId { get; set; } = string.Empty;

    public int ApplicationId { get; set; }
    public TrainingApplication? Application { get; set; }

    public int ApplicantId { get; set; }
    public Applicant? Applicant { get; set; }

    /* ------------------------------------------------ what was charged ---
       Snapshotted rather than read back from the fee structure, which can be
       superseded between the payment and the day somebody asks about it. */

    /// <summary>The published fee, tax included.</summary>
    public decimal FeeGross { get; set; }

    /// <summary>Deducted at source by the payer, on the taxable value only.</summary>
    public decimal TdsAmount { get; set; }

    /// <summary>What the payer was actually asked to remit: gross less TDS.</summary>
    public decimal Amount { get; set; }

    public string Currency { get; set; } = "INR";

    /* --------------------------------------------------- how it went ---- */

    public PaymentAttemptStatus Status { get; set; } = PaymentAttemptStatus.Initiated;

    /// <summary>Which gateway this went through, as named in System Settings.</summary>
    public string Gateway { get; set; } = string.Empty;

    /// <summary>True when it went to the gateway's test environment.</summary>
    public bool TestMode { get; set; }

    /// <summary>What the gateway says the payer used — "UPI", "Credit Card".</summary>
    public string? Method { get; set; }

    /// <summary>The gateway's own reference for the attempt.</summary>
    public string? TrackingId { get; set; }

    /// <summary>The bank's reference, which is what a branch will ask for.</summary>
    public string? BankReference { get; set; }

    /// <summary>The gateway's wording when it refused, kept verbatim.</summary>
    public string? FailureReason { get; set; }

    public DateTime InitiatedOn { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedOn { get; set; }
}
