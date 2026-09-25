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

    /// <summary>Where the mark goes when clicked. Null means it is not a link.</summary>
    public string? LogoLinkUrl { get; set; }

    /// <summary>The accrediting or partner body shown beside the main mark.</summary>
    public string? PartnerName { get; set; }
    public bool HasPartnerLogo { get; set; }
    public string? PartnerLogoFileName { get; set; }
    public string? PartnerLogoUrl { get; set; }
    public int PartnerLogoVersion { get; set; }
    public string? PartnerLogoLinkUrl { get; set; }

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

    /// <summary>Optional. Where each mark takes the reader when clicked.</summary>
    public string? LogoLinkUrl { get; set; }
    public string? PartnerLogoLinkUrl { get; set; }
}

/* --------------------------------------------------------------- site text */

/// <summary>One editable string: what it says now, and what it shipped as.</summary>
public class SiteTextDto
{
    public string Key { get; set; } = string.Empty;
    /// <summary>Which screen it belongs to, for grouping in the editor.</summary>
    public string Group { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? Hint { get; set; }
    public bool Multiline { get; set; }

    /// <summary>The wording the product ships with.</summary>
    public string Default { get; set; } = string.Empty;
    /// <summary>What is actually rendered — the override, or the default.</summary>
    public string Value { get; set; } = string.Empty;
    public bool IsOverridden { get; set; }
}

public class SiteTextUpdateDto
{
    /// <summary>Blank, or the shipped wording, restores the original.</summary>
    public string? Value { get; set; }
}
