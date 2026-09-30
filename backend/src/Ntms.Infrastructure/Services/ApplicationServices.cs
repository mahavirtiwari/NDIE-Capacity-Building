using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/* --------------------------------------------------------------- applicants */

public class ApplicantService(
    NtmsDbContext db,
    ICodeGenerator codes,
    ICurrentUser currentUser,
    INotificationService notifications,
    OtpService otp,
    SignupFormService signupForms)
{
    /* Scoped at the source, so no read path can forget it. */
    private IQueryable<Applicant> Base => db.Applicants.AsNoTracking()
        .Include(a => a.Category)
        .Include(a => a.SubCategory)
        .Include(a => a.State)
        .Include(a => a.District)
        .WithinScope(currentUser);

    /* The statuses that make up each standing, named once so the filter and
       the value shown can never drift apart. */
    private static readonly ApplicationStatus[] Settled =
        [ApplicationStatus.Approved, ApplicationStatus.Enrolled];

    private static readonly ApplicationStatus[] InProgress =
        [ApplicationStatus.Submitted, ApplicationStatus.UnderScrutiny,
         ApplicationStatus.Clarification];

    public async Task<PagedResult<ApplicantDto>> ListAsync(
        PagedRequest request, int? categoryId, string? state, string? standing,
        bool? isBlocked, DateTime? registeredFrom, DateTime? registeredTo,
        CancellationToken ct)
    {
        var wanted = (standing ?? string.Empty).Trim();

        var query = Base
            .WhereIf(categoryId.HasValue, a => a.CategoryId == categoryId)
            .WhereIf(!string.IsNullOrWhiteSpace(state), a => a.State!.Name == state!.ToUpperInvariant())
            .WhereIf(isBlocked.HasValue, a => a.IsBlocked == isBlocked)
            .WhereIf(registeredFrom.HasValue, a => a.RegisteredOn >= registeredFrom!.Value)
            /* The end of the chosen day, not its midnight: somebody picking
               the 30th means everything registered on the 30th. */
            .WhereIf(registeredTo.HasValue,
                a => a.RegisteredOn < registeredTo!.Value.Date.AddDays(1))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                a => a.FullName.Contains(request.Search!) || a.ApplicantCode.Contains(request.Search!)
                     || a.Email.Contains(request.Search!) || a.Pan.Contains(request.Search!));

        /* Filtered in SQL rather than after paging, or page two would be
           missing whatever page one filtered out. */
        query = wanted switch
        {
            "Registered" => query.Where(
                a => !db.Applications.Any(x => x.ApplicantId == a.Id)),

            "ApplicationReceived" => query.Where(
                a => db.Applications.Any(x => x.ApplicantId == a.Id && InProgress.Contains(x.Status))
                     && !db.Applications.Any(x => x.ApplicantId == a.Id && Settled.Contains(x.Status))),

            "Approved" => query.Where(
                a => db.Applications.Any(x => x.ApplicantId == a.Id && Settled.Contains(x.Status))),

            "Rejected" => query.Where(
                a => db.Applications.Any(
                         x => x.ApplicantId == a.Id && x.Status == ApplicationStatus.Rejected)
                     && !db.Applications.Any(
                         x => x.ApplicantId == a.Id
                              && (Settled.Contains(x.Status) || InProgress.Contains(x.Status)))),

            _ => query,
        };

        var page = await query
            .ApplySort(request, db.Model.FindEntityType(typeof(Applicant))!, a => a.RegisteredOn)
            .ToPagedResultAsync(request, a => a.ToDto(), ct);

        await FillStandingAsync(page.Items, ct);
        return page;
    }

    /// <summary>
    /// Works out where each applicant on this page stands, in one query for
    /// the page rather than one per row.
    /// </summary>
    private async Task FillStandingAsync(IReadOnlyList<ApplicantDto> rows, CancellationToken ct)
    {
        if (rows.Count == 0) return;

        var ids = rows.Select(r => r.Id).ToList();

        var statuses = await db.Applications.AsNoTracking()
            .Where(a => ids.Contains(a.ApplicantId))
            .Select(a => new { a.ApplicantId, a.Status })
            .ToListAsync(ct);

        var byApplicant = statuses
            .GroupBy(a => a.ApplicantId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Status).ToList());

        foreach (var row in rows)
        {
            row.Standing = Standing(byApplicant.GetValueOrDefault(row.Id) ?? []);
        }
    }

    /// <summary>
    /// The furthest an applicant has got. Approved beats in progress, which
    /// beats rejected: what somebody has achieved describes them better than
    /// what they were turned down for.
    /// </summary>
    private static string Standing(List<ApplicationStatus> statuses)
    {
        if (statuses.Count == 0) return "Registered";
        if (statuses.Any(Settled.Contains)) return "Approved";
        if (statuses.Any(InProgress.Contains)) return "ApplicationReceived";
        if (statuses.Contains(ApplicationStatus.Rejected)) return "Rejected";
        return "Registered";
    }

    /* The answers ride along here and not on the list: a page of applicants
       does not show them, and joining a row per question onto every list read
       would cost the many to serve the one. */
    public async Task<ApplicantDto> GetAsync(int id, CancellationToken ct)
    {
        var dto = (await Base.Include(a => a.Answers).FirstOrDefaultAsync(a => a.Id == id, ct)
                   ?? throw AppException.NotFound("Applicant")).ToDto();

        await FillStandingAsync([dto], ct);
        return dto;
    }

    /// <summary>
    /// Basic sign-up from the mobile app. The applicant code is generated here
    /// and becomes the account's identity; the e-mail stays editable.
    /// </summary>
    public async Task<ApplicantDto> SignUpAsync(ApplicantSignUpDto dto, CancellationToken ct)
    {
        Guard.Check()
            .When(dto.CategoryId <= 0, "Select a category.")
            .When(dto.SubCategoryId <= 0, "Select a sub-category.")
            .ThrowIfInvalid();

        /* The pair has to exist and belong together. Without this a mismatched
           sub-category reaches the database and comes back as a foreign key
           violation, which says nothing to the person who picked it. */
        var pairIsReal = await db.SubCategories.AsNoTracking().AnyAsync(
            c => c.Id == dto.SubCategoryId && c.CategoryId == dto.CategoryId, ct);
        if (!pairIsReal)
            throw new AppException("That sub-category does not belong to the chosen category.");

        /* The form this sub-category actually shows, so that what is demanded
           here is exactly what was asked there. A question switched off in the
           portal is not asked by the app and is not insisted on here either;
           one somebody added is asked, and its answer is kept. */
        var form = await signupForms.FormAsync(dto.SubCategoryId, activeOnly: true, ct);
        var asked = form.Fields
            .ToDictionary(f => f.Key, f => f, StringComparer.OrdinalIgnoreCase);

        bool Asks(string key) => asked.ContainsKey(key);
        bool Demands(string key) => asked.TryGetValue(key, out var f) && f.Required;

        var pan = Asks("pan") ? Formats.Normalise(dto.Pan) : null;

        var guard = Guard.Check()
            .Required(dto.FullName, "Full name")
            .Email(dto.Email)
            .Mobile(dto.Mobile);

        if (Asks("pan")) guard = guard.Pan(pan, required: Demands("pan"));

        /* Gender and social category are asked at sign-up because the scheme
           reports reach by them, and a figure assembled later from whoever
           happened to answer would not describe the intake. Whether they are
           compulsory is the department's call, on the form. */
        guard = guard
            .When(Demands("gender") && string.IsNullOrWhiteSpace(dto.Gender),
                "Select a gender.")
            .When(Demands("socialCategory") && string.IsNullOrWhiteSpace(dto.SocialCategory),
                "Select a social category.");

        var answers = ValidateSignupAnswers(form, dto.Answers, guard);
        guard.ThrowIfInvalid();

        /* One registration per person per category, the person being their PAN.
           A category is entered once, under one sub-category — somebody
           already registered for Bronze cannot also register for Silver. The
           same PAN under a different category is a separate registration and
           is allowed, which is why this is not a check on PAN alone.

           The database enforces the same rule on (Pan, CategoryId); this is
           here to say it in words rather than as an index violation. */
        var already = string.IsNullOrEmpty(pan)
            ? null
            : await db.Applicants.AsNoTracking()
                .Where(a => a.Pan == pan && a.CategoryId == dto.CategoryId)
                .Select(a => new { Category = a.Category!.Name, SubCategory = a.SubCategory!.Name })
                .FirstOrDefaultAsync(ct);

        if (already is not null)
        {
            /* The sub-category is named because it is what makes the refusal
               actionable. The applicant ID they already hold is not: this
               endpoint is anonymous, and that ID is what they sign in with. */
            throw AppException.Conflict(
                $"This PAN is already registered under {already.Category}, for " +
                $"{already.SubCategory}. A category can only be entered once, so the same PAN " +
                "can be registered under a different category but not under another " +
                $"sub-category of {already.Category}.");
        }

        var entity = new Applicant
        {
            ApplicantCode = await codes.NextApplicantCodeAsync(ct),
            FullName = dto.FullName.Trim(),
            /* Lower-cased so it always matches the OTP challenge destination,
               whatever collation the database runs under. */
            Email = dto.Email.Trim().ToLowerInvariant(),
            Mobile = dto.Mobile.Trim(),
            /* Empty where the form does not ask for one. The unique index that
               holds the one-registration-per-category rule skips those rows,
               since a rule keyed on PAN cannot be applied without one. */
            Pan = pan ?? string.Empty,
            Gender = EnumMaps.ParseDeclared<Gender>(dto.Gender),
            SocialCategory = EnumMaps.ParseDeclared<SocialCategory>(dto.SocialCategory),
            CategoryId = dto.CategoryId,
            SubCategoryId = dto.SubCategoryId,
            RegisteredOn = DateTime.UtcNow,
        };

        foreach (var answer in answers) entity.Answers.Add(answer);

        db.Applicants.Add(entity);
        await db.SaveChangesAsync(ct);

        /* Confirm the address before the account is usable, then tell the
           applicant the ID they will actually sign in with.

           The registration itself is already committed, so a throttled or
           failed send must not surface as a sign-up failure — that would leave
           an orphaned record the applicant could not retry past the PAN check.
           The verify screen can request a fresh code. */
        try
        {
            await otp.SendEmailOtpAsync(entity.Email, entity.FullName, ct);
        }
        catch (AppException)
        {
            /* Reported to the applicant by the verify screen when they resend. */
        }

        await notifications.SendApplicantWelcomeAsync(entity, ct);

        return await GetAsync(entity.Id, ct);
    }

    /// <summary>
    /// Checks the answers to the custom questions and turns them into rows.
    ///
    /// Only what the form asks is read: a key that is not on it is dropped
    /// rather than stored, so a stale app cannot write answers to questions
    /// this sub-category no longer has.
    /// </summary>
    private static List<ApplicantAnswer> ValidateSignupAnswers(
        SignupFormDto form, Dictionary<string, string?> supplied, Guard.Collector guard)
    {
        var rows = new List<ApplicantAnswer>();
        var given = new Dictionary<string, string?>(supplied, StringComparer.OrdinalIgnoreCase);

        /* A document is not collected at sign-up: there is no account to hang
           an upload off yet, and the registration form is where the scheme
           asks for papers. One on this form is ignored rather than blocking. */
        foreach (var field in form.Fields.Where(f => !f.IsBuiltIn && f.Type != "file"))
        {
            given.TryGetValue(field.Key, out var raw);
            var value = (raw ?? string.Empty).Trim();

            if (value.Length == 0)
            {
                guard.When(field.Required, $"'{field.Label}' is required.");
                continue;
            }

            var complaint = CheckSignupFormat(field, value) ?? CheckSignupChoice(field, value);
            if (complaint is not null)
            {
                guard.When(true, complaint);
                continue;
            }

            rows.Add(new ApplicantAnswer
            {
                Key = field.Key,
                Label = field.Label,
                Value = value.Length > 2000 ? value[..2000] : value,
            });
        }

        return rows;
    }

    private static string? CheckSignupFormat(SignupFieldDto field, string value) => field.Type switch
    {
        "email" when !Formats.IsEmail(value) => $"'{field.Label}' is not a valid email.",
        "mobile" when !Formats.IsMobile(value) => $"'{field.Label}' is not a valid mobile number.",
        "pan" when !Formats.IsPan(value.ToUpperInvariant()) => $"'{field.Label}' is not a valid PAN.",
        "tan" when !Formats.IsTan(value.ToUpperInvariant()) => $"'{field.Label}' is not a valid TAN.",
        "gstin" when !Formats.IsGstin(value.ToUpperInvariant()) => $"'{field.Label}' is not a valid GSTIN.",
        "ifsc" when !Formats.IsIfsc(value.ToUpperInvariant()) => $"'{field.Label}' is not a valid IFSC.",
        "aadhaar" when !Formats.IsAadhaar(value) => $"'{field.Label}' is not a valid Aadhaar number.",
        "pincode" when !Formats.IsPincode(value) => $"'{field.Label}' is not a valid pincode.",
        "number" when !decimal.TryParse(value, out _) => $"'{field.Label}' has to be a number.",
        "date" when !DateTime.TryParse(value, out _) => $"'{field.Label}' is not a valid date.",
        _ => null,
    };

    /// <summary>
    /// A chosen answer has to be one of the choices. A multi-select arrives as
    /// a comma-separated list, the way the app sends it.
    /// </summary>
    private static string? CheckSignupChoice(SignupFieldDto field, string value)
    {
        if (field.Options.Count == 0) return null;
        if (field.Type is not ("select" or "radio" or "multiselect")) return null;

        var allowed = field.Options.Select(o => o.Value).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var chosen = field.Type == "multiselect"
            ? value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            : [value];

        return chosen.All(allowed.Contains)
            ? null
            : $"'{field.Label}' was answered with something that is not one of the choices.";
    }

    /// <summary>
    /// Blocks an account, or lets it back in, and records why.
    ///
    /// Both directions are explained. A history that gives grounds only for
    /// the blocks answers half the questions later put to it — "who let them
    /// back in, and on what basis" is the other half.
    /// </summary>
    public async Task<ApplicantDto> SetBlockedAsync(
        int id, bool isBlocked, int? blockReasonId, string? remarks, CancellationToken ct)
    {
        var entity = await db.Applicants.FirstOrDefaultAsync(a => a.Id == id, ct)
                     ?? throw AppException.NotFound("Applicant");

        if (entity.IsBlocked == isBlocked)
        {
            throw new AppException(
                isBlocked ? "This account is already blocked." : "This account is not blocked.");
        }

        var note = (remarks ?? string.Empty).Trim();
        var wantedKind = isBlocked ? AccessReasonKind.Block : AccessReasonKind.Unblock;

        /* Chosen from the list either way: both halves of the history have to
           give grounds, and a reason typed forty different ways cannot be
           counted or reported on. */
        var reason = await db.BlockReasons
            .FirstOrDefaultAsync(r => r.Id == blockReasonId && r.Kind == wantedKind, ct)
            ?? throw new AppException(isBlocked
                ? "Choose a reason for blocking this account."
                : "Choose a reason for unblocking this account.");

        if (reason.Status != RecordStatus.Active)
            throw new AppException($"'{reason.Label}' is no longer available as a reason.");

        if (reason.RequiresNote && note.Length == 0)
            throw new AppException($"'{reason.Label}' needs a note saying what happened.");

        var reasonLabel = reason.Label;

        if (isBlocked)
        {
            entity.BlockedOn = DateTime.UtcNow;
            entity.BlockReasonLabel = reason.Label;
        }
        else
        {
            entity.BlockedOn = null;
            entity.BlockReasonLabel = null;
        }

        entity.IsBlocked = isBlocked;

        entity.StatusEvents.Add(new ApplicantStatusEvent
        {
            Blocked = isBlocked,
            BlockReasonId = reason.Id,
            ReasonLabel = reasonLabel,
            Remarks = note.Length == 0 ? null : note,
            ByUserId = currentUser.UserId,
            ByUserName = currentUser.DisplayName ?? "Administrator",
            ByUserCode = currentUser.UserCode ?? "—",
            On = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(ct);

        /* Told, with the grounds. Somebody locked out of the app deserves to
           know why, and somebody let back in needs to know they can work
           again. A failed send must not undo a decision that is already
           taken, so it is logged rather than thrown. */
        if (!string.IsNullOrWhiteSpace(entity.Email))
        {
            try
            {
                await notifications.SendApplicantAccessChangedAsync(
                    entity, isBlocked, reasonLabel, note, ct);
            }
            catch (Exception)
            {
                /* The email log carries the failure; the block stands. */
            }
        }

        return await GetAsync(id, ct);
    }

    /// <summary>Everything the history popup shows about one account.</summary>
    public async Task<ApplicantHistoryDto> HistoryAsync(int id, CancellationToken ct)
    {
        var entity = await Base
            .Include(a => a.StatusEvents)
            .FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw AppException.NotFound("Applicant");

        return new ApplicantHistoryDto
        {
            ApplicantId = entity.Id,
            ApplicantCode = entity.ApplicantCode,
            FullName = entity.FullName,
            Email = entity.Email,
            IsBlocked = entity.IsBlocked,
            BlockedOn = entity.BlockedOn,
            BlockReasonLabel = entity.BlockReasonLabel,
            RegisteredOn = entity.RegisteredOn,
            LastLoginOn = entity.LastLoginOn,
            Events =
            [
                .. entity.StatusEvents
                    .OrderByDescending(e => e.On)
                    .Select(e => new ApplicantStatusEventDto
                    {
                        Id = e.Id,
                        Blocked = e.Blocked,
                        ReasonLabel = e.ReasonLabel,
                        Remarks = e.Remarks,
                        ByUserName = e.ByUserName,
                        ByUserCode = e.ByUserCode,
                        On = e.On,
                    }),
            ],
        };
    }

    /// <summary>
    /// Every applicant the filters match, flattened for a spreadsheet:
    /// what the sign-up form collected, where they stand, and the dates
    /// behind that.
    ///
    /// Not the list DTO. A screen shows a page and hides what will not fit;
    /// an export is opened to be read across, and leaving the answers out is
    /// leaving out the part nobody can get at any other way.
    /// </summary>
    public async Task<List<ApplicantExportRowDto>> ExportAsync(
        int? categoryId, string? state, string? standing, bool? isBlocked,
        DateTime? registeredFrom, DateTime? registeredTo, string? search,
        CancellationToken ct)
    {
        var request = new PagedRequest { Page = 1, PageSize = 100000, Search = search };
        var page = await ListAsync(
            request, categoryId, state, standing, isBlocked, registeredFrom, registeredTo, ct);

        var ids = page.Items.Select(r => r.Id).ToList();
        if (ids.Count == 0) return [];

        /* Three reads for the whole export rather than three per row. */
        var answers = await db.ApplicantAnswers.AsNoTracking()
            .Where(a => ids.Contains(a.ApplicantId))
            .Select(a => new { a.ApplicantId, a.Label, a.Value })
            .ToListAsync(ct);

        var applications = await db.Applications.AsNoTracking()
            .Where(a => ids.Contains(a.ApplicantId))
            .Select(a => new
            {
                a.ApplicantId, a.Status, a.SubmittedOn, a.RejectionReasonLabel, a.ModifiedOn,
            })
            .ToListAsync(ct);

        var byApplicant = applications.GroupBy(a => a.ApplicantId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var answersByApplicant = answers.GroupBy(a => a.ApplicantId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var rows = new List<ApplicantExportRowDto>(page.Items.Count);

        foreach (var item in page.Items)
        {
            var mine = byApplicant.GetValueOrDefault(item.Id) ?? [];
            var rejected = mine
                .Where(a => a.Status == ApplicationStatus.Rejected)
                .OrderByDescending(a => a.ModifiedOn ?? a.SubmittedOn)
                .FirstOrDefault();

            var row = new ApplicantExportRowDto
            {
                ApplicantCode = item.ApplicantCode,
                FullName = item.FullName,
                Email = item.Email,
                Mobile = item.Mobile,
                Pan = item.Pan,
                Gender = item.Gender,
                SocialCategory = item.SocialCategory,
                Category = item.CategoryName,
                SubCategory = item.SubCategoryName,
                State = item.State,
                District = item.District,
                City = item.City,
                EmailVerified = item.EmailVerified,
                MobileVerified = item.MobileVerified,
                Standing = item.Standing,
                RegisteredOn = item.RegisteredOn,
                FirstAppliedOn = mine.Where(a => a.SubmittedOn != null)
                    .Min(a => a.SubmittedOn),
                ApprovedOn = mine
                    .Where(a => a.Status is ApplicationStatus.Approved or ApplicationStatus.Enrolled)
                    .Max(a => a.ModifiedOn ?? a.SubmittedOn),
                RejectedOn = rejected is null ? null : rejected.ModifiedOn ?? rejected.SubmittedOn,
                RejectionReason = rejected?.RejectionReasonLabel,
                Access = item.IsBlocked ? "Blocked" : "Active",
                LastLoginOn = item.LastLoginOn,
            };

            foreach (var answer in answersByApplicant.GetValueOrDefault(item.Id) ?? [])
            {
                row.Answers[answer.Label] = answer.Value;
            }

            rows.Add(row);
        }

        /* The block details are on the applicant rather than the list DTO,
           so they come from one more read keyed by the same ids. */
        var blocks = await db.Applicants.AsNoTracking()
            .Where(a => ids.Contains(a.Id))
            .Select(a => new { a.Id, a.ApplicantCode, a.BlockedOn, a.BlockReasonLabel })
            .ToDictionaryAsync(a => a.ApplicantCode, a => a, ct);

        foreach (var row in rows)
        {
            if (!blocks.TryGetValue(row.ApplicantCode, out var block)) continue;
            row.BlockedOn = block.BlockedOn;
            row.BlockReason = block.BlockReasonLabel;
        }

        return rows;
    }
}

/* ------------------------------------------------------------- applications */

public class ApplicationService(
    NtmsDbContext db,
    ICodeGenerator codes,
    FeeService fees,
    ICurrentUser currentUser,
    INotificationService notifications)
{
    /* Scoped at the source, so no read path can forget it. */
    private IQueryable<TrainingApplication> Base => db.Applications.AsNoTracking()
        .Include(a => a.Applicant)
        .Include(a => a.Category)
        .Include(a => a.SubCategory)
        .Include(a => a.ProgramType)
        .Include(a => a.AssignedToUser)
        .Include(a => a.State)
        .Include(a => a.Documents)
        .Include(a => a.History)
        .WithinScope(currentUser);

    public async Task<PagedResult<ApplicationDto>> ListAsync(
        PagedRequest request, string? status, int? categoryId, int? programTypeId,
        string? state, CancellationToken ct)
    {
        /* The queue filter arrives as a comma separated list of statuses. */
        var statuses = EnumMaps.SplitList(status)
            .Select(s => EnumMaps.ParseEnumOrNull<ApplicationStatus>(s))
            .Where(s => s.HasValue)
            .Select(s => s!.Value)
            .ToList();

        var query = Base
            .WhereIf(statuses.Count > 0, a => statuses.Contains(a.Status))
            .WhereIf(categoryId.HasValue, a => a.CategoryId == categoryId)
            .WhereIf(programTypeId.HasValue, a => a.ProgramTypeId == programTypeId)
            .WhereIf(!string.IsNullOrWhiteSpace(state), a => a.State!.Name == state!.ToUpperInvariant())
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                a => a.ApplicationNo.Contains(request.Search!)
                     || a.Applicant!.FullName.Contains(request.Search!)
                     || a.Applicant!.Pan.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(TrainingApplication))!, a => a.SubmittedOn);

        return await query.ToPagedResultAsync(request, a => a.ToDto(), ct);
    }

    public async Task<List<ApplicationDto>> AllAsync(string? status, CancellationToken ct)
    {
        var statuses = EnumMaps.SplitList(status)
            .Select(s => EnumMaps.ParseEnumOrNull<ApplicationStatus>(s))
            .Where(s => s.HasValue).Select(s => s!.Value).ToList();

        var rows = await Base
            .WhereIf(statuses.Count > 0, a => statuses.Contains(a.Status))
            .OrderByDescending(a => a.SubmittedOn)
            .ToListAsync(ct);
        return [.. rows.Select(a => a.ToDto())];
    }

    /// <summary>
    /// How many sit at each status, under the same filters as the list.
    ///
    /// Counted in the database against the filtered set, not by pulling every
    /// application to the browser and counting there: a tile that ignores the
    /// filters is answering a question nobody asked.
    /// </summary>
    public async Task<ApplicationCountsDto> CountsAsync(
        string? status, int? categoryId, int? programTypeId, string? state,
        string? search, CancellationToken ct)
    {
        var statuses = EnumMaps.SplitList(status)
            .Select(s => EnumMaps.ParseEnumOrNull<ApplicationStatus>(s))
            .Where(s => s.HasValue).Select(s => s!.Value).ToList();

        var query = Base
            .WhereIf(statuses.Count > 0, a => statuses.Contains(a.Status))
            .WhereIf(categoryId.HasValue, a => a.CategoryId == categoryId)
            .WhereIf(programTypeId.HasValue, a => a.ProgramTypeId == programTypeId)
            .WhereIf(!string.IsNullOrWhiteSpace(state), a => a.State!.Name == state!.ToUpperInvariant())
            .WhereIf(!string.IsNullOrWhiteSpace(search),
                a => a.ApplicationNo.Contains(search!)
                     || a.Applicant!.FullName.Contains(search!)
                     || a.Applicant!.Pan.Contains(search!));

        var byStatus = await query
            .GroupBy(a => a.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        int For(ApplicationStatus wanted) =>
            byStatus.FirstOrDefault(g => g.Status == wanted)?.Count ?? 0;

        return new ApplicationCountsDto
        {
            Submitted = For(ApplicationStatus.Submitted),
            UnderScrutiny = For(ApplicationStatus.UnderScrutiny),
            Clarification = For(ApplicationStatus.Clarification),
            Approved = For(ApplicationStatus.Approved),
            Enrolled = For(ApplicationStatus.Enrolled),
            Rejected = For(ApplicationStatus.Rejected),
            Total = byStatus.Sum(g => g.Count),
        };
    }

    public async Task<ApplicationDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.Include(a => a.Payments).FirstOrDefaultAsync(a => a.Id == id, ct)
         ?? throw AppException.NotFound("Application")).ToDto();

    /// <summary>
    /// Submission from the mobile app. Answers are validated against the active
    /// registration form for the chosen program type before anything is stored.
    /// </summary>
    public async Task<ApplicationDto> SubmitAsync(ApplicationSubmitDto dto, CancellationToken ct)
    {
        var applicant = await db.Applicants.FirstOrDefaultAsync(a => a.Id == dto.ApplicantId, ct)
                        ?? throw AppException.NotFound("Applicant");
        if (applicant.IsBlocked)
            throw AppException.Forbidden("This applicant account is blocked.");

        var programType = await db.ProgramTypes.FirstOrDefaultAsync(p => p.Id == dto.ProgramTypeId, ct)
                          ?? throw AppException.NotFound("Program type");
        if (programType.Status != RecordStatus.Active)
            throw new AppException("This program type is not open for applications.");

        /* A track that does not ask for a registration form has no form to
           publish, nothing to validate, and nothing to scrutinise. */
        RegistrationForm? form = null;

        if (programType.RequiresRegistrationForm)
        {
            form = await db.RegistrationForms
                .Include(f => f.Sections).ThenInclude(s => s.Fields)
                .Where(f => f.ProgramTypeId == dto.ProgramTypeId && f.Status == RecordStatus.Active)
                .OrderByDescending(f => f.Id)
                .FirstOrDefaultAsync(ct)
                ?? throw new AppException("No registration form is published for this program type.");

            ValidateResponses(form, dto.Responses);
        }

        ValidateTds(dto);

        var duplicate = await db.Applications.AnyAsync(
            a => a.ApplicantId == dto.ApplicantId
                 && a.ProgramTypeId == dto.ProgramTypeId
                 && a.Status != ApplicationStatus.Rejected, ct);
        if (duplicate)
            throw AppException.Conflict("An application for this program type is already in progress.");

        var fee = await fees.CurrentForProgramTypeAsync(dto.ProgramTypeId, ct);
        var now = DateTime.UtcNow;

        var entity = new TrainingApplication
        {
            ApplicationNo = await codes.NextApplicationNoAsync(ct),
            ApplicantId = applicant.Id,
            CategoryId = programType.CategoryId,
            SubCategoryId = programType.SubCategoryId,
            ProgramTypeId = programType.Id,
            RegistrationFormId = form?.Id,

            /* Scrutiny is the reading of what was declared on the registration
               form. Where the track asks for no form, there is nothing to
               read, so the application is approved as it arrives rather than
               joining a queue nobody can act on. */
            Status = form is null ? ApplicationStatus.Approved : ApplicationStatus.Submitted,
            SubmittedOn = now,
            PaymentStatus = programType.IsFeeApplicable ? PaymentStatus.Pending : PaymentStatus.NotApplicable,
            FeeAmount = fee?.Totals.Gross ?? 0m,
            /* Kept with the application, not looked up when they come to pay:
               TDS is deducted on the value of the service and not on the tax,
               and the published fee may be superseded in between. */
            FeeTaxable = fee?.Totals.Taxable,
            FeeGst = fee?.Totals.Gst,
            TdsPercent = dto.TdsPercent,
            Tan = Formats.Normalise(dto.Tan),
            DeductorName = dto.DeductorName,
            StateCode = applicant.StateCode,
            DistrictCode = applicant.DistrictCode,
            ResponsesJson = JsonSerializer.Serialize(dto.Responses),
        };

        entity.History.Add(new ScrutinyEvent
        {
            Action = ScrutinyAction.Submitted,
            ByUserName = applicant.FullName,
            ByRole = BaseRole.Applicant.ToString(),
            On = now,
            Remarks = "Application submitted from the mobile app.",
        });

        /* Recorded as its own event rather than left implicit. Somebody
           reading the history a year later needs to see why this application
           was never scrutinised, and "the track asked for no form" is the
           answer — not an omission by whoever was on the queue. */
        if (form is null)
        {
            entity.History.Add(new ScrutinyEvent
            {
                Action = ScrutinyAction.Approved,
                ByUserName = "System",
                ByRole = BaseRole.Applicant.ToString(),
                On = now,
                Remarks =
                    $"Approved without scrutiny: {programType.Name} does not require a "
                    + "registration form.",
            });
        }

        db.Applications.Add(entity);
        await db.SaveChangesAsync(ct);

        await notifications.SendApplicationSubmittedAsync(
            entity, applicant.Email, applicant.FullName, ct);

        return await GetAsync(entity.Id, ct);
    }

    public async Task<ApplicationDto> DecideAsync(int id, ScrutinyDecisionDto dto, CancellationToken ct)
    {
        var entity = await db.Applications
            .Include(a => a.Documents).Include(a => a.History)
            .FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw AppException.NotFound("Application");

        if (entity.Status is not (ApplicationStatus.Submitted or ApplicationStatus.UnderScrutiny
            or ApplicationStatus.Clarification))
        {
            throw new AppException($"An application that is {entity.Status} cannot be scrutinised again.");
        }

        var (status, action) = dto.Decision.Trim().ToLowerInvariant() switch
        {
            "approve" => (ApplicationStatus.Approved, ScrutinyAction.Approved),
            "reject" => (ApplicationStatus.Rejected, ScrutinyAction.Rejected),
            "clarification" => (ApplicationStatus.Clarification, ScrutinyAction.Clarification),
            _ => throw new AppException("Decision must be Approve, Reject or Clarification."),
        };

        var remarks = (dto.Remarks ?? string.Empty).Trim();
        string? reasonLabel = null;

        if (status == ApplicationStatus.Rejected)
        {
            /* Chosen from the list, not typed: a rejection is counted and
               reported on, and forty spellings of the same reason cannot be. */
            var reason = await db.RejectionReasons
                .FirstOrDefaultAsync(r => r.Id == dto.RejectionReasonId, ct)
                ?? throw new AppException("Choose a reason for the rejection.");

            if (reason.Status != RecordStatus.Active)
                throw new AppException($"'{reason.Label}' is no longer available as a reason.");

            if (reason.RequiresNote && remarks.Length == 0)
            {
                throw new AppException(
                    $"'{reason.Label}' needs a note saying what exactly was wrong.");
            }

            /* Snapshotted, because the master can be reworded or retired and
               a rejection has to keep reading the way it was given. */
            reasonLabel = reason.Label;
            entity.RejectionReasonId = reason.Id;
            entity.RejectionReasonLabel = reason.Label;
        }
        else if (remarks.Length == 0)
        {
            /* Approving or asking for more needs words: there is no list
               standing in for them. */
            throw new AppException("Scrutiny remarks are required.");
        }

        entity.Status = status;
        entity.History.Add(new ScrutinyEvent
        {
            Action = action,
            ByUserName = currentUser.DisplayName ?? "Scrutiny Officer",
            ByRole = currentUser.RoleName ?? "Admin",
            On = DateTime.UtcNow,
            Remarks = remarks.Length == 0 ? null : remarks,
            RejectionReasonLabel = reasonLabel,
        });

        if (dto.DocumentIdsVerified is { Count: > 0 })
        {
            foreach (var document in entity.Documents.Where(d => dto.DocumentIdsVerified.Contains(d.Id)))
            {
                document.Verified = true;
            }
        }

        await db.SaveChangesAsync(ct);

        var applicant = await db.Applicants
            .FirstOrDefaultAsync(a => a.Id == entity.ApplicantId, ct);
        if (applicant is not null)
        {
            /* The applicant is told the reason, not just that it was refused -
               they are allowed to apply again and need to know what to fix. */
            var told = reasonLabel is null
                ? remarks
                : remarks.Length == 0 ? reasonLabel : $"{reasonLabel} — {remarks}";

            await notifications.SendScrutinyOutcomeAsync(
                entity, applicant.Email, applicant.FullName, status.ToString(), told, ct);
        }

        return await GetAsync(id, ct);
    }

    public async Task<ApplicationDto> AssignAsync(int id, int userId, CancellationToken ct)
    {
        var entity = await db.Applications.Include(a => a.History)
                         .FirstOrDefaultAsync(a => a.Id == id, ct)
                     ?? throw AppException.NotFound("Application");

        var officer = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
                      ?? throw AppException.NotFound("User");

        entity.AssignedToUserId = officer.Id;
        if (entity.Status == ApplicationStatus.Submitted)
            entity.Status = ApplicationStatus.UnderScrutiny;

        entity.History.Add(new ScrutinyEvent
        {
            Action = ScrutinyAction.Assigned,
            ByUserName = currentUser.DisplayName ?? "System",
            ByRole = currentUser.RoleName ?? "Admin",
            On = DateTime.UtcNow,
            Remarks = $"Assigned to {officer.FullName} ({officer.UserCode}).",
        });

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<ApplicationDto> VerifyDocumentAsync(
        int id, int documentId, VerifyDocumentDto dto, CancellationToken ct)
    {
        var entity = await db.Applications.Include(a => a.Documents)
                         .FirstOrDefaultAsync(a => a.Id == id, ct)
                     ?? throw AppException.NotFound("Application");

        var document = entity.Documents.FirstOrDefault(d => d.Id == documentId)
                       ?? throw AppException.NotFound("Document");

        document.Verified = dto.Verified;
        document.Remarks = dto.Remarks ?? document.Remarks;

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /* ------------------------------------------------------------ helpers */

    /// <summary>
    /// Enforces the form definition server side: mandatory answers must be
    /// present, and a field that is switched off must not smuggle a value in.
    ///
    /// A section the applicant can fill more than once is stored as an array
    /// of objects under the section's own key, so its fields are read from
    /// each entry rather than from the top level, and are reported with the
    /// entry they were wrong in.
    /// </summary>
    private static void ValidateResponses(
        RegistrationForm form, Dictionary<string, JsonElement> responses)
    {
        var errors = new List<string>();

        foreach (var section in form.Sections.Where(s => s.IsEnabled))
        {
            if (!section.IsRepeatable)
            {
                ValidateEntry(section, responses, responses, null, errors);
                continue;
            }

            var entries = ReadEntries(responses, section.Key);
            var what = EntryNoun(section);

            if (entries.Count < section.MinEntries)
            {
                errors.Add(section.MinEntries == 1
                    ? $"At least one {what} is required."
                    : $"At least {section.MinEntries} {what} entries are required.");
                continue;
            }

            if (entries.Count > section.MaxEntries)
            {
                errors.Add($"No more than {section.MaxEntries} {what} entries can be added.");
                continue;
            }

            for (var index = 0; index < entries.Count; index++)
            {
                ValidateEntry(section, entries[index], responses, index + 1, errors);
            }
        }

        if (errors.Count > 0)
            throw new AppException(string.Join(" ", errors.Take(8)));
    }

    /// <summary>
    /// One pass over a section's fields. <paramref name="scope"/> is where the
    /// answers are read from — the whole response for an ordinary section, one
    /// entry for a repeating one — and <paramref name="ordinal"/> numbers the
    /// entry in any message, so "'Degree' is required" says which one.
    /// </summary>
    private static void ValidateEntry(
        RegistrationSection section,
        Dictionary<string, JsonElement> scope,
        Dictionary<string, JsonElement> outer,
        int? ordinal,
        List<string> errors)
    {
        var prefix = ordinal is null ? string.Empty : $"{EntryNoun(section)} {ordinal}: ";

        foreach (var field in section.Fields.Where(f => f.IsEnabled))
        {
            /* A conditional field is only mandatory when it is actually shown.
               Inside an entry the trigger is that entry's own answer; a
               trigger outside the section is the same for every entry. */
            if (!string.IsNullOrWhiteSpace(field.VisibleWhenFieldKey))
            {
                var found = scope.TryGetValue(field.VisibleWhenFieldKey, out var t)
                            || outer.TryGetValue(field.VisibleWhenFieldKey, out t);
                var trigger = found ? ValueToString(t) : string.Empty;

                var wanted = EnumMaps.SplitList(field.VisibleWhenValues);
                if (wanted.Count > 0 &&
                    !wanted.Contains(trigger, StringComparer.OrdinalIgnoreCase))
                {
                    continue;
                }
            }

            var hasValue = scope.TryGetValue(field.Key, out var value)
                           && !string.IsNullOrWhiteSpace(ValueToString(value));

            if (field.Validation.Required && !hasValue)
            {
                errors.Add($"{prefix}'{field.Label}' is required.");
                continue;
            }

            if (!hasValue) continue;

            var formatError = CheckFormat(field, ValueToString(scope[field.Key]));
            if (formatError is not null) errors.Add(prefix + formatError);
        }
    }

    /// <summary>What one entry of a repeating section is called, in a sentence.</summary>
    private static string EntryNoun(RegistrationSection section) =>
        string.IsNullOrWhiteSpace(section.ItemLabel) ? section.Title : section.ItemLabel;

    /// <summary>
    /// The entries a repeating section was answered with. Anything that is not
    /// an array of objects reads as no entries at all, which the minimum then
    /// reports — a malformed payload must not slip past as an empty section.
    /// </summary>
    private static List<Dictionary<string, JsonElement>> ReadEntries(
        Dictionary<string, JsonElement> responses, string sectionKey)
    {
        if (!responses.TryGetValue(sectionKey, out var raw) ||
            raw.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var entries = new List<Dictionary<string, JsonElement>>();
        foreach (var element in raw.EnumerateArray())
        {
            if (element.ValueKind != JsonValueKind.Object) continue;

            var entry = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
            foreach (var property in element.EnumerateObject()) entry[property.Name] = property.Value;
            entries.Add(entry);
        }
        return entries;
    }

    private static string? CheckFormat(RegistrationField field, string value) => field.Type switch
    {
        FieldType.Email when !Formats.IsEmail(value) => $"'{field.Label}' is not a valid email.",
        FieldType.Mobile when !Formats.IsMobile(value) => $"'{field.Label}' is not a valid mobile number.",
        FieldType.Pan when !Formats.IsPan(value.ToUpperInvariant()) => $"'{field.Label}' is not a valid PAN.",
        FieldType.Tan when !Formats.IsTan(value.ToUpperInvariant()) => $"'{field.Label}' is not a valid TAN.",
        FieldType.Gstin when !Formats.IsGstin(value.ToUpperInvariant()) => $"'{field.Label}' is not a valid GSTIN.",
        FieldType.Ifsc when !Formats.IsIfsc(value.ToUpperInvariant()) => $"'{field.Label}' is not a valid IFSC.",
        FieldType.Aadhaar when !Formats.IsAadhaar(value) => $"'{field.Label}' is not a valid Aadhaar number.",
        FieldType.Pincode when !Formats.IsPincode(value) => $"'{field.Label}' is not a valid pincode.",
        _ => null,
    };

    /// <summary>TDS is the applicant's own declaration, and it needs their TAN.</summary>
    private static void ValidateTds(ApplicationSubmitDto dto)
    {
        if (dto.TdsPercent == 0m) return;

        if (dto.TdsPercent is not (2m or 10m))
            throw new AppException("TDS can only be claimed at 2% or 10%.");

        var tan = Formats.Normalise(dto.Tan);
        if (string.IsNullOrWhiteSpace(tan) || !Formats.IsTan(tan))
            throw new AppException("A valid TAN is required when TDS is deducted.");
        if (string.IsNullOrWhiteSpace(dto.DeductorName))
            throw new AppException("The name of the deductor is required when TDS is deducted.");
    }

    private static string ValueToString(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.String => element.GetString() ?? string.Empty,
        JsonValueKind.Number => element.ToString(),
        JsonValueKind.True => "true",
        JsonValueKind.False => "false",
        JsonValueKind.Array => string.Join(',', element.EnumerateArray().Select(ValueToString)),
        JsonValueKind.Null or JsonValueKind.Undefined => string.Empty,
        _ => element.ToString(),
    };
}
