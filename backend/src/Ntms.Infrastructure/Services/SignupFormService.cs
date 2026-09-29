using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Infrastructure.Mapping;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// The form an applicant fills in to create an account, and the only place it
/// is decided.
///
/// There is one of these, not one per anything, so there is no list screen and
/// no id to pass around — the whole form is read and written as an ordered set
/// of fields.
/// </summary>
public class SignupFormService(NtmsDbContext db)
{
    /// <summary>
    /// Built-in fields, by key. The sign-up code reads the applicant record by
    /// these names, so this list is the contract between the two and a key
    /// that is not in it cannot be built in.
    ///
    /// The locked ones cannot be switched off at all: an account with no name
    /// has nobody to address, and one with no email cannot be sent the
    /// credentials it needs to sign in, so disabling either would produce
    /// accounts that do not work.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, bool> BuiltIn = new Dictionary<string, bool>
    {
        ["fullName"] = true,
        ["email"] = true,
        ["mobile"] = true,
        ["pan"] = false,
        ["gender"] = false,
        ["socialCategory"] = false,
        ["categoryId"] = true,
        ["subCategoryId"] = true,
    };

    /// <summary>
    /// The form a sub-category actually uses: its own where it has one, and
    /// the default set otherwise.
    ///
    /// Falling back rather than returning nothing is what lets a scheme add
    /// sub-categories without configuring a form for each. A sub-category owns
    /// a form the moment it has one field of its own, so the two sets are
    /// never mixed — an administrator editing a sub-category's form is editing
    /// all of what applicants will see, not part of it.
    /// </summary>
    public async Task<SignupFormDto> FormAsync(
        int? subCategoryId, bool activeOnly, CancellationToken ct)
    {
        var owned = subCategoryId is not null
                    && await db.SignupFields.AnyAsync(f => f.SubCategoryId == subCategoryId, ct);

        var from = owned ? subCategoryId : null;
        var fields = await FieldsAsync(from, activeOnly, ct);

        return new SignupFormDto
        {
            SubCategoryId = subCategoryId,
            SubCategoryName = subCategoryId is null
                ? null
                : await db.SubCategories.AsNoTracking()
                    .Where(c => c.Id == subCategoryId).Select(c => c.Name).FirstOrDefaultAsync(ct),
            IsOwnForm = owned,
            Fields = fields,
        };
    }

    private async Task<List<SignupFieldDto>> FieldsAsync(
        int? subCategoryId, bool activeOnly, CancellationToken ct)
    {
        var query = db.SignupFields.Include(f => f.Options)
            .Where(f => f.SubCategoryId == subCategoryId);

        if (activeOnly) query = query.Where(f => f.Status == RecordStatus.Active);

        var fields = await query
            .OrderBy(f => f.DisplayOrder).ThenBy(f => f.Id)
            .AsNoTracking()
            .ToListAsync(ct);

        return [.. fields.Select(Map)];
    }

    public Task<List<SignupFieldDto>> ListAsync(bool activeOnly, CancellationToken ct) =>
        FieldsAsync(null, activeOnly, ct);

    /// <summary>
    /// Gives a sub-category a form of its own, copied from the default.
    ///
    /// Copied rather than started empty: every built-in field has to be on it,
    /// and an administrator who had to add them back by hand would sooner or
    /// later publish a form with no e-mail box on it.
    /// </summary>
    public async Task<SignupFormDto> AdoptAsync(int subCategoryId, CancellationToken ct)
    {
        var subCategory = await db.SubCategories.FirstOrDefaultAsync(c => c.Id == subCategoryId, ct)
            ?? throw AppException.NotFound("Sub-category");

        if (await db.SignupFields.AnyAsync(f => f.SubCategoryId == subCategoryId, ct))
        {
            throw AppException.Conflict($"'{subCategory.Name}' already has its own sign-up form.");
        }

        var defaults = await db.SignupFields.Include(f => f.Options).AsNoTracking()
            .Where(f => f.SubCategoryId == null)
            .OrderBy(f => f.DisplayOrder).ThenBy(f => f.Id)
            .ToListAsync(ct);

        foreach (var source in defaults)
        {
            var copy = new SignupField
            {
                SubCategoryId = subCategoryId,
                Key = source.Key,
                Label = source.Label,
                Placeholder = source.Placeholder,
                HelpText = source.HelpText,
                Type = source.Type,
                Required = source.Required,
                DisplayOrder = source.DisplayOrder,
                IsBuiltIn = source.IsBuiltIn,
                IsLocked = source.IsLocked,
                Status = source.Status,
            };

            foreach (var option in source.Options.OrderBy(o => o.DisplayOrder))
            {
                copy.Options.Add(new SignupFieldOption
                {
                    Value = option.Value,
                    Label = option.Label,
                    DisplayOrder = option.DisplayOrder,
                });
            }

            db.SignupFields.Add(copy);
        }

        await db.SaveChangesAsync(ct);
        return await FormAsync(subCategoryId, false, ct);
    }

    /// <summary>
    /// Drops a sub-category's own form, putting it back on the default. The
    /// answers people gave are untouched — they are keyed by field key, not by
    /// the field row.
    /// </summary>
    public async Task<SignupFormDto> ResetAsync(int subCategoryId, CancellationToken ct)
    {
        var fields = await db.SignupFields
            .Where(f => f.SubCategoryId == subCategoryId).ToListAsync(ct);

        db.SignupFields.RemoveRange(fields);
        await db.SaveChangesAsync(ct);
        return await FormAsync(subCategoryId, false, ct);
    }

    public async Task<SignupFieldDto> CreateAsync(SignupFieldUpsertDto dto, CancellationToken ct)
    {
        var key = Normalise(dto.Key);
        Validate(dto, key);

        if (BuiltIn.ContainsKey(key))
        {
            throw AppException.Conflict(
                $"'{key}' is a built-in field. It is already on the form and can be edited there.");
        }

        /* Within this form only. The same question on two sub-categories is
           two forms asking it, not a clash. */
        if (await db.SignupFields.AnyAsync(
                f => f.SubCategoryId == dto.SubCategoryId && f.Key == key, ct))
        {
            throw AppException.Conflict($"A field with the key '{key}' already exists on this form.");
        }

        if (dto.SubCategoryId is { } owner
            && !await db.SubCategories.AnyAsync(c => c.Id == owner, ct))
        {
            throw AppException.NotFound("Sub-category");
        }

        var last = await db.SignupFields
            .Where(f => f.SubCategoryId == dto.SubCategoryId)
            .MaxAsync(f => (int?)f.DisplayOrder, ct) ?? 0;

        var entity = new SignupField
        {
            SubCategoryId = dto.SubCategoryId,
            Key = key,
            IsBuiltIn = false,
            IsLocked = false,
            DisplayOrder = dto.DisplayOrder > 0 ? dto.DisplayOrder : last + 1,
        };

        Apply(entity, dto);
        db.SignupFields.Add(entity);
        await db.SaveChangesAsync(ct);

        return Map(await LoadAsync(entity.Id, ct));
    }

    public async Task<SignupFieldDto> UpdateAsync(int id, SignupFieldUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.SignupFields.Include(f => f.Options)
            .FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("Sign-up field");

        /* The key is how the sign-up code finds the answer. Renaming it would
           orphan every answer already recorded against the old one, so it is
           fixed once the field exists - for custom fields as much as built-in
           ones. */
        Validate(dto, entity.Key);
        Apply(entity, dto);

        await db.SaveChangesAsync(ct);
        return Map(await LoadAsync(id, ct));
    }

    public async Task<SignupFieldDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.SignupFields.Include(f => f.Options)
            .FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("Sign-up field");

        var next = EnumMaps.ToStatus(status);

        if (next == RecordStatus.Inactive && entity.IsLocked)
        {
            throw AppException.Conflict(
                $"'{entity.Label}' cannot be switched off. An account cannot be created or " +
                "signed in to without it.");
        }

        entity.Status = next;
        await db.SaveChangesAsync(ct);
        return Map(entity);
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var entity = await db.SignupFields.FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("Sign-up field");

        if (entity.IsBuiltIn)
        {
            throw AppException.Conflict(
                $"'{entity.Label}' is built into the applicant record and cannot be removed. " +
                "Switch it off instead.");
        }

        /* Answers already given are kept. Removing the question does not make
           what people answered untrue, and a reinstated field should find its
           history where it left it. */
        db.SignupFields.Remove(entity);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Reorders in one call, so a drag never leaves a half-applied order.</summary>
    public async Task<List<SignupFieldDto>> ReorderAsync(
        int? subCategoryId, List<int> orderedIds, CancellationToken ct)
    {
        /* One form at a time. Renumbering every form from one list would give
           the same display order to fields on different sub-categories. */
        var fields = await db.SignupFields.Include(f => f.Options)
            .Where(f => f.SubCategoryId == subCategoryId).ToListAsync(ct);
        var position = 0;

        foreach (var id in orderedIds)
        {
            var field = fields.FirstOrDefault(f => f.Id == id);
            if (field is null) continue;
            field.DisplayOrder = ++position;
        }

        /* Anything the caller did not mention keeps its relative place, after
           everything that was. */
        foreach (var field in fields.Where(f => !orderedIds.Contains(f.Id)).OrderBy(f => f.DisplayOrder))
        {
            field.DisplayOrder = ++position;
        }

        await db.SaveChangesAsync(ct);
        return await FieldsAsync(subCategoryId, false, ct);
    }

    /* ------------------------------------------------------------- helpers */

    private async Task<SignupField> LoadAsync(int id, CancellationToken ct) =>
        await db.SignupFields.Include(f => f.Options).AsNoTracking()
            .FirstAsync(f => f.Id == id, ct);

    private static string Normalise(string key) =>
        new(key.Trim().Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());

    private static void Validate(SignupFieldUpsertDto dto, string key)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(key)) errors.Add("A key is required.");
        if (string.IsNullOrWhiteSpace(dto.Label)) errors.Add("A label is required.");

        var type = EnumMaps.ParseEnum(dto.Type, FieldType.Text);
        var needsOptions = type is FieldType.Select or FieldType.MultiSelect or FieldType.Radio;

        if (needsOptions && (dto.Options is null || dto.Options.Count == 0))
        {
            errors.Add("A field the applicant chooses from needs at least one option.");
        }

        if (errors.Count > 0) throw new AppException(string.Join(" ", errors));
    }

    private static void Apply(SignupField entity, SignupFieldUpsertDto dto)
    {
        entity.Label = dto.Label.Trim();
        entity.Placeholder = string.IsNullOrWhiteSpace(dto.Placeholder) ? null : dto.Placeholder.Trim();
        entity.HelpText = string.IsNullOrWhiteSpace(dto.HelpText) ? null : dto.HelpText.Trim();
        entity.Required = dto.Required;
        entity.Status = EnumMaps.ToStatus(dto.Status);

        if (dto.DisplayOrder > 0) entity.DisplayOrder = dto.DisplayOrder;

        /* The type of a built-in field is decided by the column behind it. */
        if (!entity.IsBuiltIn) entity.Type = EnumMaps.ParseEnum(dto.Type, FieldType.Text);

        /* A locked field is on, whatever was sent. */
        if (entity.IsLocked) entity.Status = RecordStatus.Active;

        entity.Options.Clear();
        var order = 0;
        foreach (var option in dto.Options ?? [])
        {
            if (string.IsNullOrWhiteSpace(option.Value)) continue;
            entity.Options.Add(new SignupFieldOption
            {
                Value = option.Value.Trim(),
                Label = string.IsNullOrWhiteSpace(option.Label) ? option.Value.Trim() : option.Label.Trim(),
                DisplayOrder = ++order,
            });
        }
    }

    private static SignupFieldDto Map(SignupField f) => new()
    {
        Id = f.Id,
        SubCategoryId = f.SubCategoryId,
        Key = f.Key,
        Label = f.Label,
        Placeholder = f.Placeholder,
        HelpText = f.HelpText,
        /* Lowercase, as the rest of the API renders a field type - the portal
        and the applicant app both key their editors off exactly these. */
        Type = f.Type.ToApi(),
        Required = f.Required,
        DisplayOrder = f.DisplayOrder,
        IsBuiltIn = f.IsBuiltIn,
        IsLocked = f.IsLocked,
        Status = f.Status.ToApi(),
        Options = [.. f.Options.OrderBy(o => o.DisplayOrder)
            .Select(o => new SignupFieldOptionDto { Value = o.Value, Label = o.Label })],
    };
}
