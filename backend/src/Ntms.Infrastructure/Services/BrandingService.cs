using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

public class BrandingService(NtmsDbContext db)
{
    /// <summary>A logo has to fit comfortably in a header, so keep it small.</summary>
    private const int MaxLogoBytes = 512 * 1024;

    private static readonly string[] AllowedTypes =
        ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

    /// <summary>Shipped values, used until Super Admin saves their own.</summary>
    private static BrandingSetting Defaults() => new()
    {
        Id = 1,
        OrganisationName = "National Division for Industry Excellence",
        ShortName = "NDIE",
        PortalTitle = "Capacity Building Management System",
        Tagline = "One platform for the entire training and certification lifecycle.",
        SupportEmail = "support@ntms.gov.in",
        LogoVersion = 0,
    };

    private async Task<BrandingSetting> LoadAsync(CancellationToken ct)
    {
        var existing = await db.Branding.FirstOrDefaultAsync(b => b.Id == 1, ct);
        if (existing is not null) return existing;

        var seeded = Defaults();
        db.Branding.Add(seeded);
        await db.SaveChangesAsync(ct);
        return seeded;
    }

    public async Task<BrandingDto> GetAsync(CancellationToken ct)
    {
        var entity = await LoadAsync(ct);
        return ToDto(entity);
    }

    public async Task<BrandingDto> UpdateAsync(BrandingUpdateDto dto, CancellationToken ct)
    {
        Guard.Check()
            .Required(dto.OrganisationName, "Organisation name")
            .Required(dto.ShortName, "Short name")
            .Required(dto.PortalTitle, "Portal title")
            .Email(dto.SupportEmail, required: false, label: "Support email")
            .ThrowIfInvalid();

        var entity = await LoadAsync(ct);
        entity.OrganisationName = dto.OrganisationName.Trim();
        entity.ShortName = dto.ShortName.Trim();
        entity.PortalTitle = dto.PortalTitle.Trim();
        entity.Tagline = dto.Tagline?.Trim();
        entity.SupportEmail = dto.SupportEmail?.Trim();
        entity.PartnerName = string.IsNullOrWhiteSpace(dto.PartnerName) ? null : dto.PartnerName.Trim();
        entity.LogoLinkUrl = CleanLink(dto.LogoLinkUrl, "Logo link");
        entity.PartnerLogoLinkUrl = CleanLink(dto.PartnerLogoLinkUrl, "Partner logo link");

        await db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    /// <summary>
    /// Accepts a link, or refuses it plainly.
    ///
    /// http and https only. A javascript: or data: URL here would be stored by
    /// one administrator and then clicked by everybody who uses the portal,
    /// which is the whole of a stored cross-site scripting hole - the browser
    /// would run it in the reader's session. A relative path is allowed so the
    /// mark can point at a page of this portal.
    /// </summary>
    private static string? CleanLink(string? value, string label)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;

        var trimmed = value.Trim();

        if (trimmed.StartsWith('/')) return trimmed;

        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new AppException(
                $"{label} must be a full http or https address, or a path beginning with /.");
        }

        return uri.ToString();
    }

    /// <summary>Which mark is being written: the organisation's, or the partner's.</summary>
    public enum LogoSlot
    {
        Primary,
        Partner,
    }

    public async Task<BrandingDto> SetLogoAsync(
        Stream content, string fileName, string? contentType, long length,
        LogoSlot slot, CancellationToken ct)
    {
        if (length <= 0) throw new AppException("The file is empty.");
        if (length > MaxLogoBytes)
            throw new AppException($"The logo must be {MaxLogoBytes / 1024} KB or smaller.");

        var type = (contentType ?? string.Empty).ToLowerInvariant();
        if (!AllowedTypes.Contains(type))
            throw new AppException("Upload a PNG, JPEG, SVG or WebP image.");

        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);

        var entity = await LoadAsync(ct);
        var name = Path.GetFileName(fileName);

        if (slot == LogoSlot.Primary)
        {
            entity.LogoData = buffer.ToArray();
            entity.LogoFileName = name;
            entity.LogoContentType = type;
            /* Clients cache the logo by URL, so the version is what busts it. */
            entity.LogoVersion++;
        }
        else
        {
            entity.PartnerLogoData = buffer.ToArray();
            entity.PartnerLogoFileName = name;
            entity.PartnerLogoContentType = type;
            entity.PartnerLogoVersion++;
        }

        await db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task<BrandingDto> RemoveLogoAsync(LogoSlot slot, CancellationToken ct)
    {
        var entity = await LoadAsync(ct);

        if (slot == LogoSlot.Primary)
        {
            entity.LogoData = null;
            entity.LogoFileName = null;
            entity.LogoContentType = null;
            entity.LogoVersion++;
        }
        else
        {
            entity.PartnerLogoData = null;
            entity.PartnerLogoFileName = null;
            entity.PartnerLogoContentType = null;
            entity.PartnerLogoVersion++;
        }

        await db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    /// <summary>Raw bytes for the logo endpoints; null when none is set.</summary>
    public async Task<(byte[] Content, string ContentType)?> GetLogoAsync(
        LogoSlot slot, CancellationToken ct)
    {
        var entity = await db.Branding.AsNoTracking().FirstOrDefaultAsync(b => b.Id == 1, ct);
        if (entity is null) return null;

        var (data, type) = slot == LogoSlot.Primary
            ? (entity.LogoData, entity.LogoContentType)
            : (entity.PartnerLogoData, entity.PartnerLogoContentType);

        if (data is not { Length: > 0 }) return null;
        return (data, type ?? "application/octet-stream");
    }

    private static BrandingDto ToDto(BrandingSetting entity) => new()
    {
        OrganisationName = entity.OrganisationName,
        ShortName = entity.ShortName,
        PortalTitle = entity.PortalTitle,
        Tagline = entity.Tagline,
        SupportEmail = entity.SupportEmail,
        HasLogo = entity.HasLogo,
        LogoFileName = entity.LogoFileName,
        /* Relative so it works behind any host, with the version as a cache key. */
        LogoUrl = entity.HasLogo ? $"branding/logo?v={entity.LogoVersion}" : null,
        LogoVersion = entity.LogoVersion,
        LogoLinkUrl = entity.LogoLinkUrl,
        PartnerName = entity.PartnerName,
        HasPartnerLogo = entity.HasPartnerLogo,
        PartnerLogoFileName = entity.PartnerLogoFileName,
        PartnerLogoUrl = entity.HasPartnerLogo
            ? $"branding/partner-logo?v={entity.PartnerLogoVersion}"
            : null,
        PartnerLogoVersion = entity.PartnerLogoVersion,
        PartnerLogoLinkUrl = entity.PartnerLogoLinkUrl,
        UpdatedOn = entity.ModifiedOn ?? entity.CreatedOn,
    };
}
