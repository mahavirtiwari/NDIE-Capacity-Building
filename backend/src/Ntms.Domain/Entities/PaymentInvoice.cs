using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// The copy of an invoice this system holds.
///
/// The invoice itself is raised in the ERP and sent to the applicant from
/// there — this is not where a fee becomes a document, and nothing here
/// numbers one. What is kept is the copy an applicant opens in the app, so
/// they can see it while the ERP is unreachable and after the ERP's own
/// retention has passed.
///
/// One per payment: an invoice belongs to the money that was taken, not to
/// the application, which may have been paid for more than once.
/// </summary>
public class PaymentInvoice : AuditableEntity
{
    public int PaymentTransactionId { get; set; }
    public PaymentTransaction? Payment { get; set; }

    /// <summary>
    /// The ERP's own number for it. Null where the ERP returns the document
    /// without one, which is its business rather than ours to invent.
    /// </summary>
    public string? InvoiceNumber { get; set; }

    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/pdf";

    /// <summary>
    /// The document, in the row beside its payment. An invoice is a few tens
    /// of kilobytes and is read once in a while by one person, so a share
    /// every web head would have to mount buys nothing here.
    /// </summary>
    public byte[] Content { get; set; } = [];

    /// <summary>When the copy was taken, so a stale one can be recognised.</summary>
    public DateTime FetchedOn { get; set; }
}
