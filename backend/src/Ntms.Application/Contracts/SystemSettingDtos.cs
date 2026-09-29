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

    /* -------------------------------------------------------- uploads */

    public int MaxUploadMb { get; set; } = 64;

    /* ----------------------------------------------- PAN verification */

    public bool PanVerificationEnabled { get; set; }
    public string? PanProvider { get; set; }
    public string? PanEndpoint { get; set; }

    /// <summary>True when a key is stored; the value is never sent.</summary>
    public bool HasPanApiKey { get; set; }

    public string PanApiKeyHeader { get; set; } = "X-API-KEY";
    public string PanValidPath { get; set; } = "valid";
    public string PanNamePath { get; set; } = "name";
    public int PanTimeoutSeconds { get; set; } = 10;
    public bool PanRefuseWhenUnavailable { get; set; }

    /// <summary>False until the PAN service has everything it needs.</summary>
    public bool PanConfigured { get; set; }

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

    public int MaxUploadMb { get; set; } = 64;

    public bool PanVerificationEnabled { get; set; }
    public string? PanProvider { get; set; }
    public string? PanEndpoint { get; set; }

    /// <summary>Left null to keep the stored key; empty string clears it.</summary>
    public string? PanApiKey { get; set; }

    public string? PanApiKeyHeader { get; set; }
    public string? PanValidPath { get; set; }
    public string? PanNamePath { get; set; }
    public int PanTimeoutSeconds { get; set; } = 10;
    public bool PanRefuseWhenUnavailable { get; set; }
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
