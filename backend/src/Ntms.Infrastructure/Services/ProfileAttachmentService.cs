using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Ntms.Application.Common;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// What an applicant attaches to a field of their profile form.
///
/// Two kinds, one store. A camera field takes several pictures — that is
/// how a phone photographs a certificate — and they are kept and given
/// back as pictures, one by one, in the order they were taken. They used
/// to be merged into a single PDF on the way out, which turned five
/// photographs into one document that had to be downloaded and opened
/// before anybody could see whether the first of them was in focus.
/// A file field takes one document and gives it back as it arrived, under
/// the name the applicant knew it by.
///
/// Which rules apply comes from the field's type on the published form, so
/// a field changed from one to the other behaves correctly the moment it
/// is republished.
/// </summary>
public class ProfileAttachmentService(
    NtmsDbContext db,
    ProfileFormService forms,
    ILogger<ProfileAttachmentService> logger)
{
    /// <summary>Where a field sets no limit of its own.</summary>
    private const int DefaultLimit = 5;

    /// <summary>A phone camera at sensible quality, with room to spare.</summary>
    private const int MaxBytes = 6 * 1024 * 1024;

    public sealed record Standing(string FieldKey, int Count, int Limit);

    /// <summary>
    /// What the handset knew when the shutter went.
    ///
    /// Every part optional. A phone indoors gets no fix, an applicant may
    /// refuse the location permission, and a web client has no model name
    /// to give — none of which is a reason to refuse the photograph.
    /// </summary>
    public sealed record Capture(
        DateTime? CapturedOn = null,
        decimal? Latitude = null,
        decimal? Longitude = null,
        string? Platform = null,
        string? Model = null,
        string? OsVersion = null);

    /// <summary>One picture in a field's set, without its bytes.</summary>
    public sealed record Shot(
        int DisplayOrder,
        string ContentType,
        DateTime CapturedOn,
        DateTime SyncedOn,
        decimal? Latitude,
        decimal? Longitude,
        string? DevicePlatform,
        string? DeviceModel,
        string? DeviceOsVersion,
        bool Stamped,
        int SizeBytes);

    /// <summary>How many pictures are held for a field, and how many it takes.</summary>
    public async Task<Standing> StandingAsync(int applicantId, int subCategoryId, string fieldKey, CancellationToken ct)
    {
        var count = await db.ProfileAttachments
            .CountAsync(p => p.ApplicantId == applicantId && p.SubCategoryId == subCategoryId
                        && p.FieldKey == fieldKey, ct);

        return new Standing(fieldKey, count, await LimitForAsync(applicantId, subCategoryId, fieldKey, ct));
    }

    /// <summary>
    /// Adds one picture to the end of a field's set.
    ///
    /// Refuses past the limit rather than quietly dropping it: the app
    /// shows a counter, and a picture that seemed to be taken but was not
    /// kept is worse than being told no.
    /// </summary>
    public async Task<Standing> AddAsync(
        int applicantId, int subCategoryId, string fieldKey, byte[] content, string? contentType,
        Capture? capture, CancellationToken ct)
    {
        if (content.Length == 0) throw new AppException("The picture is empty.");
        if (content.Length > MaxBytes)
            throw new AppException($"Each picture must be {MaxBytes / (1024 * 1024)} MB or smaller.");

        var type = (contentType ?? string.Empty).ToLowerInvariant();
        if (!type.StartsWith("image/", StringComparison.Ordinal))
            throw new AppException("Only pictures can be added to this field.");

        var limit = await LimitForAsync(applicantId, subCategoryId, fieldKey, ct);

        var existing = await db.ProfileAttachments
            .Where(p => p.ApplicantId == applicantId && p.SubCategoryId == subCategoryId
                        && p.FieldKey == fieldKey)
            .ToListAsync(ct);

        if (existing.Count >= limit)
            throw new AppException($"This field takes {limit} picture{(limit == 1 ? "" : "s")}.");

        var now = DateTime.UtcNow;
        var facts = capture ?? new Capture();

        /* The phone's clock, but not blindly. A handset with the date wrong
           would otherwise stamp a photograph with a time that makes the
           evidence look tampered with; anything that is not within a day of
           now is treated as no answer and the arrival time stands. */
        var capturedOn = facts.CapturedOn is { } said
                         && Math.Abs((now - said).TotalHours) <= 24
            ? said
            : now;

        var stamp = PhotoStamp.Apply(
            content, capturedOn, facts.Latitude, facts.Longitude, logger);

        db.ProfileAttachments.Add(new ProfileAttachment
        {
            ApplicantId = applicantId,
            SubCategoryId = subCategoryId,
            FieldKey = fieldKey,
            DisplayOrder = existing.Count == 0 ? 1 : existing.Max(p => p.DisplayOrder) + 1,
            ContentType = stamp.Stamped ? stamp.ContentType : type,
            Content = stamp.Content,
            CapturedOn = capturedOn,
            SyncedOn = now,
            Latitude = facts.Latitude,
            Longitude = facts.Longitude,
            DevicePlatform = Trimmed(facts.Platform, 40),
            DeviceModel = Trimmed(facts.Model, 120),
            DeviceOsVersion = Trimmed(facts.OsVersion, 40),
            Stamped = stamp.Stamped,
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
        int applicantId, int subCategoryId, string fieldKey, int displayOrder, CancellationToken ct)
    {
        var photos = await db.ProfileAttachments
            .Where(p => p.ApplicantId == applicantId && p.SubCategoryId == subCategoryId
                        && p.FieldKey == fieldKey)
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
            await LimitForAsync(applicantId, subCategoryId, fieldKey, ct));
    }

    /// <summary>Clears a field's set, for an applicant starting it again.</summary>
    public async Task<Standing> ClearAsync(int applicantId, int subCategoryId, string fieldKey, CancellationToken ct)
    {
        await db.ProfileAttachments
            .Where(p => p.ApplicantId == applicantId && p.SubCategoryId == subCategoryId
                        && p.FieldKey == fieldKey)
            .ExecuteDeleteAsync(ct);

        return new Standing(fieldKey, 0, await LimitForAsync(applicantId, subCategoryId, fieldKey, ct));
    }

    /// <summary>One picture, for a thumbnail.</summary>
    public async Task<(byte[] Content, string ContentType)> OneAsync(
        int applicantId, int subCategoryId, string fieldKey, int displayOrder, CancellationToken ct)
    {
        var photo = await db.ProfileAttachments.AsNoTracking()
            .FirstOrDefaultAsync(p => p.ApplicantId == applicantId
                                      && p.FieldKey == fieldKey
                                      && p.DisplayOrder == displayOrder, ct)
            ?? throw AppException.NotFound("Picture");

        return (photo.Content, photo.ContentType);
    }

    /// <summary>
    /// Every picture held for a field, in the order taken, without bytes.
    ///
    /// Replaces the merged PDF. A scrutiny officer wants to look at the
    /// photographs — and at where and when each was taken, which a single
    /// document flattened away — so the register of them is read first and
    /// each image fetched by its position.
    /// </summary>
    public async Task<IReadOnlyList<Shot>> ShotsAsync(
        int applicantId, int subCategoryId, string fieldKey, CancellationToken ct) =>
        await db.ProfileAttachments.AsNoTracking()
            .Where(p => p.ApplicantId == applicantId && p.SubCategoryId == subCategoryId
                        && p.FieldKey == fieldKey)
            .OrderBy(p => p.DisplayOrder)
            .Select(p => new Shot(
                p.DisplayOrder,
                p.ContentType,
                p.CapturedOn,
                p.SyncedOn,
                p.Latitude,
                p.Longitude,
                p.DevicePlatform,
                p.DeviceModel,
                p.DeviceOsVersion,
                p.Stamped,
                p.Content.Length))
            .ToListAsync(ct);

    /// <summary>Trimmed to what the column holds, or null if there is nothing.</summary>
    private static string? Trimmed(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var clean = value.Trim();
        return clean.Length <= max ? clean : clean[..max];
    }

    /* ------------------------------------------------------------ files */

    public sealed record FileStanding(string FieldKey, string? FileName, long Size);

    /// <summary>What is held for a file field, if anything.</summary>
    public async Task<FileStanding> FileStandingAsync(
        int applicantId, int subCategoryId, string fieldKey, CancellationToken ct)
    {
        var held = await db.ProfileAttachments.AsNoTracking()
            .Where(a => a.ApplicantId == applicantId && a.SubCategoryId == subCategoryId
                        && a.FieldKey == fieldKey)
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
        int applicantId, int subCategoryId, string fieldKey, byte[] content, string? fileName,
        string? contentType, CancellationToken ct)
    {
        if (content.Length == 0) throw new AppException("The file is empty.");

        var field = await FieldForAsync(applicantId, subCategoryId, fieldKey, FieldType.File, ct);

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
            .Where(a => a.ApplicantId == applicantId && a.SubCategoryId == subCategoryId
                        && a.FieldKey == fieldKey)
            .ExecuteDeleteAsync(ct);

        db.ProfileAttachments.Add(new ProfileAttachment
        {
            ApplicantId = applicantId,
            SubCategoryId = subCategoryId,
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
        int applicantId, int subCategoryId, string fieldKey, CancellationToken ct)
    {
        var held = await db.ProfileAttachments.AsNoTracking()
            .FirstOrDefaultAsync(a => a.ApplicantId == applicantId && a.SubCategoryId == subCategoryId
                        && a.FieldKey == fieldKey, ct)
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
        int applicantId, int subCategoryId, string fieldKey, FieldType expected, CancellationToken ct)
    {
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
    /// Read from the form of the sub-category this profile is being filled
    /// in for, so a limit raised or lowered by an administrator applies
    /// without anything being republished to the device.
    /// </summary>
    private async Task<int> LimitForAsync(
        int applicantId, int subCategoryId, string fieldKey, CancellationToken ct)
    {
        var field = await FieldForAsync(applicantId, subCategoryId, fieldKey, FieldType.Photos, ct);
        return Math.Clamp(field.Validation.MaxPhotos ?? DefaultLimit, 1, 20);
    }
}
