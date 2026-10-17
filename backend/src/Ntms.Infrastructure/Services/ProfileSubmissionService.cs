using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Identity;
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
public class ProfileSubmissionService(
    NtmsDbContext db,
    ProfileFormService forms,
    ProfileAttachmentService attachments,
    ICurrentUser currentUser)
{
    private IQueryable<ProfileSubmission> Base => db.ProfileSubmissions
        .Include(s => s.AssignedToUser)!.ThenInclude(u => u!.Role)
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

        /* Whether each discipline's form is read, and whether one exists
           at all. Read here so the applicant is told before they choose:
           one sub-category may open its programs the moment the form is
           sent while its neighbour queues for scrutiny, and that is worth
           knowing before filling in forty answers. */
        var published = await db.ProfileForms.AsNoTracking()
            .Where(f => f.Status == RecordStatus.Active)
            .Select(f => new { f.SubCategoryId, f.RequiresScrutiny })
            .ToListAsync(ct);

        var scrutiny = published
            .GroupBy(f => f.SubCategoryId)
            .ToDictionary(g => g.Key, g => g.First().RequiresScrutiny);

        var choices = await db.SubCategories.AsNoTracking()
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
            .ToListAsync(ct);

        foreach (var choice in choices)
        {
            choice.FormPublished = !choice.RequiresProfileForm
                                   || scrutiny.ContainsKey(choice.SubCategoryId);

            choice.RequiresScrutiny = choice.RequiresProfileForm
                                      && scrutiny.GetValueOrDefault(choice.SubCategoryId, true);
        }

        return choices;
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
    /// Keeps what has been filled in so far, without sending it.
    ///
    /// A profile form runs to dozens of answers across several sections.
    /// Until now none of it existed anywhere but the phone's memory, so
    /// signing out — or the app being killed behind a phone call — threw
    /// the lot away and the applicant started again. The attachments did
    /// survive, because those upload as they are picked, which made the
    /// loss stranger still: the documents were there and the answers
    /// beside them were gone.
    ///
    /// The draft is the same row the submission will be, in Draft status,
    /// which is what that status was always for. It is not a second record
    /// that has to be reconciled with the first: handing it in promotes
    /// this row rather than adding another, so the attempt count cannot
    /// drift and a draft cannot be read as a try that was used.
    ///
    /// Nothing is validated here. A draft is by definition half-finished,
    /// and refusing to keep it because a required answer is missing would
    /// defeat the point. The rules are applied when it is handed in.
    /// </summary>
    public async Task<ProfileStandingDto> SaveDraftAsync(
        int applicantId, int subCategoryId, Dictionary<string, object?> responses,
        CancellationToken ct)
    {
        var applicant = await db.Applicants.AsNoTracking()
                            .FirstOrDefaultAsync(a => a.Id == applicantId, ct)
                        ?? throw AppException.NotFound("Applicant");

        if (applicant.IsBlocked) throw AppException.Forbidden("Your account is blocked.");

        var subCategory = await db.SubCategories.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == subCategoryId, ct)
            ?? throw AppException.NotFound("Sub-category");

        var attempts = await db.ProfileSubmissions
            .Where(s => s.ApplicantId == applicantId && s.SubCategoryId == subCategoryId)
            .ToListAsync(ct);

        var draft = attempts.FirstOrDefault(s => s.Status == ProfileSubmissionStatus.Draft);

        /* A profile already accepted, or already on a desk, is not a thing
           to be drafted over. Silently keeping a draft behind one would
           let the applicant type into a form whose answers can never be
           sent, which is a worse outcome than being told. */
        var settled = attempts
            .Where(s => s.Status != ProfileSubmissionStatus.Draft)
            .OrderByDescending(s => s.AttemptNo)
            .FirstOrDefault();

        if (settled?.Status == ProfileSubmissionStatus.Approved)
            throw new AppException("Your profile for this sub-category has already been accepted.");

        if (settled?.Status is ProfileSubmissionStatus.Submitted
            or ProfileSubmissionStatus.UnderScrutiny)
        {
            throw new AppException("Your profile is with scrutiny. You will be told the outcome.");
        }

        var json = JsonSerializer.Serialize(responses);

        if (draft is not null)
        {
            draft.Responses = json;
            draft.ProfileFormId = (await forms.ActiveForAsync(subCategoryId, ct))?.Id
                                  ?? draft.ProfileFormId;
        }
        else
        {
            db.ProfileSubmissions.Add(new ProfileSubmission
            {
                ApplicantId = applicantId,
                CategoryId = subCategory.CategoryId,
                SubCategoryId = subCategoryId,
                ProfileFormId = (await forms.ActiveForAsync(subCategoryId, ct))?.Id,
                /* The attempt it will be once it is handed in, so the
                   screen can say "attempt 2" while it is still being
                   written. Recomputed on submit in case another attempt
                   was decided in between. */
                AttemptNo = (settled?.AttemptNo ?? 0) + 1,
                Responses = json,
                Status = ProfileSubmissionStatus.Draft,
            });
        }

        await db.SaveChangesAsync(ct);
        return await StandingAsync(applicantId, subCategoryId, ct);
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
                        && s.SubCategoryId != subCategoryId
                        /* A draft is not a registration. Somebody who
                           opened the wrong discipline, typed two answers
                           and left would otherwise be locked out of the
                           category they actually wanted. */
                        && s.Status != ProfileSubmissionStatus.Draft)
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

        /* The draft, if one is being handed in, and the last attempt that
           was actually sent. Kept apart: the draft is the row about to
           become attempt n, not attempt n itself, so counting it as one
           would make every first submission look like a second. */
        var draft = attempts.FirstOrDefault(s => s.Status == ProfileSubmissionStatus.Draft);
        var sent = attempts
            .Where(s => s.Status != ProfileSubmissionStatus.Draft)
            .ToList();

        var latest = sent.OrderByDescending(s => s.AttemptNo).FirstOrDefault();

        if (latest?.Status == ProfileSubmissionStatus.Approved)
            throw new AppException("Your profile for this sub-category has already been accepted.");

        if (latest?.Status is ProfileSubmissionStatus.Submitted
            or ProfileSubmissionStatus.UnderScrutiny)
        {
            throw new AppException("Your profile is with scrutiny. You will be told the outcome.");
        }

        var blockedUntil = BlockedUntil(sent, settings);
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

        /* The draft becomes the submission. One row, so the answers kept
           along the way and the answers handed in are the same record and
           cannot disagree. */
        var submission = draft ?? new ProfileSubmission
        {
            ApplicantId = applicantId,
            CategoryId = subCategory.CategoryId,
            SubCategoryId = subCategoryId,
        };

        submission.ProfileFormId = form.Id;
        submission.AttemptNo = (latest?.AttemptNo ?? 0) + 1;
        submission.Responses = JsonSerializer.Serialize(responses);
        /* A form nobody reads is accepted as it arrives. Queuing it would
           be a queue of submissions to rubber-stamp, and the applicant
           would wait for somebody to do nothing. */
        submission.Status = form.RequiresScrutiny
            ? ProfileSubmissionStatus.Submitted
            : ProfileSubmissionStatus.Approved;
        submission.SubmittedOn = now;
        submission.DecidedOn = form.RequiresScrutiny ? null : now;
        submission.DecidedByUserName = form.RequiresScrutiny ? null : "Not scrutinised";

        /* Where this person is, taken from the answers they have just given.

           The account's own state used to be set in one place only - the
           applicant editing their address in the app - and sign-up never
           asked. So an applicant who signed up, filled in a profile and
           waited had no state on their account at all, and a state is what
           the whole estate is divided by: the Applicants register and its
           export are scoped by it, the State/UT filters read it, and the
           officer a profile is placed with is chosen by it. All three were
           quietly answering "nowhere".

           The form has already asked. A field typed State or District
           stores the LGD code, which is the same code every other state on
           the record is written in, so the answer can simply be moved onto
           the account - where the scope reads it. Only when the account has
           none: an address the applicant has since corrected themselves is
           theirs and is not overwritten by an older form. */
        await StampWhereTheyAreFromAsync(applicant, form, responses, ct);

        /* Onto somebody's desk, not into a shared pile. Only where there is
           a decision to take: a form nobody reads needs no officer. */
        if (form.RequiresScrutiny)
        {
            submission.AssignedToUserId = await PickScrutinyOfficerAsync(
                subCategoryId, applicant.StateCode, ct);
            submission.AssignedOn = submission.AssignedToUserId is null ? null : now;
        }

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

        if (draft is null) db.ProfileSubmissions.Add(submission);

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
    /// <summary>
    /// The scrutiny queue, filtered the way the applications register used
    /// to be — that register is gone, and this is the one scrutiny now.
    ///
    /// A profile belongs to a discipline rather than to a course, so a
    /// program type filter resolves to the sub-category that type sits in:
    /// asking for Assessor - Silver asks for the profiles that qualify
    /// somebody for it. The state is the applicant's; a submission has none
    /// of its own.
    /// </summary>
    /// <summary>
    /// The profiles this account may read at all.
    ///
    /// An Operation Manager sees the desk they were given. The Super Admin
    /// and the Ministry see everything, which is how a profile nobody was
    /// found for gets noticed and placed. An Admin sees the disciplines it
    /// was allocated, which is the same answer every other register gives
    /// it. Below the Operation Manager, nobody.
    ///
    /// That last part was missing: the rule narrowed for the Operation
    /// Manager and let every other tier through to the whole register,
    /// which was written with the tiers above in mind. An agency login
    /// sits beneath, so it read every profile in the scheme — names,
    /// disciplines, decisions, and the reasons people were turned down.
    /// An agency runs the batches it is given and has no part in deciding
    /// who is let into a discipline.
    ///
    /// Applied to the record as well as to the list. Hiding a row while
    /// leaving it to be fetched by its id hides nothing.
    /// </summary>
    private IQueryable<ProfileSubmission> Visible()
    {
        var query = Base.AsNoTracking()
            /* A draft has not been handed in, so it is in nobody's queue. */
            .Where(s => s.Status != ProfileSubmissionStatus.Draft);

        switch (currentUser.Tier)
        {
            case BaseRole.OperationManager:
                var self = currentUser.UserId ?? 0;
                return query.Where(s => s.AssignedToUserId == self);

            /* Unscoped by design, and the only two that are. */
            case BaseRole.SuperAdmin:
            case BaseRole.Ministry:
                return query;

            /* An Admin saw the whole register, in every scheme and every
               state, because it was grouped with the two tiers above it.
               It does not belong there: an Admin is allocated categories,
               sub-categories and states like an Operation Manager, and
               every other register it reads honours that allocation. A
               profile carries somebody's name, their documents and the
               reason they were turned down, so reading one outside the
               allocation is reading a stranger's file.

               The discipline is narrowed and the territory is not, which is
               the one place this differs from the other registers. A
               profile's state is the applicant's, and an applicant has no
               state until they fill in their address - so filtering on it
               would hide exactly the profiles this tier exists to notice:
               the ones nobody has been found for. Where the applicant has
               said where they are, it is honoured. */
            case BaseRole.Admin:
                var categories = currentUser.ScopeCategoryIds;
                var subCategories = currentUser.ScopeSubCategoryIds;
                var states = currentUser.ScopeStateCodes;

                if (categories.Count > 0)
                    query = query.Where(s => categories.Contains(s.CategoryId));
                if (subCategories.Count > 0)
                    query = query.Where(s => subCategories.Contains(s.SubCategoryId));
                if (states.Count > 0)
                {
                    query = query.Where(
                        s => s.Applicant!.StateCode == null
                             || states.Contains(s.Applicant.StateCode.Value));
                }

                return query;

            default:
                return query.Where(_ => false);
        }
    }

    private IQueryable<ProfileSubmission> Queue(
        string? search, string? status, int? categoryId, int? subCategoryId,
        int? programTypeId, string? state, DateOnly? from, DateOnly? to)
    {
        var wanted = string.IsNullOrWhiteSpace(status)
            ? null
            : (ProfileSubmissionStatus?)Enum.Parse<ProfileSubmissionStatus>(status, true);

        var fromStamp = from?.ToDateTime(TimeOnly.MinValue);
        var toStamp = to?.ToDateTime(TimeOnly.MaxValue);

        return Visible()
            .WhereIf(wanted.HasValue, s => s.Status == wanted)
            .WhereIf(categoryId.HasValue, s => s.CategoryId == categoryId)
            .WhereIf(subCategoryId.HasValue, s => s.SubCategoryId == subCategoryId)
            .WhereIf(programTypeId.HasValue, s => db.ProgramTypes
                .Any(p => p.Id == programTypeId && p.SubCategoryId == s.SubCategoryId))
            .WhereIf(!string.IsNullOrWhiteSpace(state),
                s => s.Applicant!.State!.Name == state!.ToUpperInvariant())
            .WhereIf(fromStamp.HasValue, s => s.SubmittedOn >= fromStamp)
            .WhereIf(toStamp.HasValue, s => s.SubmittedOn <= toStamp)
            .WhereIf(!string.IsNullOrWhiteSpace(search),
                s => s.Applicant!.FullName.Contains(search!)
                     || s.Applicant!.ApplicantCode.Contains(search!)
                     || s.Applicant!.Pan.Contains(search!));
    }

    /// <summary>
    /// The Operation Manager a profile belongs to.
    ///
    /// Qualified by allocation rather than by tier: a manager holds program
    /// types and states, so the ones who cover this profile are those with a
    /// program type in its discipline and the applicant's state on their
    /// list. An empty allocation covers nothing, which is the rule
    /// everywhere else here.
    ///
    /// Among those, in turn: the one who has gone longest without being
    /// given a profile in this discipline takes the next one, and a manager
    /// who has never been given one comes before all of them. Over a run of
    /// profiles that deals them round the qualifying managers evenly, which
    /// is what a rota is, and it does not depend on anybody clearing their
    /// desk — the count of open cases, which decided this before, let a
    /// manager who worked through their queue be handed every new arrival.
    ///
    /// Ties go to the lower id, so two profiles arriving together are
    /// placed in a defined order rather than an arbitrary one.
    ///
    /// Null when nobody qualifies. That is not a failure to hide: the
    /// profile stays in the register, unassigned, until a manager who
    /// covers it is appointed, and is then placed by itself.
    /// </summary>
    /// <summary>
    /// Moves the State and District the form asked for onto the account.
    ///
    /// Written onto the applicant rather than onto the submission because
    /// the account is where every scope, filter and allocation in the
    /// system already looks for somebody's territory. Putting a second
    /// copy on the submission would mean two answers to one question.
    ///
    /// Nothing is overwritten. An applicant who has corrected their address
    /// in the app has said something more recent than a form they filled in
    /// months ago, and a district is cleared rather than kept when the
    /// state it belonged to is not the one being set - a district of the
    /// wrong state is worse than no district.
    ///
    /// A form that does not ask, or asks as free text, leaves the account
    /// as it was: there is nothing here to read, and a typed place name
    /// cannot be turned into a code that means the same thing as the rest
    /// of the record.
    /// </summary>
    private async Task StampWhereTheyAreFromAsync(
        Applicant applicant, ProfileForm form, Dictionary<string, object?> responses,
        CancellationToken ct)
    {
        if (applicant.StateCode is not null) return;

        var fields = form.Sections
            .Where(s => s.IsEnabled)
            .SelectMany(s => s.Fields)
            .ToList();

        var state = CodeAnswered(fields, FieldType.State, responses)
                    ?? await NamedStateAsync(fields, responses, ct);

        if (state is null) return;

        applicant.StateCode = state;
        applicant.DistrictCode =
            CodeAnswered(fields, FieldType.District, responses)
            ?? await NamedDistrictAsync(fields, responses, state.Value, ct);
    }

    /// <summary>
    /// The state a form asked for as plain text, matched to the LGD master
    /// by name.
    ///
    /// The State field type exists precisely so this is not necessary: it
    /// stores the code, and a code means the same thing as every other
    /// state on the record. But forms were being designed before it
    /// existed, and a published form asking for the state in a text box is
    /// not something an applicant can be asked to wait out - the account
    /// stays stateless, and with it the register, the filters and the
    /// officer who should have been given the profile.
    ///
    /// So a text answer is accepted when it is exactly the name of a state,
    /// ignoring case and surrounding space. Exactly, and nothing cleverer:
    /// "Delhi" is Delhi, and anything the master does not recognise is left
    /// alone rather than guessed at. A wrong state is worse than none,
    /// because none is visibly missing and wrong is not.
    /// </summary>
    private async Task<int?> NamedStateAsync(
        IEnumerable<ProfileField> fields, Dictionary<string, object?> responses,
        CancellationToken ct)
    {
        var written = TextAnswered(fields, FieldType.State, "state", responses);
        if (written is null) return null;

        return await db.States.AsNoTracking()
            .Where(s => s.Name == written)
            .Select(s => (int?)s.Code)
            .FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// The district, matched the same way and only within the state just
    /// settled - district names repeat across the country, so one read
    /// nationally would be a coin toss between them.
    /// </summary>
    private async Task<int?> NamedDistrictAsync(
        IEnumerable<ProfileField> fields, Dictionary<string, object?> responses,
        int stateCode, CancellationToken ct)
    {
        var written = TextAnswered(fields, FieldType.District, "district", responses);
        if (written is null) return null;

        return await db.Districts.AsNoTracking()
            .Where(d => d.StateCode == stateCode && d.Name == written)
            .Select(d => (int?)d.Code)
            .FirstOrDefaultAsync(ct);
    }

    /// <summary>
    /// What was written in the field this form calls "state" or "district".
    ///
    /// Found by what the field is called, because a text box carries
    /// nothing else to go on. Only an exact name - a form asking "State of
    /// incorporation" is asking a different question and is left to itself.
    /// Returned upper-cased, which is how the LGD master spells everything.
    /// </summary>
    private static string? TextAnswered(
        IEnumerable<ProfileField> fields, FieldType typed, string called,
        Dictionary<string, object?> responses)
    {
        static string Plain(string value) =>
            new string([.. value.Where(char.IsLetter)]).ToLowerInvariant();

        foreach (var field in fields)
        {
            /* A field of the right type is the right field whatever it is
               called - it only reaches here because its answer was not a
               code, which happens where a form was filled in before the
               type was changed under it. Otherwise the name is all there
               is to go on. */
            var named = field.Type is FieldType.Text or FieldType.Select
                        && (Plain(field.Key) == called || Plain(field.Label) == called);

            if (field.Type != typed && !named) continue;

            if (!responses.TryGetValue(field.Key, out var answer) || answer is null) continue;

            var written = answer.ToString()?.Trim();
            if (!string.IsNullOrEmpty(written)) return written.ToUpperInvariant();
        }

        return null;
    }

    /// <summary>
    /// The LGD code answered to the first field of this type, where one was.
    ///
    /// Anything that is not a whole number is not a code - a form asking for
    /// the state as text, an answer left blank, a repeating section whose
    /// answer is a list - and reads as unanswered rather than as a guess.
    /// </summary>
    private static int? CodeAnswered(
        IEnumerable<ProfileField> fields, FieldType type,
        Dictionary<string, object?> responses)
    {
        foreach (var field in fields.Where(f => f.Type == type))
        {
            if (!responses.TryGetValue(field.Key, out var answer) || answer is null) continue;

            var written = answer.ToString();
            if (int.TryParse(written, out var code) && code > 0) return code;
        }

        return null;
    }

    private async Task<int?> PickScrutinyOfficerAsync(
        int subCategoryId, int? applicantState, CancellationToken ct)
    {
        var candidates = db.Users.AsNoTracking()
            .Where(u => u.BaseRole == BaseRole.OperationManager
                        && u.Status == RecordStatus.Active
                        && u.ProgramTypes.Any(held => db.ProgramTypes
                            .Any(p => p.Id == held.ProgramTypeId
                                      && p.SubCategoryId == subCategoryId)));

        /* Where the applicant said where they are, the manager has to cover
           it. Where they did not, the discipline is all there is to go on. */
        if (applicantState is { } state)
        {
            candidates = candidates.Where(u => u.States.Any(s => s.StateCode == state));
        }

        /* Whose turn it is. Measured per discipline rather than across the
           scheme: a manager covering two sub-categories would otherwise be
           skipped in one because they had just been given a case in the
           other, and the rota in each would drift apart. */
        var next = await candidates
            .Select(u => new
            {
                u.Id,
                LastGiven = db.ProfileSubmissions
                    .Where(s => s.AssignedToUserId == u.Id && s.SubCategoryId == subCategoryId)
                    .Max(s => (DateTime?)s.AssignedOn),
            })
            /* Never given one sorts first: null is the smallest value SQL
               Server orders ascending, which is the behaviour wanted here
               and is written down because it is not the behaviour of every
               database this might one day run on. */
            .OrderBy(x => x.LastGiven).ThenBy(x => x.Id)
            .FirstOrDefaultAsync(ct);

        return next?.Id;
    }

    public async Task<PagedResult<ProfileSubmissionDto>> QueueAsync(
        PagedRequest request, string? status, int? categoryId, int? subCategoryId,
        int? programTypeId, string? state, DateOnly? from, DateOnly? to,
        CancellationToken ct)
    {
        var query = Queue(request.Search, status, categoryId, subCategoryId,
                          programTypeId, state, from, to)
            .OrderByDescending(s => s.SubmittedOn);

        return await query.ToPagedResultAsync(request, Map, ct);
    }

    /// <summary>
    /// Places any profile that is waiting with nobody on it.
    ///
    /// A profile is given to an officer when it is handed in, and at that
    /// moment there may be no Operation Manager whose program types and
    /// states cover it. Reassignment by hand is gone, so without this such
    /// a profile would wait for good — including every profile submitted
    /// before an officer who covers it was appointed.
    ///
    /// This used to run at the top of every read of the queue. It costs a
    /// query to pick an officer, a query to load the row and a save of its
    /// own, per waiting profile, and it ran again in full for every
    /// officer who opened the screen - fifty-nine seconds a page against
    /// ten thousand profiles, with twenty-five readers doing the same
    /// twenty thousand round trips each and contending for the rows while
    /// they did it. It is a sweep now, on its own worker, which is where
    /// work that is nobody's request belongs.
    ///
    /// Bounded per pass, so a backlog is worked through over several
    /// rather than holding a connection for the length of one. Returns
    /// how many were placed.
    /// </summary>
    public async Task<int> PlaceUnassignedAsync(CancellationToken ct)
    {
        const int PerPass = 500;

        var waiting = await db.ProfileSubmissions
            .Where(s => s.AssignedToUserId == null
                        && (s.Status == ProfileSubmissionStatus.Submitted
                            || s.Status == ProfileSubmissionStatus.UnderScrutiny))
            /* Oldest first, so a backlog is dealt out in the order it
               arrived - and so the bound below takes the oldest rather
               than whichever the database happened to return. */
            .OrderBy(s => s.Id)
            .Take(PerPass)
            .Select(s => new { s.Id, s.SubCategoryId, s.Applicant!.StateCode })
            .ToListAsync(ct);

        if (waiting.Count == 0) return 0;

        var placed = 0;

        foreach (var row in waiting)
        {
            var officer = await PickScrutinyOfficerAsync(row.SubCategoryId, row.StateCode, ct);
            if (officer is null) continue;

            var entity = await db.ProfileSubmissions
                .FirstOrDefaultAsync(s => s.Id == row.Id, ct);
            if (entity is null) continue;

            entity.AssignedToUserId = officer;
            entity.AssignedOn = DateTime.UtcNow;

            /* Saved inside the loop, deliberately. The rota is read from
               the database, so until this row is written the next pick
               cannot see that this manager has just been given one — and a
               backlog of ten would go to the same desk in a single pass,
               which is the opposite of taking them in turn. */
            await db.SaveChangesAsync(ct);
            placed++;
        }

        return placed;
    }

    /// <summary>
    /// The counters over the queue, under the same filters as the list — so
    /// the headline figures and the rows beneath them cannot disagree.
    /// </summary>
    public async Task<ProfileScrutinyCountsDto> CountsAsync(
        string? search, string? status, int? categoryId, int? subCategoryId,
        int? programTypeId, string? state, DateOnly? from, DateOnly? to,
        CancellationToken ct)
    {
        /* Counted without the status filter, so the three tiles always add up
           to what was received rather than to whichever one is selected. */
        var all = Queue(search, null, categoryId, subCategoryId,
                        programTypeId, state, from, to);

        return new ProfileScrutinyCountsDto
        {
            Received = await all.CountAsync(ct),
            Pending = await all.CountAsync(
                s => s.Status == ProfileSubmissionStatus.Submitted
                     || s.Status == ProfileSubmissionStatus.UnderScrutiny, ct),
            Approved = await all.CountAsync(s => s.Status == ProfileSubmissionStatus.Approved, ct),
            Rejected = await all.CountAsync(s => s.Status == ProfileSubmissionStatus.Rejected, ct),
        };
    }

    public async Task<ProfileSubmissionDto> GetAsync(int id, CancellationToken ct)
    {
        var submission = await Visible().FirstOrDefaultAsync(s => s.Id == id, ct)
                         ?? throw AppException.NotFound("Profile submission");

        var dto = Map(submission);

        /* Only on the one profile being read, never on the queue: the list
           shows a row per applicant and has no use for what is attached to
           each. */
        dto.Attachments = [.. await attachments.HeldForAsync(
            submission.ApplicantId, submission.SubCategoryId, ct)];

        return dto;
    }

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

    /// <summary>
    /// The profile this account is about to decide, or a refusal.
    ///
    /// Scrutiny is the Operation Manager's work, and specifically the one
    /// the profile was placed with. This used to read the whole register
    /// and check only that nobody had decided already, so any account
    /// holding the scrutinise permission — the tiers above it included —
    /// could accept or reject a profile that was never on their desk. The
    /// screens have stopped offering it; a screen is not where that is
    /// settled.
    ///
    /// Three refusals rather than one, because "no" on its own leaves the
    /// manager guessing which of them it was.
    /// </summary>
    private async Task<ProfileSubmission> Decidable(int id, CancellationToken ct)
    {
        var submission = await Base.FirstOrDefaultAsync(s => s.Id == id, ct)
                         ?? throw AppException.NotFound("Profile submission");

        if (submission.Status is ProfileSubmissionStatus.Approved
            or ProfileSubmissionStatus.Rejected)
        {
            throw new AppException("This profile has already been decided.");
        }

        if (currentUser.Tier != BaseRole.OperationManager)
        {
            throw new AppException(
                "Only the Operation Manager a profile is placed with can decide it.");
        }

        /* Unassigned is its own case: nobody covers the discipline and
           state yet, and the profile is waiting for an appointment rather
           than for a decision. Taking it would put the case on a desk that
           the allocation did not choose. */
        if (submission.AssignedToUserId is null)
        {
            throw new AppException(
                "This profile has not been allocated yet. It is placed automatically "
                + "once an Operation Manager covers its sub-category and state.");
        }

        if (submission.AssignedToUserId != currentUser.UserId)
        {
            throw new AppException("This profile is on another Operation Manager's desk.");
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
        AssignedToUserId = s.AssignedToUserId,
        AssignedToName = s.AssignedToUser?.FullName,
        AssignedToCode = s.AssignedToUser?.UserCode,
        AssignedToRole = s.AssignedToUser?.Role?.Name,
        RejectionReasonId = s.RejectionReasonId,
        RejectionReasonLabel = s.RejectionReasonLabel,
        Remarks = s.Remarks,
        Responses = JsonSerializer.Deserialize<Dictionary<string, object?>>(s.Responses) ?? [],
        History = [.. s.History.OrderBy(h => h.On).Select(Event)],
    };
}
