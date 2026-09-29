namespace Ntms.Application.Contracts;

/// <summary>
/// How the deployment itself is set. The gateway's working key is deliberately
/// absent — it can be written but never read back.
/// </summary>
public class SystemSettingsDto
{
    public bool MaintenanceMode { get; set; }
    public string? MaintenanceMessage { get; set; }
    public DateTime? MaintenanceUntil { get; set; }

    public bool PaymentEnabled { get; set; }
    public string? PaymentGateway { get; set; }
    public bool PaymentTestMode { get; set; } = true;
    public string? MerchantId { get; set; }
    public string? AccessCode { get; set; }

    /// <summary>True when a working key is stored; the value is never sent.</summary>
    public bool HasWorkingKey { get; set; }

    public string? ReturnUrl { get; set; }
    public string? CancelUrl { get; set; }

    /// <summary>
    /// False until the gateway has everything it needs. The screen shows what
    /// is missing rather than letting payments be switched on into a gap.
    /// </summary>
    public bool PaymentConfigured { get; set; }

    public DateTime UpdatedOn { get; set; }
}

public class SystemSettingsUpdateDto
{
    public bool MaintenanceMode { get; set; }
    public string? MaintenanceMessage { get; set; }
    public DateTime? MaintenanceUntil { get; set; }

    public bool PaymentEnabled { get; set; }
    public string? PaymentGateway { get; set; }
    public bool PaymentTestMode { get; set; } = true;
    public string? MerchantId { get; set; }
    public string? AccessCode { get; set; }

    /// <summary>Left null to keep the stored key; empty string clears it.</summary>
    public string? WorkingKey { get; set; }

    public string? ReturnUrl { get; set; }
    public string? CancelUrl { get; set; }
}

/// <summary>
/// What an unauthenticated caller is told while the site is closed. Served
/// without a token, because the sign-in screen has to be able to say why it
/// will not let anybody in.
/// </summary>
public class MaintenanceStatusDto
{
    public bool MaintenanceMode { get; set; }
    public string? Message { get; set; }
    public DateTime? Until { get; set; }
}
