using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// An applicant putting themselves on a batch.
///
/// Registering used to mean submitting an application and waiting for it to
/// be scrutinised. That reading has moved to the profile form, which happens
/// once for the discipline — so by the time somebody gets here they have
/// already been read and accepted, and what is left is a seat and, where
/// there is one, a fee.
///
/// A free program is therefore registered on the spot. A paid one is held
/// against the application until the money arrives, and the existing payment
/// flow finishes the job; nothing is routed through a gateway for nothing.
/// </summary>
public class BatchRegistrationService(
    NtmsDbContext db,
    ICodeGenerator codes,
    FeeService fees,
    INotificationService notifications)
{
    public sealed record Outcome(
        string Status,
        int ApplicationId,
        string ApplicationNo,
        decimal AmountDue,
        string Message);

    public async Task<Outcome> RegisterAsync(int applicantId, int programmeId, CancellationToken ct)
    {
        var applicant = await db.Applicants
            .Include(a => a.SubCategory)
            .FirstOrDefaultAsync(a => a.Id == applicantId, ct)
            ?? throw AppException.NotFound("Applicant");

        if (applicant.IsBlocked)
            throw AppException.Forbidden("Your account is blocked.");

        var batch = await db.Programmes
            .Include(p => p.ProgramType)
            .Include(p => p.Participants)
            .FirstOrDefaultAsync(p => p.Id == programmeId, ct)
            ?? throw AppException.NotFound("Batch");

        var programType = batch.ProgramType
                          ?? throw new AppException("This batch has no program type.");

        /* ---- the gate, again -------------------------------------------
           Checked here as well as on the listing. The list is a view and
           can be stale; this is where a seat is actually taken.

           The profile that has to be accepted is the one for this batch's
           own discipline. An account may hold several, and clearing
           scrutiny as an assessor says nothing about a master trainer's
           batch — so this cannot be a check for any accepted profile. */
        var subCategory = await db.SubCategories.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == programType.SubCategoryId, ct)
            ?? throw new AppException("This batch's sub-category is missing.");

        if (subCategory.RequiresProfileForm)
        {
            var cleared = await db.ProfileSubmissions.AsNoTracking()
                .AnyAsync(s => s.ApplicantId == applicantId
                               && s.SubCategoryId == programType.SubCategoryId
                               && s.Status == ProfileSubmissionStatus.Approved, ct);

            if (!cleared)
            {
                throw new AppException(
                    $"Your {subCategory.Name} profile has to be accepted before you can " +
                    "register for this batch.");
            }
        }

        await GuardProgramTypeAsync(applicantId, programType, ct);

        if (!batch.RegistrationsOpen)
            throw new AppException("Registrations for this batch are closed.");

        if (batch.Participants.Any(p => p.ApplicantId == applicantId))
            throw new AppException("You are already registered for this batch.");

        if (batch.Participants.Count >= batch.MaxParticipants)
            throw new AppException("This batch is full.");

        /* ---- the application ------------------------------------------
           Still created, because the fee, the TDS declaration and the
           payment all hang off it, and so does the certificate at the end.
           It is approved as it is made: the reading that used to approve it
           happened on the profile. */
        var application = await db.Applications
            .FirstOrDefaultAsync(a => a.ApplicantId == applicantId
                                      && a.ProgramTypeId == programType.Id
                                      && a.Status != ApplicationStatus.Rejected, ct);

        var now = DateTime.UtcNow;

        if (application is null)
        {
            var fee = await fees.CurrentForProgramTypeAsync(programType.Id, ct);

            application = new TrainingApplication
            {
                ApplicationNo = await codes.NextApplicationNoAsync(ct),
                ApplicantId = applicantId,
                CategoryId = programType.CategoryId,
                SubCategoryId = programType.SubCategoryId,
                ProgramTypeId = programType.Id,
                Status = ApplicationStatus.Approved,
                SubmittedOn = now,
                PaymentStatus = programType.IsFeeApplicable
                    ? PaymentStatus.Pending
                    : PaymentStatus.NotApplicable,
                FeeAmount = fee?.Totals.Gross ?? 0m,
                FeeTaxable = fee?.Totals.Taxable,
                FeeGst = fee?.Totals.Gst,
                StateCode = applicant.StateCode,
                DistrictCode = applicant.DistrictCode,
                ResponsesJson = JsonSerializer.Serialize(new Dictionary<string, object?>()),
            };

            application.History.Add(new ScrutinyEvent
            {
                Action = ScrutinyAction.Submitted,
                ByUserName = applicant.FullName,
                ByRole = BaseRole.Applicant.ToString(),
                On = now,
                Remarks = "Registered for a batch from the mobile app.",
            });

            /* Written down rather than left implicit: somebody reading this
               in a year needs to see why it was never on a queue. */
            application.History.Add(new ScrutinyEvent
            {
                Action = ScrutinyAction.Approved,
                ByUserName = "System",
                ByRole = "System",
                On = now,
                Remarks = "Approved on the accepted profile for this sub-category.",
            });

            db.Applications.Add(application);
            await db.SaveChangesAsync(ct);
        }

        /* ---- money, or no money ---------------------------------------- */
        var owes = programType.IsFeeApplicable
                   && application.FeeAmount > 0m
                   && application.PaymentStatus != PaymentStatus.Paid;

        if (owes)
        {
            return new Outcome(
                "PaymentRequired",
                application.Id,
                application.ApplicationNo,
                application.FeeAmount,
                "Pay the fee to finish registering for this batch.");
        }

        batch.Participants.Add(new ProgrammeParticipant
        {
            ApplicantId = applicantId,
            ApplicationId = application.Id,
            EnrolledOn = DateOnly.FromDateTime(now),
            Result = ParticipantResult.Pending,
        });

        application.Status = ApplicationStatus.Enrolled;
        batch.ParticipantCount = batch.Participants.Count;

        /* Full is full: the next applicant should be told before they try. */
        if (batch.ParticipantCount >= batch.MaxParticipants) batch.RegistrationsOpen = false;

        await db.SaveChangesAsync(ct);

        await notifications.SendProgrammeScheduleAsync(
            batch, applicant.Email, applicant.FullName, ct);

        return new Outcome(
            "Registered",
            application.Id,
            application.ApplicationNo,
            0m,
            "You are registered. The schedule has been emailed to you.");
    }

    /// <summary>
    /// Whether this program type is finished with them.
    ///
    /// The same three rules the listing applies, enforced here because the
    /// listing is only a view: passing it, sitting one that certifies
    /// nobody, or running out of attempts.
    /// </summary>
    private async Task GuardProgramTypeAsync(
        int applicantId, ProgramType programType, CancellationToken ct)
    {
        var sittings = await db.ProgrammeParticipants.AsNoTracking()
            .Where(p => p.ApplicantId == applicantId
                        && p.Programme!.ProgramTypeId == programType.Id)
            .Select(p => p.Result)
            .ToListAsync(ct);

        if (sittings.Any(r => r == ParticipantResult.Pass))
            throw new AppException("You have already cleared this program.");

        if (programType.CertificationPolicy == CertificationPolicy.None
            && sittings.Any(r => r != ParticipantResult.Pending))
        {
            throw new AppException("You have already taken this program.");
        }

        var allowed = Math.Clamp(
            await db.SystemSettings.AsNoTracking()
                .Where(s => s.Id == 1)
                .Select(s => s.ProgramTypeMaxAttempts)
                .FirstOrDefaultAsync(ct) is var n and > 0 ? n : 3,
            1, 10);

        if (sittings.Count(r => r == ParticipantResult.Fail) >= allowed)
            throw new AppException($"You have used all {allowed} attempts at this program.");
    }
}
