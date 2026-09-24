using Microsoft.Extensions.Configuration;
using Ntms.Application.Common;

namespace Ntms.Infrastructure.Storage;

/// <summary>
/// Where monitoring photographs live on disk.
///
/// The images are kept as files rather than in the database: a workshop
/// generates dozens of them, each far larger than any other row in the system,
/// and putting them in table pages would bloat every backup and every restore
/// of data nobody queries. The database keeps the metadata, which is what gets
/// searched, and the row points at the file.
///
/// Files are laid out <c>programme/{id}/{kind}/{guid}.{ext}</c>. Grouping by
/// programme means a workshop's whole evidence pack can be handed over or
/// archived as one folder, and the GUID name means an upload can never
/// overwrite an earlier one or smuggle a path in through its filename.
/// </summary>
public class MonitoringPhotoStore
{
    private const long MaxBytes = 8 * 1024 * 1024;

    /* Matched against the sniffed type, not the extension the client claims. */
    private static readonly Dictionary<string, string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/jpg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
    };

    private readonly string root;

    public MonitoringPhotoStore(IConfiguration config)
    {
        /* Configurable because production will point it at a share the web
           heads all mount; the default keeps a developer working out of the
           box without setting anything up. */
        var configured = config["Storage:MonitoringRoot"];
        root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(AppContext.BaseDirectory, "App_Data", "monitoring")
            : configured;
    }

    /* Paths are compared the way the filesystem treats them: case-insensitively
       on Windows, exactly on Linux, where two names differing only in case are
       two different directories. */
    private static readonly StringComparison PathCase =
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    public sealed record StoredFile(string RelativePath, string FileName, string ContentType, long SizeBytes);

    /// <summary>
    /// Writes one photograph and returns what the caller should record about it.
    /// Throws an <see cref="AppException"/> — a 400, not a 500 — when the file
    /// is the wrong type or too big, because that is the client's mistake.
    /// </summary>
    public async Task<StoredFile> SaveAsync(
        Stream content, string? contentType, long length, int programmeId, string kind,
        CancellationToken ct)
    {
        if (length <= 0)
            throw new AppException("The photo appears to be empty. Please retake it.");

        if (length > MaxBytes)
            throw new AppException($"Photos must be {MaxBytes / (1024 * 1024)} MB or smaller.");

        if (contentType is null || !AllowedTypes.TryGetValue(contentType, out var extension))
            throw new AppException("Photos must be JPEG, PNG or WebP.");

        var folder = Path.Combine(root, "programme", programmeId.ToString(), kind);
        Directory.CreateDirectory(folder);

        var name = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(folder, name);

        /* FileMode.CreateNew rather than Create: a GUID collision should fail
           loudly, not quietly replace somebody else's evidence. */
        await using (var file = new FileStream(
            fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 64 * 1024, useAsync: true))
        {
            await content.CopyToAsync(file, ct);
        }

        var relative = $"programme/{programmeId}/{kind}/{name}";
        return new StoredFile(relative, name, contentType, new FileInfo(fullPath).Length);
    }

    /// <summary>
    /// Opens a stored photograph for reading.
    ///
    /// The path is rebuilt from the root and checked to still sit under it, so
    /// a tampered row cannot be used to read a file elsewhere on the machine.
    /// </summary>
    public Stream Open(string relativePath)
    {
        var full = Path.GetFullPath(Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
        var boundary = Path.GetFullPath(root) + Path.DirectorySeparatorChar;

        if (!full.StartsWith(boundary, PathCase))
            throw AppException.NotFound("Photo");

        if (!File.Exists(full))
            throw AppException.NotFound("Photo");

        return new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.Read, 64 * 1024, useAsync: true);
    }
}
