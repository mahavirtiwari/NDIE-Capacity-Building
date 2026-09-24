namespace Ntms.Application.Contracts;

/// <summary>
/// Sender and SMTP settings. The password is deliberately absent — it can be
/// written but never read back, so the portal cannot disclose it.
/// </summary>
public class EmailSettingsDto
{
    public bool Enabled { get; set; }
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string? UserName { get; set; }
    /// <summary>True when a password is stored; the value itself is never sent.</summary>
    public bool HasPassword { get; set; }
    public string? FromAddress { get; set; }
    public string? FromName { get; set; }
    public string? ReplyTo { get; set; }
    public string? RedirectAllTo { get; set; }
    public int TimeoutSeconds { get; set; } = 30;
    public int OtpValidityMinutes { get; set; } = 10;
    /// <summary>True when configuration, not the portal, is supplying the host.</summary>
    public bool UsingConfigFallback { get; set; }
    public DateTime UpdatedOn { get; set; }
}

public class EmailSettingsUpdateDto
{
    public bool Enabled { get; set; }
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string? UserName { get; set; }
    /// <summary>Left null to keep the stored password; empty string clears it.</summary>
    public string? Password { get; set; }
    public string? FromAddress { get; set; }
    public string? FromName { get; set; }
    public string? ReplyTo { get; set; }
    public string? RedirectAllTo { get; set; }
    public int TimeoutSeconds { get; set; } = 30;
    public int OtpValidityMinutes { get; set; } = 10;
}

public class SendTestEmailDto
{
    public string To { get; set; } = string.Empty;
}

public class EmailTemplateDto
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public string PlainTextBody { get; set; } = string.Empty;
    /// <summary>Token names this template understands, for the editor.</summary>
    public List<string> Placeholders { get; set; } = [];
    public bool IsEnabled { get; set; }
    /// <summary>Credential and code messages cannot be switched off.</summary>
    public bool CanDisable { get; set; }
    public DateTime UpdatedOn { get; set; }
}

public class EmailTemplateUpdateDto
{
    public string Subject { get; set; } = string.Empty;
    public string HtmlBody { get; set; } = string.Empty;
    public string PlainTextBody { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;
}

/// <summary>The rendered message, so the editor can show it before saving.</summary>
public class EmailPreviewDto
{
    public string Subject { get; set; } = string.Empty;
    public string Html { get; set; } = string.Empty;
    public string PlainText { get; set; } = string.Empty;
}

/// <summary>One delivery attempt, as shown on the Email screen.</summary>
public class EmailLogDto
{
    public int Id { get; set; }
    public DateTime SentOn { get; set; }
    public string TemplateKey { get; set; } = string.Empty;
    public string Recipient { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    /// <summary>Sent, Failed or Suppressed.</summary>
    public string Status { get; set; } = string.Empty;
    /// <summary>What the mail server said when it refused.</summary>
    public string? Error { get; set; }
    public string? Host { get; set; }
}
