using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Email;

/// <summary>
/// The messages the system actually sends. The wording lives in editable
/// templates; this class only decides which template to use and what to fill
/// the placeholders with.
/// </summary>
public interface INotificationService
{
    Task SendOtpAsync(string email, string name, string code, CancellationToken ct = default);
    Task SendApplicantWelcomeAsync(Applicant applicant, CancellationToken ct = default);
    Task SendApplicantCredentialsAsync(
        Applicant applicant, string password, CancellationToken ct = default);
    Task SendPortalCredentialsAsync(
        PortalUser user, string temporaryPassword, CancellationToken ct = default);
    Task SendPasswordResetCodeAsync(
        PortalUser user, string code, int validityMinutes, CancellationToken ct = default);
    /// <summary>
    /// Credentials for a newly created account, on the template that matches
    /// its tier, with the allocation spelled out.
    /// </summary>
    Task SendCredentialsForRoleAsync(
        PortalUser user, string temporaryPassword, CancellationToken ct = default);
    /// <summary>Tells the account holder their password changed, whoever changed it.</summary>
    Task SendPasswordChangedAsync(
        PortalUser user, string method, CancellationToken ct = default);
    Task SendApplicationSubmittedAsync(
        TrainingApplication application, string applicantEmail, string applicantName,
        CancellationToken ct = default);
    Task SendScrutinyOutcomeAsync(
        TrainingApplication application, string applicantEmail, string applicantName,
        string outcome, string remarks, CancellationToken ct = default);
    Task SendProgrammeRaisedAsync(
        Programme programme, string agencyName, string email, string name,
        CancellationToken ct = default);
    Task SendPostponementRequestedAsync(
        Programme programme, string agencyName, string reason, string email, string name,
        CancellationToken ct = default);
    Task SendProgrammeScheduleAsync(
        Programme programme, string email, string name, CancellationToken ct = default);
    Task SendAgencyEmpanelledAsync(
        ImplementingAgency agency, string scope, CancellationToken ct = default);

    /// <summary>
    /// Tells the holder their access was switched on or off, and on what
    /// grounds. Sent for both directions: somebody locked out deserves to know
    /// why, and somebody let back in needs to know they can work again.
    /// </summary>
    Task SendAccountStatusChangedAsync(
        PortalUser user, string reason, string by, CancellationToken ct = default);

    /// <summary>Tells the holder their details or allocation were changed.</summary>
    Task SendAccountUpdatedAsync(PortalUser user, CancellationToken ct = default);

    /// <summary>
    /// Tells an applicant their account was blocked or let back in, and why.
    /// Sent both ways: being locked out without being told why is the worst
    /// version of this, and being let back in is worth knowing.
    /// </summary>
    Task SendApplicantAccessChangedAsync(
        Applicant applicant, bool blocked, string reason, string remarks,
        CancellationToken ct = default);

    /// <summary>
    /// Sends the holder their certificate details and where to verify it.
    /// Used when one is issued and again whenever somebody re-sends it.
    /// </summary>
    Task SendCertificateAsync(
        Certificate certificate, string email, string name, string verifyUrl,
        CancellationToken ct = default);

    /// <summary>A one-time code for an applicant recovering their password.</summary>
    Task SendApplicantResetCodeAsync(
        Applicant applicant, string code, int validityMinutes, CancellationToken ct = default);
}

public class NotificationService(
    IEmailSender sender,
    IEmailSettingsProvider settings,
    NtmsDbContext db) : INotificationService
{
    public async Task SendOtpAsync(
        string email, string name, string code, CancellationToken ct = default)
    {
        var options = await settings.GetAsync(ct);
        await SendAsync(EmailTemplateDefaults.Otp, email, new()
        {
            ["name"] = name,
            ["code"] = code,
            ["validityMinutes"] = options.OtpValidityMinutes.ToString(),
        }, ct);
    }

    public Task SendApplicantWelcomeAsync(Applicant applicant, CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.ApplicantWelcome, applicant.Email, new()
        {
            ["name"] = applicant.FullName,
            ["applicantCode"] = applicant.ApplicantCode,
            ["email"] = applicant.Email,
        }, ct);

    public Task SendApplicantCredentialsAsync(
        Applicant applicant, string password, CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.ApplicantCredentials, applicant.Email, new()
        {
            ["name"] = applicant.FullName,
            ["applicantCode"] = applicant.ApplicantCode,
            ["password"] = password,
        }, ct);

    public Task SendPortalCredentialsAsync(
        PortalUser user, string temporaryPassword, CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.PortalCredentials, user.Email, new()
        {
            ["name"] = user.FullName,
            ["userCode"] = user.UserCode,
            ["temporaryPassword"] = temporaryPassword,
        }, ct);

    public Task SendPasswordResetCodeAsync(
        PortalUser user, string code, int validityMinutes, CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.PasswordReset, user.Email, new()
        {
            ["name"] = user.FullName,
            ["userCode"] = user.UserCode,
            ["code"] = code,
            ["validityMinutes"] = validityMinutes.ToString(),
        }, ct);

    public async Task SendCredentialsForRoleAsync(
        PortalUser user, string temporaryPassword, CancellationToken ct = default)
    {
        await SendAsync(
            EmailTemplateDefaults.CredentialsKeyFor(user.BaseRole), user.Email, new()
            {
                ["name"] = user.FullName,
                ["userCode"] = user.UserCode,
                ["temporaryPassword"] = temporaryPassword,
                ["roleName"] = Application.Common.RoleHierarchy.DisplayName(user.BaseRole),
                ["scopeSummary"] = await DescribeScopeAsync(user, ct),
            }, ct);
    }

    /// <summary>
    /// The allocation in words, so the recipient can see the boundary of their
    /// account without signing in and inferring it from what is missing.
    /// </summary>
    private async Task<string> DescribeScopeAsync(PortalUser user, CancellationToken ct)
    {
        if (!Application.Common.RoleHierarchy.IsScoped(user.BaseRole))
        {
            return "The whole program — no category, state or district limits apply.";
        }

        var parts = new List<string>();

        var categories = user.Categories.Select(c => c.CategoryId).ToList();
        if (categories.Count > 0)
        {
            parts.Add(await NamesAsync(
                db.Categories.Where(c => categories.Contains(c.Id)).Select(c => c.Name),
                "category", "categories", ct));
        }

        var subCategories = user.SubCategories.Select(c => c.SubCategoryId).ToList();
        if (subCategories.Count > 0)
        {
            parts.Add(await NamesAsync(
                db.SubCategories.Where(c => subCategories.Contains(c.Id)).Select(c => c.Name),
                "sub-category", "sub-categories", ct));
        }

        var programTypes = user.ProgramTypes.Select(p => p.ProgramTypeId).ToList();
        if (programTypes.Count > 0)
        {
            parts.Add(await NamesAsync(
                db.ProgramTypes.Where(p => programTypes.Contains(p.Id)).Select(p => p.Name),
                "program type", "program types", ct));
        }

        var states = user.States.Select(x => x.StateCode).ToList();
        if (states.Count > 0)
        {
            parts.Add(await NamesAsync(
                db.States.Where(x => states.Contains(x.Code)).Select(x => x.Name),
                "state", "states", ct));
        }

        var districts = user.Districts.Select(x => x.DistrictCode).ToList();
        if (districts.Count > 0)
        {
            parts.Add(await NamesAsync(
                db.Districts.Where(x => districts.Contains(x.Code)).Select(x => x.Name),
                "district", "districts", ct));
        }

        return parts.Count == 0 ? "Not yet allocated." : string.Join("; ", parts);
    }

    /// <summary>
    /// Lists a few names outright and counts the rest, so an allocation of
    /// thirty states does not turn the email into a directory.
    /// </summary>
    private static async Task<string> NamesAsync(
        IQueryable<string> query, string singular, string plural, CancellationToken ct)
    {
        var names = await query.OrderBy(n => n).ToListAsync(ct);
        var label = names.Count == 1 ? singular : plural;

        if (names.Count <= 4) return $"{label}: {string.Join(", ", names)}";
        return $"{names.Count} {plural}: {string.Join(", ", names.Take(3))} and {names.Count - 3} more";
    }

    public Task SendPasswordChangedAsync(
        PortalUser user, string method, CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.PasswordChanged, user.Email, new()
        {
            ["name"] = user.FullName,
            ["userCode"] = user.UserCode,
            ["changedOn"] = IndianTime.Format(DateTime.UtcNow),
            ["method"] = method,
        }, ct);

    public Task SendApplicationSubmittedAsync(
        TrainingApplication application, string applicantEmail, string applicantName,
        CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.ApplicationSubmitted, applicantEmail, new()
        {
            ["name"] = applicantName,
            ["applicationNo"] = application.ApplicationNo,
            ["programme"] = application.ProgramType?.Name ?? "the program",
        }, ct);

    public Task SendApplicantAccessChangedAsync(
        Applicant applicant, bool blocked, string reason, string remarks,
        CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.ApplicantAccessChanged, applicant.Email, new()
        {
            ["name"] = applicant.FullName,
            ["applicantCode"] = applicant.ApplicantCode,
            ["outcome"] = blocked ? "blocked" : "unblocked",
            ["reason"] = reason,
            ["remarks"] = remarks,
        }, ct);

    public Task SendCertificateAsync(
        Certificate certificate, string email, string name, string verifyUrl,
        CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.CertificateIssued, email, new()
        {
            ["name"] = name,
            ["certificateNumber"] = certificate.Number,
            ["kind"] = certificate.Kind.ToString(),
            ["programme"] = certificate.ProgrammeName,
            ["issuedOn"] = certificate.IssuedOn.ToString("dd MMM yyyy"),
            ["validTill"] = certificate.ValidTill?.ToString("dd MMM yyyy") ?? "No expiry",
            ["verifyUrl"] = verifyUrl,
        }, ct);

    public Task SendScrutinyOutcomeAsync(
        TrainingApplication application, string applicantEmail, string applicantName,
        string outcome, string remarks, CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.ScrutinyOutcome, applicantEmail, new()
        {
            ["name"] = applicantName,
            ["applicationNo"] = application.ApplicationNo,
            ["outcome"] = outcome,
            ["remarks"] = remarks,
        }, ct);

    /// <summary>Tells the manager a batch is waiting on their permission.</summary>
    public Task SendProgrammeRaisedAsync(
        Programme programme, string agencyName, string email, string name,
        CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.ProgrammeRaised, email, new()
        {
            ["name"] = name,
            ["agencyName"] = agencyName,
            ["programmeName"] = programme.ProgrammeName,
            ["programmeId"] = programme.ProgrammeId,
            ["startDate"] = programme.StartDate.ToString("dd MMM yyyy"),
            ["endDate"] = programme.EndDate.ToString("dd MMM yyyy"),
            ["venue"] = programme.Venue,
            ["state"] = programme.State?.Name ?? string.Empty,
        }, ct);

    /// <summary>Tells the manager an agency wants a batch put off, and why.</summary>
    public Task SendPostponementRequestedAsync(
        Programme programme, string agencyName, string reason, string email, string name,
        CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.PostponementRequested, email, new()
        {
            ["name"] = name,
            ["agencyName"] = agencyName,
            ["programmeName"] = programme.ProgrammeName,
            ["programmeId"] = programme.ProgrammeId,
            ["startDate"] = programme.StartDate.ToString("dd MMM yyyy"),
            ["reason"] = reason,
        }, ct);

    public Task SendProgrammeScheduleAsync(
        Programme programme, string email, string name, CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.ProgrammeSchedule, email, new()
        {
            ["name"] = name,
            ["programmeName"] = programme.ProgrammeName,
            ["programmeId"] = programme.ProgrammeId,
            ["startDate"] = programme.StartDate.ToString("dd MMM yyyy"),
            ["endDate"] = programme.EndDate.ToString("dd MMM yyyy"),
            ["mode"] = programme.Mode.ToString(),
            ["venue"] = programme.Venue,
            ["meetingLink"] = string.IsNullOrWhiteSpace(programme.MeetingLink)
                ? string.Empty
                : $"Join link: {programme.MeetingLink}",
        }, ct);

    public Task SendAgencyEmpanelledAsync(
        ImplementingAgency agency, string scope, CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.AgencyEmpanelled, agency.Email, new()
        {
            ["agencyName"] = agency.Name,
            ["agencyCode"] = agency.Code,
            ["contactPerson"] = agency.ContactPerson,
            ["empanelledOn"] = agency.EmpanelledOn.ToString("dd MMM yyyy"),
            ["validTill"] = agency.EmpanelmentValidTill?.ToString("dd MMM yyyy") ?? "Open ended",
            ["scope"] = string.IsNullOrWhiteSpace(scope) ? "Not yet assigned" : scope,
        }, ct);

    /* ------------------------------------------------------------ plumbing */

    /// <summary>
    /// Fills a template and hands it to the sender. A template that is switched
    /// off is skipped; one that is missing falls back to the shipped wording, so
    /// a deleted row can never stop the system notifying anyone.
    /// </summary>
    private async Task SendAsync(
        string key, string to, Dictionary<string, string> values, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(to)) return;

        var template = await db.EmailTemplates.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Key == key, ct);

        if (template is not null && !template.IsEnabled
            && !EmailTemplateDefaults.AlwaysOn.Contains(key))
        {
            return;
        }

        template ??= EmailTemplateDefaults.All.First(t => t.Key == key);

        await sender.SendAsync(new EmailMessage
        {
            To = to,
            TemplateKey = key,
            Subject = Fill(template.Subject, values, escape: false),
            HtmlBody = await LayoutAsync(Fill(template.HtmlBody, values, escape: true), ct),
            PlainTextBody = Fill(template.PlainTextBody, values, escape: false),
        }, ct);
    }

    /// <summary>
    /// Replaces <c>{{token}}</c> with its value. Values going into HTML are
    /// encoded, so a name containing a bracket cannot break — or inject into —
    /// the markup. Unknown tokens are left alone rather than blanked, which
    /// makes a typo in the editor visible instead of silent.
    /// </summary>
    internal static string Fill(string body, IReadOnlyDictionary<string, string> values, bool escape)
        => TokenPattern.Replace(body ?? string.Empty, match =>
        {
            var name = match.Groups[1].Value.Trim();
            if (!values.TryGetValue(name, out var value)) return match.Value;
            return escape ? System.Net.WebUtility.HtmlEncode(value) : value;
        });

    private static readonly Regex TokenPattern =
        new(@"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", RegexOptions.Compiled);

    /// <summary>
    /// The branded frame. Names and colour come from the branding settings, so
    /// email matches the portal instead of drifting from it.
    /// </summary>
    internal async Task<string> LayoutAsync(string body, CancellationToken ct)
    {
        var brand = await db.Branding.AsNoTracking().FirstOrDefaultAsync(b => b.Id == 1, ct);
        var org = System.Net.WebUtility.HtmlEncode(
            brand?.OrganisationName ?? "National Division for Industry Excellence");
        var title = System.Net.WebUtility.HtmlEncode(
            brand?.PortalTitle ?? "Capacity Building Management System");

        return $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#2a2626;
                        max-width:560px;margin:0 auto;">
              <div style="background:#9b2c3c;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0;">
                <strong>{title}</strong><br />
                <span style="font-size:12px;color:#f0d6da;">{org}</span>
              </div>
              <div style="border:1px solid #e6e0de;border-top:0;padding:20px;border-radius:0 0 8px 8px;">
                {body}
                <p style="margin-top:24px;color:#7a716f;font-size:12px;">
                  This is an automated message. Please do not reply to it.
                </p>
              </div>
            </div>
            """;
    }

    public Task SendAccountStatusChangedAsync(
        PortalUser user, string reason, string by, CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.AccountStatusChanged, user.Email, new()
        {
            ["name"] = user.FullName,
            ["userCode"] = user.UserCode,
            ["state"] = user.Status == Domain.Common.RecordStatus.Active ? "enabled" : "disabled",
            ["reason"] = reason,
            /* Named, because "an administrator" answers nothing to somebody
               asking why they were locked out. */
            ["by"] = string.IsNullOrWhiteSpace(by) ? "an administrator" : by,
            ["on"] = IndianTime.Format(DateTime.UtcNow),
        }, ct);

    public Task SendAccountUpdatedAsync(PortalUser user, CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.AccountUpdated, user.Email, new()
        {
            ["name"] = user.FullName,
            ["userCode"] = user.UserCode,
            ["on"] = IndianTime.Format(DateTime.UtcNow),
        }, ct);

    public Task SendApplicantResetCodeAsync(
        Applicant applicant, string code, int validityMinutes, CancellationToken ct = default) =>
        SendAsync(EmailTemplateDefaults.PasswordReset, applicant.Email, new()
        {
            ["name"] = applicant.FullName,
            /* The reset template speaks of a user code; for an applicant that
               is their applicant ID, which is the same thing by another name. */
            ["userCode"] = applicant.ApplicantCode,
            ["code"] = code,
            ["validityMinutes"] = validityMinutes.ToString(),
        }, ct);
}
