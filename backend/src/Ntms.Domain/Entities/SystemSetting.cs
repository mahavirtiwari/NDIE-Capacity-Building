using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// The settings that govern the deployment rather than the scheme: whether the
/// site is open, and how it is to take money.
///
/// One row, id 1, like the branding and e-mail settings beside it. A settings
/// table with many rows invites two of them to disagree.
/// </summary>
public class SystemSetting : AuditableEntity
{
    /* ------------------------------------------------------ maintenance */

    /// <summary>
    /// Closes the site to everybody but a Super Admin.
    ///
    /// Deliberately not a flag in appsettings: shutting the door has to be
    /// possible from the portal at the moment it is needed, and a file change
    /// means a deployment and an app-pool recycle.
    /// </summary>
    public bool MaintenanceMode { get; set; }

    /// <summary>Shown to everyone turned away. Falls back to a plain sentence.</summary>
    public string? MaintenanceMessage { get; set; }

    /// <summary>
    /// When the work is expected to finish, if that is known. Displayed, never
    /// acted on: nothing switches itself back on, because an overrun that lets
    /// the public back in mid-migration is worse than a long outage.
    /// </summary>
    public DateTime? MaintenanceUntil { get; set; }

    /* -------------------------------------------------- payment gateway */

    /// <summary>Which gateway the fee payment goes through, e.g. CCAvenue.</summary>
    public string? PaymentGateway { get; set; }

    /// <summary>False until the gateway is live; nothing is charged while off.</summary>
    public bool PaymentEnabled { get; set; }

    /// <summary>
    /// True for the gateway's test environment. Kept apart from
    /// <see cref="PaymentEnabled"/> so a live deployment can be wired up and
    /// exercised against test credentials before any real money moves.
    /// </summary>
    public bool PaymentTestMode { get; set; } = true;

    public string? MerchantId { get; set; }
    public string? AccessCode { get; set; }

    /// <summary>
    /// The gateway's signing secret. Write only, like the SMTP password: the
    /// API accepts it and never sends it back, so the portal cannot disclose
    /// it and a screenshot of the settings screen cannot leak it.
    /// </summary>
    public string? WorkingKey { get; set; }

    /// <summary>Where the gateway returns the payer to. Blank uses the site's own URL.</summary>
    public string? ReturnUrl { get; set; }
    public string? CancelUrl { get; set; }

    /* -------------------------------------------------------- uploads */

    /// <summary>
    /// The largest file anybody may publish, in megabytes.
    ///
    /// Here rather than in a config file because the answer changes with the
    /// disk the deployment sits on and with what a department is trying to
    /// put up, and neither is worth a release.
    /// </summary>
    public int MaxUploadMb { get; set; } = 64;

    /* ----------------------------------------------- PAN verification */

    /// <summary>
    /// Off until a provider is contracted. Turning it on before one is
    /// reachable would fail every registration, so it is a decision somebody
    /// makes deliberately rather than a default.
    /// </summary>
    public bool PanVerificationEnabled { get; set; }

    /// <summary>Who the service belongs to, for the screen to name.</summary>
    public string? PanProvider { get; set; }

    /// <summary>The endpoint a PAN is posted to.</summary>
    public string? PanEndpoint { get; set; }

    /// <summary>
    /// The provider's key. Write only, like the SMTP password and the
    /// gateway's working key: the API accepts it and never sends it back.
    /// </summary>
    public string? PanApiKey { get; set; }

    public string PanApiKeyHeader { get; set; } = "X-API-KEY";

    /// <summary>
    /// Where the answer sits in the provider's JSON, as dotted paths, so a
    /// change of provider is a settings change rather than a deployment.
    /// </summary>
    public string PanValidPath { get; set; } = "valid";
    public string PanNamePath { get; set; } = "name";

    public int PanTimeoutSeconds { get; set; } = 10;

    /// <summary>
    /// What to do when the provider cannot be reached. False lets the
    /// registration through and leaves the PAN unverified, so an outage at a
    /// third party does not close the scheme to new applicants. True refuses,
    /// for when a verified PAN is a hard requirement.
    /// </summary>
    public bool PanRefuseWhenUnavailable { get; set; }
}
