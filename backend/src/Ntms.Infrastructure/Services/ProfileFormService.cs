using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

public class ProfileFormService(NtmsDbContext db)
{
    private IQueryable<ProfileForm> Base => db.ProfileForms.AsNoTracking()
        .Include(f => f.ProgramType)!.ThenInclude(p => p!.Category)
        .Include(f => f.ProgramType)!.ThenInclude(p => p!.SubCategory)
        .Include(f => f.Sections).ThenInclude(s => s.Fields).ThenInclude(x => x.Options);

    public async Task<PagedResult<ProfileFormDto>> ListAsync(
        PagedRequest request, int? categoryId, int? subCategoryId, int? programTypeId,
        string? status, CancellationToken ct)
    {
        /* Category and sub-category are reached through the programme type,
           which is where a form's placement in the masters actually lives. */
        var query = Base
            .WhereIf(categoryId.HasValue, f => f.ProgramType!.CategoryId == categoryId)
            .WhereIf(subCategoryId.HasValue, f => f.ProgramType!.SubCategoryId == subCategoryId)
            .WhereIf(programTypeId.HasValue, f => f.ProgramTypeId == programTypeId)
            .WhereIf(!string.IsNullOrWhiteSpace(status), f => f.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                f => f.ProgramType!.Name.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(ProfileForm))!, f => f.Id);

        return await query.ToPagedResultAsync(request, f => f.ToDto(), ct);
    }

    public async Task<List<ProfileFormDto>> AllAsync(string? status, CancellationToken ct) =>
        [.. (await Base
                .WhereIf(!string.IsNullOrWhiteSpace(status), f => f.Status == EnumMaps.ToStatus(status))
                .ToListAsync(ct))
            .Select(f => f.ToDto())];

    public async Task<ProfileFormDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.FirstOrDefaultAsync(f => f.Id == id, ct)
         ?? throw AppException.NotFound("Profile form")).ToDto();

    /// <summary>The active form a mobile applicant should be shown.</summary>
    public async Task<ProfileFormDto> GetByProgramTypeAsync(int programTypeId, CancellationToken ct)
    {
        var form = await Base
            .Where(f => f.ProgramTypeId == programTypeId && f.Status == RecordStatus.Active)
            .OrderByDescending(f => f.Id)
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Profile form for this program type");
        return form.ToDto();
    }

    public async Task<ProfileFormDto> CreateAsync(ProfileFormUpsertDto dto, CancellationToken ct)
    {
        await GuardAsync(dto.ProgramTypeId, dto.Version, null, ct);
        Validate(dto.Sections);

        var entity = new ProfileForm
        {
            ProgramTypeId = dto.ProgramTypeId,
            Version = dto.Version,
            Status = EnumMaps.ToStatus(dto.Status),
        };
        BuildSections(entity, dto.Sections);

        db.ProfileForms.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<ProfileFormDto> UpdateAsync(
        int id, ProfileFormUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.ProfileForms
            .Include(f => f.Sections).ThenInclude(s => s.Fields).ThenInclude(x => x.Options)
            .FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("Profile form");

        await GuardAsync(dto.ProgramTypeId, dto.Version, id, ct);
        Validate(dto.Sections);

        entity.ProgramTypeId = dto.ProgramTypeId;
        entity.Version = dto.Version;
        entity.Status = EnumMaps.ToStatus(dto.Status);

        /* The designer always posts the whole tree, so the simplest correct
           behaviour is to rebuild it. Submitted applications keep their own
           copy of the answers, so nothing historical is lost. */
        db.ProfileSections.RemoveRange(entity.Sections);
        entity.Sections.Clear();
        BuildSections(entity, dto.Sections);

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<ProfileFormDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.ProfileForms.FirstOrDefaultAsync(f => f.Id == id, ct)
                     ?? throw AppException.NotFound("Profile form");
        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>Copies a finished form onto another program type.</summary>
    public async Task<ProfileFormDto> ReplicateAsync(ReplicateFormDto dto, CancellationToken ct)
    {
        var source = await Base.FirstOrDefaultAsync(f => f.Id == dto.SourceFormId, ct)
                     ?? throw AppException.NotFound("Source profile form");

        if (source.ProgramTypeId == dto.TargetProgramTypeId)
            throw new AppException("Pick a different program type to replicate onto.");

        await GuardAsync(dto.TargetProgramTypeId, dto.Version, null, ct);

        var copy = new ProfileForm
        {
            ProgramTypeId = dto.TargetProgramTypeId,
            Version = dto.Version,
            Status = RecordStatus.Active,
        };

        foreach (var section in source.Sections.OrderBy(s => s.DisplayOrder))
        {
            var newSection = new ProfileSection
            {
                Key = section.Key,
                Title = section.Title,
                Description = section.Description,
                DisplayOrder = section.DisplayOrder,
                IsEnabled = section.IsEnabled,
                IsRepeatable = section.IsRepeatable,
                MinEntries = section.MinEntries,
                MaxEntries = section.MaxEntries,
                ItemLabel = section.ItemLabel,
            };

            foreach (var field in section.Fields.OrderBy(f => f.DisplayOrder))
            {
                var newField = new ProfileField
                {
                    Key = field.Key,
                    Label = field.Label,
                    Type = field.Type,
                    IsEnabled = field.IsEnabled,
                    Placeholder = field.Placeholder,
                    HelpText = field.HelpText,
                    DisplayOrder = field.DisplayOrder,
                    ColSpan = field.ColSpan,
                    VisibleWhenFieldKey = field.VisibleWhenFieldKey,
                    VisibleWhenValues = field.VisibleWhenValues,
                    Validation = new FieldValidation
                    {
                        Required = field.Validation.Required,
                        MinLength = field.Validation.MinLength,
                        MaxLength = field.Validation.MaxLength,
                        Min = field.Validation.Min,
                        Max = field.Validation.Max,
                        Pattern = field.Validation.Pattern,
                        AllowedExtensions = field.Validation.AllowedExtensions,
                        MaxFileSizeMb = field.Validation.MaxFileSizeMb,
                    },
                };

                foreach (var option in field.Options.OrderBy(o => o.DisplayOrder))
                {
                    newField.Options.Add(new ProfileFieldOption
                    {
                        Value = option.Value,
                        Label = option.Label,
                        DisplayOrder = option.DisplayOrder,
                    });
                }

                newSection.Fields.Add(newField);
            }

            copy.Sections.Add(newSection);
        }

        db.ProfileForms.Add(copy);
        await db.SaveChangesAsync(ct);
        return await GetAsync(copy.Id, ct);
    }

    /* ------------------------------------------------------------ helpers */

    private async Task GuardAsync(int programTypeId, string version, int? exceptId, CancellationToken ct)
    {
        if (!await db.ProgramTypes.AnyAsync(p => p.Id == programTypeId, ct))
            throw AppException.NotFound("Program type");

        var clash = await db.ProfileForms.AnyAsync(
            f => f.ProgramTypeId == programTypeId && f.Version == version
                 && (exceptId == null || f.Id != exceptId), ct);
        if (clash)
            throw AppException.Conflict(
                $"Version '{version}' already exists for this program type.");
    }

    private static void Validate(List<ProfileSectionDto> sections)
    {
        if (sections.Count == 0)
            throw new AppException("A profile form needs at least one section.");

        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var field in sections.SelectMany(s => s.Fields))
        {
            if (string.IsNullOrWhiteSpace(field.Key) || string.IsNullOrWhiteSpace(field.Label))
                throw new AppException("Every field needs a key and a label.");

            if (!keys.Add(field.Key.Trim()))
                throw new AppException($"Field key '{field.Key}' is used more than once.");
        }

        ValidateRepeats(sections, keys);

        /* Which section each field sits in, so a condition can be checked
           against where its trigger lives as well as whether it exists. */
        var sectionOfField = sections
            .SelectMany(s => s.Fields.Select(f => (Field: f.Key.Trim(), Section: s)))
            .ToDictionary(x => x.Field, x => x.Section, StringComparer.OrdinalIgnoreCase);

        foreach (var section in sections)
        {
            foreach (var field in section.Fields
                         .Where(f => !string.IsNullOrWhiteSpace(f.VisibleWhenFieldKey)))
            {
                var trigger = field.VisibleWhenFieldKey!.Trim();

                /* A conditional field must point at a key that actually exists. */
                if (!sectionOfField.TryGetValue(trigger, out var triggerSection))
                {
                    throw new AppException(
                        $"Field '{field.Key}' depends on '{trigger}', which does not exist.");
                }

                /* A repeating section is answered once per entry, so a trigger
                   inside one has as many answers as there are entries and no
                   single value to test from outside it. Within the same
                   section the entry supplies the answer, which is fine. */
                if (triggerSection.IsRepeatable && !ReferenceEquals(triggerSection, section))
                {
                    throw new AppException(
                        $"Field '{field.Key}' depends on '{trigger}', which is in the repeating " +
                        $"section '{triggerSection.Title}'. A field can only depend on a repeating " +
                        "section from inside the same section.");
                }
            }
        }
    }

    /// <summary>
    /// A repeating section is stored as an array under its own key, so that
    /// key has to be usable: present, unique, and not already taken by a
    /// field, whose answers sit at the top level beside it.
    /// </summary>
    private static void ValidateRepeats(
        List<ProfileSectionDto> sections, HashSet<string> fieldKeys)
    {
        var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        /* Same order as BuildSections, so the key checked here is the key
           that ends up stored — the suffix a clash gets depends on which
           section is reached first. */
        foreach (var section in sections.OrderBy(s => s.DisplayOrder))
        {
            if (string.IsNullOrWhiteSpace(section.Title))
                throw new AppException("Every section needs a title.");

            var key = SectionKey(section, used);

            if (!section.IsRepeatable) continue;

            if (section.Fields.Count == 0)
            {
                throw new AppException(
                    $"'{section.Title}' repeats but has no fields. There would be nothing to add.");
            }

            if (fieldKeys.Contains(key))
            {
                throw new AppException(
                    $"'{section.Title}' repeats, so its answers are stored under '{key}' — " +
                    "which is already a field key. Rename one of them.");
            }

            if (section.MinEntries < 0 || section.MinEntries > MaxRepeatCeiling)
                throw new AppException($"'{section.Title}': the smallest number of entries must be between 0 and {MaxRepeatCeiling}.");

            if (section.MaxEntries < 1 || section.MaxEntries > MaxRepeatCeiling)
                throw new AppException($"'{section.Title}': the largest number of entries must be between 1 and {MaxRepeatCeiling}.");

            if (section.MinEntries > section.MaxEntries)
                throw new AppException($"'{section.Title}': the smallest number of entries cannot be more than the largest.");
        }
    }

    /// <summary>The most entries a section may ever be allowed to take.</summary>
    private const int MaxRepeatCeiling = 50;

    /// <summary>
    /// The key a section's answers are stored under, unique within the form.
    ///
    /// A repeating section keeps the key it was saved with, because answers
    /// already sit under it and a retitled section must not lose them. Any
    /// other section is keyed from its title afresh each save: nothing is
    /// stored under it, so it may as well read like the section it names.
    /// </summary>
    private static string SectionKey(ProfileSectionDto section, HashSet<string> used)
    {
        var stem = section.IsRepeatable && !string.IsNullOrWhiteSpace(section.Key)
            ? CamelKey(section.Key)
            : CamelKey(section.Title);

        var candidate = stem;
        for (var suffix = 2; !used.Add(candidate); suffix++) candidate = $"{stem}{suffix}";
        return candidate;
    }

    /// <summary>"Educational qualification" becomes educationalQualification.</summary>
    private static string CamelKey(string text)
    {
        var words = new string([.. text.Select(c => char.IsAsciiLetterOrDigit(c) ? c : ' ')])
            .Split(' ', StringSplitOptions.RemoveEmptyEntries);

        if (words.Length == 0) return "section";

        var key = string.Concat(words.Select((word, index) => index == 0
            ? word.ToLowerInvariant()
            : char.ToUpperInvariant(word[0]) + word[1..].ToLowerInvariant()));

        /* A key that starts with a digit is legal JSON but reads as a mistake
           everywhere else it is shown. */
        if (char.IsAsciiDigit(key[0])) key = "s" + key;
        return key.Length <= 80 ? key : key[..80];
    }

    private static void BuildSections(ProfileForm form, List<ProfileSectionDto> sections)
    {
        var usedSectionKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var sectionOrder = 0;
        foreach (var sectionDto in sections.OrderBy(s => s.DisplayOrder))
        {
            sectionOrder++;
            var section = new ProfileSection
            {
                Key = SectionKey(sectionDto, usedSectionKeys),
                Title = sectionDto.Title.Trim(),
                Description = sectionDto.Description,
                DisplayOrder = sectionOrder,
                IsEnabled = sectionDto.IsEnabled,
                IsRepeatable = sectionDto.IsRepeatable,
                MinEntries = sectionDto.IsRepeatable ? sectionDto.MinEntries : 1,
                MaxEntries = sectionDto.IsRepeatable ? sectionDto.MaxEntries : 1,
                ItemLabel = string.IsNullOrWhiteSpace(sectionDto.ItemLabel)
                    ? null
                    : sectionDto.ItemLabel.Trim(),
            };

            var fieldOrder = 0;
            foreach (var fieldDto in sectionDto.Fields.OrderBy(f => f.DisplayOrder))
            {
                fieldOrder++;
                var field = new ProfileField
                {
                    Key = fieldDto.Key.Trim(),
                    Label = fieldDto.Label.Trim(),
                    Type = EnumMaps.ParseEnum(fieldDto.Type, FieldType.Text),
                    IsEnabled = fieldDto.IsEnabled,
                    Placeholder = fieldDto.Placeholder,
                    HelpText = fieldDto.HelpText,
                    DisplayOrder = fieldOrder,
                    ColSpan = fieldDto.ColSpan == 2 ? 2 : 1,
                    VisibleWhenFieldKey = string.IsNullOrWhiteSpace(fieldDto.VisibleWhenFieldKey)
                        ? null
                        : fieldDto.VisibleWhenFieldKey.Trim(),
                    VisibleWhenValues = EnumMaps.JoinList(fieldDto.VisibleWhenValues),
                    Validation = new FieldValidation
                    {
                        Required = fieldDto.Validation.Required,
                        MinLength = fieldDto.Validation.MinLength,
                        MaxLength = fieldDto.Validation.MaxLength,
                        Min = fieldDto.Validation.Min,
                        Max = fieldDto.Validation.Max,
                        Pattern = fieldDto.Validation.Pattern,
                        AllowedExtensions = EnumMaps.JoinList(fieldDto.Validation.AllowedExtensions),
                        MaxFileSizeMb = fieldDto.Validation.MaxFileSizeMb,
                    },
                };

                var optionOrder = 0;
                foreach (var option in fieldDto.Options)
                {
                    optionOrder++;
                    field.Options.Add(new ProfileFieldOption
                    {
                        Value = string.IsNullOrWhiteSpace(option.Value)
                            ? Slug(option.Label)
                            : option.Value.Trim(),
                        Label = option.Label.Trim(),
                        DisplayOrder = optionOrder,
                    });
                }

                section.Fields.Add(field);
            }

            form.Sections.Add(section);
        }
    }

    private static string Slug(string label) =>
        string.Join('-', label.ToLowerInvariant()
            .Split([' ', '/', '\\', ',', '(', ')', '.'], StringSplitOptions.RemoveEmptyEntries));
}
