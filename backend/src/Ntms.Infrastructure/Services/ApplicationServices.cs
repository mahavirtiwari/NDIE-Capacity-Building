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

    /* The same query without the scope filter, for reading back a row this
       very call just created. Sign-up is anonymous: there is no principal
       to scope by, and the applicant is entitled to the record they have
       just made. Used nowhere else — every other read goes through Base. */
    private IQueryable<Applicant> Unscoped => db.Applicants.AsNoTracking()
        .Include(a => a.Category)
        .Include(a => a.SubCategory)
        .Include(a => a.State)
        .Include(a => a.District);

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
            /* On any profile they hold, not on the account's own column:
               the column is only the first discipline they entered. */
            .WhereIf(categoryId.HasValue,
                a => a.ProfileSubmissions.Any(s => s.CategoryId == categoryId))
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
        await FillStatusReasonAsync(page.Items, ct);
        return page;
    }

    /// <summary>
    /// Why each applicant on this page was last blocked or unblocked.
    ///
    /// One query for the page rather than one per row, the same as the
    /// standing beside it. An account nobody has ever blocked has no event
    /// and no reason, which is almost all of them and reads as an empty
    /// cell rather than a dash.
    /// </summary>
    private async Task FillStatusReasonAsync(
        IReadOnlyList<ApplicantDto> rows, CancellationToken ct)
    {
        if (rows.Count == 0) return;

        var ids = rows.Select(r => r.Id).ToList();

        var events = await db.ApplicantStatusEvents.AsNoTracking()
            .Where(e => ids.Contains(e.ApplicantId))
            .OrderByDescending(e => e.On)
            .Select(e => new { e.ApplicantId, e.ReasonLabel, e.Remarks, e.On, e.ByUserName })
            .ToListAsync(ct);

        var latest = new Dictionary<int, (string? Reason, DateTime On, string By)>();
        foreach (var e in events)
        {
            if (latest.ContainsKey(e.ApplicantId)) continue;

            /* The chosen category where there was one, the note where there
               was not: unblocking has no master list to choose from. */
            var said = string.IsNullOrWhiteSpace(e.ReasonLabel) ? e.Remarks : e.ReasonLabel;
            latest[e.ApplicantId] = (said, e.On, e.ByUserName);
        }

        foreach (var row in rows)
        {
            if (!latest.TryGetValue(row.Id, out var found)) continue;
            row.StatusReason = found.Reason;
            row.StatusChangedOn = found.On;
            row.StatusChangedBy = found.By;
        }
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
        /* The form as the app shows it, so that what is demanded here is
           exactly what was asked there. A question switched off in the portal
           is not asked by the app and is not insisted on here either; one
           somebody added is asked, and its answer is kept.

           Nothing about a discipline is asked at this point. An account is an
           account: which category and sub-category somebody works in is
           chosen in the app afterwards, on the profile form, and one account
           may hold a profile in each category. Asking here would have fixed
           that choice at the moment of signing up, before the applicant had
           seen what the programs are. */
        var form = await signupForms.FormAsync(activeOnly: true, ct);
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

        /* One account per person, the person being their PAN.

           It used to be one per PAN per category, because a category was
           chosen at sign-up and entering a second one meant a second account.
           It does not any more: one account holds a profile in each category
           the applicant enters, so a second account for the same PAN is a
           duplicate of a person rather than a separate registration.

           The database enforces the same rule on Pan; this is here to say it
           in words rather than as an index violation. */
        var already = !string.IsNullOrEmpty(pan)
                      && await db.Applicants.AsNoTracking().AnyAsync(a => a.Pan == pan, ct);

        if (already)
        {
            /* The ID they already hold is not named: this endpoint is
               anonymous, and that ID is what they sign in with. */
            throw AppException.Conflict(
                "This PAN is already registered. Sign in with the applicant ID you were sent, " +
                "or use 'forgot applicant ID' to have it sent to you again. One account covers " +
                "every category - the category is chosen in the app, not here.");
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

        /* One e-mail at sign-up, and it is the code they need to get past
           this screen. The applicant ID used to go out in a second message
           sent in the same breath — before the address had been verified,
           and announcing an account that could not yet be signed in to. It
           arrives with the password instead, once the OTP is accepted,
           which is the first moment it is any use. */

        return await JustCreatedAsync(entity.Id, ct);
    }

    /// <summary>
    /// Reads back a row this call has just written, without the scope
    /// filter. Sign-up has no signed-in principal to scope by.
    /// </summary>
    private async Task<ApplicantDto> JustCreatedAsync(int id, CancellationToken ct)
    {
        var dto = (await Unscoped.Include(a => a.Answers)
                       .FirstOrDefaultAsync(a => a.Id == id, ct)
                   ?? throw AppException.NotFound("Applicant")).ToDto();
        await FillStandingAsync([dto], ct);
        return dto;
    }

    /// <summary>
    /// Checks the answers to the custom questions and turns them into rows.
    ///
    /// Only what the form asks is read: a key that is not on it is dropped
    /// rather than stored, so a stale app cannot write answers to questions
    /// the form no longer has.
    /// </summary>
    private static List<ApplicantAnswer> ValidateSignupAnswers(
        SignupFormDto form, Dictionary<string, string?> supplied, Guard.Collector guard)
    {
        var rows = new List<ApplicantAnswer>();
        var given = new Dictionary<string, string?>(supplied, StringComparer.OrdinalIgnoreCase);

        /* A document is not collected at sign-up: there is no account to hang
           an upload off yet, and the profile form is where the scheme
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
            Timeline = await TimelineAsync(entity, ct),
        };
    }

    /// <summary>
    /// Everything that has happened to one applicant, from every part of
    /// the system, oldest first.
    ///
    /// Assembled here rather than left to the screen: the pieces live in
    /// six tables and the only thing that makes them a history is being
    /// put in order together. Each query is for this one applicant, so
    /// this is a handful of small reads rather than a join across the
    /// estate.
    ///
    /// Every entry carries the wording as it was at the time - a rejection
    /// reason, an amount, a programme name - because a history that reads
    /// back through today's masters is a history that changes when
    /// somebody renames something.
    /// </summary>
    private async Task<List<TimelineEventDto>> TimelineAsync(
        Applicant applicant, CancellationToken ct)
    {
        var events = new List<TimelineEventDto>
        {
            new()
            {
                On = applicant.RegisteredOn,
                Area = "Account",
                Title = "Registered",
                Detail = $"Signed up from the app as {applicant.ApplicantCode}.",
                Reference = applicant.Email,
            },
        };

        /* ---- the profile, and every attempt at it -------------------- */

        var submissions = await db.ProfileSubmissions.AsNoTracking()
            .Where(s => s.ApplicantId == applicant.Id)
            .Include(s => s.SubCategory)
            .Include(s => s.History)
            .ToListAsync(ct);

        foreach (var submission in submissions)
        {
            var where = submission.SubCategory?.Name ?? $"Sub-category {submission.SubCategoryId}";

            if (submission.History.Count > 0)
            {
                foreach (var moment in submission.History)
                {
                    events.Add(new TimelineEventDto
                    {
                        On = moment.On,
                        Area = "Profile",
                        Title = moment.Action switch
                        {
                            ScrutinyAction.Submitted when submission.AttemptNo > 1
                                => $"Profile sent again (attempt {submission.AttemptNo})",
                            ScrutinyAction.Submitted => "Profile sent for scrutiny",
                            ScrutinyAction.Approved => "Profile accepted",
                            ScrutinyAction.Rejected => "Profile turned down",
                            _ => $"Profile {moment.Action.ToString().ToLowerInvariant()}",
                        },
                        Detail = Join(moment.RejectionReasonLabel, moment.Remarks),
                        Reference = where,
                        By = moment.ByRole == "Applicant" ? null : moment.ByUserName,
                    });
                }

                continue;
            }

            /* No event rows, so read the submission itself.

               Every profile that existed before the move to per-discipline
               scrutiny is like this: the migration carried across what was
               answered and when it was decided, but there was no per-event
               history to carry. Taking only the event rows would have left
               those applicants with no profile story at all, which is most
               of them. */
            if (submission.SubmittedOn is { } sentOn)
            {
                events.Add(new TimelineEventDto
                {
                    On = sentOn,
                    Area = "Profile",
                    Title = submission.AttemptNo > 1
                        ? $"Profile sent again (attempt {submission.AttemptNo})"
                        : "Profile sent for scrutiny",
                    Reference = where,
                });
            }

            if (submission.DecidedOn is { } decidedOn
                && submission.Status is ProfileSubmissionStatus.Approved
                    or ProfileSubmissionStatus.Rejected)
            {
                events.Add(new TimelineEventDto
                {
                    On = decidedOn,
                    Area = "Profile",
                    Title = submission.Status == ProfileSubmissionStatus.Approved
                        ? "Profile accepted"
                        : "Profile turned down",
                    Detail = Join(submission.RejectionReasonLabel, submission.Remarks),
                    Reference = where,
                    By = submission.DecidedByUserName,
                });
            }
        }

        /* ---- applications, and what scrutiny did with them ----------- */

        var applications = await db.Applications.AsNoTracking()
            .Where(a => a.ApplicantId == applicant.Id)
            .Include(a => a.ProgramType)
            .Include(a => a.History)
            .ToListAsync(ct);

        foreach (var application in applications)
        {
            var what = application.ApplicationNo;

            if (application.SubmittedOn is { } submittedOn)
            {
                events.Add(new TimelineEventDto
                {
                    On = submittedOn,
                    Area = "Application",
                    Title = "Application submitted",
                    Detail = application.ProgramType?.Name,
                    Reference = what,
                });
            }

            foreach (var moment in application.History)
            {
                /* The submission is already above, from the application
                   itself, which carries the date the applicant saw. */
                if (moment.Action == ScrutinyAction.Submitted) continue;

                events.Add(new TimelineEventDto
                {
                    On = moment.On,
                    Area = "Application",
                    Title = moment.Action switch
                    {
                        ScrutinyAction.Approved => "Application approved",
                        ScrutinyAction.Rejected => "Application rejected",
                        ScrutinyAction.Enrolled => "Enrolled on a batch",
                        ScrutinyAction.Comment => "Comment added",
                        _ => $"Application {moment.Action.ToString().ToLowerInvariant()}",
                    },
                    Detail = Join(moment.RejectionReasonLabel, moment.Remarks),
                    Reference = what,
                    By = moment.ByUserName,
                });
            }
        }

        /* ---- what was paid, and what failed -------------------------- */

        var payments = await db.PaymentTransactions.AsNoTracking()
            .Where(p => p.ApplicantId == applicant.Id)
            .ToListAsync(ct);

        foreach (var payment in payments)
        {
            /* An attempt that never left this system says nothing worth
               recording; one that reached the gateway did something. */
            if (payment.Status == PaymentAttemptStatus.Initiated) continue;

            events.Add(new TimelineEventDto
            {
                On = payment.CompletedOn ?? payment.InitiatedOn,
                Area = "Payment",
                Title = payment.Status switch
                {
                    PaymentAttemptStatus.Paid => "Fee paid",
                    PaymentAttemptStatus.Failed => "Payment failed",
                    PaymentAttemptStatus.Cancelled => "Payment cancelled at the gateway",
                    PaymentAttemptStatus.Abandoned => "Payment started and never finished",
                    _ => $"Payment {payment.Status.ToString().ToLowerInvariant()}",
                },
                Detail = $"{payment.Amount:N2}",
                Reference = payment.OrderId,
            });
        }

        /* ---- the programmes they actually sat ------------------------ */

        var participations = await db.ProgrammeParticipants.AsNoTracking()
            .Where(p => p.ApplicantId == applicant.Id)
            .Include(p => p.Programme)
            .ToListAsync(ct);

        foreach (var participation in participations)
        {
            var programme = participation.Programme?.ProgrammeName
                            ?? participation.Programme?.ProgrammeId;

            events.Add(new TimelineEventDto
            {
                On = participation.EnrolledOn.ToDateTime(TimeOnly.MinValue),
                Area = "Programme",
                Title = "Enrolled",
                Reference = programme,
            });

            if (participation.Result != ParticipantResult.Pending
                && participation.ResultRecordedOn is { } recordedOn)
            {
                events.Add(new TimelineEventDto
                {
                    On = recordedOn,
                    Area = "Programme",
                    Title = participation.Result == ParticipantResult.Pass
                        ? "Passed"
                        : "Did not pass",
                    Reference = programme,
                });
            }
        }

        /* ---- and what they hold at the end of it --------------------- */

        var certificates = await db.Certificates.AsNoTracking()
            .Where(c => c.Participant!.ApplicantId == applicant.Id)
            .Select(c => new { c.Number, c.IssuedOn, c.ProgrammeName })
            .ToListAsync(ct);

        foreach (var certificate in certificates)
        {
            events.Add(new TimelineEventDto
            {
                On = certificate.IssuedOn.ToDateTime(TimeOnly.MinValue),
                Area = "Certificate",
                Title = "Certificate issued",
                Detail = certificate.ProgrammeName,
                Reference = certificate.Number,
            });
        }

        /* ---- blocked and let back in --------------------------------- */

        foreach (var moment in applicant.StatusEvents)
        {
            events.Add(new TimelineEventDto
            {
                On = moment.On,
                Area = "Account",
                Title = moment.Blocked ? "Account blocked" : "Account unblocked",
                Detail = Join(moment.ReasonLabel, moment.Remarks),
                By = moment.ByUserName,
            });
        }

        return [.. events.OrderBy(e => e.On)];
    }

    /// <summary>A reason and a remark read as one line, where both exist.</summary>
    private static string? Join(string? reason, string? remarks)
    {
        var parts = new[] { reason, remarks }
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .ToList();

        return parts.Count == 0 ? null : string.Join(" - ", parts);
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
    /// profile form for the chosen program type before anything is stored.
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

        /* A track that does not ask for a profile form has no form to
           publish, nothing to validate, and nothing to scrutinise. */
        ProfileForm? form = null;

        if (programType.SubCategory?.RequiresProfileForm ?? true)
        {
            form = await db.ProfileForms
                .Include(f => f.Sections).ThenInclude(s => s.Fields)
                .Where(f => f.SubCategoryId == programType.SubCategoryId
                            && f.Status == RecordStatus.Active)
                .OrderByDescending(f => f.Id)
                .FirstOrDefaultAsync(ct)
                ?? throw new AppException("No profile form is published for this sub-category.");

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
            ProfileFormId = form?.Id,

            /* There is one scrutiny, and it has already happened.

               What an application declares is the profile, and the profile
               is read and accepted per discipline before any track in it is
               offered at all. Reading it a second time when somebody picks a
               batch asks the same question of the same answers, and leaves
               an approved person waiting in a queue to be approved again.
               So an application is accepted as it arrives. */
            Status = ApplicationStatus.Approved,
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
           was never scrutinised, and the answer is a decision the scheme
           made — not an omission by whoever was on the queue. */
        entity.History.Add(new ScrutinyEvent
        {
            Action = ScrutinyAction.Approved,
            ByUserName = "System",
            ByRole = BaseRole.Applicant.ToString(),
            On = now,
            Remarks = form is null
                ? $"Approved on submission: {programType.Name} does not require a profile form."
                : "Approved on submission: the profile for this discipline has already been "
                  + "scrutinised and accepted.",
        });

        db.Applications.Add(entity);
        await db.SaveChangesAsync(ct);

        await notifications.SendApplicationSubmittedAsync(
            entity, applicant.Email, applicant.FullName, ct);

        return await GetAsync(entity.Id, ct);
    }

    public async Task<ApplicationDto> AssignAsync(int id, int userId, CancellationToken ct)
    {
        var entity = await db.Applications.Include(a => a.History)
                         .FirstOrDefaultAsync(a => a.Id == id, ct)
                     ?? throw AppException.NotFound("Application");

        var officer = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
                      ?? throw AppException.NotFound("User");

        /* Assigning an owner no longer moves the application anywhere. It
           arrives approved, and there is no queue for it to enter. */
        entity.AssignedToUserId = officer.Id;

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
        ProfileForm form, Dictionary<string, JsonElement> responses)
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
        ProfileSection section,
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
    private static string EntryNoun(ProfileSection section) =>
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

    private static string? CheckFormat(ProfileField field, string value) => field.Type switch
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
