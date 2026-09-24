using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

public class RegistrationFormService(NtmsDbContext db)
{
    private IQueryable<RegistrationForm> Base => db.RegistrationForms.AsNoTracking()
        .Include(f => f.ProgramType)!.ThenInclude(p => p!.Category)
        .Include(f => f.ProgramType)!.ThenInclude(p => p!.SubCategory)
        .Include(f => f.Sections).ThenInclude(s => s.Fields).ThenInclude(x => x.Options);

    public async Task<PagedResult<RegistrationFormDto>> ListAsync(
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
            .ApplySort(request, db.Model.FindEntityType(typeof(RegistrationForm))!, f => f.Id);

        return await query.ToPagedResultAsync(request, f => f.ToDto(), ct);
    }

    public async Task<List<RegistrationFormDto>> AllAsync(string? status, CancellationToken ct) =>
        [.. (await Base
                .WhereIf(!string.IsNullOrWhiteSpace(status), f => f.Status == EnumMaps.ToStatus(status))
                .ToListAsync(ct))
            .Select(f => f.ToDto())];

    public async Task<RegistrationFormDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.FirstOrDefaultAsync(f => f.Id == id, ct)
         ?? throw AppException.NotFound("Registration form")).ToDto();

    /// <summary>The active form a mobile applicant should be shown.</summary>
    public async Task<RegistrationFormDto> GetByProgramTypeAsync(int programTypeId, CancellationToken ct)
    {
        var form = await Base
            .Where(f => f.ProgramTypeId == programTypeId && f.Status == RecordStatus.Active)
            .OrderByDescending(f => f.Id)
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Registration form for this program type");
        return form.ToDto();
    }

    public async Task<RegistrationFormDto> CreateAsync(RegistrationFormUpsertDto dto, CancellationToken ct)
    {
        await GuardAsync(dto.ProgramTypeId, dto.Version, null, ct);
        Validate(dto.Sections);

        var entity = new RegistrationForm
        {
            ProgramTypeId = dto.ProgramTypeId,
            Version = dto.Version,
            Status = EnumMaps.ToStatus(dto.Status),
        };
        BuildSections(entity, dto.Sections);

        db.RegistrationForms.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<RegistrationFormDto> UpdateAsync(
        int id, RegistrationFormUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.RegistrationForms
            .Include(f => f.Sections).ThenInclude(s => s.Fields).ThenInclude(x => x.Options)
            .FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("Registration form");

        await GuardAsync(dto.ProgramTypeId, dto.Version, id, ct);
        Validate(dto.Sections);

        entity.ProgramTypeId = dto.ProgramTypeId;
        entity.Version = dto.Version;
        entity.Status = EnumMaps.ToStatus(dto.Status);

        /* The designer always posts the whole tree, so the simplest correct
           behaviour is to rebuild it. Submitted applications keep their own
           copy of the answers, so nothing historical is lost. */
        db.RegistrationSections.RemoveRange(entity.Sections);
        entity.Sections.Clear();
        BuildSections(entity, dto.Sections);

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<RegistrationFormDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.RegistrationForms.FirstOrDefaultAsync(f => f.Id == id, ct)
                     ?? throw AppException.NotFound("Registration form");
        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>Copies a finished form onto another program type.</summary>
    public async Task<RegistrationFormDto> ReplicateAsync(ReplicateFormDto dto, CancellationToken ct)
    {
        var source = await Base.FirstOrDefaultAsync(f => f.Id == dto.SourceFormId, ct)
                     ?? throw AppException.NotFound("Source registration form");

        if (source.ProgramTypeId == dto.TargetProgramTypeId)
            throw new AppException("Pick a different program type to replicate onto.");

        await GuardAsync(dto.TargetProgramTypeId, dto.Version, null, ct);

        var copy = new RegistrationForm
        {
            ProgramTypeId = dto.TargetProgramTypeId,
            Version = dto.Version,
            Status = RecordStatus.Active,
        };

        foreach (var section in source.Sections.OrderBy(s => s.DisplayOrder))
        {
            var newSection = new RegistrationSection
            {
                Title = section.Title,
                Description = section.Description,
                DisplayOrder = section.DisplayOrder,
                IsEnabled = section.IsEnabled,
            };

            foreach (var field in section.Fields.OrderBy(f => f.DisplayOrder))
            {
                var newField = new RegistrationField
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
                    newField.Options.Add(new RegistrationFieldOption
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

        db.RegistrationForms.Add(copy);
        await db.SaveChangesAsync(ct);
        return await GetAsync(copy.Id, ct);
    }

    /* ------------------------------------------------------------ helpers */

    private async Task GuardAsync(int programTypeId, string version, int? exceptId, CancellationToken ct)
    {
        if (!await db.ProgramTypes.AnyAsync(p => p.Id == programTypeId, ct))
            throw AppException.NotFound("Program type");

        var clash = await db.RegistrationForms.AnyAsync(
            f => f.ProgramTypeId == programTypeId && f.Version == version
                 && (exceptId == null || f.Id != exceptId), ct);
        if (clash)
            throw AppException.Conflict(
                $"Version '{version}' already exists for this program type.");
    }

    private static void Validate(List<RegistrationSectionDto> sections)
    {
        if (sections.Count == 0)
            throw new AppException("A registration form needs at least one section.");

        var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var field in sections.SelectMany(s => s.Fields))
        {
            if (string.IsNullOrWhiteSpace(field.Key) || string.IsNullOrWhiteSpace(field.Label))
                throw new AppException("Every field needs a key and a label.");

            if (!keys.Add(field.Key.Trim()))
                throw new AppException($"Field key '{field.Key}' is used more than once.");
        }

        /* A conditional field must point at a key that actually exists. */
        foreach (var field in sections.SelectMany(s => s.Fields)
                     .Where(f => !string.IsNullOrWhiteSpace(f.VisibleWhenFieldKey)))
        {
            if (!keys.Contains(field.VisibleWhenFieldKey!.Trim()))
                throw new AppException(
                    $"Field '{field.Key}' depends on '{field.VisibleWhenFieldKey}', which does not exist.");
        }
    }

    private static void BuildSections(RegistrationForm form, List<RegistrationSectionDto> sections)
    {
        var sectionOrder = 0;
        foreach (var sectionDto in sections.OrderBy(s => s.DisplayOrder))
        {
            sectionOrder++;
            var section = new RegistrationSection
            {
                Title = sectionDto.Title.Trim(),
                Description = sectionDto.Description,
                DisplayOrder = sectionOrder,
                IsEnabled = sectionDto.IsEnabled,
            };

            var fieldOrder = 0;
            foreach (var fieldDto in sectionDto.Fields.OrderBy(f => f.DisplayOrder))
            {
                fieldOrder++;
                var field = new RegistrationField
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
                    field.Options.Add(new RegistrationFieldOption
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
