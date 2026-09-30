using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;
using PdfSharp.Drawing;
using PdfSharp.Pdf;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// What an applicant attaches to a field of their profile form.
///
/// Two kinds, one store. A camera field takes several pictures — that is
/// how a phone photographs a certificate — and they come back merged into
/// one PDF in the order taken, because nobody wants to read five images.
/// A file field takes one document and gives it back as it arrived, under
/// the name the applicant knew it by.
///
/// Which rules apply comes from the field's type on the published form, so
/// a field changed from one to the other behaves correctly the moment it
/// is republished.
/// </summary>
public class ProfileAttachmentService(NtmsDbContext db, ProfileFormService forms)
{
    /// <summary>Where a field sets no limit of its own.</summary>
    private const int DefaultLimit = 5;

    /// <summary>A phone camera at sensible quality, with room to spare.</summary>
    private const int MaxBytes = 6 * 1024 * 1024;

    public sealed record Standing(string FieldKey, int Count, int Limit);

    /// <summary>How many pictures are held for a field, and how many it takes.</summary>
    public async Task<Standing> StandingAsync(int applicantId, string fieldKey, CancellationToken ct)
    {
        var count = await db.ProfileAttachments
            .CountAsync(p => p.ApplicantId == applicantId && p.FieldKey == fieldKey, ct);

        return new Standing(fieldKey, count, await LimitForAsync(applicantId, fieldKey, ct));
    }

    /// <summary>
    /// Adds one picture to the end of a field's set.
    ///
    /// Refuses past the limit rather than quietly dropping it: the app
    /// shows a counter, and a picture that seemed to be taken but was not
    /// kept is worse than being told no.
    /// </summary>
    public async Task<Standing> AddAsync(
        int applicantId, string fieldKey, byte[] content, string? contentType,
        CancellationToken ct)
    {
        if (content.Length == 0) throw new AppException("The picture is empty.");
        if (content.Length > MaxBytes)
            throw new AppException($"Each picture must be {MaxBytes / (1024 * 1024)} MB or smaller.");

        var type = (contentType ?? string.Empty).ToLowerInvariant();
        if (!type.StartsWith("image/", StringComparison.Ordinal))
            throw new AppException("Only pictures can be added to this field.");

        var limit = await LimitForAsync(applicantId, fieldKey, ct);

        var existing = await db.ProfileAttachments
            .Where(p => p.ApplicantId == applicantId && p.FieldKey == fieldKey)
            .ToListAsync(ct);

        if (existing.Count >= limit)
            throw new AppException($"This field takes {limit} picture{(limit == 1 ? "" : "s")}.");

        db.ProfileAttachments.Add(new ProfileAttachment
        {
            ApplicantId = applicantId,
            FieldKey = fieldKey,
            DisplayOrder = existing.Count == 0 ? 1 : existing.Max(p => p.DisplayOrder) + 1,
            ContentType = type,
            Content = content,
            CapturedOn = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(ct);
        return new Standing(fieldKey, existing.Count + 1, limit);
    }

    /// <summary>
    /// Removes one picture and closes the gap behind it.
    ///
    /// Renumbered rather than left with a hole, so the set stays "one to
    /// N" and the next picture added cannot collide with a position that
    /// was vacated.
    /// </summary>
    public async Task<Standing> RemoveAsync(
        int applicantId, string fieldKey, int displayOrder, CancellationToken ct)
    {
        var photos = await db.ProfileAttachments
            .Where(p => p.ApplicantId == applicantId && p.FieldKey == fieldKey)
            .OrderBy(p => p.DisplayOrder)
            .ToListAsync(ct);

        var going = photos.FirstOrDefault(p => p.DisplayOrder == displayOrder)
                    ?? throw AppException.NotFound("Picture");

        db.ProfileAttachments.Remove(going);

        var order = 1;
        foreach (var photo in photos.Where(p => p.Id != going.Id))
        {
            photo.DisplayOrder = order++;
        }

        await db.SaveChangesAsync(ct);
        return new Standing(fieldKey, photos.Count - 1,
            await LimitForAsync(applicantId, fieldKey, ct));
    }

    /// <summary>Clears a field's set, for an applicant starting it again.</summary>
    public async Task<Standing> ClearAsync(int applicantId, string fieldKey, CancellationToken ct)
    {
        await db.ProfileAttachments
            .Where(p => p.ApplicantId == applicantId && p.FieldKey == fieldKey)
            .ExecuteDeleteAsync(ct);

        return new Standing(fieldKey, 0, await LimitForAsync(applicantId, fieldKey, ct));
    }

    /// <summary>One picture, for a thumbnail.</summary>
    public async Task<(byte[] Content, string ContentType)> OneAsync(
        int applicantId, string fieldKey, int displayOrder, CancellationToken ct)
    {
        var photo = await db.ProfileAttachments.AsNoTracking()
            .FirstOrDefaultAsync(p => p.ApplicantId == applicantId
                                      && p.FieldKey == fieldKey
                                      && p.DisplayOrder == displayOrder, ct)
            ?? throw AppException.NotFound("Picture");

        return (photo.Content, photo.ContentType);
    }

    /// <summary>
    /// Every picture for a field, as one PDF, a page each.
    ///
    /// Each page is sized to its picture rather than forced onto A4: these
    /// are photographs of documents at whatever aspect the camera gave, and
    /// letterboxing them into a portrait page wastes half the paper and
    /// makes the writing smaller.
    /// </summary>
    public async Task<byte[]> PdfAsync(int applicantId, string fieldKey, CancellationToken ct)
    {
        var photos = await db.ProfileAttachments.AsNoTracking()
            .Where(p => p.ApplicantId == applicantId && p.FieldKey == fieldKey)
            .OrderBy(p => p.DisplayOrder)
            .ToListAsync(ct);

        if (photos.Count == 0) throw AppException.NotFound("Pictures for this field");

        using var document = new PdfDocument();
        document.Info.Title = fieldKey;

        foreach (var photo in photos)
        {
            using var stream = new MemoryStream(photo.Content);

            XImage image;
            try
            {
                image = XImage.FromStream(stream);
            }
            catch (Exception)
            {
                /* One unreadable picture must not cost the whole document.
                   The page is skipped and the rest still open. */
                continue;
            }

            using (image)
            {
                var page = document.AddPage();
                page.Width = XUnit.FromPoint(image.PixelWidth * 72.0 / Math.Max(image.HorizontalResolution, 1));
                page.Height = XUnit.FromPoint(image.PixelHeight * 72.0 / Math.Max(image.VerticalResolution, 1));

                using var gfx = XGraphics.FromPdfPage(page);
                gfx.DrawImage(image, 0, 0, page.Width.Point, page.Height.Point);
            }
        }

        if (document.PageCount == 0)
            throw new AppException("None of the pictures for this field could be read.");

        using var output = new MemoryStream();
        document.Save(output, false);
        return output.ToArray();
    }

    /* ------------------------------------------------------------ files */

    public sealed record FileStanding(string FieldKey, string? FileName, long Size);

    /// <summary>What is held for a file field, if anything.</summary>
    public async Task<FileStanding> FileStandingAsync(
        int applicantId, string fieldKey, CancellationToken ct)
    {
        var held = await db.ProfileAttachments.AsNoTracking()
            .Where(a => a.ApplicantId == applicantId && a.FieldKey == fieldKey)
            .Select(a => new { a.FileName, Size = (long)a.Content.Length })
            .FirstOrDefaultAsync(ct);

        return new FileStanding(fieldKey, held?.FileName, held?.Size ?? 0);
    }

    /// <summary>
    /// Stores the file an applicant chose for a field, replacing whatever
    /// was there.
    ///
    /// Replacing rather than appending: a file field asks one question and
    /// has one answer, and somebody who picks a second document means the
    /// second one. The extensions and the size limit are the form's, so
    /// tightening them is a settings change rather than a release.
    /// </summary>
    public async Task<FileStanding> SetFileAsync(
        int applicantId, string fieldKey, byte[] content, string? fileName,
        string? contentType, CancellationToken ct)
    {
        if (content.Length == 0) throw new AppException("The file is empty.");

        var field = await FieldForAsync(applicantId, fieldKey, FieldType.File, ct);

        var limitMb = Math.Clamp(field.Validation.MaxFileSizeMb ?? 5, 1, 64);
        if (content.Length > limitMb * 1024L * 1024L)
            throw new AppException($"The file must be {limitMb} MB or smaller.");

        var name = Path.GetFileName(fileName ?? string.Empty);
        if (string.IsNullOrWhiteSpace(name)) name = "attachment";

        var allowed = (field.Validation.AllowedExtensions ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(e => e.TrimStart('.').ToLowerInvariant())
            .Where(e => e.Length > 0)
            .ToList();

        if (allowed.Count > 0)
        {
            var extension = Path.GetExtension(name).TrimStart('.').ToLowerInvariant();
            if (!allowed.Contains(extension))
            {
                throw new AppException(
                    $"This field takes {string.Join(", ", allowed)} files.");
            }
        }

        /* Cleared first, so a field that somehow holds several ends up with
           one rather than with the new file behind the old ones. */
        await db.ProfileAttachments
            .Where(a => a.ApplicantId == applicantId && a.FieldKey == fieldKey)
            .ExecuteDeleteAsync(ct);

        db.ProfileAttachments.Add(new ProfileAttachment
        {
            ApplicantId = applicantId,
            FieldKey = fieldKey,
            DisplayOrder = 1,
            FileName = name,
            ContentType = string.IsNullOrWhiteSpace(contentType)
                ? "application/octet-stream"
                : contentType,
            Content = content,
            CapturedOn = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(ct);
        return new FileStanding(fieldKey, name, content.Length);
    }

    /// <summary>The file itself, as it arrived.</summary>
    public async Task<(byte[] Content, string ContentType, string FileName)> FileAsync(
        int applicantId, string fieldKey, CancellationToken ct)
    {
        var held = await db.ProfileAttachments.AsNoTracking()
            .FirstOrDefaultAsync(a => a.ApplicantId == applicantId && a.FieldKey == fieldKey, ct)
            ?? throw AppException.NotFound("File for this field");

        return (held.Content, held.ContentType, held.FileName ?? $"{fieldKey}");
    }

    /* ---------------------------------------------------------- helpers */

    /// <summary>
    /// The field on the applicant's own form, checked to be the kind the
    /// caller expects.
    ///
    /// Read from the published form every time rather than trusted from the
    /// request, so a field cannot be written to as one kind and read as
    /// another, and so a limit an administrator changes applies at once.
    /// </summary>
    private async Task<ProfileField> FieldForAsync(
        int applicantId, string fieldKey, FieldType expected, CancellationToken ct)
    {
        var subCategoryId = await db.Applicants.AsNoTracking()
            .Where(a => a.Id == applicantId)
            .Select(a => a.SubCategoryId)
            .FirstOrDefaultAsync(ct);

        var form = await forms.ActiveForAsync(subCategoryId, ct);

        var field = form?.Sections
            .SelectMany(s => s.Fields)
            .FirstOrDefault(f => f.Key == fieldKey && f.Type == expected);

        if (field is null)
        {
            throw new AppException(expected == FieldType.File
                ? "This field does not take a file."
                : "This field does not take pictures.");
        }

        return field;
    }

    /// <summary>
    /// What the form says this field takes.
    ///
    /// Read from the applicant's own sub-category form, so a limit raised
    /// or lowered by an administrator applies without anything being
    /// republished to the device.
    /// </summary>
    private async Task<int> LimitForAsync(int applicantId, string fieldKey, CancellationToken ct)
    {
        var field = await FieldForAsync(applicantId, fieldKey, FieldType.Photos, ct);
        return Math.Clamp(field.Validation.MaxPhotos ?? DefaultLimit, 1, 20);
    }
}
