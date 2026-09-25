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

    public async Task<List<SignupFieldDto>> ListAsync(bool activeOnly, CancellationToken ct)
    {
        var query = db.SignupFields.Include(f => f.Options).AsQueryable();
        if (activeOnly) query = query.Where(f => f.Status == RecordStatus.Active);

        var fields = await query
            .OrderBy(f => f.DisplayOrder).ThenBy(f => f.Id)
            .AsNoTracking()
            .ToListAsync(ct);

        return [.. fields.Select(Map)];
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

        if (await db.SignupFields.AnyAsync(f => f.Key == key, ct))
        {
            throw AppException.Conflict($"A field with the key '{key}' already exists.");
        }

        var last = await db.SignupFields.MaxAsync(f => (int?)f.DisplayOrder, ct) ?? 0;

        var entity = new SignupField
        {
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
    public async Task<List<SignupFieldDto>> ReorderAsync(List<int> orderedIds, CancellationToken ct)
    {
        var fields = await db.SignupFields.Include(f => f.Options).ToListAsync(ct);
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
        return await ListAsync(false, ct);
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
