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
}
