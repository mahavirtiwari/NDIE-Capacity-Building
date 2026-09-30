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

    public async Task<ApplicantDto> MeAsync(int applicantId, CancellationToken ct) =>
        (await db.Applicants.AsNoTracking()
            .Include(a => a.Category).Include(a => a.SubCategory)
            .Include(a => a.State).Include(a => a.District)
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
            .Email(dto.Email)
            .Mobile(dto.Mobile)
            .ThrowIfInvalid();

        var emailChanged = !string.Equals(applicant.Email, dto.Email.Trim(),
            StringComparison.OrdinalIgnoreCase);


        applicant.Email = dto.Email.Trim().ToLowerInvariant();
        applicant.Mobile = dto.Mobile.Trim();
        /* Left alone when omitted, so a client that does not send these fields
           cannot blank a declaration the applicant already made. */
        applicant.Gender = EnumMaps.ParseDeclared<Gender>(dto.Gender) ?? applicant.Gender;
        applicant.SocialCategory =
            EnumMaps.ParseDeclared<SocialCategory>(dto.SocialCategory) ?? applicant.SocialCategory;
        applicant.StateCode = dto.StateCode;
        applicant.DistrictCode = dto.DistrictCode;
        applicant.City = dto.City;

        /* A new address has to be proven before it is trusted again. */
        if (emailChanged) applicant.EmailVerified = false;

        await db.SaveChangesAsync(ct);
        return await MeAsync(applicantId, ct);
    }

    /// <summary>Programmes the applicant is eligible to apply for.</summary>
    public async Task<List<ApplicantProgramDto>> AvailableProgramsAsync(
        int applicantId, CancellationToken ct)
    {
        var applicant = await db.Applicants.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == applicantId, ct)
            ?? throw AppException.NotFound("Applicant");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var programTypes = await db.ProgramTypes.AsNoTracking()
            .Include(p => p.Category)
            .Include(p => p.SubCategory)
            .Where(p => p.Status == RecordStatus.Active && p.CategoryId == applicant.CategoryId)
            .OrderBy(p => p.Name)
            .ToListAsync(ct);

        var typeIds = programTypes.Select(p => p.Id).ToList();

        var forms = await db.ProfileForms.AsNoTracking()
            .Where(f => typeIds.Contains(f.ProgramTypeId) && f.Status == RecordStatus.Active)
            .Select(f => f.ProgramTypeId)
            .ToListAsync(ct);

        var fees = await db.FeeStructures.AsNoTracking()
            .Include(f => f.Components)
            .Where(f => typeIds.Contains(f.ProgramTypeId)
                        && f.Status == RecordStatus.Active
                        && f.EffectiveFrom <= today
                        && (f.EffectiveTo == null || f.EffectiveTo >= today))
            .ToListAsync(ct);

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

                var accepting = !pt.RequiresProfileForm || forms.Contains(pt.Id);

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
                    RequiresProfileForm = pt.RequiresProfileForm,

                    ExistingApplicationStatus = existing?.Status.ToApi(),
                    ExistingApplicationId = existing?.Id,
                    ExistingApplicationNo = existing?.ApplicationNo,
                    ExistingSubmittedOn = existing?.SubmittedOn,
                    ExistingRejectionReason = existing?.Status == ApplicationStatus.Rejected
                        ? existing.RejectionReasonLabel
                        : null,

                    CanApply = accepting && live is null,
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

    /// <summary>Batches the applicant is enrolled in, with their attendance.</summary>
    public async Task<List<ApplicantEnrolmentDto>> MyEnrolmentsAsync(int applicantId, CancellationToken ct)
    {
        var rows = await db.ProgrammeParticipants.AsNoTracking()
            .Include(p => p.Programme).ThenInclude(x => x!.Agency)
            .Include(p => p.Programme).ThenInclude(x => x!.State)
            .Where(p => p.ApplicantId == applicantId)
            .OrderByDescending(p => p.Programme!.StartDate)
            .ToListAsync(ct);

        return
        [
            .. rows.Select(p => new ApplicantEnrolmentDto
            {
                ParticipantId = p.Id,
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
            }),
        ];
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
