namespace Ntms.Application.Contracts;

/* --------------------------------------------------------------- summary */

/// <summary>One line on the payment summary, in the order it is read.</summary>
public class PaymentLineDto
{
    public string Label { get; set; } = string.Empty;
    public decimal Amount { get; set; }

    /// <summary>True for a deduction, which is shown with a minus sign.</summary>
    public bool IsDeduction { get; set; }

    /// <summary>True for the line the eye should stop on — the total.</summary>
    public bool IsTotal { get; set; }
}

/// <summary>
/// What an applicant is about to pay, broken down.
///
/// Built rather than stored: the point of showing it is that the payer can
/// check the arithmetic before the money moves, and a figure they cannot
/// check is one they have to take on trust.
/// </summary>
public class PaymentSummaryDto
{
    public int ApplicationId { get; set; }
    public string ApplicationNo { get; set; } = string.Empty;
    public string? ProgramTypeName { get; set; }

    public string Currency { get; set; } = "INR";
    public List<PaymentLineDto> Lines { get; set; } = [];

    public decimal FeeGross { get; set; }
    public decimal TdsPercent { get; set; }
    public decimal TdsAmount { get; set; }

    /// <summary>What the gateway will be asked for.</summary>
    public decimal Payable { get; set; }

    /// <summary>Where the application stands: Pending, Paid, Failed.</summary>
    public string PaymentStatus { get; set; } = "Pending";

    /// <summary>False when nothing is owed, or the fee is already settled.</summary>
    public bool CanPay { get; set; }

    /// <summary>
    /// Why not, when CanPay is false. Shown as written, because "payments are
    /// switched off" and "you have already paid" call for different actions.
    /// </summary>
    public string? Blocked { get; set; }

    /// <summary>The gateway that would be used, once one is configured.</summary>
    public string? Gateway { get; set; }
    public bool TestMode { get; set; }

    /// <summary>
    /// True when the split had to be read from the fee structure in force
    /// rather than from what was recorded with the application.
    /// </summary>
    public bool FromCurrentFee { get; set; }
}

/* ------------------------------------------------------------ initiation */

/// <summary>
/// Where to send the payer. The app opens <see cref="RedirectUrl"/> in the
/// phone's own browser rather than inside itself: the payer gets a real
/// address bar and a padlock to check, and no part of this application is
/// anywhere near the page they type a card into.
/// </summary>
public class PaymentInitiationDto
{
    public string OrderId { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";
    public string RedirectUrl { get; set; } = string.Empty;
    public bool TestMode { get; set; }
}

/* ---------------------------------------------------------- transactions */

public class PaymentTransactionDto
{
    public int Id { get; set; }
    public string OrderId { get; set; } = string.Empty;

    public int ApplicationId { get; set; }
    public string ApplicationNo { get; set; } = string.Empty;
    public string? ProgramTypeName { get; set; }

    public decimal FeeGross { get; set; }
    public decimal TdsAmount { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "INR";

    public string Status { get; set; } = "Initiated";
    public string Gateway { get; set; } = string.Empty;
    public bool TestMode { get; set; }

    public string? Method { get; set; }
    public string? TrackingId { get; set; }
    public string? BankReference { get; set; }
    public string? FailureReason { get; set; }

    public DateTime InitiatedOn { get; set; }
    public DateTime? CompletedOn { get; set; }

    /// <summary>
    /// Whether to offer this payment's invoice. Read off the settings rather
    /// than by asking the ERP once per row: the answer to "is invoicing on"
    /// is the same for every row, and whether this particular invoice has
    /// been raised is discovered when it is opened.
    /// </summary>
    public bool InvoiceOffered { get; set; }
}
