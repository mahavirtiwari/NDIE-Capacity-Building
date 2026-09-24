using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Super Admin's view of outgoing mail: who it is sent as, how it is sent, and
/// the wording of each message.
/// </summary>
public class EmailAdminService(
    NtmsDbContext db,
    IEmailSender sender,
    IEmailSettingsProvider provider,
    INotificationService notifications,
    IOptions<EmailOptions> configured)
{
    /* -------------------------------------------------------- settings */

    private async Task<EmailSetting> LoadAsync(CancellationToken ct)
    {
        var existing = await db.EmailSettings.FirstOrDefaultAsync(e => e.Id == 1, ct);
        if (existing is not null) return existing;

        var seeded = new EmailSetting { Id = 1 };
        db.EmailSettings.Add(seeded);
        await db.SaveChangesAsync(ct);
        return seeded;
    }

    public async Task<EmailSettingsDto> GetSettingsAsync(CancellationToken ct)
    {
        var row = await LoadAsync(ct);
        var effective = await provider.GetAsync(ct);

        return new EmailSettingsDto
        {
            Enabled = row.Enabled,
            Host = row.Host,
            Port = row.Port,
            UseSsl = row.UseSsl,
            UserName = row.UserName,
            HasPassword = !string.IsNullOrWhiteSpace(row.Password)
                          || !string.IsNullOrWhiteSpace(configured.Value.Password),
            FromAddress = row.FromAddress,
            FromName = row.FromName,
            ReplyTo = row.ReplyTo,
            RedirectAllTo = row.RedirectAllTo,
            TimeoutSeconds = row.TimeoutSeconds,
            OtpValidityMinutes = row.OtpValidityMinutes,
            /* Tells the screen that mail is working off appsettings, not off
               anything saved here. */
            UsingConfigFallback = string.IsNullOrWhiteSpace(row.Host)
                                  && !string.IsNullOrWhiteSpace(effective.Host),
            UpdatedOn = row.ModifiedOn ?? row.CreatedOn,
        };
    }

    public async Task<EmailSettingsDto> UpdateSettingsAsync(
        EmailSettingsUpdateDto dto, CancellationToken ct)
    {
        Guard.Check()
            .Email(dto.FromAddress, required: false, label: "From address")
            .Email(dto.ReplyTo, required: false, label: "Reply-to address")
            .Email(dto.RedirectAllTo, required: false, label: "Redirect all mail to")
            .When(dto.Port is < 1 or > 65535, "Port must be between 1 and 65535.")
            .When(dto.TimeoutSeconds is < 5 or > 300, "Timeout must be between 5 and 300 seconds.")
            .When(dto.OtpValidityMinutes is < 1 or > 60,
                "OTP validity must be between 1 and 60 minutes.")
            .ThrowIfInvalid();

        /* Switching sending on without anywhere to send is the single most
           likely misconfiguration, so it is refused rather than silently
           falling back to logging. */
        var host = string.IsNullOrWhiteSpace(dto.Host)
            ? configured.Value.Host
            : dto.Host.Trim();
        if (dto.Enabled && string.IsNullOrWhiteSpace(host))
            throw new AppException("Set an SMTP host before switching sending on.");

        var row = await LoadAsync(ct);
        row.Enabled = dto.Enabled;
        row.Host = dto.Host?.Trim();
        row.Port = dto.Port;
        row.UseSsl = dto.UseSsl;
        row.UserName = dto.UserName?.Trim();
        row.FromAddress = dto.FromAddress?.Trim();
        row.FromName = dto.FromName?.Trim();
        row.ReplyTo = dto.ReplyTo?.Trim();
        row.RedirectAllTo = dto.RedirectAllTo?.Trim();
        row.TimeoutSeconds = dto.TimeoutSeconds;
        row.OtpValidityMinutes = dto.OtpValidityMinutes;

        /* Null means "leave it alone" so the screen never has to round-trip a
           secret it was not shown; an empty string is an explicit clear. */
        if (dto.Password is not null) row.Password = dto.Password.Trim();

        await db.SaveChangesAsync(ct);
        return await GetSettingsAsync(ct);
    }

    /// <summary>Sends a real message so the settings can be proven end to end.</summary>
    public async Task SendTestAsync(string to, CancellationToken ct)
    {
        Guard.Check().Email(to, required: true, label: "Test recipient").ThrowIfInvalid();

        var effective = await provider.GetAsync(ct);
        if (!effective.Enabled || string.IsNullOrWhiteSpace(effective.Host))
        {
            throw new AppException(
                "Sending is switched off, so no message was sent. Turn it on and set a host first.");
        }

        var body = $"""
            <p>This is a test message from the portal.</p>
            <p>If you are reading it, the SMTP settings are working. Sent at
               {DateTime.UtcNow:dd MMM yyyy HH:mm} UTC via {effective.Host}:{effective.Port}.</p>
            """;

        await sender.SendAsync(new EmailMessage
        {
            To = to.Trim(),
            TemplateKey = "test",
            Subject = "Test message from the portal",
            HtmlBody = await ((NotificationService)notifications).LayoutAsync(body, ct),
            PlainTextBody = "This is a test message from the portal. The SMTP settings are working.",
        }, ct);
    }

    /// <summary>The most recent delivery attempts, newest first.</summary>
    public async Task<List<EmailLogDto>> RecentLogAsync(int take, CancellationToken ct)
    {
        var rows = await db.EmailLog.AsNoTracking()
            .OrderByDescending(e => e.SentOn)
            .Take(Math.Clamp(take, 1, 200))
            .ToListAsync(ct);

        return [.. rows.Select(e => new EmailLogDto
        {
            Id = e.Id,
            SentOn = e.SentOn,
            TemplateKey = e.TemplateKey,
            Recipient = e.Recipient,
            Subject = e.Subject,
            Status = e.Status,
            Error = e.Error,
            Host = e.Host,
        })];
    }

    /* -------------------------------------------------------- templates */

    public async Task<List<EmailTemplateDto>> ListTemplatesAsync(CancellationToken ct)
    {
        var rows = await db.EmailTemplates.AsNoTracking().ToListAsync(ct);

        /* Ordered the way the shipped catalogue lists them, so the screen reads
           in the order a message is actually met, not alphabetically. */
        var order = EmailTemplateDefaults.All.Select((t, i) => (t.Key, i))
            .ToDictionary(x => x.Key, x => x.i);

        return [.. rows
            .OrderBy(r => order.TryGetValue(r.Key, out var i) ? i : int.MaxValue)
            .Select(ToDto)];
    }

    public async Task<EmailTemplateDto> GetTemplateAsync(string key, CancellationToken ct)
    {
        var row = await db.EmailTemplates.AsNoTracking().FirstOrDefaultAsync(t => t.Key == key, ct)
                  ?? throw AppException.NotFound("Email template");
        return ToDto(row);
    }

    public async Task<EmailTemplateDto> UpdateTemplateAsync(
        string key, EmailTemplateUpdateDto dto, CancellationToken ct)
    {
        var row = await db.EmailTemplates.FirstOrDefaultAsync(t => t.Key == key, ct)
                  ?? throw AppException.NotFound("Email template");

        Guard.Check()
            .Required(dto.Subject, "Subject")
            .Required(dto.HtmlBody, "Message body")
            .ThrowIfInvalid();

        row.Subject = dto.Subject.Trim();
        row.HtmlBody = dto.HtmlBody.Trim();
        row.PlainTextBody = (dto.PlainTextBody ?? string.Empty).Trim();
        /* A credential or code message stays on whatever the request says. */
        row.IsEnabled = EmailTemplateDefaults.AlwaysOn.Contains(key) || dto.IsEnabled;

        await db.SaveChangesAsync(ct);
        return ToDto(row);
    }

    /// <summary>Restores one template to the wording the system shipped with.</summary>
    public async Task<EmailTemplateDto> ResetTemplateAsync(string key, CancellationToken ct)
    {
        var row = await db.EmailTemplates.FirstOrDefaultAsync(t => t.Key == key, ct)
                  ?? throw AppException.NotFound("Email template");
        var shipped = EmailTemplateDefaults.All.FirstOrDefault(t => t.Key == key)
                      ?? throw AppException.NotFound("Email template");

        row.Subject = shipped.Subject;
        row.HtmlBody = shipped.HtmlBody;
        row.PlainTextBody = shipped.PlainTextBody;
        row.Placeholders = shipped.Placeholders;
        row.IsEnabled = true;

        await db.SaveChangesAsync(ct);
        return ToDto(row);
    }

    /// <summary>
    /// Renders a template with stand-in values, so the wording can be checked
    /// without sending anything.
    /// </summary>
    public async Task<EmailPreviewDto> PreviewAsync(
        string key, EmailTemplateUpdateDto? draft, CancellationToken ct)
    {
        var row = await db.EmailTemplates.AsNoTracking().FirstOrDefaultAsync(t => t.Key == key, ct)
                  ?? throw AppException.NotFound("Email template");

        var subject = draft?.Subject ?? row.Subject;
        var html = draft?.HtmlBody ?? row.HtmlBody;
        var text = draft?.PlainTextBody ?? row.PlainTextBody;

        var samples = SampleValues(row.Placeholders);
        var rendered = NotificationService.Fill(html, samples, escape: true);

        return new EmailPreviewDto
        {
            Subject = NotificationService.Fill(subject, samples, escape: false),
            Html = await ((NotificationService)notifications).LayoutAsync(rendered, ct),
            PlainText = NotificationService.Fill(text, samples, escape: false),
        };
    }

    private static Dictionary<string, string> SampleValues(string placeholders)
    {
        var known = new Dictionary<string, string>
        {
            ["name"] = "A. Sharma",
            ["email"] = "a.sharma@example.com",
            ["code"] = "482913",
            ["validityMinutes"] = "10",
            ["applicantCode"] = "APP240001",
            ["userCode"] = "OM0007",
            ["password"] = "Xy7#kq2P",
            ["temporaryPassword"] = "Xy7#kq2P",
            ["applicationNo"] = "APL/2026/1001",
            ["programme"] = "Master Trainer - Bronze",
            ["outcome"] = "Approved",
            ["remarks"] = "Documents verified.",
            ["programmeName"] = "Master Trainer - Bronze",
            ["programmeId"] = "PRG/2026/0042",
            ["startDate"] = "12 Oct 2026",
            ["endDate"] = "16 Oct 2026",
            ["mode"] = "Physical",
            ["venue"] = "NDIE Centre, New Delhi",
            ["meetingLink"] = "Join link: https://example.gov.in/meet/0042",
        };

        var wanted = (placeholders ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        foreach (var token in wanted)
        {
            known.TryAdd(token, $"[{token}]");
        }

        return known;
    }

    private static EmailTemplateDto ToDto(EmailTemplate row) => new()
    {
        Id = row.Id,
        Key = row.Key,
        Name = row.Name,
        Description = row.Description,
        Subject = row.Subject,
        HtmlBody = row.HtmlBody,
        PlainTextBody = row.PlainTextBody,
        Placeholders = [.. (row.Placeholders ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)],
        IsEnabled = row.IsEnabled,
        CanDisable = !EmailTemplateDefaults.AlwaysOn.Contains(row.Key),
        UpdatedOn = row.ModifiedOn ?? row.CreatedOn,
    };
}
