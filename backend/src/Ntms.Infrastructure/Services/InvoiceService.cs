using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Invoicing;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// The applicant's copy of an invoice.
///
/// The document is the ERP's: it raises the invoice, numbers it and sends it
/// to the applicant. This only fetches a copy so they can open it in the app,
/// and — when Super Admin has asked for it — keeps that copy so it is still
/// there when the ERP is not.
/// </summary>
public class InvoiceService(NtmsDbContext db, InvoiceFetcher fetcher)
{
    public sealed record Invoice(string? Number, string ContentType, string FileName, byte[] Content);

    /// <summary>
    /// Whether the app should offer an invoice at all. Cheap: it asks the
    /// settings, not the ERP, so it can be answered for every row of a
    /// payment history without a round trip each.
    /// </summary>
    public async Task<bool> OfferedAsync(CancellationToken ct) =>
        await db.SystemSettings.AsNoTracking()
            .Where(s => s.Id == 1)
            .Select(s => s.ErpInvoiceEnabled)
            .FirstOrDefaultAsync(ct);

    /// <summary>
    /// The invoice for one payment, scoped to the applicant who made it.
    ///
    /// Throws with something the applicant can read rather than returning
    /// nothing: every refusal here has a reason worth telling them, whether
    /// the invoice has not been raised yet or the ERP is unreachable.
    /// </summary>
    public async Task<Invoice> ForPaymentAsync(
        int applicantId, string orderId, CancellationToken ct)
    {
        var payment = await db.PaymentTransactions
            .Include(p => p.Application).ThenInclude(a => a!.ProgramType)
            .Include(p => p.Applicant)
            .FirstOrDefaultAsync(p => p.OrderId == orderId && p.ApplicantId == applicantId, ct)
            ?? throw AppException.NotFound("Payment");

        /* Nothing is invoiced until it is paid, and an applicant asking for
           the invoice on a failed attempt should be told that rather than
           sent to the ERP to be refused. */
        if (payment.Status != PaymentAttemptStatus.Paid)
            throw new AppException("An invoice is raised only once a payment has gone through.");

        var settings = await db.SystemSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == 1, ct);

        var stored = await db.PaymentInvoices
            .FirstOrDefaultAsync(i => i.PaymentTransactionId == payment.Id, ct);

        if (stored is { Content.Length: > 0 })
            return new Invoice(stored.InvoiceNumber, stored.ContentType, stored.FileName, stored.Content);

        if (settings is null || !settings.ErpInvoiceEnabled)
            throw new AppException("Invoices are not available yet.");

        var reference = ReferenceFor(payment, settings.ErpInvoiceReference);
        if (string.IsNullOrWhiteSpace(reference))
        {
            throw new AppException(
                "This payment has no " + Describe(settings.ErpInvoiceReference) +
                " to look an invoice up by.");
        }

        var fallbackName = $"invoice-{payment.OrderId}.pdf";
        var result = await fetcher.FetchAsync(reference, fallbackName, ct);

        if (result.Invoice is null)
            throw new AppException(result.Unavailable ?? "The invoice could not be fetched.");

        var fetched = result.Invoice;

        if (settings.ErpStoreInvoiceCopy)
        {
            /* Kept against the payment so the next view costs nothing and
               survives the ERP being down. Replaced rather than duplicated
               if a row somehow exists without content. */
            stored ??= new PaymentInvoice { PaymentTransactionId = payment.Id };
            stored.InvoiceNumber = fetched.Number;
            stored.FileName = fetched.FileName;
            stored.ContentType = fetched.ContentType;
            stored.Content = fetched.Content;
            stored.FetchedOn = DateTime.UtcNow;

            if (stored.Id == 0) db.PaymentInvoices.Add(stored);
            await db.SaveChangesAsync(ct);
        }

        return new Invoice(fetched.Number, fetched.ContentType, fetched.FileName, fetched.Content);
    }

    /// <summary>
    /// Which of our identifiers goes to the ERP. All four are things this
    /// system already holds against a payment; which one is agreed between
    /// the two sides and set under System Settings.
    /// </summary>
    private static string? ReferenceFor(PaymentTransaction payment, string? choice) => choice switch
    {
        "TrackingId" => payment.TrackingId,
        "ApplicationNo" => payment.Application?.ApplicationNo,
        "ApplicantCode" => payment.Applicant?.ApplicantCode,
        _ => payment.OrderId,
    };

    private static string Describe(string? choice) => choice switch
    {
        "TrackingId" => "gateway tracking ID",
        "ApplicationNo" => "application number",
        "ApplicantCode" => "applicant ID",
        _ => "order ID",
    };
}
