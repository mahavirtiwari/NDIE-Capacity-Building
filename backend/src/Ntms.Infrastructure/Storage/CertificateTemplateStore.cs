using Microsoft.Extensions.Configuration;
using Ntms.Application.Common;

namespace Ntms.Infrastructure.Storage;

/// <summary>
/// Where certificate templates live on disk.
///
/// Same reasoning as the monitoring photographs: the files are large, nothing
/// queries their contents, and keeping them out of table pages keeps backups
/// about data. Laid out <c>programType/{id}/{kind}{ext}</c> — one slot per kind,
/// so re-uploading overwrites rather than accumulating drafts nobody can tell
/// apart.
/// </summary>
public class CertificateTemplateStore
{
    private const long MaxBytes = 10 * 1024 * 1024;

    /* Artwork or a document to lay a certificate out from. Deliberately not
       arbitrary file types: this is an authenticated upload that is served back
       out again, so the list is what a template could plausibly be. */
    private static readonly Dictionary<string, string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["application/pdf"] = ".pdf",
        ["image/png"] = ".png",
        ["image/jpeg"] = ".jpg",
        ["image/jpg"] = ".jpg",
        ["text/html"] = ".html",
        ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] = ".docx",
    };

    public static string AllowedDescription => "PDF, PNG, JPEG, HTML or DOCX, up to 10 MB";

    private readonly string root;

    public CertificateTemplateStore(IConfiguration config)
    {
        var configured = config["Storage:CertificateTemplateRoot"];
        root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(AppContext.BaseDirectory, "App_Data", "certificate-templates")
            : configured;
    }

    public sealed record StoredFile(string RelativePath, string ContentType, long SizeBytes);

    public async Task<StoredFile> SaveAsync(
        Stream content, string? contentType, long length, int programTypeId, string kind,
        CancellationToken ct)
    {
        if (length <= 0)
            throw new AppException("That file appears to be empty.");

        if (length > MaxBytes)
            throw new AppException($"Templates must be {MaxBytes / (1024 * 1024)} MB or smaller.");

        if (contentType is null || !AllowedTypes.TryGetValue(contentType, out var extension))
            throw new AppException($"A template must be {AllowedDescription}.");

        var folder = Path.Combine(root, "programType", programTypeId.ToString());
        Directory.CreateDirectory(folder);

        var relative = $"programType/{programTypeId}/{kind}{extension}";
        var fullPath = Path.Combine(folder, $"{kind}{extension}");

        /* Create overwrites deliberately: this slot holds the current template
           and a replacement is meant to take its place. */
        await using (var file = new FileStream(
            fullPath, FileMode.Create, FileAccess.Write, FileShare.None, 64 * 1024, useAsync: true))
        {
            await content.CopyToAsync(file, ct);
        }

        return new StoredFile(relative, contentType, new FileInfo(fullPath).Length);
    }

    /// <summary>
    /// Opens a stored template. The path is rebuilt from the root and checked
    /// to still sit under it, so a tampered row cannot read elsewhere on disk.
    /// </summary>
    public Stream Open(string relativePath)
    {
        var full = Path.GetFullPath(Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
        var boundary = Path.GetFullPath(root) + Path.DirectorySeparatorChar;

        if (!full.StartsWith(boundary, StringComparison.OrdinalIgnoreCase) || !File.Exists(full))
            throw AppException.NotFound("Template");

        return new FileStream(full, FileMode.Open, FileAccess.Read, FileShare.Read, 64 * 1024, useAsync: true);
    }

    /// <summary>Removes the file behind a template row. A missing file is not an error.</summary>
    public void Delete(string relativePath)
    {
        var full = Path.GetFullPath(Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
        var boundary = Path.GetFullPath(root) + Path.DirectorySeparatorChar;

        if (!full.StartsWith(boundary, StringComparison.OrdinalIgnoreCase)) return;
        if (File.Exists(full)) File.Delete(full);
    }
}
