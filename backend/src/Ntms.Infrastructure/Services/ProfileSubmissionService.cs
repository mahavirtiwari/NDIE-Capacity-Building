using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// The gate an applicant passes before any program opens to them.
///
/// They answer their sub-category's profile form, it is read on the scrutiny
/// queue, and only an accepted profile makes the programs beneath that
/// discipline visible. A rejection is not the end of it — the answers are
/// handed back so they can be corrected — but there are only so many tries,
/// and running out closes the discipline for a while.
/// </summary>
public class ProfileSubmissionService(NtmsDbContext db, ProfileFormService forms)
{
    private IQueryable<ProfileSubmission> Base => db.ProfileSubmissions
        .Include(s => s.SubCategory)
        .Include(s => s.Applicant)
        .Include(s => s.History);

    /* ----------------------------------------------------------- applicant */

    /// <summary>
    /// Where this applicant stands: what they last sent, what scrutiny said,
    /// how many tries are left, and whether they may send another.
    /// </summary>
    public async Task<ProfileStandingDto> StandingAsync(int applicantId, CancellationToken ct)
    {
        var applicant = await db.Applicants.AsNoTracking()
            .Include(a => a.SubCategory)
            .FirstOrDefaultAsync(a => a.Id == applicantId, ct)
            ?? throw AppException.NotFound("Applicant");

        var wanted = applicant.SubCategory?.RequiresProfileForm ?? true;

        var latest = await Base.AsNoTracking()
            .Where(s => s.ApplicantId == applicantId)
            .OrderByDescending(s => s.AttemptNo)
            .FirstOrDefaultAsync(ct);

        var settings = await SettingsAsync(ct);
        var rejections = await db.ProfileSubmissions.AsNoTracking()
            .CountAsync(s => s.ApplicantId == applicantId
                             && s.Status == ProfileSubmissionStatus.Rejected, ct);

        var blockedUntil = applicant.ProfileBlockedUntil > DateTime.UtcNow
            ? applicant.ProfileBlockedUntil
            : null;

        return new ProfileStandingDto
        {
            Required = wanted,
            /* A discipline that asks for no profile form is open from the
               start: there is nothing to read and nothing to wait for. */
            Cleared = !wanted || latest?.Status == ProfileSubmissionStatus.Approved,
            Status = latest?.Status.ToString(),
            SubCategoryId = applicant.SubCategoryId,
            SubCategoryName = applicant.SubCategory?.Name,
            AttemptNo = latest?.AttemptNo ?? 0,
            AttemptsAllowed = settings.MaxAttempts,
            AttemptsLeft = Math.Max(settings.MaxAttempts - rejections, 0),
            SubmittedOn = latest?.SubmittedOn,
            DecidedOn = latest?.DecidedOn,
            RejectionReasonLabel = latest?.RejectionReasonLabel,
            Remarks = latest?.Remarks,
            BlockedUntil = blockedUntil,
            BlockReason = blockedUntil is null ? null : applicant.ProfileBlockReason,
            /* Handed back so a correction starts from what was said before
               rather than from an empty form. */
            Responses = latest is null
                ? null
                : JsonSerializer.Deserialize<Dictionary<string, object?>>(latest.Responses),
            CanSubmit = wanted
                        && blockedUntil is null
                        && latest?.Status != ProfileSubmissionStatus.Approved
                        && latest?.Status != ProfileSubmissionStatus.Submitted
                        && latest?.Status != ProfileSubmissionStatus.UnderScrutiny
                        && rejections < settings.MaxAttempts,
            History =
            [
                .. (latest?.History ?? []).OrderBy(h => h.On).Select(h => new ScrutinyEventDto
                {
                    Id = h.Id,
                    Action = h.Action.ToString(),
                    ByUserName = h.ByUserName,
                    ByRole = h.ByRole,
                    On = h.On,
                    Remarks = h.Remarks,
                    RejectionReasonLabel = h.RejectionReasonLabel,
                }),
            ],
        };
    }

    /// <summary>
    /// Sends the profile for scrutiny, as a new attempt.
    ///
    /// Every refusal here is one the applicant can act on, because the app
    /// shows it to them: blocked, already approved, already waiting, or out
    /// of tries.
    /// </summary>
    public async Task<ProfileStandingDto> SubmitAsync(
        int applicantId, Dictionary<string, object?> responses, CancellationToken ct)
    {
        var applicant = await db.Applicants
            .Include(a => a.SubCategory)
            .FirstOrDefaultAsync(a => a.Id == applicantId, ct)
            ?? throw AppException.NotFound("Applicant");

        if (!(applicant.SubCategory?.RequiresProfileForm ?? true))
            throw new AppException("This sub-category does not ask for a profile form.");

        if (applicant.ProfileBlockedUntil > DateTime.UtcNow)
        {
            throw new AppException(
                $"Your profile was turned down too many times. You can try again after " +
                $"{applicant.ProfileBlockedUntil:d MMMM yyyy}.");
        }

        var settings = await SettingsAsync(ct);

        var attempts = await db.ProfileSubmissions
            .Where(s => s.ApplicantId == applicantId)
            .ToListAsync(ct);

        var latest = attempts.OrderByDescending(s => s.AttemptNo).FirstOrDefault();

        if (latest?.Status == ProfileSubmissionStatus.Approved)
            throw new AppException("Your profile has already been accepted.");

        if (latest?.Status is ProfileSubmissionStatus.Submitted
            or ProfileSubmissionStatus.UnderScrutiny)
        {
            throw new AppException("Your profile is with scrutiny. You will be told the outcome.");
        }

        var rejections = attempts.Count(s => s.Status == ProfileSubmissionStatus.Rejected);
        if (rejections >= settings.MaxAttempts)
            throw new AppException("You have used every attempt at the profile form.");

        var form = await forms.ActiveForAsync(applicant.SubCategoryId, ct)
                   ?? throw new AppException(
                       "No profile form has been published for your sub-category yet.");

        var now = DateTime.UtcNow;

        var submission = new ProfileSubmission
        {
            ApplicantId = applicantId,
            SubCategoryId = applicant.SubCategoryId,
            ProfileFormId = form.Id,
            AttemptNo = (latest?.AttemptNo ?? 0) + 1,
            Responses = JsonSerializer.Serialize(responses),
            /* A form nobody reads is accepted as it arrives. Queuing it
               would be a queue of submissions to rubber-stamp, and the
               applicant would wait for somebody to do nothing. */
            Status = form.RequiresScrutiny
                ? ProfileSubmissionStatus.Submitted
                : ProfileSubmissionStatus.Approved,
            SubmittedOn = now,
            DecidedOn = form.RequiresScrutiny ? null : now,
            DecidedByUserName = form.RequiresScrutiny ? null : "Not scrutinised",
        };

        submission.History.Add(new ProfileScrutinyEvent
        {
            Action = ScrutinyAction.Submitted,
            ByUserName = applicant.FullName,
            ByRole = "Applicant",
            On = now,
        });

        /* Written down rather than left implicit. Somebody reading this a
           year later needs to see why it was never on a queue, and "the
           form asks for no scrutiny" is the answer — not an omission by
           whoever was on it. */
        if (!form.RequiresScrutiny)
        {
            submission.History.Add(new ProfileScrutinyEvent
            {
                Action = ScrutinyAction.Approved,
                ByUserName = "System",
                ByRole = "System",
                On = now,
                Remarks = "This sub-category's profile form is not scrutinised.",
            });
        }

        db.ProfileSubmissions.Add(submission);
        await db.SaveChangesAsync(ct);

        return await StandingAsync(applicantId, ct);
    }

    /* -------------------------------------------------------------- office */

    /// <summary>What is waiting to be read, newest request first.</summary>
    public async Task<PagedResult<ProfileSubmissionDto>> QueueAsync(
        PagedRequest request, string? status, int? subCategoryId, CancellationToken ct)
    {
        var wanted = string.IsNullOrWhiteSpace(status)
            ? null
            : (ProfileSubmissionStatus?)Enum.Parse<ProfileSubmissionStatus>(status, true);

        var query = Base.AsNoTracking()
            .Where(s => s.Status != ProfileSubmissionStatus.Draft)
            .WhereIf(wanted.HasValue, s => s.Status == wanted)
            .WhereIf(subCategoryId.HasValue, s => s.SubCategoryId == subCategoryId)
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                s => s.Applicant!.FullName.Contains(request.Search!)
                     || s.Applicant!.ApplicantCode.Contains(request.Search!))
            .OrderByDescending(s => s.SubmittedOn);

        return await query.ToPagedResultAsync(request, Map, ct);
    }

    public async Task<ProfileSubmissionDto> GetAsync(int id, CancellationToken ct) =>
        Map(await Base.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw AppException.NotFound("Profile submission"));

    /// <summary>Accepts a profile, which opens the discipline to the applicant.</summary>
    public async Task<ProfileSubmissionDto> ApproveAsync(
        int id, string? remarks, string byUser, string byRole, CancellationToken ct)
    {
        var submission = await Decidable(id, ct);

        submission.Status = ProfileSubmissionStatus.Approved;
        submission.DecidedOn = DateTime.UtcNow;
        submission.DecidedByUserName = byUser;
        submission.Remarks = remarks;
        submission.RejectionReasonId = null;
        submission.RejectionReasonLabel = null;

        submission.History.Add(new ProfileScrutinyEvent
        {
            Action = ScrutinyAction.Approved,
            ByUserName = byUser,
            ByRole = byRole,
            On = submission.DecidedOn.Value,
            Remarks = remarks,
        });

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Turns a profile down, and closes the discipline if that was the last
    /// try.
    ///
    /// The block is worked out here rather than left for a nightly job,
    /// because the applicant is told the outcome immediately and what they
    /// are told has to be true.
    /// </summary>
    public async Task<ProfileSubmissionDto> RejectAsync(
        int id, int reasonId, string? remarks, string byUser, string byRole, CancellationToken ct)
    {
        var submission = await Decidable(id, ct);

        var reason = await db.RejectionReasons.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == reasonId && r.Status == RecordStatus.Active, ct)
            ?? throw new AppException("Choose a reason for the rejection.");

        submission.Status = ProfileSubmissionStatus.Rejected;
        submission.DecidedOn = DateTime.UtcNow;
        submission.DecidedByUserName = byUser;
        submission.RejectionReasonId = reason.Id;
        submission.RejectionReasonLabel = reason.Label;
        submission.Remarks = remarks;

        submission.History.Add(new ProfileScrutinyEvent
        {
            Action = ScrutinyAction.Rejected,
            ByUserName = byUser,
            ByRole = byRole,
            On = submission.DecidedOn.Value,
            Remarks = remarks,
            RejectionReasonLabel = reason.Label,
        });

        var settings = await SettingsAsync(ct);
        var rejections = await db.ProfileSubmissions
            .CountAsync(s => s.ApplicantId == submission.ApplicantId
                             && s.Status == ProfileSubmissionStatus.Rejected, ct);

        /* The one being rejected now is not counted by the query above until
           it is saved, so it is added here. */
        if (rejections + 1 >= settings.MaxAttempts)
        {
            var applicant = await db.Applicants.FirstAsync(a => a.Id == submission.ApplicantId, ct);
            applicant.ProfileBlockedUntil = DateTime.UtcNow.AddMonths(settings.BlockMonths);
            applicant.ProfileBlockReason = reason.Label;
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /* ------------------------------------------------------------ helpers */

    private async Task<ProfileSubmission> Decidable(int id, CancellationToken ct)
    {
        var submission = await Base.FirstOrDefaultAsync(s => s.Id == id, ct)
                         ?? throw AppException.NotFound("Profile submission");

        if (submission.Status is ProfileSubmissionStatus.Approved
            or ProfileSubmissionStatus.Rejected)
        {
            throw new AppException("This profile has already been decided.");
        }

        return submission;
    }

    private async Task<(int MaxAttempts, int BlockMonths)> SettingsAsync(CancellationToken ct)
    {
        var row = await db.SystemSettings.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == 1, ct);

        /* Clamped, because a zero would block every applicant on their first
           rejection and a negative would never block anybody. */
        return (
            Math.Clamp(row?.ProfileMaxAttempts ?? 3, 1, 10),
            Math.Clamp(row?.ProfileBlockMonths ?? 6, 1, 60));
    }

    private static ProfileSubmissionDto Map(ProfileSubmission s) => new()
    {
        Id = s.Id,
        ApplicantId = s.ApplicantId,
        ApplicantCode = s.Applicant?.ApplicantCode,
        ApplicantName = s.Applicant?.FullName,
        SubCategoryId = s.SubCategoryId,
        SubCategoryName = s.SubCategory?.Name,
        ProfileFormId = s.ProfileFormId,
        AttemptNo = s.AttemptNo,
        Status = s.Status.ToString(),
        SubmittedOn = s.SubmittedOn,
        DecidedOn = s.DecidedOn,
        DecidedByUserName = s.DecidedByUserName,
        RejectionReasonId = s.RejectionReasonId,
        RejectionReasonLabel = s.RejectionReasonLabel,
        Remarks = s.Remarks,
        Responses = JsonSerializer.Deserialize<Dictionary<string, object?>>(s.Responses)
                    ?? [],
        History =
        [
            .. s.History.OrderBy(h => h.On).Select(h => new ScrutinyEventDto
            {
                Id = h.Id,
                Action = h.Action.ToString(),
                ByUserName = h.ByUserName,
                ByRole = h.ByRole,
                On = h.On,
                Remarks = h.Remarks,
                RejectionReasonLabel = h.RejectionReasonLabel,
            }),
        ],
    };
}
