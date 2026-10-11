using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Payments;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Taking the fee for an application.
///
/// The money never passes through here. The payer is sent to the gateway's
/// own page, types their card or their UPI id there, and the gateway posts
/// back what happened; this decides what may be paid, records each attempt,
/// and believes the answer only once it has decrypted it and found the
/// amount to be the one that was asked for.
/// </summary>
public class PaymentService(
    NtmsDbContext db,
    FeeService fees,
    PaymentGateways gateways,
    BatchRegistrationService registration,
    ILogger<PaymentService> logger)
{
    /* ------------------------------------------------------------ summary */

    /// <summary>
    /// What this applicant is about to pay, and whether they may.
    ///
    /// Answers even when they may not: "payments are switched off" and "you
    /// have already paid" need different things done about them, and a screen
    /// that only knows the button is disabled can say neither.
    /// </summary>
    public async Task<PaymentSummaryDto> SummaryAsync(
        int applicantId, int applicationId, CancellationToken ct)
    {
        var application = await MineAsync(applicantId, applicationId, ct);
        var settings = await db.SystemSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == 1, ct);

        var money = await SplitAsync(application, ct);

        var lines = new List<PaymentLineDto>
        {
            new() { Label = "Program fee", Amount = money.Taxable + money.NonTaxable },
        };

        if (money.Gst > 0)
            lines.Add(new PaymentLineDto { Label = "GST", Amount = money.Gst });

        if (money.Tds > 0)
        {
            lines.Add(new PaymentLineDto
            {
                Label = $"TDS deducted at source ({application.TdsPercent:0.##}%)",
                Amount = money.Tds,
                IsDeduction = true,
            });
        }

        lines.Add(new PaymentLineDto
        {
            Label = "Net payable",
            Amount = money.Payable,
            IsTotal = true,
        });

        var summary = new PaymentSummaryDto
        {
            ApplicationId = application.Id,
            ApplicationNo = application.ApplicationNo,
            ProgramTypeName = application.ProgramType?.Name,
            Lines = lines,
            FeeGross = money.Gross,
            TdsPercent = application.TdsPercent,
            TdsAmount = money.Tds,
            Payable = money.Payable,
            PaymentStatus = application.PaymentStatus.ToString(),
            Gateway = settings?.PaymentGateway,
            TestMode = settings?.PaymentTestMode ?? true,
            FromCurrentFee = money.FromCurrentFee,
        };

        summary.Blocked = WhyNot(application, settings, money.Payable);
        summary.CanPay = summary.Blocked is null;
        return summary;
    }

    /// <summary>
    /// The one place that decides whether money may be taken. Every path that
    /// could charge somebody asks this, so a reason can never apply to the
    /// screen and not to the request behind it.
    /// </summary>
    private string? WhyNot(TrainingApplication application, SystemSetting? settings, decimal payable)
    {
        if (application.PaymentStatus == PaymentStatus.NotApplicable)
            return "There is no fee to pay for this program.";

        if (application.PaymentStatus == PaymentStatus.Paid)
            return "This fee has already been paid.";

        if (application.PaymentStatus == PaymentStatus.Refunded)
            return "This fee was refunded. Ask the program office before paying again.";

        if (payable <= 0)
            return "Nothing is payable on this application.";

        if (settings is null || !settings.PaymentEnabled)
            return "Online payment is switched off at the moment. The program office can tell you how else to pay.";

        if (!gateways.Handles(settings.PaymentGateway))
        {
            return string.IsNullOrWhiteSpace(settings.PaymentGateway)
                ? "No payment gateway has been set up yet."
                : $"{settings.PaymentGateway} is not available for payment yet.";
        }

        if (string.IsNullOrWhiteSpace(settings.MerchantId)
            || string.IsNullOrWhiteSpace(settings.AccessCode)
            || string.IsNullOrWhiteSpace(settings.WorkingKey))
        {
            return "The payment gateway is not fully set up yet.";
        }

        return null;
    }

    /* --------------------------------------------------------- initiation */

    /// <summary>
    /// Opens an attempt and says where to send the payer.
    ///
    /// The redirect is a page on this API rather than the gateway's own URL,
    /// because a gateway takes its instruction as a signed POST body and a
    /// phone cannot be handed one of those as a link.
    /// </summary>
    public async Task<PaymentInitiationDto> InitiateAsync(
        int applicantId, int applicationId, string publicBaseUrl, CancellationToken ct)
    {
        var application = await MineAsync(applicantId, applicationId, ct);
        var settings = await db.SystemSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == 1, ct);

        var money = await SplitAsync(application, ct);

        var refusal = WhyNot(application, settings, money.Payable);
        if (refusal is not null) throw new AppException(refusal);

        /* An attempt nobody finished must not sit open: the next one would
           look like a second payment for the same fee, and a stale redirect
           page would still be live. */
        var stale = await db.PaymentTransactions
            .Where(p => p.ApplicationId == application.Id
                        && (p.Status == PaymentAttemptStatus.Initiated
                            || p.Status == PaymentAttemptStatus.Processing))
            .ToListAsync(ct);

        foreach (var open in stale) open.Status = PaymentAttemptStatus.Abandoned;

        var attempt = new PaymentTransaction
        {
            OrderId = NextOrderId(),
            ApplicationId = application.Id,
            ApplicantId = applicantId,
            FeeGross = money.Gross,
            TdsAmount = money.Tds,
            Amount = money.Payable,
            Currency = money.Currency,
            Status = PaymentAttemptStatus.Initiated,
            Gateway = settings!.PaymentGateway!,
            TestMode = settings.PaymentTestMode,
            InitiatedOn = DateTime.UtcNow,
        };

        db.PaymentTransactions.Add(attempt);
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Payment {OrderId} opened for application {ApplicationNo}, {Amount} {Currency}",
            attempt.OrderId, application.ApplicationNo, attempt.Amount, attempt.Currency);

        return new PaymentInitiationDto
        {
            OrderId = attempt.OrderId,
            Amount = attempt.Amount,
            Currency = attempt.Currency,
            RedirectUrl = $"{publicBaseUrl.TrimEnd('/')}/api/payments/go/{attempt.OrderId}",
            TestMode = attempt.TestMode,
        };
    }

    /// <summary>
    /// The form that carries the payer to the gateway.
    ///
    /// Served once. An attempt that has already been sent is not sent again:
    /// re-posting the same order is how a gateway ends up with two live
    /// authorisations for one fee.
    /// </summary>
    public async Task<GatewayRedirect> RedirectAsync(
        string orderId, string publicBaseUrl, CancellationToken ct)
    {
        var attempt = await db.PaymentTransactions
            .Include(p => p.Application)
            .Include(p => p.Applicant)
            .FirstOrDefaultAsync(p => p.OrderId == orderId, ct)
            ?? throw AppException.NotFound("Payment");

        if (attempt.Status != PaymentAttemptStatus.Initiated)
            throw new AppException("This payment has already been sent to the gateway.");

        var settings = await db.SystemSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == 1, ct)
            ?? throw new AppException("The payment gateway is not set up.");

        var gateway = gateways.For(settings.PaymentGateway);
        var root = publicBaseUrl.TrimEnd('/');

        var redirect = gateway.BuildRedirect(new GatewayRequest
        {
            OrderId = attempt.OrderId,
            Amount = attempt.Amount,
            Currency = attempt.Currency,
            MerchantId = settings.MerchantId!,
            AccessCode = settings.AccessCode!,
            WorkingKey = settings.WorkingKey!,
            TestMode = attempt.TestMode,
            RedirectUrl = $"{root}/api/payments/callback",
            CancelUrl = $"{root}/api/payments/callback",
            PayerName = attempt.Applicant?.FullName,
            PayerEmail = attempt.Applicant?.Email,
            PayerMobile = attempt.Applicant?.Mobile,
            Description = attempt.Application?.ApplicationNo,
        });

        attempt.Status = PaymentAttemptStatus.Processing;
        await db.SaveChangesAsync(ct);

        return redirect;
    }

    /* ----------------------------------------------------------- the reply */

    /// <summary>
    /// Records what the gateway says happened.
    ///
    /// Safe to receive twice, because a gateway that does not get a clean
    /// response will send its answer again, and a payer who reloads the
    /// return page sends it a third time.
    /// </summary>
    public async Task<PaymentTransactionDto> CompleteAsync(string payload, CancellationToken ct)
    {
        var settings = await db.SystemSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == 1, ct)
            ?? throw new AppException("The payment gateway is not set up.");

        var gateway = gateways.For(settings.PaymentGateway);
        var outcome = gateway.ReadOutcome(payload, settings.WorkingKey ?? string.Empty);

        var attempt = await db.PaymentTransactions
            .Include(p => p.Application)
            .FirstOrDefaultAsync(p => p.OrderId == outcome.OrderId, ct)
            ?? throw AppException.NotFound("Payment");

        /* Already settled. Nothing to do, and nothing to undo: a later reply
           must not turn a paid fee into a failed one. */
        if (attempt.Status is PaymentAttemptStatus.Paid or PaymentAttemptStatus.Failed
            or PaymentAttemptStatus.Cancelled)
        {
            return Map(attempt);
        }

        attempt.Method = outcome.Method;
        attempt.TrackingId = outcome.TrackingId;
        attempt.BankReference = outcome.BankReference;
        attempt.CompletedOn = DateTime.UtcNow;

        /* The response is encrypted under the working key, so only the
           gateway could have written it — but the amount is checked anyway.
           A success for less than was asked is not a success. */
        var shortPaid = outcome.Succeeded
                        && outcome.Amount is not null
                        && Math.Abs(outcome.Amount.Value - attempt.Amount) > 0.01m;

        if (outcome.Succeeded && !shortPaid)
        {
            attempt.Status = PaymentAttemptStatus.Paid;
            attempt.FailureReason = null;

            if (attempt.Application is not null)
                attempt.Application.PaymentStatus = PaymentStatus.Paid;

            logger.LogInformation("Payment {OrderId} succeeded, tracking {TrackingId}",
                attempt.OrderId, outcome.TrackingId);
        }
        else if (outcome.Cancelled)
        {
            attempt.Status = PaymentAttemptStatus.Cancelled;
            attempt.FailureReason = outcome.Message ?? "The payment was cancelled.";
        }
        else
        {
            attempt.Status = PaymentAttemptStatus.Failed;
            attempt.FailureReason = shortPaid
                ? $"The gateway reported {outcome.Amount} against {attempt.Amount} due."
                : outcome.Message ?? $"The gateway reported '{outcome.RawStatus}'.";

            if (attempt.Application is not null
                && attempt.Application.PaymentStatus != PaymentStatus.Paid)
            {
                attempt.Application.PaymentStatus = PaymentStatus.Failed;
            }

            logger.LogWarning("Payment {OrderId} did not go through: {Reason}",
                attempt.OrderId, attempt.FailureReason);
        }

        await db.SaveChangesAsync(ct);

        /* The seat the money was for.
           Registering for a paid batch leaves an application and no
           participant row, and it used to be the payer's job to go back to
           the batch and press Register a second time. Most did not, so they
           had paid for a programme they were not on. Taking it here closes
           that gap; the registration service is the one place that knows
           the rules, so it is asked rather than copied.

           A failure here must not undo a payment that went through. It is
           logged and the attempt is still reported as paid - the seat can
           be taken by hand, the money cannot be taken twice. */
        if (attempt.Status == PaymentAttemptStatus.Paid
            && attempt.Application?.ProgrammeId is int programmeId)
        {
            try
            {
                await registration.RegisterAsync(attempt.ApplicantId, programmeId, ct);
            }
            catch (Exception caught)
            {
                logger.LogError(caught,
                    "Payment {OrderId} went through but the seat on batch {ProgrammeId} " +
                    "could not be taken", attempt.OrderId, programmeId);
            }
        }

        return Map(attempt);
    }

    /* -------------------------------------------------------------- reads */

    public async Task<PaymentTransactionDto> StatusAsync(
        int applicantId, string orderId, CancellationToken ct) =>
        Map(await db.PaymentTransactions.AsNoTracking()
                .Include(p => p.Application).ThenInclude(a => a!.ProgramType)
                .FirstOrDefaultAsync(p => p.OrderId == orderId && p.ApplicantId == applicantId, ct)
            ?? throw AppException.NotFound("Payment"));

    /// <summary>Every attempt this applicant has made, newest first.</summary>
    public async Task<List<PaymentTransactionDto>> HistoryAsync(int applicantId, CancellationToken ct) =>
        [.. (await db.PaymentTransactions.AsNoTracking()
                .Include(p => p.Application).ThenInclude(a => a!.ProgramType)
                .Where(p => p.ApplicantId == applicantId
                            && p.Status != PaymentAttemptStatus.Initiated
                            && p.Status != PaymentAttemptStatus.Abandoned)
                .OrderByDescending(p => p.InitiatedOn)
                .ToListAsync(ct))
            .Select(Map)];

    /* ------------------------------------------------------------ helpers */

    private async Task<TrainingApplication> MineAsync(
        int applicantId, int applicationId, CancellationToken ct) =>
        await db.Applications
            .Include(a => a.ProgramType)
            .FirstOrDefaultAsync(a => a.Id == applicationId && a.ApplicantId == applicantId, ct)
        ?? throw AppException.NotFound("Application");

    private sealed record Money(
        decimal Taxable,
        decimal NonTaxable,
        decimal Gst,
        decimal Gross,
        decimal Tds,
        decimal Payable,
        string Currency,
        bool FromCurrentFee);

    /// <summary>
    /// What is owed, split the way the arithmetic needs it.
    ///
    /// TDS is deducted on the value of the service and not on the tax charged
    /// on it, so the taxable part has to be known separately from the gross.
    /// It is recorded with the application; where an older application does
    /// not have it, the fee structure in force is read instead and the screen
    /// says so, because that structure may have moved since.
    /// </summary>
    private async Task<Money> SplitAsync(TrainingApplication application, CancellationToken ct)
    {
        var currency = "INR";
        var taxable = application.FeeTaxable;
        var gst = application.FeeGst;
        var fromCurrent = false;

        if (taxable is null || gst is null)
        {
            var fee = await fees.CurrentForProgramTypeAsync(application.ProgramTypeId, ct);
            if (fee is not null)
            {
                taxable = fee.Totals.Taxable;
                gst = fee.Totals.Gst;
                currency = fee.Currency;
                fromCurrent = true;
            }
        }

        /* Nothing to go on: treat the whole recorded gross as taxable. It is
           the reading that never understates the deduction the payer claimed. */
        var gross = application.FeeAmount;
        var taxablePart = taxable ?? gross;
        var gstPart = gst ?? 0m;
        var nonTaxable = Rounding.Half(gross - taxablePart - gstPart);
        if (nonTaxable < 0) nonTaxable = 0m;

        var tds = Rounding.Half(taxablePart * application.TdsPercent / 100m);
        var payable = Rounding.Half(gross - tds);
        if (payable < 0) payable = 0m;

        return new Money(
            Rounding.Half(taxablePart), nonTaxable, Rounding.Half(gstPart),
            Rounding.Half(gross), tds, payable, currency, fromCurrent);
    }

    /// <summary>
    /// Unique, and not guessable: the page that carries the payer to the
    /// gateway is found by this alone, so a sequence somebody could count
    /// through would hand them somebody else's payment.
    /// </summary>
    private static string NextOrderId() =>
        $"PAY{DateTime.UtcNow:yyMMddHHmmss}{Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(4))}";

    private static PaymentTransactionDto Map(PaymentTransaction p) => new()
    {
        Id = p.Id,
        OrderId = p.OrderId,
        ApplicationId = p.ApplicationId,
        ApplicationNo = p.Application?.ApplicationNo ?? string.Empty,
        ProgramTypeName = p.Application?.ProgramType?.Name,
        FeeGross = p.FeeGross,
        TdsAmount = p.TdsAmount,
        Amount = p.Amount,
        Currency = p.Currency,
        Status = p.Status.ToString(),
        Gateway = p.Gateway,
        TestMode = p.TestMode,
        Method = p.Method,
        TrackingId = p.TrackingId,
        BankReference = p.BankReference,
        FailureReason = p.FailureReason,
        InitiatedOn = p.InitiatedOn,
        CompletedOn = p.CompletedOn,
    };
}
