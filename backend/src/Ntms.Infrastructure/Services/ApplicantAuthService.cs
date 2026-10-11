using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Sign-in for the mobile applicant app. Separate from the portal because the
/// two populations live in different tables and carry different claims, but the
/// rule is the same: the generated code is the identity, never the e-mail.
/// </summary>
public class ApplicantAuthService(
    NtmsDbContext db,
    IPasswordService passwords,
    ITokenService tokens,
    INotificationService notifications,
    OtpService otp,
    ILogger<ApplicantAuthService> logger)
{
    public async Task<ApplicantLoginResponseDto> LoginAsync(
        ApplicantLoginRequestDto request, CancellationToken ct)
    {
        var code = (request.ApplicantCode ?? string.Empty).Trim().ToUpperInvariant();

        var applicant = await db.Applicants
            .Include(a => a.Category)
            .Include(a => a.SubCategory)
            .FirstOrDefaultAsync(a => a.ApplicantCode == code, ct);

        if (applicant is null
            || string.IsNullOrEmpty(applicant.PasswordHash)
            || !passwords.Verify(applicant.PasswordHash, request.Password))
        {
            logger.LogWarning("Failed applicant sign-in for {Code}", code);
            throw new AppException("Invalid applicant ID or password.", 401);
        }

        if (applicant.IsBlocked)
            throw new AppException("This account has been blocked. Contact the helpdesk.", 403);

        if (!applicant.EmailVerified)
            throw new AppException("Verify your email address before signing in.", 403);

        var (token, expiresIn) = tokens.CreateApplicantToken(applicant);
        var refresh = tokens.CreateRefreshToken();

        applicant.LastLoginOn = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return new ApplicantLoginResponseDto
        {
            Token = token,
            RefreshToken = refresh,
            ExpiresInSeconds = expiresIn,
            Applicant = applicant.ToDto(),
        };
    }

    /// <summary>
    /// Issues the applicant's first password once the e-mail OTP has been
    /// verified, and mails it alongside the applicant ID.
    /// </summary>
    public async Task<string> IssueFirstPasswordAsync(Applicant applicant, CancellationToken ct)
    {
        var password = passwords.GenerateTemporaryPassword();
        applicant.PasswordHash = passwords.Hash(password);
        await db.SaveChangesAsync(ct);

        await notifications.SendApplicantCredentialsAsync(applicant, password, ct);
        return password;
    }

    /// <summary>
    /// The account as the applicant sees it, answers to the sign-up form
    /// included: their own screen lists what they were asked when they
    /// registered, so it needs what they said.
    /// </summary>
    public async Task<ApplicantDto> MeAsync(int applicantId, CancellationToken ct) =>
        (await db.Applicants.AsNoTracking()
            .Include(a => a.Category).Include(a => a.SubCategory)
            .Include(a => a.State).Include(a => a.District)
            .Include(a => a.Answers)
            .FirstOrDefaultAsync(a => a.Id == applicantId, ct)
         ?? throw AppException.NotFound("Applicant")).ToDto();

    public async Task ChangePasswordAsync(int applicantId, ChangePasswordDto dto, CancellationToken ct)
    {
        var applicant = await db.Applicants.FirstOrDefaultAsync(a => a.Id == applicantId, ct)
                        ?? throw AppException.NotFound("Applicant");

        if (!passwords.Verify(applicant.PasswordHash, dto.CurrentPassword))
            throw new AppException("The current password is not correct.");
        if (dto.NewPassword.Length < 8)
            throw new AppException("The new password must be at least 8 characters.");

        applicant.PasswordHash = passwords.Hash(dto.NewPassword);
        await db.SaveChangesAsync(ct);

        /* Same reason as the reset: a password changed by somebody else is
           only noticed if the holder is told. */
        try
        {
            await notifications.SendApplicantPasswordChangedAsync(
                applicant, "changed in the app", ct);
        }
        catch (Exception caught)
        {
            logger.LogWarning(caught,
                "The password for {ApplicantCode} was changed but the confirmation "
                + "could not be sent.", applicant.ApplicantCode);
        }
    }

    /// <summary>
    /// The applicant may change their own contact details. Their applicant ID is
    /// untouched, so sign-in keeps working exactly as before.
    /// </summary>
    public async Task<ApplicantDto> UpdateProfileAsync(
        int applicantId, ApplicantProfileUpdateDto dto, CancellationToken ct)
    {
        var applicant = await db.Applicants.FirstOrDefaultAsync(a => a.Id == applicantId, ct)
                        ?? throw AppException.NotFound("Applicant");

        Guard.Check()
            .Mobile(dto.Mobile)
            .ThrowIfInvalid();

        applicant.Mobile = dto.Mobile.Trim();

        /* All of these are left alone when they are not sent, so a client
           that does not show a field cannot blank what the applicant
           already said. The e-mail is not here at all: it moves only
           through RequestEmailChangeAsync and the code that follows it. */
        applicant.Gender = EnumMaps.ParseDeclared<Gender>(dto.Gender) ?? applicant.Gender;
        applicant.SocialCategory =
            EnumMaps.ParseDeclared<SocialCategory>(dto.SocialCategory) ?? applicant.SocialCategory;
        applicant.StateCode = dto.StateCode ?? applicant.StateCode;
        applicant.DistrictCode = dto.DistrictCode ?? applicant.DistrictCode;
        applicant.City = string.IsNullOrWhiteSpace(dto.City) ? applicant.City : dto.City.Trim();

        await db.SaveChangesAsync(ct);
        return await MeAsync(applicantId, ct);
    }

    /* ------------------------------------------------------ e-mail change
       Three steps, and the account does not move until the last one.

       It used to be one: the address was written straight onto the account,
       the applicant was signed out, and a code went to wherever they had
       typed. A single mistyped character therefore locked somebody out of
       their own account and out of the mailbox that could let them back in.

       Now the new address is held to one side until a code sent to it comes
       back. Nothing about signing in changes at any point - the applicant ID
       is the identity and the password is untouched - so a change that is
       never finished costs nothing. */

    /// <summary>Sends a code to the address they want to move to.</summary>
    public async Task<ApplicantDto> RequestEmailChangeAsync(
        int applicantId, string email, CancellationToken ct)
    {
        var applicant = await db.Applicants.FirstOrDefaultAsync(a => a.Id == applicantId, ct)
                        ?? throw AppException.NotFound("Applicant");

        Guard.Check().Email(email).ThrowIfInvalid();

        var wanted = email.Trim().ToLowerInvariant();

        if (string.Equals(wanted, applicant.Email, StringComparison.OrdinalIgnoreCase))
            throw new AppException("That is already the address on your account.");

        applicant.PendingEmail = wanted;
        await db.SaveChangesAsync(ct);

        /* Throttling and the attempt budget are the OTP service's; a code
           asked for too often is refused there with a 429 the app shows. */
        await otp.SendEmailChangeOtpAsync(wanted, applicant.FullName, ct);

        return await MeAsync(applicantId, ct);
    }

    /// <summary>Sends the code again, to the same address.</summary>
    public async Task<ApplicantDto> ResendEmailChangeAsync(int applicantId, CancellationToken ct)
    {
        var applicant = await db.Applicants.AsNoTracking()
                            .FirstOrDefaultAsync(a => a.Id == applicantId, ct)
                        ?? throw AppException.NotFound("Applicant");

        if (string.IsNullOrWhiteSpace(applicant.PendingEmail))
            throw new AppException("There is no address waiting to be verified.");

        await otp.SendEmailChangeOtpAsync(applicant.PendingEmail, applicant.FullName, ct);
        return await MeAsync(applicantId, ct);
    }

    /// <summary>Moves the account, once the code proves they can read it.</summary>
    public async Task<ApplicantDto> ConfirmEmailChangeAsync(
        int applicantId, string code, CancellationToken ct)
    {
        var applicant = await db.Applicants.FirstOrDefaultAsync(a => a.Id == applicantId, ct)
                        ?? throw AppException.NotFound("Applicant");

        var wanted = applicant.PendingEmail;
        if (string.IsNullOrWhiteSpace(wanted))
            throw new AppException("There is no address waiting to be verified.");

        /* Throws on a wrong, stale or spent code, so nothing below runs
           unless the person holding this session can also read that inbox. */
        await otp.SpendCodeAsync(OtpService.EmailChangeChannel, wanted, code, ct);

        applicant.Email = wanted;
        applicant.EmailVerified = true;
        applicant.PendingEmail = null;

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Applicant {Code} moved to a new e-mail address",
            applicant.ApplicantCode);

        return await MeAsync(applicantId, ct);
    }

    /// <summary>Drops the change. The address on the account never moved.</summary>
    public async Task<ApplicantDto> CancelEmailChangeAsync(int applicantId, CancellationToken ct)
    {
        var applicant = await db.Applicants.FirstOrDefaultAsync(a => a.Id == applicantId, ct)
                        ?? throw AppException.NotFound("Applicant");

        applicant.PendingEmail = null;
        await db.SaveChangesAsync(ct);
        return await MeAsync(applicantId, ct);
    }

    /// <summary>Programmes the applicant is eligible to apply for.</summary>
    /// <summary>
    /// Pulls the qualification and the years of experience out of an
    /// accepted profile, using whichever fields the form designer pointed
    /// at.
    ///
    /// Each answer comes back with a flag rather than a default, because
    /// "they did not say" and "they said none" are different things and
    /// only the second is a reason to close a program.
    /// </summary>
    private async Task<(bool HasQualification, int QualificationRank,
                        bool HasExperience, decimal ExperienceYears)>
        ReadEligibilityAsync(ProfileSubmission? accepted, CancellationToken ct)
    {
        if (accepted?.ProfileFormId is not { } formId) return (false, 0, false, 0m);

        var mapped = await db.ProfileFields.AsNoTracking()
            .Where(f => f.Section!.FormId == formId
                        && f.Role != ProfileFieldRole.None)
            .Select(f => new { f.Key, f.Role })
            .ToListAsync(ct);

        if (mapped.Count == 0) return (false, 0, false, 0m);

        Dictionary<string, JsonElement>? answers;
        try
        {
            answers = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
                accepted.Responses);
        }
        catch (JsonException)
        {
            /* A profile whose answers cannot be read must not close every
               program to somebody. It is left unmeasured. */
            return (false, 0, false, 0m);
        }

        if (answers is null) return (false, 0, false, 0m);

        var hasQualification = false;
        var rank = 0;
        var hasExperience = false;
        var years = 0m;

        foreach (var field in mapped)
        {
            if (!answers.TryGetValue(field.Key, out var value)) continue;

            var text = value.ValueKind switch
            {
                JsonValueKind.String => value.GetString(),
                JsonValueKind.Number => value.ToString(),
                _ => null,
            };

            if (string.IsNullOrWhiteSpace(text)) continue;

            if (field.Role == ProfileFieldRole.Qualification)
            {
                var found = QualificationLevels.RankOf(text);
                /* Rank 0 means the catalogue does not know the value, which
                   is not the same as the lowest rung — treat it as unsaid. */
                if (found > 0)
                {
                    hasQualification = true;
                    rank = found;
                }
            }
            else if (field.Role == ProfileFieldRole.ExperienceYears
                     && decimal.TryParse(text, out var parsed))
            {
                hasExperience = true;
                years = parsed;
            }
        }

        return (hasQualification, rank, hasExperience, years);
    }

    public async Task<List<ApplicantProgramDto>> AvailableProgramsAsync(
        int applicantId, CancellationToken ct)
    {
        if (!await db.Applicants.AsNoTracking().AnyAsync(a => a.Id == applicantId, ct))
            throw AppException.NotFound("Applicant");

        /* ---- the gate ------------------------------------------------
           Nothing is visible until a profile form has been read and
           accepted. The applicant is not shown a list of things they
           cannot have yet; the app asks about their profile first and
           sends them to fill it in. An empty list here is the honest
           answer to "what is open to me".

           Per discipline, because an account may hold a profile in each
           category it has entered. Somebody accepted as an assessor sees
           the assessor programs; if they later enter a second category and
           that profile is still with scrutiny, the first set stays open
           and the second has not opened yet. Both are true at once. */
        var accepted = await db.ProfileSubmissions.AsNoTracking()
            .Where(s => s.ApplicantId == applicantId
                        && s.Status == ProfileSubmissionStatus.Approved)
            .OrderByDescending(s => s.AttemptNo)
            .ToListAsync(ct);

        var acceptedBySubCategory = accepted
            .GroupBy(s => s.SubCategoryId)
            .ToDictionary(g => g.Key, g => g.First());

        /* Disciplines that ask for no profile form at all are open to
           anybody with an account, so they come in alongside. */
        var openWithoutForm = await db.SubCategories.AsNoTracking()
            .Where(c => !c.RequiresProfileForm && c.Status == RecordStatus.Active)
            .Select(c => c.Id)
            .ToListAsync(ct);

        var visible = acceptedBySubCategory.Keys.Concat(openWithoutForm).Distinct().ToList();
        if (visible.Count == 0) return [];

        /* What each accepted profile says about qualification and
           experience — but only from fields the form designer nominated.
           Nothing is inferred from a field's name. Read per discipline,
           because the answer that matters for a program is the one on the
           profile for that program's own sub-category. */
        var eligibility = new Dictionary<int, (bool HasQualification, int Rank,
                                               bool HasExperience, decimal Years)>();

        foreach (var (subCategoryId, submission) in acceptedBySubCategory)
        {
            eligibility[subCategoryId] = await ReadEligibilityAsync(submission, ct);
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        /* ---- a track is only offered once a batch exists to join -------
           A program type is a description of a course; it is not something
           anybody can attend until an implementing agency raises a batch
           under it and the operation manager permits that batch. Listing a
           type with nothing running behind it invites an application that
           has nowhere to go.

           Agency authorship needs no clause of its own: a batch is raised
           by an agency and carries its AgencyId, and the permission is the
           tier above saying yes — an agency cannot accept its own. */
        var offerable = await db.Programmes.AsNoTracking()
            .OpenForRegistration(today)
            .Select(p => p.ProgramTypeId)
            .Distinct()
            .ToListAsync(ct);

        if (offerable.Count == 0) return [];

        /* Scoped to the disciplines they hold an accepted profile in, not
           to whole categories. A sibling discipline has its own form and
           its own scrutiny, and clearing one does not clear the other. */
        var programTypes = await db.ProgramTypes.AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.SubCategory)
            .Where(p => p.Status == RecordStatus.Active
                        && visible.Contains(p.SubCategoryId)
                        && offerable.Contains(p.Id))
            .OrderBy(p => p.SubCategory!.Name).ThenBy(p => p.Name)
            .ToListAsync(ct);

        /* Fees are still per program type: two courses in one discipline
           can cost different amounts. */
        var typeIds = programTypes.Select(p => p.Id).ToList();

        /* The profile form belongs to the sub-category now, so a track is
           open once its discipline has one published — not once somebody
           has built a separate form for every course inside it. */
        var subCategoryIds = programTypes.Select(p => p.SubCategoryId).Distinct().ToList();

        var forms = await db.ProfileForms.AsNoTracking()
            .Where(f => subCategoryIds.Contains(f.SubCategoryId) && f.Status == RecordStatus.Active)
            .Select(f => f.SubCategoryId)
            .ToListAsync(ct);

        var fees = await db.FeeStructures.AsNoTracking()
            .Include(f => f.Components)
            .Where(f => typeIds.Contains(f.ProgramTypeId)
                        && f.Status == RecordStatus.Active
                        && f.EffectiveFrom <= today
                        && (f.EffectiveTo == null || f.EffectiveTo >= today))
            .ToListAsync(ct);

        /* What they have already done with each track. A participation is
           the record of actually having sat it, which is what decides
           whether a track is finished with them — an application only says
           they asked. */
        var sat = await db.ProgrammeParticipants.AsNoTracking()
            .Where(p => p.ApplicantId == applicantId)
            .Select(p => new { p.Programme!.ProgramTypeId, p.Result })
            .ToListAsync(ct);

        var maxTries = Math.Clamp(
            await db.SystemSettings.AsNoTracking()
                .Where(s => s.Id == 1)
                .Select(s => s.ProgramTypeMaxAttempts)
                .FirstOrDefaultAsync(ct) is var n and > 0 ? n : 3,
            1, 10);

        var applied = await db.Applications.AsNoTracking()
            .Where(a => a.ApplicantId == applicantId)
            .Select(a => new
            {
                a.Id,
                a.ProgramTypeId,
                a.ApplicationNo,
                a.Status,
                a.SubmittedOn,
                a.RejectionReasonLabel,
            })
            .OrderByDescending(a => a.SubmittedOn)
            .ToListAsync(ct);

        return
        [
            .. programTypes.Select(pt =>
            {
                var fee = fees.FirstOrDefault(f => f.ProgramTypeId == pt.Id);
                var taxable = fee?.Components.Where(c => c.IsTaxable).Sum(c => c.Amount) ?? 0m;
                var nonTaxable = fee?.Components.Where(c => !c.IsTaxable).Sum(c => c.Amount) ?? 0m;
                var gst = fee is null ? 0m : Math.Round(taxable * fee.GstPercent / 100m, 2);
                /* The one in flight, if there is one. A rejected application
                   is history rather than a blocker: the applicant is allowed
                   to fix what was wrong and apply again, so the newest
                   rejection is shown only when nothing live stands. */
                var mine = applied.Where(a => a.ProgramTypeId == pt.Id).ToList();
                var live = mine.FirstOrDefault(a => a.Status != ApplicationStatus.Rejected);
                var existing = live ?? mine.FirstOrDefault();

                var wantsForm = pt.SubCategory?.RequiresProfileForm ?? true;
                var accepting = !wantsForm || forms.Contains(pt.SubCategoryId);

                /* Measured against the profile for this program's own
                   discipline. Nothing is carried over from another one. */
                var (hasQualification, qualificationRank, hasExperience, experienceYears) =
                    eligibility.GetValueOrDefault(pt.SubCategoryId);

                /* ---- is this track finished with them? ----------------
                   Passing closes it, because the certificate is the point
                   and they have it. Sitting a track that certifies nobody
                   closes it too, for the same reason read the other way:
                   there was never anything to earn twice. Otherwise it is
                   the count of failures against the allowance. */
                var mySittings = sat.Where(s => s.ProgramTypeId == pt.Id).ToList();
                var passed = mySittings.Any(s => s.Result == ParticipantResult.Pass);
                var failed = mySittings.Count(s => s.Result == ParticipantResult.Fail);
                var decided = mySittings.Count(s => s.Result != ParticipantResult.Pending);
                var certifies = pt.CertificationPolicy != CertificationPolicy.None;

                var closedReason =
                    passed ? "You have already cleared this program."
                    : !certifies && decided > 0
                        ? "You have already taken this program."
                    : failed >= maxTries
                        ? $"You have used all {maxTries} attempts at this program."
                        : null;

                /* ---- do they meet the bar? ----------------------------
                   Checked only where the form actually nominated a field
                   to measure against. A program with a minimum and a form
                   that never said which answer holds it is left open: the
                   officer who accepted the profile is the one who checked,
                   and guessing here would hide programs for no reason
                   anybody could see. */
                if (closedReason is null
                    && hasQualification
                    && !string.IsNullOrWhiteSpace(pt.MinQualification)
                    && qualificationRank < QualificationLevels.RankOf(pt.MinQualification))
                {
                    closedReason =
                        $"This program needs {QualificationLevels.LabelFor(pt.MinQualification)}. "
                        + "Your profile says otherwise.";
                }

                if (closedReason is null
                    && hasExperience
                    && pt.MinExperienceYears > 0
                    && experienceYears < pt.MinExperienceYears)
                {
                    closedReason =
                        $"This program needs {pt.MinExperienceYears} years of experience. "
                        + $"Your profile says {experienceYears}.";
                }

                return new ApplicantProgramDto
                {
                    ProgramTypeId = pt.Id,
                    Code = pt.Code,
                    Name = pt.Name,
                    ShortDescription = pt.ShortDescription,
                    CategoryName = pt.Category?.Name,
                    SubCategoryName = pt.SubCategory?.Name,
                    DurationDays = pt.DurationDays,
                    DeliveryMode = pt.DeliveryMode.ToApi(),
                    MinQualification = pt.MinQualification,
                    MinQualificationLabel = QualificationLevels.LabelFor(pt.MinQualification),
                    MinExperienceYears = pt.MinExperienceYears,
                    IsExamMandatory = pt.IsExamMandatory,
                    FeePayable = pt.IsFeeApplicable ? Math.Round(taxable + nonTaxable + gst, 2) : 0m,
                    TdsOptions = EnumMaps.SplitInts(fee?.TdsOptions),
                    /* A track that asks for no profile form is open the
                       moment it exists: there is no form to wait on. */
                    AcceptingApplications = accepting,
                    RequiresProfileForm = wantsForm,

                    Closed = closedReason is not null,
                    ClosedReason = closedReason,
                    AttemptsUsed = failed,
                    AttemptsAllowed = maxTries,

                    ExistingApplicationStatus = existing?.Status.ToApi(),
                    ExistingApplicationId = existing?.Id,
                    ExistingApplicationNo = existing?.ApplicationNo,
                    ExistingSubmittedOn = existing?.SubmittedOn,
                    ExistingRejectionReason = existing?.Status == ApplicationStatus.Rejected
                        ? existing.RejectionReasonLabel
                        : null,

                    /* A track that is finished with them cannot be applied
                       to again, whatever else is true of it. */
                    CanApply = accepting && live is null && closedReason is null,
                };
            }),
        ];
    }

    public async Task<List<ApplicationDto>> MyApplicationsAsync(int applicantId, CancellationToken ct)
    {
        var rows = await db.Applications.AsNoTracking()
            .Include(a => a.Applicant)
            .Include(a => a.Category)
            .Include(a => a.SubCategory)
            .Include(a => a.ProgramType)
            .Include(a => a.Documents)
            .Include(a => a.History)
            .Where(a => a.ApplicantId == applicantId)
            .OrderByDescending(a => a.SubmittedOn)
            .ToListAsync(ct);

        return [.. rows.Select(a => a.ToDto())];
    }

    /// <summary>
    /// Every batch the applicant registered for.
    ///
    /// Two kinds, and both belong on the list. A seat that was taken is a
    /// participant row, and carries attendance, the paper and the
    /// certificate. A registration whose fee has not arrived has no
    /// participant row at all - it is only an application with a batch
    /// written on it - and that used to be shown nowhere, so somebody who
    /// had registered and not yet paid saw an empty screen and no way back
    /// to the payment.
    /// </summary>
    public async Task<List<ApplicantEnrolmentDto>> MyEnrolmentsAsync(int applicantId, CancellationToken ct)
    {
        var rows = await db.ProgrammeParticipants.AsNoTracking()
            .Include(p => p.Programme).ThenInclude(x => x!.Agency)
            .Include(p => p.Programme).ThenInclude(x => x!.State)
            .Where(p => p.ApplicantId == applicantId)
            .OrderByDescending(p => p.Programme!.StartDate)
            .ToListAsync(ct);

        var enrolments = rows.Select(p => new ApplicantEnrolmentDto
        {
            ParticipantId = p.Id,
            ApplicationId = p.ApplicationId ?? 0,
            SeatTaken = true,
            ProgrammeId = p.Programme!.ProgrammeId,
            ProgrammeName = p.Programme.ProgrammeName,
            AgencyName = p.Programme.Agency?.Name,
            Mode = p.Programme.Mode.ToApi(),
            Venue = p.Programme.Venue,
            State = p.Programme.State?.Name,
            StartDate = p.Programme.StartDate,
            EndDate = p.Programme.EndDate,
            MeetingLink = p.Programme.MeetingLink,
            ExamDateTime = p.Programme.ExamDateTime,
            Status = p.Programme.Status.ToApi(),
            AttendancePercent = p.AttendancePercent,
            ExamScore = p.ExamScore,
            Result = p.Result.ToApi(),
            CertificateNo = p.CertificateNo,
        }).ToList();

        /* Registered, not yet seated. Excludes anything already in the list
           above: paying takes the seat, and the two would otherwise both
           describe the same batch. */
        var seated = rows.Select(p => p.ProgrammeId).ToHashSet();

        var awaiting = await db.Applications.AsNoTracking()
            .Include(a => a.Programme).ThenInclude(x => x!.Agency)
            .Include(a => a.Programme).ThenInclude(x => x!.State)
            .Where(a => a.ApplicantId == applicantId
                        && a.ProgrammeId != null
                        && a.Status != ApplicationStatus.Rejected
                        /* Owing, which is Pending or Failed. A free
                           programme's application is NotApplicable and its
                           seat was taken on the spot, so reading it as
                           money outstanding would list a batch they are
                           already on as waiting to be paid for. */
                        && (a.PaymentStatus == Domain.Common.PaymentStatus.Pending
                            || a.PaymentStatus == Domain.Common.PaymentStatus.Failed)
                        && !seated.Contains(a.ProgrammeId!.Value))
            .OrderByDescending(a => a.Programme!.StartDate)
            .ToListAsync(ct);

        enrolments.AddRange(awaiting.Select(a => new ApplicantEnrolmentDto
        {
            ParticipantId = 0,
            ApplicationId = a.Id,
            SeatTaken = false,
            AmountDue = a.FeeAmount,
            PaymentStatus = a.PaymentStatus.ToApi(),
            ProgrammeId = a.Programme!.ProgrammeId,
            ProgrammeName = a.Programme.ProgrammeName,
            AgencyName = a.Programme.Agency?.Name,
            Mode = a.Programme.Mode.ToApi(),
            Venue = a.Programme.Venue,
            State = a.Programme.State?.Name,
            StartDate = a.Programme.StartDate,
            EndDate = a.Programme.EndDate,
            MeetingLink = a.Programme.MeetingLink,
            ExamDateTime = a.Programme.ExamDateTime,
            Status = a.Programme.Status.ToApi(),
            Result = "Pending",
        }));

        return [.. enrolments.OrderByDescending(e => e.StartDate)];
    }

    /* ----------------------------------------------- password recovery */

    private const int ResetValidityMinutes = 15;
    /* Eight characters: the column holds ten, and widening it would be a
       migration for nothing. */
    private const string ResetChannel = "AppReset";
    private static readonly TimeSpan ResetCooldown = TimeSpan.FromSeconds(60);

    /// <summary>
    /// Either the applicant ID or the e-mail on the account.
    ///
    /// Both, because somebody who has lost their password has usually lost
    /// the message carrying their applicant ID with it, and an ID-only
    /// recovery leaves them with nothing to try.
    ///
    /// An e-mail shared by two accounts resolves to neither: a household may
    /// register more than one applicant on one mailbox, and guessing which of
    /// them to reset would lock the other out.
    /// </summary>
    private async Task<Applicant?> ResolveForResetAsync(string? identifier, CancellationToken ct)
    {
        var typed = (identifier ?? string.Empty).Trim();
        if (typed.Length == 0) return null;

        var asCode = typed.ToUpperInvariant();
        var byCode = await db.Applicants.FirstOrDefaultAsync(a => a.ApplicantCode == asCode, ct);
        if (byCode is not null) return byCode;

        if (!typed.Contains('@')) return null;

        var lowered = typed.ToLowerInvariant();
        var matches = await db.Applicants
            .Where(a => a.Email == lowered && !a.IsBlocked)
            .Take(2).ToListAsync(ct);

        return matches.Count == 1 ? matches[0] : null;
    }

    /// <summary>
    /// Mails a one-time code to the address on file.
    ///
    /// The reply says the same thing whether or not the account exists, so
    /// this cannot be used to find out which applicant IDs are real. The
    /// masked address is the one concession, and only where there was an
    /// account to mask — somebody recovering their own login needs to see
    /// which of their mailboxes to open.
    /// </summary>
    public async Task<ApplicantForgotPasswordResultDto> ForgotPasswordAsync(
        ApplicantForgotPasswordDto dto, CancellationToken ct)
    {
        var vague = new ApplicantForgotPasswordResultDto
        {
            Message = "If that account exists, a reset code has been sent to the email on file.",
            ValidityMinutes = ResetValidityMinutes,
            ResendAfterSeconds = (int) ResetCooldown.TotalSeconds,
        };

        var applicant = await ResolveForResetAsync(dto.Identifier, ct);

        /* A blocked account is treated as absent, for the same reason. */
        if (applicant is null || applicant.IsBlocked
            || string.IsNullOrWhiteSpace(applicant.Email))
        {
            logger.LogInformation("Applicant password reset requested for an unknown account");
            return vague;
        }

        /* Filed under the applicant code, never under whatever was typed, so
           the second step finds it either way. */
        var code = applicant.ApplicantCode;
        var now = DateTime.UtcNow;

        var last = await db.OtpChallenges
            .Where(o => o.Destination == code && o.Channel == ResetChannel)
            .OrderByDescending(o => o.CreatedOn)
            .FirstOrDefaultAsync(ct);

        /* Silent on cooldown: "too soon" would confirm the ID is real. The
           masked address still comes back, because the holder is most likely
           the person tapping resend. */
        if (last is not null && now - last.CreatedOn < ResetCooldown)
        {
            vague.MaskedEmail = Mask(applicant.Email);
            vague.ResendAfterSeconds =
                (int) (ResetCooldown - (now - last.CreatedOn)).TotalSeconds;
            return vague;
        }

        var live = await db.OtpChallenges
            .Where(o => o.Destination == code && o.Channel == ResetChannel && !o.IsUsed)
            .ToListAsync(ct);
        foreach (var stale in live) stale.IsUsed = true;

        var secret = System.Security.Cryptography.RandomNumberGenerator
            .GetInt32(100000, 1000000).ToString();

        db.OtpChallenges.Add(new OtpChallenge
        {
            Channel = ResetChannel,
            Destination = code,
            CodeHash = passwords.Hash(secret),
            ExpiresOn = now.AddMinutes(ResetValidityMinutes),
        });
        await db.SaveChangesAsync(ct);

        await notifications.SendApplicantResetCodeAsync(
            applicant, secret, ResetValidityMinutes, ct);

        logger.LogInformation("Applicant password reset code sent for {ApplicantCode}", code);

        vague.MaskedEmail = Mask(applicant.Email);
        return vague;
    }

    /// <summary>Consumes the code, sets the new password and kills every session.</summary>
    public async Task ResetPasswordAsync(ApplicantResetPasswordDto dto, CancellationToken ct)
    {
        if ((dto.NewPassword ?? string.Empty).Length < 8)
            throw new AppException("The new password must be at least 8 characters.");

        /* Resolved the same way as the request, so somebody who asked by
           e-mail can finish by e-mail. */
        var applicant = await ResolveForResetAsync(dto.Identifier, ct);
        var code = applicant?.ApplicantCode ?? string.Empty;

        var challenge = await db.OtpChallenges
            .Where(o => o.Destination == code && o.Channel == ResetChannel && !o.IsUsed)
            .OrderByDescending(o => o.CreatedOn)
            .FirstOrDefaultAsync(ct)
            ?? throw new AppException("Request a reset code first.");

        if (challenge.ExpiresOn < DateTime.UtcNow)
        {
            challenge.IsUsed = true;
            await db.SaveChangesAsync(ct);
            throw new AppException("That code has expired. Ask for a new one.");
        }

        if (challenge.Attempts >= 5)
        {
            challenge.IsUsed = true;
            await db.SaveChangesAsync(ct);
            throw new AppException("Too many incorrect attempts. Ask for a new code.");
        }

        if (!passwords.Verify(challenge.CodeHash, dto.Code ?? string.Empty))
        {
            challenge.Attempts++;
            await db.SaveChangesAsync(ct);
            throw new AppException("That code is not correct.");
        }

        challenge.IsUsed = true;
        applicant!.PasswordHash = passwords.Hash(dto.NewPassword!);
        await db.SaveChangesAsync(ct);

        logger.LogInformation("Applicant password reset completed for {ApplicantCode}", code);

        /* Confirmed by e-mail, with the applicant ID they sign in with:
           somebody who has just been through a reset has usually lost that
           too, and a reset nobody asked for has to be visible to the person
           it happened to. */
        try
        {
            await notifications.SendApplicantPasswordChangedAsync(
                applicant, "reset with a code", ct);
        }
        catch (Exception caught)
        {
            logger.LogWarning(caught,
                "The password for {ApplicantCode} was reset but the confirmation "
                + "could not be sent.", code);
        }
    }

    /// <summary>
    /// a••••@e••••••.org — enough for the holder to recognise their own
    /// mailbox, not enough for anybody else to learn it.
    /// </summary>
    private static string Mask(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 0) return "•••";

        var user = email[..at];
        var host = email[(at + 1)..];
        var dot = host.LastIndexOf('.');

        var maskedUser = user[..1] + new string('•', Math.Max(1, user.Length - 1));
        var maskedHost = dot > 0
            ? host[..1] + new string('•', Math.Max(1, dot - 1)) + host[dot..]
            : host[..1] + new string('•', Math.Max(1, host.Length - 1));

        return $"{maskedUser}@{maskedHost}";
    }

}
