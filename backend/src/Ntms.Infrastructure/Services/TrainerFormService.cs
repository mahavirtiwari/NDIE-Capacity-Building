using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// The form a coordinator fills in to register a trainer.
///
/// Set up here and rendered by the app, rather than built into the app.
/// Before this the questions were markup in the coordinator build: adding
/// one meant a release and a hundred handsets updating, and the scheme had
/// no way to ask its faculty anything it had not thought of a year ago.
///
/// Built-in fields map to columns on <see cref="ProgrammeTrainer"/> and are
/// read by key when a trainer is registered. Anything added here is a
/// custom question, kept as a <see cref="TrainerAnswer"/> against the
/// trainer it was asked about.
/// </summary>
public class TrainerFormService(NtmsDbContext db)
{
    /// <summary>
    /// The built-in fields, by key, with whether they may be switched off.
    ///
    /// These names are the contract between this form and the registration
    /// code: a key not in this list cannot be built in, and one in it is
    /// written to the column of the same name.
    ///
    /// Two are locked. A trainer with no name is not a record anybody can
    /// read, and the mobile number is what the same person is recognised
    /// by across an agency's batches — switch it off and every programme
    /// registers the same trainer again as somebody new.
    /// </summary>
    private static readonly IReadOnlyDictionary<string, bool> BuiltIn =
        new Dictionary<string, bool>
        {
            ["fullName"] = true,
            ["mobile"] = true,
            ["email"] = false,
            ["qualification"] = false,
            ["qualificationDetails"] = false,
            ["experience"] = false,
            ["aadhaar"] = false,
            ["photo"] = false,
            ["idProof"] = false,
        };

    /// <summary>
    /// The shipped form, written on first read.
    ///
    /// The app asked these questions before anybody could configure them,
    /// so an empty table would be a form that lost fields the moment the
    /// feature arrived. The defaults are what the screen already had.
    /// </summary>
    private static readonly IReadOnlyList<TrainerField> Shipped =
    [
        new() { Key = "fullName", Label = "Full name", Type = FieldType.Text, Required = true,
                Placeholder = "As it should appear on the record" },
        new() { Key = "mobile", Label = "Mobile", Type = FieldType.Mobile, Required = true,
                Placeholder = "Enter mobile number" },
        new() { Key = "email", Label = "Email", Type = FieldType.Email, Required = false,
                Placeholder = "Enter email address" },
        new() { Key = "qualification", Label = "Qualification", Type = FieldType.Select,
                Required = false, HelpText = "The highest the trainer holds." },
        new() { Key = "qualificationDetails", Label = "Qualification details",
                Type = FieldType.Text, Required = false,
                Placeholder = "Subject, institution and year" },
        new() { Key = "experience", Label = "Experience", Type = FieldType.Duration,
                Required = false, HelpText = "Years and months in the field." },
        new() { Key = "aadhaar", Label = "Aadhaar", Type = FieldType.Aadhaar, Required = false },
        new() { Key = "photo", Label = "Trainer photo", Type = FieldType.Photos, Required = false,
                HelpText = "Taken with the camera on the day." },
        new() { Key = "idProof", Label = "ID proof", Type = FieldType.Photos, Required = false,
                HelpText = "A photograph of the document, not a file." },
    ];

    public async Task<TrainerFormDto> FormAsync(bool activeOnly, CancellationToken ct) =>
        new() { Fields = await FieldsAsync(activeOnly, ct) };

    public Task<List<TrainerFieldDto>> ListAsync(bool activeOnly, CancellationToken ct) =>
        FieldsAsync(activeOnly, ct);

    private async Task<List<TrainerFieldDto>> FieldsAsync(bool activeOnly, CancellationToken ct)
    {
        await EnsureShippedAsync(ct);

        var query = db.TrainerFields.Include(f => f.Options).AsQueryable();
        if (activeOnly) query = query.Where(f => f.Status == RecordStatus.Active);

        var fields = await query
            .OrderBy(f => f.DisplayOrder).ThenBy(f => f.Id)
            .AsNoTracking()
            .ToListAsync(ct);

        return [.. fields.Select(Map)];
    }

    /// <summary>
    /// Writes the shipped form the first time anybody looks at it, and adds
    /// any built-in field a later release introduces. Never touches a field
    /// that is already there: the labels and the order are the office's.
    /// </summary>
    private async Task EnsureShippedAsync(CancellationToken ct)
    {
        var held = await db.TrainerFields.Select(f => f.Key).ToListAsync(ct);
        var missing = Shipped.Where(f => !held.Contains(f.Key)).ToList();
        if (missing.Count == 0) return;

        var order = await db.TrainerFields.MaxAsync(f => (int?)f.DisplayOrder, ct) ?? 0;

        foreach (var field in missing)
        {
            db.TrainerFields.Add(new TrainerField
            {
                Key = field.Key,
                Label = field.Label,
                Placeholder = field.Placeholder,
                HelpText = field.HelpText,
                Type = field.Type,
                Required = field.Required,
                DisplayOrder = ++order,
                IsBuiltIn = true,
                IsLocked = BuiltIn[field.Key],
                Status = RecordStatus.Active,
            });
        }

        await db.SaveChangesAsync(ct);
    }

    public async Task<TrainerFieldDto> CreateAsync(TrainerFieldUpsertDto dto, CancellationToken ct)
    {
        await EnsureShippedAsync(ct);

        var key = Normalise(dto.Key);
        Validate(dto, key);

        if (BuiltIn.ContainsKey(key))
        {
            throw AppException.Conflict(
                $"'{key}' is a built-in field. It is already on the form and can be edited there.");
        }

        if (await db.TrainerFields.AnyAsync(f => f.Key == key, ct))
            throw AppException.Conflict($"A field with the key '{key}' already exists on the form.");

        var last = await db.TrainerFields.MaxAsync(f => (int?)f.DisplayOrder, ct) ?? 0;

        var entity = new TrainerField
        {
            Key = key,
            IsBuiltIn = false,
            IsLocked = false,
            DisplayOrder = dto.DisplayOrder > 0 ? dto.DisplayOrder : last + 1,
        };

        Apply(entity, dto);
        db.TrainerFields.Add(entity);
        await db.SaveChangesAsync(ct);

        return Map(await LoadAsync(entity.Id, ct));
    }

    public async Task<TrainerFieldDto> UpdateAsync(
        int id, TrainerFieldUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.TrainerFields.Include(f => f.Options)
            .FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("Trainer field");

        /* The key is how a registration finds the answer. Renaming it would
           orphan everything already recorded against the old one, so it is
           fixed once the field exists — custom fields included. */
        Validate(dto, entity.Key);
        Apply(entity, dto);

        await db.SaveChangesAsync(ct);
        return Map(await LoadAsync(id, ct));
    }

    public async Task<TrainerFieldDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.TrainerFields.Include(f => f.Options)
            .FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("Trainer field");

        var next = EnumMaps.ToStatus(status);

        if (next == RecordStatus.Inactive && entity.IsLocked)
        {
            throw AppException.Conflict(
                $"'{entity.Label}' cannot be switched off. A trainer cannot be registered or "
                + "recognised across batches without it.");
        }

        entity.Status = next;
        await db.SaveChangesAsync(ct);
        return Map(entity);
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var entity = await db.TrainerFields.FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("Trainer field");

        if (entity.IsBuiltIn)
        {
            throw AppException.Conflict(
                $"'{entity.Label}' is built into the trainer record and cannot be removed. "
                + "Switch it off instead.");
        }

        /* Answers already given are kept. Removing the question does not
           make what was answered untrue, and a reinstated field should find
           its history where it left it. */
        db.TrainerFields.Remove(entity);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>Reorders in one call, so a drag never leaves a half-applied order.</summary>
    public async Task<List<TrainerFieldDto>> ReorderAsync(List<int> orderedIds, CancellationToken ct)
    {
        var fields = await db.TrainerFields.Include(f => f.Options).ToListAsync(ct);
        var position = 0;

        foreach (var id in orderedIds)
        {
            var field = fields.FirstOrDefault(f => f.Id == id);
            if (field is null) continue;
            field.DisplayOrder = ++position;
        }

        foreach (var field in fields.Where(f => !orderedIds.Contains(f.Id))
                     .OrderBy(f => f.DisplayOrder))
        {
            field.DisplayOrder = ++position;
        }

        await db.SaveChangesAsync(ct);
        return await FieldsAsync(false, ct);
    }

    /* ------------------------------------------------------------- helpers */

    private async Task<TrainerField> LoadAsync(int id, CancellationToken ct) =>
        await db.TrainerFields.Include(f => f.Options).AsNoTracking()
            .FirstAsync(f => f.Id == id, ct);

    private static string Normalise(string key) =>
        new(key.Trim().Where(c => char.IsLetterOrDigit(c) || c == '_').ToArray());

    private static void Validate(TrainerFieldUpsertDto dto, string key)
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(key)) errors.Add("A key is required.");
        if (string.IsNullOrWhiteSpace(dto.Label)) errors.Add("A label is required.");

        var type = EnumMaps.ParseEnum(dto.Type, FieldType.Text);
        var needsOptions = type is FieldType.Select or FieldType.MultiSelect or FieldType.Radio;

        if (needsOptions && (dto.Options is null || dto.Options.Count == 0))
            errors.Add("A field the coordinator chooses from needs at least one option.");

        if (errors.Count > 0) throw new AppException(string.Join(" ", errors));
    }

    private static void Apply(TrainerField entity, TrainerFieldUpsertDto dto)
    {
        entity.Label = dto.Label.Trim();
        entity.Placeholder = string.IsNullOrWhiteSpace(dto.Placeholder)
            ? null : dto.Placeholder.Trim();
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
            entity.Options.Add(new TrainerFieldOption
            {
                Value = option.Value.Trim(),
                Label = string.IsNullOrWhiteSpace(option.Label)
                    ? option.Value.Trim() : option.Label.Trim(),
                DisplayOrder = ++order,
            });
        }
    }

    private static TrainerFieldDto Map(TrainerField f) => new()
    {
        Id = f.Id,
        Key = f.Key,
        Label = f.Label,
        Placeholder = f.Placeholder,
        HelpText = f.HelpText,
        Type = f.Type.ToApi(),
        Required = f.Required,
        DisplayOrder = f.DisplayOrder,
        IsBuiltIn = f.IsBuiltIn,
        IsLocked = f.IsLocked,
        Status = f.Status.ToApi(),
        Options = [.. f.Options.OrderBy(o => o.DisplayOrder)
            .Select(o => new TrainerFieldOptionDto { Value = o.Value, Label = o.Label })],
    };
}
