using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Ntms.Infrastructure.Email;

/// <summary>SMTP settings, bound from the "Email" configuration section.</summary>
public class EmailOptions
{
    public const string SectionName = "Email";

    /// <summary>Turn off in environments that must not send real mail.</summary>
    public bool Enabled { get; set; }
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromAddress { get; set; } = "no-reply@ntms.gov.in";
    public string FromName { get; set; } = "Capacity Building Management System";
    /// <summary>Where undeliverable mail and applicant replies should go.</summary>
    public string? ReplyTo { get; set; }
    /// <summary>
    /// When set, every message is redirected here instead of the real
    /// recipient. Use it on staging so tests never reach a real applicant.
    /// </summary>
    public string? RedirectAllTo { get; set; }
    public int TimeoutSeconds { get; set; } = 30;
    /// <summary>Minutes an e-mail OTP stays valid.</summary>
    public int OtpValidityMinutes { get; set; } = 10;
}

public class EmailMessage
{
    public required string To { get; init; }
    /// <summary>Which template produced this, for the delivery log.</summary>
    public string? TemplateKey { get; init; }
    public required string Subject { get; init; }
    public required string HtmlBody { get; init; }
    public string? PlainTextBody { get; init; }
    public IReadOnlyList<string> Cc { get; init; } = [];
}

public interface IEmailSender
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}

/// <summary>
/// Plain SMTP sender. Failures are logged and swallowed: a notification that
/// cannot be delivered must never roll back the transaction that triggered it.
/// </summary>
public class SmtpEmailSender(
    IEmailSettingsProvider settings,
    Persistence.NtmsDbContext db,
    Microsoft.Extensions.Hosting.IHostEnvironment environment,
    ILogger<SmtpEmailSender> logger) : IEmailSender
{
    /// <summary>
    /// Templates whose subject or body carries a credential.
    ///
    /// A one-time code and a first password are the whole of what the
    /// message is for, so neither the subject nor the body can be written
    /// anywhere a credential should not go.
    /// </summary>
    private static readonly HashSet<string> Secretive = new(StringComparer.OrdinalIgnoreCase)
    {
        EmailTemplateDefaults.Otp,
        EmailTemplateDefaults.PasswordReset,
        EmailTemplateDefaults.ApplicantCredentials,
        EmailTemplateDefaults.PortalCredentials,
        EmailTemplateDefaults.AdminCredentials,
        EmailTemplateDefaults.MinistryCredentials,
        EmailTemplateDefaults.OpsManagerCredentials,
        EmailTemplateDefaults.AgencyCredentials,
        EmailTemplateDefaults.CoordinatorCredentials,
    };

    private static bool CarriesASecret(EmailMessage message) =>
        message.TemplateKey is { } key && Secretive.Contains(key);
    /// <summary>
    /// Records the attempt. Written on its own so a logging failure can never
    /// take down the send it was describing.
    /// </summary>
    private async Task RecordAsync(
        EmailMessage message, string recipient, string status, string? error,
        string? host, CancellationToken ct)
    {
        try
        {
            db.EmailLog.Add(new Domain.Entities.EmailLogEntry
            {
                TemplateKey = message.TemplateKey ?? string.Empty,
                Recipient = recipient,
                /* The OTP template puts the code in the subject line, so
                   the subject of a credential-bearing message is not kept
                   either. The template key says what was sent. */
                Subject = CarriesASecret(message)
                    ? "(withheld: this message carries a credential)"
                    : message.Subject.Length > 300 ? message.Subject[..300] : message.Subject,
                Status = status,
                Error = error is { Length: > 2000 } ? error[..2000] : error,
                Host = host,
            });
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not write the email log entry");
        }
    }

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        /* Read per send, so a change saved in the portal takes effect at once
           rather than at the next restart. */
        var _options = await settings.GetAsync(ct);

        var recipient = string.IsNullOrWhiteSpace(_options.RedirectAllTo)
            ? message.To
            : _options.RedirectAllTo;

        if (!_options.Enabled || string.IsNullOrWhiteSpace(_options.Host))
        {
            /* The whole message used to go to the log here, so that an OTP
               was readable without wiring up a mailbox. That is a fair
               trade on a developer's machine and a credential leak
               anywhere else — and sending is off by default, so anywhere
               else is where it mostly ran. The body is written only in
               Development now, and never for a message whose point is the
               secret inside it. */
            if (string.Equals(environment.EnvironmentName, "Development", StringComparison.OrdinalIgnoreCase) && !CarriesASecret(message))
            {
                logger.LogInformation(
                    "Email suppressed (sending disabled). To: {To}; Subject: {Subject}\n{Body}",
                    recipient, message.Subject, message.PlainTextBody ?? message.HtmlBody);
            }
            else if (string.Equals(environment.EnvironmentName, "Development", StringComparison.OrdinalIgnoreCase))
            {
                logger.LogInformation(
                    "Email suppressed (sending disabled). To: {To}; Template: {Template}. "
                    + "Body withheld: it carries a credential.",
                    recipient, message.TemplateKey);
            }
            else
            {
                logger.LogWarning(
                    "Email suppressed: sending is not configured. To: {To}; Template: {Template}. "
                    + "Nothing was delivered.",
                    recipient, message.TemplateKey);
            }

            /* Recorded, not just logged. A silently suppressed message is the
               hardest kind to diagnose: nothing arrives and nothing says why. */
            await RecordAsync(message, recipient, "Suppressed",
                _options.Enabled
                    ? "No SMTP host is configured."
                    : "Sending is switched off in Administration → Email.",
                _options.Host, ct);
            return;
        }

        try
        {
            using var client = new SmtpClient(_options.Host, _options.Port)
            {
                EnableSsl = _options.UseSsl,
                Timeout = _options.TimeoutSeconds * 1000,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Credentials = string.IsNullOrWhiteSpace(_options.UserName)
                    ? CredentialCache.DefaultNetworkCredentials
                    : new NetworkCredential(_options.UserName, _options.Password),
            };

            using var mail = new MailMessage
            {
                From = new MailAddress(_options.FromAddress, _options.FromName),
                Subject = message.Subject,
                Body = message.HtmlBody,
                IsBodyHtml = true,
            };
            mail.To.Add(recipient);
            foreach (var cc in message.Cc) mail.CC.Add(cc);
            if (!string.IsNullOrWhiteSpace(_options.ReplyTo))
                mail.ReplyToList.Add(_options.ReplyTo);

            await client.SendMailAsync(mail, ct);
            logger.LogInformation("Email sent to {To}: {Subject}", recipient, message.Subject);
            await RecordAsync(message, recipient, "Sent", null, _options.Host, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to send email to {To}: {Subject}",
                recipient, message.Subject);
            await RecordAsync(message, recipient, "Failed", ex.Message, _options.Host, ct);
        }
    }
}
