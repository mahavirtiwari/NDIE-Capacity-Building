using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// The sender account and SMTP connection, maintained by Super Admin rather
/// than by editing appsettings and restarting. A single row, id 1.
///
/// When <see cref="Host"/> is blank the values from configuration are used
/// instead, so an untouched deployment behaves exactly as before.
/// </summary>
public class EmailSetting : AuditableEntity
{
    /// <summary>Off means every message is logged instead of sent.</summary>
    public bool Enabled { get; set; }

    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    /// <summary>STARTTLS on 587, implicit TLS on 465.</summary>
    public bool UseSsl { get; set; } = true;

    public string? UserName { get; set; }

    /// <summary>
    /// Write-only as far as the API is concerned: it is accepted on a save and
    /// never returned, so it cannot be read back out of the portal.
    /// </summary>
    public string? Password { get; set; }

    public string? FromAddress { get; set; }
    public string? FromName { get; set; }
    public string? ReplyTo { get; set; }

    /// <summary>Set during testing to divert every message to one mailbox.</summary>
    public string? RedirectAllTo { get; set; }

    public int TimeoutSeconds { get; set; } = 30;
    public int OtpValidityMinutes { get; set; } = 10;
}

/// <summary>
/// One transactional message, editable by Super Admin. The body is stored with
/// <c>{{placeholder}}</c> tokens that the notification service fills in; which
/// tokens a template supports is recorded on <see cref="Placeholders"/> so the
/// editor can list them.
/// </summary>
public class EmailTemplate : AuditableEntity
{
    /// <summary>Stable identifier the code sends against, e.g. "portal-credentials".</summary>
    public string Key { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public string PlainTextBody { get; set; } = string.Empty;

    /// <summary>Comma separated token names, for the editor's reference list.</summary>
    public string Placeholders { get; set; } = string.Empty;

    /// <summary>
    /// Off suppresses this one message without affecting the rest. Credentials
    /// and verification codes stay on regardless — see EmailTemplateDefaults.
    /// </summary>
    public bool IsEnabled { get; set; } = true;
}

/// <summary>
/// One delivery attempt. Written for every message the system tries to send,
/// successful or not, so "I never got the email" can be answered from the
/// portal instead of from a server log.
/// </summary>
public class EmailLogEntry
{
    public int Id { get; set; }

    public DateTime SentOn { get; set; } = DateTime.UtcNow;

    /// <summary>Template key, or "test" for a manual check.</summary>
    public string TemplateKey { get; set; } = string.Empty;
    public string Recipient { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;

    /// <summary>Sent, Failed, or Suppressed when sending is switched off.</summary>
    public string Status { get; set; } = "Sent";

    /// <summary>The SMTP server's own words when it refused. Null on success.</summary>
    public string? Error { get; set; }

    /// <summary>Which server it went through, for when settings have changed.</summary>
    public string? Host { get; set; }
}
