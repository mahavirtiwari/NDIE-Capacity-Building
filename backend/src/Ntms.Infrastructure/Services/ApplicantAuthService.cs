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

        var forms = await db.RegistrationForms.AsNoTracking()
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
            .Select(a => new { a.ProgramTypeId, a.Status })
            .ToListAsync(ct);

        return
        [
            .. programTypes.Select(pt =>
            {
                var fee = fees.FirstOrDefault(f => f.ProgramTypeId == pt.Id);
                var taxable = fee?.Components.Where(c => c.IsTaxable).Sum(c => c.Amount) ?? 0m;
                var nonTaxable = fee?.Components.Where(c => !c.IsTaxable).Sum(c => c.Amount) ?? 0m;
                var gst = fee is null ? 0m : Math.Round(taxable * fee.GstPercent / 100m, 2);
                var existing = applied.FirstOrDefault(a => a.ProgramTypeId == pt.Id);

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
                    /* A track that asks for no registration form is open the
                       moment it exists: there is no form to wait on. */
                    AcceptingApplications =
                        !pt.RequiresRegistrationForm || forms.Contains(pt.Id),
                    RequiresRegistrationForm = pt.RequiresRegistrationForm,
                    ExistingApplicationStatus = existing?.Status.ToApi(),
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
}
