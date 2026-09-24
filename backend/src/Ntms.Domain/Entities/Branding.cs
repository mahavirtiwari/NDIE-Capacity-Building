using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// Portal identity — the organisation's name and logo — maintained by Super
/// Admin rather than baked into the build. A single row, id 1.
/// </summary>
public class BrandingSetting : AuditableEntity
{
    /// <summary>Full name shown under the logo, e.g. the division's name.</summary>
    public string OrganisationName { get; set; } = string.Empty;

    /// <summary>Short mark used where space is tight, e.g. "NDIE".</summary>
    public string ShortName { get; set; } = string.Empty;

    /// <summary>Title in the top bar and the browser tab.</summary>
    public string PortalTitle { get; set; } = string.Empty;

    /// <summary>Line in the sign-in panel, left blank to hide it.</summary>
    public string? Tagline { get; set; }

    public string? SupportEmail { get; set; }

    /* The logo is small, so it lives in the row rather than on a share that
       every web head would have to mount. */
    public byte[]? LogoData { get; set; }
    public string? LogoFileName { get; set; }
    public string? LogoContentType { get; set; }

    /// <summary>Bumped on every logo change so clients re-fetch it.</summary>
    public int LogoVersion { get; set; }

    public bool HasLogo => LogoData is { Length: > 0 };

    /* A second mark for the accrediting or partner body — QCI alongside NDIE,
       for instance — shown at the opposite end of the sign-in header. */
    public string? PartnerName { get; set; }
    public byte[]? PartnerLogoData { get; set; }
    public string? PartnerLogoFileName { get; set; }
    public string? PartnerLogoContentType { get; set; }
    public int PartnerLogoVersion { get; set; }

    public bool HasPartnerLogo => PartnerLogoData is { Length: > 0 };
}
