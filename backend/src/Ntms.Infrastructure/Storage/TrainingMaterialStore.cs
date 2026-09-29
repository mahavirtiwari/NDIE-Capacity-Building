using Microsoft.Extensions.Configuration;
using Ntms.Application.Common;

namespace Ntms.Infrastructure.Storage;

/// <summary>
/// Where published training material lives on disk.
///
/// Files rather than rows, for the same reason as the monitoring photographs:
/// a course pack is tens of megabytes of material nobody queries, and putting
/// it in table pages would weigh down every backup and every restore. The
/// database keeps what is searched and points at the file.
///
/// Laid out <c>program/{programTypeId}/{guid}.{ext}</c>. Grouping by programme
/// means a track's whole pack can be archived or handed over as one folder,
/// and the GUID name means an upload can neither overwrite an earlier one nor
/// smuggle a path in through its filename.
/// </summary>
public class TrainingMaterialStore
{

    /// <summary>
    /// What may be published, by sniffed type rather than by the extension
    /// the browser claims. Anything not on this list is refused: the file is
    /// served back to other people, so what goes on must be something a
    /// browser will render rather than execute.
    /// </summary>
    private static readonly Dictionary<string, string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["application/pdf"] = ".pdf",
        ["image/jpeg"] = ".jpg",
        ["image/jpg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
        ["video/mp4"] = ".mp4",
        ["audio/mpeg"] = ".mp3",
        ["application/msword"] = ".doc",
        ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] = ".docx",
        ["application/vnd.ms-powerpoint"] = ".ppt",
        ["application/vnd.openxmlformats-officedocument.presentationml.presentation"] = ".pptx",
        ["application/vnd.ms-excel"] = ".xls",
        ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] = ".xlsx",
    };

    /// <summary>What a browser will show in place rather than download.</summary>
    private static readonly HashSet<string> Previewable = new(StringComparer.OrdinalIgnoreCase)
    {
        "application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp",
        "video/mp4", "audio/mpeg",
    };

    private readonly string root;

    public TrainingMaterialStore(IConfiguration config)
    {
        var configured = config["Storage:MaterialsRoot"];
        root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(AppContext.BaseDirectory, "App_Data", "materials")
            : configured;
    }

    private static readonly StringComparison PathCase =
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    public static bool CanPreview(string? contentType) =>
        contentType is not null && Previewable.Contains(contentType);

    public sealed record StoredFile(
        string RelativePath, string FileName, string ContentType, long SizeBytes);

    /// <summary>
    /// Writes one file and returns what the material row should record about
    /// it. A wrong type or an oversized file is the caller's mistake, so it
    /// comes back as a 400 rather than an unhandled 500.
    /// </summary>
    public async Task<StoredFile> SaveAsync(
        Stream content, string? contentType, string? originalName, long length,
        int programTypeId, long maxBytes, CancellationToken ct)
    {
        if (length <= 0)
            throw new AppException("That file is empty.");

        /* The ceiling comes from System Settings rather than from a constant
           here: it depends on the disk the deployment sits on and on what a
           department is trying to publish, and neither is worth a release. */
        if (length > maxBytes)
        {
            throw new AppException(
                $"Files must be {maxBytes / (1024 * 1024)} MB or smaller. " +
                "Host a larger video and publish it as a Link instead, or raise " +
                "the limit in System Settings.");
        }

        if (contentType is null || !AllowedTypes.TryGetValue(contentType, out var extension))
        {
            throw new AppException(
                "That file type cannot be published. PDFs, images, Office documents, " +
                "MP4 video and MP3 audio are accepted.");
        }

        var folder = Path.Combine(root, "program", programTypeId.ToString());
        Directory.CreateDirectory(folder);

        var name = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(folder, name);

        /* CreateNew, not Create: a GUID collision should fail loudly rather
           than quietly replace somebody else's material. */
        await using (var file = new FileStream(
            fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 64 * 1024, useAsync: true))
        {
            await content.CopyToAsync(file, ct);
        }

        /* The name the file was uploaded under is kept for display and for the
           download, but never used as a path. */
        var shown = Path.GetFileName(originalName ?? string.Empty);
        if (string.IsNullOrWhiteSpace(shown)) shown = name;

        return new StoredFile(
            $"program/{programTypeId}/{name}", shown, contentType, new FileInfo(fullPath).Length);
    }

    /// <summary>
    /// Opens a stored file for reading.
    ///
    /// The path is rebuilt from the root and checked to still sit under it, so
    /// a tampered row cannot be turned into a read of some other file on the
    /// machine. An external URL is not a stored file and is refused here.
    /// </summary>
    public Stream Open(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)
            || relativePath.Contains("://", StringComparison.Ordinal))
        {
            throw AppException.NotFound("File");
        }

        var full = Path.GetFullPath(
            Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
        var boundary = Path.GetFullPath(root) + Path.DirectorySeparatorChar;

        if (!full.StartsWith(boundary, PathCase) || !File.Exists(full))
            throw AppException.NotFound("File");

        return new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.Read, 64 * 1024, useAsync: true);
    }
}
