using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
    ApplicantEligibilityService rules,
    ProgrammeSchedulePdf schedules,
    INotificationService notifications,
    ILogger<BatchRegistrationService> logger)
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

        await GuardProgramTypeAsync(applicantId, batch, ct);

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
                ProgrammeId = batch.Id,
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

        /* The batch they are registering for now, which is not
           necessarily the one the application was first made for: an
           application covers the program type, and somebody whose payment
           lapsed may come back and choose a different date. */
        application.ProgrammeId = batch.Id;

        /* ---- money, or no money ---------------------------------------- */
        var owes = programType.IsFeeApplicable
                   && application.FeeAmount > 0m
                   && application.PaymentStatus != PaymentStatus.Paid;

        if (owes)
        {
            await db.SaveChangesAsync(ct);

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

        /* The timetable, generated now rather than stored: a curriculum
           can be edited afterwards, and what they were sent should be what
           was true when they registered. A failure here must not undo a
           seat that has been taken, so the message goes without it. */
        EmailAttachment? schedule = null;
        try
        {
            schedule = await schedules.BuildAsync(batch.Id, ct);
        }
        catch (Exception caught)
        {
            logger.LogWarning(caught,
                "The schedule for {Programme} could not be built; the joining "
                + "instructions go without it.", batch.ProgrammeId);
        }

        await notifications.SendProgrammeScheduleAsync(
            batch, applicant.Email, applicant.FullName, schedule, ct);

        return new Outcome(
            "Registered",
            application.Id,
            application.ApplicationNo,
            0m,
            "You are registered. The schedule has been emailed to you.");
    }

    /// <summary>
    /// Whether this applicant's own history closes the batch to them.
    ///
    /// The rules live in one place and the listing asks the same question,
    /// so the card and the refusal cannot disagree: passing the track,
    /// having taken one that certifies nobody, running out of attempts,
    /// already holding a live booking in the same track, or being booked
    /// on something else across the same dates.
    ///
    /// Enforced here as well as on the listing because the listing is only
    /// a view, and this is where the seat is actually taken.
    /// </summary>
    private async Task GuardProgramTypeAsync(
        int applicantId, Programme batch, CancellationToken ct)
    {
        var standing = await rules.ReadAsync(applicantId, ct);

        /* Registering twice for the same batch is caught by the caller,
           with a message of its own; this must not shadow it with "you are
           already registered for this program". */
        if (standing.Refuse(batch) is { } refused
            && !await db.ProgrammeParticipants.AsNoTracking()
                .AnyAsync(p => p.ApplicantId == applicantId && p.ProgrammeId == batch.Id, ct))
        {
            throw new AppException(refused);
        }
    }
}
