using Microsoft.Extensions.Configuration;
using Ntms.Application.Common;

namespace Ntms.Infrastructure.Storage;

/// <summary>
/// Where an applicant's profile pictures and documents live on disk.
///
/// They used to live in the database, as bytes on the attachment row. That
/// was defensible when there was one picture per applicant and it was read
/// during scrutiny; it stopped being so once the coordinator's app was
/// photographing people on the ground. Images are the largest thing the
/// system holds and nothing queries them, so every backup and every restore
/// carried them, and the database grew with the photographs rather than with
/// the records. The row keeps what gets searched and points at the file,
/// which is the arrangement monitoring photographs have always had.
///
/// Files are laid out <c>applicant/{id}/{guid}.{ext}</c>: a folder per
/// applicant, so everything one person sent can be handed over, archived or
/// removed as a unit, and a GUID name so an upload can neither overwrite an
/// earlier one nor smuggle a path in through its own filename. Which field
/// an image answers is on the row, not in the path - a field key is whatever
/// the form designer typed, and that does not belong in a directory name.
/// </summary>
public class ProfileAttachmentStore
{
    /* Matched against the type the caller sniffed, not the extension the
       client claims. Documents are allowed here as well as pictures: the
       same table holds both, and a file field's own allow-list is applied
       by the service before anything reaches this. */
    private static readonly Dictionary<string, string> Extensions =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["image/jpeg"] = ".jpg",
            ["image/jpg"] = ".jpg",
            ["image/png"] = ".png",
            ["image/webp"] = ".webp",
            ["application/pdf"] = ".pdf",
        };

    private readonly string root;

    public ProfileAttachmentStore(IConfiguration config)
    {
        /* Configurable because production points it at a share every web
           head mounts, and because it must sit outside the published site
           folder - a release that replaces that folder would otherwise take
           the applicants' documents with it. The default keeps a developer
           working without setting anything up. */
        var configured = config["Storage:ProfileAttachmentRoot"];
        root = string.IsNullOrWhiteSpace(configured)
            ? Path.Combine(AppContext.BaseDirectory, "App_Data", "profile-attachments")
            : configured;
    }

    /* Compared the way the filesystem treats them: case-insensitively on
       Windows, exactly on Linux, where two names differing only in case are
       two different directories. */
    private static readonly StringComparison PathCase =
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    public sealed record StoredFile(string RelativePath, long SizeBytes);

    /// <summary>
    /// Writes one file into the applicant's folder and returns what the row
    /// should record about it.
    ///
    /// An unrecognised type is stored as <c>.bin</c> rather than refused:
    /// what may be uploaded is the form's decision and has already been
    /// taken by the time anything gets here, and a file the applicant has
    /// successfully sent must not be lost over a name.
    /// </summary>
    public async Task<StoredFile> SaveAsync(
        byte[] content, string? contentType, int applicantId, CancellationToken ct)
    {
        if (content.Length == 0)
            throw new AppException("The file appears to be empty.");

        var extension = contentType is not null
                        && Extensions.TryGetValue(contentType, out var known)
            ? known
            : ".bin";

        var folder = Path.Combine(root, "applicant", applicantId.ToString());
        Directory.CreateDirectory(folder);

        var name = $"{Guid.NewGuid():N}{extension}";
        var fullPath = Path.Combine(folder, name);

        /* CreateNew rather than Create: a GUID collision should fail loudly
           rather than quietly replace somebody else's document. */
        await using (var file = new FileStream(
            fullPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 64 * 1024,
            useAsync: true))
        {
            await file.WriteAsync(content, ct);
        }

        return new StoredFile($"applicant/{applicantId}/{name}", content.Length);
    }

    /// <summary>
    /// Reads a stored file back.
    ///
    /// The path is rebuilt from the root and checked to still sit under it,
    /// so a tampered row cannot be used to read a file elsewhere on the
    /// machine.
    /// </summary>
    public async Task<byte[]> ReadAsync(string relativePath, CancellationToken ct)
    {
        var full = Resolve(relativePath);

        if (!File.Exists(full)) throw AppException.NotFound("File");

        return await File.ReadAllBytesAsync(full, ct);
    }

    /// <summary>
    /// Removes a stored file, and says nothing if it has already gone.
    ///
    /// A row deleted whose file is missing is a tidier outcome than a
    /// delete that fails: the record is what the applicant is shown, and
    /// leaving it because its bytes are absent helps nobody.
    /// </summary>
    public void Delete(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath)) return;

        try
        {
            var full = Resolve(relativePath);
            if (File.Exists(full)) File.Delete(full);
        }
        catch (AppException)
        {
            /* Outside the root: not ours to delete, and not ours to fail on. */
        }
    }

    private string Resolve(string relativePath)
    {
        var full = Path.GetFullPath(
            Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
        var boundary = Path.GetFullPath(root) + Path.DirectorySeparatorChar;

        if (!full.StartsWith(boundary, PathCase)) throw AppException.NotFound("File");

        return full;
    }
}
