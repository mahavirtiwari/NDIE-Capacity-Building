using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// The gate an applicant passes before the programs of a discipline open to
/// them.
///
/// They choose a category and a sub-category, answer that sub-category's
/// profile form, and — where the form asks to be read — wait for scrutiny.
/// One profile per category: somebody in ZED Certification is a Silver
/// assessor or a Bronze trainer, not both. Several categories are fine, and
/// a new one can start from the answers they already gave.
/// </summary>
public class ProfileSubmissionService(NtmsDbContext db, ProfileFormService forms)
{
    private IQueryable<ProfileSubmission> Base => db.ProfileSubmissions
        .Include(s => s.Category)
        .Include(s => s.SubCategory)
        .Include(s => s.Applicant)
        .Include(s => s.History);

    /* ----------------------------------------------------------- applicant */

    /// <summary>
    /// Every profile this applicant holds, newest first, with where each
    /// one stands.
    /// </summary>
    public async Task<List<ProfileStandingDto>> MineAsync(int applicantId, CancellationToken ct)
    {
        var mine = await Base.AsNoTracking()
            .Where(s => s.ApplicantId == applicantId)
            .ToListAsync(ct);

        var settings = await SettingsAsync(ct);

        return
        [
            .. mine
                .GroupBy(s => s.SubCategoryId)
                .Select(g => Standing(g.ToList(), settings))
                .OrderByDescending(s => s.SubmittedOn),
        ];
    }

    /// <summary>
    /// Where they stand with one discipline — including one they have not
    /// started, so the app can ask whether they may begin.
    /// </summary>
    public async Task<ProfileStandingDto> StandingAsync(
        int applicantId, int subCategoryId, CancellationToken ct)
    {
        var subCategory = await db.SubCategories.AsNoTracking()
            .Include(c => c.Category)
            .FirstOrDefaultAsync(c => c.Id == subCategoryId, ct)
            ?? throw AppException.NotFound("Sub-category");

        var attempts = await Base.AsNoTracking()
            .Where(s => s.ApplicantId == applicantId && s.SubCategoryId == subCategoryId)
            .ToListAsync(ct);

        if (attempts.Count > 0) return Standing(attempts, await SettingsAsync(ct));

        var settings = await SettingsAsync(ct);

        return new ProfileStandingDto
        {
            Required = subCategory.RequiresProfileForm,
            Cleared = !subCategory.RequiresProfileForm,
            CategoryId = subCategory.CategoryId,
            CategoryName = subCategory.Category?.Name,
            SubCategoryId = subCategoryId,
            SubCategoryName = subCategory.Name,
            AttemptsAllowed = settings.MaxAttempts,
            AttemptsLeft = settings.MaxAttempts,
            CanSubmit = subCategory.RequiresProfileForm,
        };
    }

    /// <summary>
    /// The sub-categories this applicant may still start a profile in.
    ///
    /// A category they are already in offers nothing: they hold one profile
    /// per category and it is settled. Everything else is open.
    /// </summary>
    public async Task<List<ProfileChoiceDto>> ChoicesAsync(int applicantId, CancellationToken ct)
    {
        var taken = await db.ProfileSubmissions.AsNoTracking()
            .Where(s => s.ApplicantId == applicantId)
            .Select(s => s.CategoryId)
            .Distinct()
            .ToListAsync(ct);

        return
        [
            .. await db.SubCategories.AsNoTracking()
                .Include(s => s.Category)
                .Where(s => s.Status == RecordStatus.Active
                            && s.Category!.Status == RecordStatus.Active
                            && !taken.Contains(s.CategoryId))
                .OrderBy(s => s.Category!.Name).ThenBy(s => s.Name)
                .Select(s => new ProfileChoiceDto
                {
                    CategoryId = s.CategoryId,
                    CategoryName = s.Category!.Name,
                    SubCategoryId = s.Id,
                    SubCategoryName = s.Name,
                    RequiresProfileForm = s.RequiresProfileForm,
                })
                .ToListAsync(ct),
        ];
    }

    /// <summary>
    /// The answers from a profile they already hold, to start another from.
    ///
    /// Only from one that was accepted: copying a set of answers that was
    /// turned down would carry the fault into the new discipline. The keys
    /// that do not exist on the new form are dropped where it is filled in,
    /// not here, because this does not know which form it is going to.
    /// </summary>
    public async Task<Dictionary<string, object?>> FetchAsync(
        int applicantId, int fromSubCategoryId, CancellationToken ct)
    {
        var source = await db.ProfileSubmissions.AsNoTracking()
            .Where(s => s.ApplicantId == applicantId
                        && s.SubCategoryId == fromSubCategoryId
                        && s.Status == ProfileSubmissionStatus.Approved)
            .OrderByDescending(s => s.AttemptNo)
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("An accepted profile for that sub-category");

        return JsonSerializer.Deserialize<Dictionary<string, object?>>(source.Responses) ?? [];
    }

    /// <summary>
    /// Sends a profile for one discipline, as a new attempt at it.
    ///
    /// Every refusal here is one the applicant can act on, because the app
    /// shows it to them: the wrong category, blocked, already accepted,
    /// already waiting, or out of tries.
    /// </summary>
    public async Task<ProfileStandingDto> SubmitAsync(
        int applicantId, int subCategoryId, Dictionary<string, object?> responses,
        CancellationToken ct)
    {
        var applicant = await db.Applicants.FirstOrDefaultAsync(a => a.Id == applicantId, ct)
                        ?? throw AppException.NotFound("Applicant");

        if (applicant.IsBlocked) throw AppException.Forbidden("Your account is blocked.");

        var subCategory = await db.SubCategories.AsNoTracking()
            .Include(s => s.Category)
            .FirstOrDefaultAsync(s => s.Id == subCategoryId, ct)
            ?? throw AppException.NotFound("Sub-category");

        if (!subCategory.RequiresProfileForm)
            throw new AppException("This sub-category does not ask for a profile form.");

        /* ---- one sub-category per category ---------------------------
           Checked here rather than at sign-up, which no longer knows which
           discipline anybody is in. */
        var elsewhere = await db.ProfileSubmissions.AsNoTracking()
            .Where(s => s.ApplicantId == applicantId
                        && s.CategoryId == subCategory.CategoryId
                        && s.SubCategoryId != subCategoryId)
            .Select(s => s.SubCategory!.Name)
            .FirstOrDefaultAsync(ct);

        if (elsewhere is not null)
        {
            throw new AppException(
                $"You are already registered under {elsewhere} in " +
                $"{subCategory.Category?.Name}. One sub-category per category.");
        }

        var settings = await SettingsAsync(ct);

        var attempts = await db.ProfileSubmissions
            .Where(s => s.ApplicantId == applicantId && s.SubCategoryId == subCategoryId)
            .ToListAsync(ct);

        var latest = attempts.OrderByDescending(s => s.AttemptNo).FirstOrDefault();

        if (latest?.Status == ProfileSubmissionStatus.Approved)
            throw new AppException("Your profile for this sub-category has already been accepted.");

        if (latest?.Status is ProfileSubmissionStatus.Submitted
            or ProfileSubmissionStatus.UnderScrutiny)
        {
            throw new AppException("Your profile is with scrutiny. You will be told the outcome.");
        }

        var blockedUntil = BlockedUntil(attempts, settings);
        if (blockedUntil > DateTime.UtcNow)
        {
            throw new AppException(
                "Your profile for this sub-category was turned down too many times. " +
                $"You can try again after {blockedUntil:d MMMM yyyy}.");
        }

        var form = await forms.ActiveForAsync(subCategoryId, ct)
                   ?? throw new AppException(
                       "No profile form has been published for this sub-category yet.");

        var now = DateTime.UtcNow;

        var submission = new ProfileSubmission
        {
            ApplicantId = applicantId,
            CategoryId = subCategory.CategoryId,
            SubCategoryId = subCategoryId,
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
           year later needs to see why it was never on a queue. */
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

        /* The first discipline somebody enters is kept on the applicant for
           the reports that group by one. It is never changed afterwards:
           a report that silently moved people between categories as they
           added profiles would be worse than one that is plainly partial. */
        if (applicant.CategoryId is null)
        {
            applicant.CategoryId = subCategory.CategoryId;
            applicant.SubCategoryId = subCategoryId;
        }

        await db.SaveChangesAsync(ct);

        return await StandingAsync(applicantId, subCategoryId, ct);
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
    /// Turns a profile down. The applicant corrects it and sends it again,
    /// until they run out of tries — at which point the discipline closes
    /// to them for a while, which falls out of the attempts rather than
    /// being written anywhere.
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

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /* ------------------------------------------------------------ helpers */

    /// <summary>
    /// Where one discipline's attempts have got to.
    ///
    /// The block is worked out here rather than stored: it is the last
    /// rejection plus the months the settings allow, once the tries are
    /// used up. Nothing has to remember to lift it, and changing the
    /// setting changes every block at once rather than only new ones.
    /// </summary>
    private static ProfileStandingDto Standing(
        List<ProfileSubmission> attempts, (int MaxAttempts, int BlockMonths) settings)
    {
        var latest = attempts.OrderByDescending(s => s.AttemptNo).First();
        var rejections = attempts.Count(s => s.Status == ProfileSubmissionStatus.Rejected);
        var blockedUntil = BlockedUntil(attempts, settings);
        var blocked = blockedUntil > DateTime.UtcNow;

        return new ProfileStandingDto
        {
            Required = true,
            Cleared = latest.Status == ProfileSubmissionStatus.Approved,
            Status = latest.Status.ToString(),
            CategoryId = latest.CategoryId,
            CategoryName = latest.Category?.Name,
            SubCategoryId = latest.SubCategoryId,
            SubCategoryName = latest.SubCategory?.Name,
            AttemptNo = latest.AttemptNo,
            AttemptsAllowed = settings.MaxAttempts,
            AttemptsLeft = Math.Max(settings.MaxAttempts - rejections, 0),
            SubmittedOn = latest.SubmittedOn,
            DecidedOn = latest.DecidedOn,
            RejectionReasonLabel = latest.RejectionReasonLabel,
            Remarks = latest.Remarks,
            BlockedUntil = blocked ? blockedUntil : null,
            BlockReason = blocked ? latest.RejectionReasonLabel : null,
            /* Handed back so a correction starts from what was said before
               rather than from an empty form. */
            Responses = JsonSerializer.Deserialize<Dictionary<string, object?>>(latest.Responses),
            CanSubmit = !blocked
                        && latest.Status != ProfileSubmissionStatus.Approved
                        && latest.Status != ProfileSubmissionStatus.Submitted
                        && latest.Status != ProfileSubmissionStatus.UnderScrutiny
                        && rejections < settings.MaxAttempts,
            History =
            [
                .. latest.History.OrderBy(h => h.On).Select(Event),
            ],
        };
    }

    private static DateTime? BlockedUntil(
        List<ProfileSubmission> attempts, (int MaxAttempts, int BlockMonths) settings)
    {
        var rejections = attempts
            .Where(s => s.Status == ProfileSubmissionStatus.Rejected && s.DecidedOn.HasValue)
            .ToList();

        if (rejections.Count < settings.MaxAttempts) return null;
        return rejections.Max(s => s.DecidedOn)!.Value.AddMonths(settings.BlockMonths);
    }

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

    private static ScrutinyEventDto Event(ProfileScrutinyEvent h) => new()
    {
        Id = h.Id,
        Action = h.Action.ToString(),
        ByUserName = h.ByUserName,
        ByRole = h.ByRole,
        On = h.On,
        Remarks = h.Remarks,
        RejectionReasonLabel = h.RejectionReasonLabel,
    };

    private static ProfileSubmissionDto Map(ProfileSubmission s) => new()
    {
        Id = s.Id,
        ApplicantId = s.ApplicantId,
        ApplicantCode = s.Applicant?.ApplicantCode,
        ApplicantName = s.Applicant?.FullName,
        CategoryId = s.CategoryId,
        CategoryName = s.Category?.Name,
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
        Responses = JsonSerializer.Deserialize<Dictionary<string, object?>>(s.Responses) ?? [],
        History = [.. s.History.OrderBy(h => h.On).Select(Event)],
    };
}
