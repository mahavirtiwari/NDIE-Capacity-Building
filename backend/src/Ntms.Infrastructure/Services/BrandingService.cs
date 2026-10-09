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

    /* Raster only. SVG is a document: it carries script, and the portal is
       served from this same origin, so a logo opened in a tab ran that
       script against whoever opened it — with their token in reach. A mark
       in the header has no need of it. */
    private static readonly string[] AllowedTypes =
        ["image/png", "image/jpeg", "image/webp"];

    /// <summary>
    /// What each accepted type actually begins with.
    ///
    /// The browser tells us the type of what it is uploading and has no
    /// reason to tell the truth. The first bytes of the file do.
    /// </summary>
    private static readonly (string Type, byte[] Magic)[] Signatures =
    [
        ("image/png", [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
        ("image/jpeg", [0xFF, 0xD8, 0xFF]),
        ("image/webp", [0x52, 0x49, 0x46, 0x46]),
    ];

    /// <summary>The type the bytes say they are, or null if they say nothing.</summary>
    private static string? SniffType(byte[] content)
    {
        foreach (var (type, magic) in Signatures)
        {
            if (content.Length < magic.Length) continue;
            if (content.AsSpan(0, magic.Length).SequenceEqual(magic))
            {
                /* RIFF is also WAV and AVI; WEBP says so four bytes later. */
                if (type != "image/webp") return type;
                if (content.Length >= 12
                    && content.AsSpan(8, 4).SequenceEqual("WEBP"u8))
                {
                    return type;
                }
            }
        }

        return null;
    }

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

    /// <summary>Which mark is being written.</summary>
    public enum LogoSlot
    {
        Primary,
        Partner,

        /// <summary>The organisation's own mark, drawn for a dark ground.</summary>
        Reversed,
    }

    public async Task<BrandingDto> SetLogoAsync(
        Stream content, string fileName, string? contentType, long length,
        LogoSlot slot, CancellationToken ct)
    {
        if (length <= 0) throw new AppException("The file is empty.");
        if (length > MaxLogoBytes)
            throw new AppException($"The logo must be {MaxLogoBytes / 1024} KB or smaller.");

        var claimed = (contentType ?? string.Empty).ToLowerInvariant();
        if (!AllowedTypes.Contains(claimed))
            throw new AppException("Upload a PNG, JPEG or WebP image.");

        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();

        /* The served type is the one the bytes prove, not the one the upload
           claimed, so nothing can be stored under a type it is not. */
        var type = SniffType(bytes)
                   ?? throw new AppException(
                       "That file is not a PNG, JPEG or WebP image.");

        var entity = await LoadAsync(ct);
        var name = Path.GetFileName(fileName);

        switch (slot)
        {
            case LogoSlot.Primary:
                entity.LogoData = bytes;
                entity.LogoFileName = name;
                entity.LogoContentType = type;
                /* Clients cache the logo by URL, so the version is what busts it. */
                entity.LogoVersion++;
                break;

            case LogoSlot.Reversed:
                entity.ReversedLogoData = bytes;
                entity.ReversedLogoFileName = name;
                entity.ReversedLogoContentType = type;
                entity.ReversedLogoVersion++;
                break;

            default:
                entity.PartnerLogoData = bytes;
                entity.PartnerLogoFileName = name;
                entity.PartnerLogoContentType = type;
                entity.PartnerLogoVersion++;
                break;
        }

        await db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task<BrandingDto> RemoveLogoAsync(LogoSlot slot, CancellationToken ct)
    {
        var entity = await LoadAsync(ct);

        switch (slot)
        {
            case LogoSlot.Primary:
                entity.LogoData = null;
                entity.LogoFileName = null;
                entity.LogoContentType = null;
                entity.LogoVersion++;
                break;

            case LogoSlot.Reversed:
                entity.ReversedLogoData = null;
                entity.ReversedLogoFileName = null;
                entity.ReversedLogoContentType = null;
                entity.ReversedLogoVersion++;
                break;

            default:
                entity.PartnerLogoData = null;
                entity.PartnerLogoFileName = null;
                entity.PartnerLogoContentType = null;
                entity.PartnerLogoVersion++;
                break;
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

        var (data, type) = slot switch
        {
            LogoSlot.Primary => (entity.LogoData, entity.LogoContentType),
            LogoSlot.Reversed => (entity.ReversedLogoData, entity.ReversedLogoContentType),
            _ => (entity.PartnerLogoData, entity.PartnerLogoContentType),
        };

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
        HasReversedLogo = entity.HasReversedLogo,
        ReversedLogoFileName = entity.ReversedLogoFileName,
        ReversedLogoUrl = entity.HasReversedLogo
            ? $"branding/reversed-logo?v={entity.ReversedLogoVersion}"
            : null,
        ReversedLogoVersion = entity.ReversedLogoVersion,
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
