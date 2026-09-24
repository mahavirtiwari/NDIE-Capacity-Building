namespace Ntms.Application.Contracts;

/// <summary>Portal identity, maintained by Super Admin.</summary>
public class BrandingDto
{
    public string OrganisationName { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public string PortalTitle { get; set; } = string.Empty;
    public string? Tagline { get; set; }
    public string? SupportEmail { get; set; }
    public bool HasLogo { get; set; }
    public string? LogoFileName { get; set; }
    /// <summary>Relative to the API base, with a cache-busting version.</summary>
    public string? LogoUrl { get; set; }
    public int LogoVersion { get; set; }

    /// <summary>The accrediting or partner body shown beside the main mark.</summary>
    public string? PartnerName { get; set; }
    public bool HasPartnerLogo { get; set; }
    public string? PartnerLogoFileName { get; set; }
    public string? PartnerLogoUrl { get; set; }
    public int PartnerLogoVersion { get; set; }

    public DateTime UpdatedOn { get; set; }
}

public class BrandingUpdateDto
{
    public string OrganisationName { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public string PortalTitle { get; set; } = string.Empty;
    public string? Tagline { get; set; }
    public string? SupportEmail { get; set; }
    public string? PartnerName { get; set; }
}
