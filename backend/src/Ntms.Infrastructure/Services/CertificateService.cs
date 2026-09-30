using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Certificates;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Persistence;
using Ntms.Infrastructure.Storage;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Awarding certificates, and producing the documents themselves.
///
/// The programme type's policy decides what each participant earns; this class
/// decides whether it can be awarded yet, allocates the number, records the
/// award and renders it. Nothing is ever deleted — a certificate issued in
/// error is revoked, and the number it consumed stays consumed.
/// </summary>
public class CertificateService(
    NtmsDbContext db,
    ICurrentUser currentUser,
    CertificateTemplateStore templates,
    INotificationService notifications)
{
    private IQueryable<Certificate> Base => db.Certificates.AsNoTracking()
        .Include(c => c.IssuedBy);

    /* ------------------------------------------------------- eligibility */

    /// <summary>
    /// Everyone on a programme and what they are owed, without issuing
    /// anything. This is what the screen shows before the button is pressed.
    /// </summary>
    public async Task<ProgrammeCertificateSummaryDto> ProgrammeSummaryAsync(
        int programmeId, CancellationToken ct)
    {
        var programme = await LoadProgrammeAsync(programmeId, ct);
        var type = programme.ProgramType!;
        var policy = type.CertificationPolicy;

        var issued = await Base
            .Where(c => c.ProgrammeId == programmeId)
            .ToListAsync(ct);

        var summary = new ProgrammeCertificateSummaryDto
        {
            ProgrammeId = programmeId,
            ProgrammeName = programme.ProgrammeName,
            CertificationPolicy = policy.ToString(),
            CertificationPolicyLabel = CertificationPolicies.Label(policy),
            MissingTemplates =
            [
                .. CertificationPolicies.KindsFor(policy)
                    .Where(kind => type.CertificateTemplates.All(t => t.Kind != kind))
                    .Select(kind => kind.ToString()),
            ],
        };

        foreach (var participant in programme.Participants.OrderBy(p => p.Applicant!.FullName))
        {
            var live = issued.FirstOrDefault(c => c.ParticipantId == participant.Id && !c.IsRevoked);
            var row = Assess(programme, participant, policy, live);
            summary.Participants.Add(row);

            if (row.Certificate is not null) summary.Issued++;
            else if (row.CanIssue) summary.Pending++;
            else summary.NotEligible++;
        }

        return summary;
    }

    /// <summary>
    /// What one participant earns and whether it can be issued.
    ///
    /// The rules in one place, so the list, the single issue and the bulk issue
    /// cannot disagree about who qualifies.
    /// </summary>
    private CertificateEligibilityDto Assess(
        Programme programme,
        ProgrammeParticipant participant,
        CertificationPolicy policy,
        Certificate? live)
    {
        var row = new CertificateEligibilityDto
        {
            ParticipantId = participant.Id,
            Name = participant.Applicant?.FullName ?? string.Empty,
            Result = participant.Result.ToString(),
            Certificate = live is null ? null : ToDto(live),
        };

        if (live is not null)
        {
            row.Kind = live.Kind.ToString();
            row.KindLabel = KindLabel(live.Kind);
            return row;
        }

        if (policy == CertificationPolicy.None)
        {
            row.Blocker = "This program awards no certificate.";
            return row;
        }

        if (programme.Status != ProgramStatus.Conducted)
        {
            row.Blocker = "The program has not been marked as conducted.";
            return row;
        }

        /* A pending result cannot be turned into an award under any policy that
           distinguishes outcomes — and under one that does not, the participant
           still has to have been on the programme. */
        if (participant.Result == ParticipantResult.Pending
            && policy != CertificationPolicy.ParticipationOnly)
        {
            row.Blocker = "Record the exam result first.";
            return row;
        }

        var kind = CertificationPolicies.AwardFor(policy, participant.Result == ParticipantResult.Pass);
        if (kind is null)
        {
            row.Blocker = participant.Result == ParticipantResult.Fail
                ? "Did not qualify, and this program awards nothing otherwise."
                : "Nothing is awarded for this result.";
            return row;
        }

        row.Kind = kind.Value.ToString();
        row.KindLabel = KindLabel(kind.Value);
        row.CanIssue = true;
        return row;
    }

    /* ------------------------------------------------------------- issue */

    public async Task<CertificateDto> IssueAsync(int participantId, CancellationToken ct)
    {
        var participant = await db.ProgrammeParticipants
            .Include(p => p.Applicant)
            .FirstOrDefaultAsync(p => p.Id == participantId, ct)
            ?? throw AppException.NotFound("Participant");

        var programme = await LoadProgrammeAsync(participant.ProgrammeId, ct);
        var live = await db.Certificates
            .FirstOrDefaultAsync(c => c.ParticipantId == participantId && c.RevokedOn == null, ct);

        var assessment = Assess(programme, participant, programme.ProgramType!.CertificationPolicy, live);

        if (assessment.Certificate is not null)
            throw AppException.Conflict($"{assessment.Name} already holds certificate {live!.Number}.");

        if (!assessment.CanIssue)
            throw new AppException(assessment.Blocker ?? "This participant is not eligible.");

        var certificate = await CreateAsync(
            programme, participant, Enum.Parse<CertificateKind>(assessment.Kind!), ct);

        return ToDto(certificate);
    }

    /// <summary>
    /// Issues to everyone on the programme who is owed one and does not have
    /// it. Those who are not eligible are skipped rather than failing the run —
    /// a whole batch should not stop because one exam result is outstanding.
    /// </summary>
    public async Task<ProgrammeCertificateSummaryDto> IssueProgrammeAsync(
        int programmeId, CancellationToken ct)
    {
        var programme = await LoadProgrammeAsync(programmeId, ct);
        var policy = programme.ProgramType!.CertificationPolicy;

        var live = await db.Certificates
            .Where(c => c.ProgrammeId == programmeId && c.RevokedOn == null)
            .ToListAsync(ct);

        foreach (var participant in programme.Participants)
        {
            var already = live.FirstOrDefault(c => c.ParticipantId == participant.Id);
            var assessment = Assess(programme, participant, policy, already);
            if (!assessment.CanIssue || assessment.Certificate is not null) continue;

            await CreateAsync(programme, participant, Enum.Parse<CertificateKind>(assessment.Kind!), ct);
        }

        return await ProgrammeSummaryAsync(programmeId, ct);
    }

    private async Task<Certificate> CreateAsync(
        Programme programme, ProgrammeParticipant participant, CertificateKind kind,
        CancellationToken ct)
    {
        var type = programme.ProgramType!;
        var issuedOn = IndianToday();

        var certificate = new Certificate
        {
            Kind = kind,
            ParticipantId = participant.Id,
            ProgrammeId = programme.Id,
            ProgramTypeId = type.Id,
            RecipientName = participant.Applicant?.FullName ?? string.Empty,
            ProgrammeName = programme.ProgrammeName,
            ProgramTypeName = type.Name,
            IssuedOn = issuedOn,
            ValidTill = type.CertificateValidityMonths > 0
                ? issuedOn.AddMonths(type.CertificateValidityMonths)
                : null,
            IssuedByUserId = currentUser.UserId
                ?? throw AppException.Forbidden("Sign in to issue certificates."),
        };

        /* The number is taken inside the retry: two people pressing Issue at the
           same moment would otherwise both read the same last number, and the
           unique index would reject the second. Retrying re-reads it. */
        for (var attempt = 1; ; attempt++)
        {
            certificate.Number = await NextNumberAsync(type, issuedOn.Year, ct);
            db.Certificates.Add(certificate);

            try
            {
                await db.SaveChangesAsync(ct);
                break;
            }
            catch (DbUpdateException) when (attempt < 5)
            {
                db.Entry(certificate).State = EntityState.Detached;
            }
        }

        /* Mirrored onto the participant, which is where the programme screens
           and the applicant app already look for it. */
        participant.CertificateNo = certificate.Number;
        await db.SaveChangesAsync(ct);

        return certificate;
    }

    /// <summary>
    /// The next number in this programme type's series for the year, e.g.
    /// <c>ZED-MT-B/2026/00042</c>.
    ///
    /// Per type and per year so the series stays short and readable, and so a
    /// year's issuance can be counted straight off the numbers.
    /// </summary>
    private async Task<string> NextNumberAsync(ProgramType type, int year, CancellationToken ct)
    {
        var prefix = $"{type.Code}/{year}/";

        var last = await db.Certificates.AsNoTracking()
            .Where(c => c.Number.StartsWith(prefix))
            .OrderByDescending(c => c.Number)
            .Select(c => c.Number)
            .FirstOrDefaultAsync(ct);

        var next = 1;
        if (last is not null && int.TryParse(last[prefix.Length..], out var previous))
        {
            next = previous + 1;
        }

        return $"{prefix}{next:D5}";
    }

    /* ------------------------------------------------------------ revoke */

    public async Task<CertificateDto> RevokeAsync(int id, string reason, CancellationToken ct)
    {
        Guard.Check().Required(reason, "Reason").ThrowIfInvalid();

        var certificate = await db.Certificates
            .FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw AppException.NotFound("Certificate");

        if (certificate.IsRevoked)
            throw AppException.Conflict("This certificate is already revoked.");

        certificate.RevokedOn = DateTime.UtcNow;
        certificate.RevokedReason = reason.Trim();
        certificate.RevokedByUserId = currentUser.UserId;

        /* The participant no longer holds a live certificate. */
        var participant = await db.ProgrammeParticipants
            .FirstOrDefaultAsync(p => p.Id == certificate.ParticipantId, ct);
        if (participant is not null) participant.CertificateNo = null;

        await db.SaveChangesAsync(ct);
        return ToDto(certificate);
    }

    /* -------------------------------------------------------- re-sending */

    /// <summary>
    /// Sends the holder their certificate details again.
    ///
    /// Details and a verification link rather than the document itself: the
    /// certificate is rendered from a template that can change, and a PDF
    /// sitting in an inbox is a copy nobody can withdraw. What is e-mailed
    /// points at the live record, so a revoked certificate stops verifying.
    /// </summary>
    public async Task<string> ResendAsync(int id, string verifyBaseUrl, CancellationToken ct)
    {
        var certificate = await db.Certificates.AsNoTracking()
            .Include(c => c.Participant)!.ThenInclude(p => p!.Applicant)
            .FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw AppException.NotFound("Certificate");

        if (certificate.RevokedOn is not null)
        {
            throw new AppException(
                "This certificate has been revoked, so it cannot be sent again.");
        }

        var applicant = certificate.Participant?.Applicant
            ?? throw new AppException("This certificate is not linked to an applicant.");

        if (string.IsNullOrWhiteSpace(applicant.Email))
            throw new AppException("There is no email address on this applicant's account.");

        var verifyUrl =
            $"{verifyBaseUrl.TrimEnd('/')}/verify?number={Uri.EscapeDataString(certificate.Number)}";

        await notifications.SendCertificateAsync(
            certificate, applicant.Email, applicant.FullName, verifyUrl, ct);

        return applicant.Email;
    }

    /* ------------------------------------------------------------ render */

    /// <summary>The printable document for one certificate.</summary>
    public async Task<CertificateRenderer.Rendered> RenderAsync(int id, CancellationToken ct)
    {
        var certificate = await Base
            .Include(c => c.Programme)!.ThenInclude(p => p!.Category)
            .Include(c => c.Programme)!.ThenInclude(p => p!.SubCategory)
            .Include(c => c.Programme)!.ThenInclude(p => p!.State)
            .Include(c => c.Programme)!.ThenInclude(p => p!.Agency)
            .Include(c => c.ProgramType)
            .FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw AppException.NotFound("Certificate");

        var template = await LoadTemplateAsync(certificate.ProgramTypeId, certificate.Kind, ct);
        var organisation = await OrganisationNameAsync(ct);

        return CertificateRenderer.Render(
            template,
            certificate.Kind,
            Values(certificate, organisation),
            Safe($"{certificate.Number}.html"));
    }

    /// <summary>Every live certificate on a programme, one per page.</summary>
    public async Task<CertificateRenderer.Rendered> RenderProgrammeAsync(
        int programmeId, CancellationToken ct)
    {
        var programme = await LoadProgrammeAsync(programmeId, ct);

        var certificates = await Base
            .Include(c => c.Programme)!.ThenInclude(p => p!.Category)
            .Include(c => c.Programme)!.ThenInclude(p => p!.SubCategory)
            .Include(c => c.Programme)!.ThenInclude(p => p!.State)
            .Include(c => c.Programme)!.ThenInclude(p => p!.Agency)
            .Include(c => c.ProgramType)
            .Where(c => c.ProgrammeId == programmeId && c.RevokedOn == null)
            .OrderBy(c => c.RecipientName)
            .ToListAsync(ct);

        if (certificates.Count == 0)
            throw new AppException("No certificates have been issued on this program yet.");

        /* Printed in one pass per kind, because each kind has its own artwork
           and a single document can only carry one background. */
        var byKind = certificates.GroupBy(c => c.Kind).ToList();
        if (byKind.Count > 1)
        {
            throw new AppException(
                "This program has issued both certification and participation certificates. " +
                "Print each kind separately so the right artwork is used for each.");
        }

        var kind = byKind[0].Key;
        var template = await LoadTemplateAsync(certificates[0].ProgramTypeId, kind, ct);
        var organisation = await OrganisationNameAsync(ct);

        return CertificateRenderer.RenderMany(
            template,
            kind,
            [.. certificates.Select(c => Values(c, organisation))],
            programme.ProgrammeName,
            Safe($"{programme.ProgrammeId}-certificates.html"));
    }

    /// <summary>
    /// A specimen rendered from made-up details, so artwork can be checked
    /// before anyone has been certified.
    /// </summary>
    public async Task<CertificateRenderer.Rendered> PreviewAsync(
        int programTypeId, CertificateKind kind, CancellationToken ct)
    {
        var type = await db.ProgramTypes.AsNoTracking()
            .Include(p => p.Category).Include(p => p.SubCategory)
            .FirstOrDefaultAsync(p => p.Id == programTypeId, ct)
            ?? throw AppException.NotFound("Program type");

        if (!CertificationPolicies.Awards(type.CertificationPolicy, kind))
        {
            throw new AppException(
                $"This programme is set to \"{CertificationPolicies.Label(type.CertificationPolicy)}\", " +
                $"so it does not award a {kind.ToString().ToLowerInvariant()} certificate.");
        }

        var template = await LoadTemplateAsync(programTypeId, kind, ct);
        var today = IndianToday();

        var values = new Dictionary<string, string>
        {
            ["recipientName"] = "Specimen — A. Candidate",
            ["certificateNumber"] = $"{type.Code}/{today.Year}/00000",
            ["kindLabel"] = KindLabel(kind),
            ["programmeName"] = "Specimen batch",
            ["programmeCode"] = "SPECIMEN",
            ["programTypeName"] = type.Name,
            ["categoryName"] = type.Category?.Name ?? string.Empty,
            ["subCategoryName"] = type.SubCategory?.Name ?? string.Empty,
            ["startDate"] = Format(today.AddDays(-type.DurationDays)),
            ["endDate"] = Format(today),
            ["durationDays"] = type.DurationDays.ToString(),
            ["issuedOn"] = Format(today),
            ["validTill"] = type.CertificateValidityMonths > 0
                ? Format(today.AddMonths(type.CertificateValidityMonths))
                : string.Empty,
            ["venue"] = "Specimen venue",
            ["city"] = "New Delhi",
            ["state"] = "DELHI",
            ["agencyName"] = "Specimen agency",
            ["organisationName"] = await OrganisationNameAsync(ct),
        };

        return CertificateRenderer.Render(template, kind, values, Safe($"specimen-{type.Code}.html"));
    }

    /* ------------------------------------------------------------ verify */

    /// <summary>Confirms a certificate number, for anyone holding a document.</summary>
    public async Task<CertificateVerificationDto> VerifyAsync(string number, CancellationToken ct)
    {
        var trimmed = (number ?? string.Empty).Trim();

        var certificate = await Base
            .FirstOrDefaultAsync(c => c.Number == trimmed, ct);

        if (certificate is null)
        {
            return new CertificateVerificationDto
            {
                Found = false,
                Number = trimmed,
                Status = "No certificate was issued with that number.",
            };
        }

        var expired = certificate.ValidTill is { } till && till < IndianToday();

        return new CertificateVerificationDto
        {
            Found = true,
            Number = certificate.Number,
            RecipientName = certificate.RecipientName,
            ProgramTypeName = certificate.ProgramTypeName,
            KindLabel = KindLabel(certificate.Kind),
            IssuedOn = certificate.IssuedOn,
            ValidTill = certificate.ValidTill,
            IsRevoked = certificate.IsRevoked,
            IsExpired = expired,
            Status = certificate.IsRevoked
                ? $"Revoked on {Format(DateOnly.FromDateTime(certificate.RevokedOn!.Value))}."
                : expired
                    ? $"Expired on {Format(certificate.ValidTill!.Value)}."
                    : "Valid.",
        };
    }

    /* ---------------------------------------------------------- helpers */

    private async Task<Programme> LoadProgrammeAsync(int programmeId, CancellationToken ct) =>
        await db.Programmes
            .Include(p => p.ProgramType)!.ThenInclude(t => t!.CertificateTemplates)
            .Include(p => p.Participants).ThenInclude(x => x.Applicant)
            .FirstOrDefaultAsync(p => p.Id == programmeId, ct)
        ?? throw AppException.NotFound("Program");

    private async Task<CertificateRenderer.Template?> LoadTemplateAsync(
        int programTypeId, CertificateKind kind, CancellationToken ct)
    {
        var row = await db.CertificateTemplates.AsNoTracking()
            .FirstOrDefaultAsync(t => t.ProgramTypeId == programTypeId && t.Kind == kind, ct);

        /* No template is not an error: the renderer falls back to a plain
           certificate so an award is never withheld for want of artwork. */
        if (row is null) return null;

        await using var stream = templates.Open(row.RelativePath);
        using var buffer = new MemoryStream();
        await stream.CopyToAsync(buffer, ct);

        return new CertificateRenderer.Template(row.ContentType, buffer.ToArray());
    }

    private async Task<string> OrganisationNameAsync(CancellationToken ct) =>
        await db.Branding.AsNoTracking()
            .Select(b => b.OrganisationName)
            .FirstOrDefaultAsync(ct) ?? string.Empty;

    private static Dictionary<string, string> Values(Certificate c, string organisation)
    {
        var programme = c.Programme;

        return new Dictionary<string, string>
        {
            ["recipientName"] = c.RecipientName,
            ["certificateNumber"] = c.Number,
            ["kindLabel"] = KindLabel(c.Kind),
            ["programmeName"] = c.ProgrammeName,
            ["programmeCode"] = programme?.ProgrammeId ?? string.Empty,
            ["programTypeName"] = c.ProgramTypeName,
            ["categoryName"] = programme?.Category?.Name ?? string.Empty,
            ["subCategoryName"] = programme?.SubCategory?.Name ?? string.Empty,
            ["startDate"] = programme is null ? string.Empty : Format(programme.StartDate),
            ["endDate"] = programme is null ? string.Empty : Format(programme.EndDate),
            ["durationDays"] = programme is null
                ? string.Empty
                : (programme.EndDate.DayNumber - programme.StartDate.DayNumber + 1).ToString(),
            ["issuedOn"] = Format(c.IssuedOn),
            ["validTill"] = c.ValidTill is { } till ? Format(till) : string.Empty,
            ["venue"] = programme?.Venue ?? string.Empty,
            ["city"] = programme?.City ?? string.Empty,
            ["state"] = programme?.State?.Name ?? string.Empty,
            ["agencyName"] = programme?.Agency?.Name ?? string.Empty,
            ["organisationName"] = organisation,
        };
    }

    private static CertificateDto ToDto(Certificate c) => new()
    {
        Id = c.Id,
        Number = c.Number,
        Kind = c.Kind.ToString(),
        KindLabel = KindLabel(c.Kind),
        ParticipantId = c.ParticipantId,
        ProgrammeId = c.ProgrammeId,
        RecipientName = c.RecipientName,
        ProgrammeName = c.ProgrammeName,
        ProgramTypeName = c.ProgramTypeName,
        IssuedOn = c.IssuedOn,
        ValidTill = c.ValidTill,
        IssuedBy = c.IssuedBy?.FullName,
        IsRevoked = c.IsRevoked,
        RevokedOn = c.RevokedOn,
        RevokedReason = c.RevokedReason,
        Url = $"certificates/{c.Id}/document",
    };

    private static string KindLabel(CertificateKind kind) => kind switch
    {
        CertificateKind.Qualification => "Certification certificate",
        _ => "Participation certificate",
    };

    /// <summary>Dates on a certificate are Indian dates, not UTC ones.</summary>
    private static DateOnly IndianToday() =>
        DateOnly.FromDateTime(Email.IndianTime.From(DateTime.UtcNow));

    private static string Format(DateOnly date) =>
        date.ToString("dd MMM yyyy", CultureInfo.InvariantCulture);

    /// <summary>A filename safe to put in a Content-Disposition header.</summary>
    private static string Safe(string name) =>
        string.Concat(name.Select(ch => Path.GetInvalidFileNameChars().Contains(ch) ? '-' : ch));
}
