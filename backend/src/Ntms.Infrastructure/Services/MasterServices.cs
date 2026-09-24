using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/* ------------------------------------------------------------- categories */

public class CategoryService(NtmsDbContext db)
{
    public async Task<PagedResult<CategoryDto>> ListAsync(
        PagedRequest request, string? status, CancellationToken ct)
    {
        var counts = await db.SubCategories
            .GroupBy(s => s.CategoryId)
            .Select(g => new { CategoryId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CategoryId, x => x.Count, ct);

        var query = db.Categories.AsNoTracking()
            .WhereIf(!string.IsNullOrWhiteSpace(status),
                c => c.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                c => c.Code.Contains(request.Search!) || c.Name.Contains(request.Search!)
                     || (c.Description != null && c.Description.Contains(request.Search!)))
            .ApplySort(request, db.Model.FindEntityType(typeof(Category))!, c => c.DisplayOrder);

        return await query.ToPagedResultAsync(
            request, c => c.ToDto(counts.GetValueOrDefault(c.Id)), ct);
    }

    public async Task<List<CategoryDto>> AllAsync(string? status, CancellationToken ct) =>
        [.. (await db.Categories.AsNoTracking()
                .WhereIf(!string.IsNullOrWhiteSpace(status), c => c.Status == EnumMaps.ToStatus(status))
                .OrderBy(c => c.DisplayOrder).ToListAsync(ct))
            .Select(c => c.ToDto())];

    public async Task<CategoryDto> GetAsync(int id, CancellationToken ct)
    {
        var entity = await db.Categories.AsNoTracking().FirstOrDefaultAsync(c => c.Id == id, ct)
                     ?? throw AppException.NotFound("Category");
        var count = await db.SubCategories.CountAsync(s => s.CategoryId == id, ct);
        return entity.ToDto(count);
    }

    public async Task<CategoryDto> CreateAsync(CategoryUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);
        var code = await ResolveCodeAsync(dto, null, ct);
        await GuardCodeAsync(code, null, ct);

        var entity = new Category
        {
            Code = code,
            Name = dto.Name.Trim(),
            Description = dto.Description,
            DisplayOrder = dto.DisplayOrder,
            Status = EnumMaps.ToStatus(dto.Status),
        };
        db.Categories.Add(entity);
        await db.SaveChangesAsync(ct);
        return entity.ToDto();
    }

    public async Task<CategoryDto> UpdateAsync(int id, CategoryUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
                     ?? throw AppException.NotFound("Category");

        Validate(dto);
        /* An existing code is kept when the field comes back blank, so clearing
           it by accident cannot silently renumber a live category. */
        var code = Formats.Normalise(dto.Code) is { Length: > 0 } typed ? typed : entity.Code;
        await GuardCodeAsync(code, id, ct);

        entity.Code = code;
        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description;
        entity.DisplayOrder = dto.DisplayOrder;
        entity.Status = EnumMaps.ToStatus(dto.Status);

        await db.SaveChangesAsync(ct);
        return entity.ToDto();
    }

    public async Task<CategoryDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
                     ?? throw AppException.NotFound("Category");
        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return entity.ToDto();
    }

    private async Task GuardCodeAsync(string code, int? exceptId, CancellationToken ct)
    {
        var clash = await db.Categories.AnyAsync(
            c => c.Code == code && (exceptId == null || c.Id != exceptId), ct);
        if (clash) throw AppException.Conflict($"Category code '{code}' is already in use.");
    }

    private static void Validate(CategoryUpsertDto dto) =>
        Guard.Check()
            .CodeIfPresent(dto.Code, "Category code")
            .Required(dto.Name, "Name")
            .ThrowIfInvalid();

    /// <summary>Uses what was typed, or derives one from the name.</summary>
    private async Task<string> ResolveCodeAsync(
        CategoryUpsertDto dto, int? exceptId, CancellationToken ct)
    {
        if (Formats.Normalise(dto.Code) is { Length: > 0 } typed) return typed;

        return await CodeFactory.UniqueAsync(
            CodeFactory.Abbreviate(dto.Name),
            (candidate, token) => db.Categories.AnyAsync(
                c => c.Code == candidate && (exceptId == null || c.Id != exceptId), token),
            ct);
    }
}

/* ---------------------------------------------------------- sub-categories */

public class SubCategoryService(NtmsDbContext db)
{
    private IQueryable<SubCategory> Base => db.SubCategories.AsNoTracking().Include(s => s.Category);

    public async Task<PagedResult<SubCategoryDto>> ListAsync(
        PagedRequest request, int? categoryId, string? status, CancellationToken ct)
    {
        var query = Base
            .WhereIf(categoryId.HasValue, s => s.CategoryId == categoryId)
            .WhereIf(!string.IsNullOrWhiteSpace(status), s => s.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                s => s.Code.Contains(request.Search!) || s.Name.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(SubCategory))!, s => s.DisplayOrder);

        return await query.ToPagedResultAsync(request, s => s.ToDto(), ct);
    }

    public async Task<List<SubCategoryDto>> AllAsync(int? categoryId, string? status, CancellationToken ct) =>
        [.. (await Base
                .WhereIf(categoryId.HasValue, s => s.CategoryId == categoryId)
                .WhereIf(!string.IsNullOrWhiteSpace(status), s => s.Status == EnumMaps.ToStatus(status))
                .OrderBy(s => s.DisplayOrder).ToListAsync(ct))
            .Select(s => s.ToDto())];

    public async Task<SubCategoryDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.FirstOrDefaultAsync(s => s.Id == id, ct)
         ?? throw AppException.NotFound("Sub-category")).ToDto();

    public async Task<SubCategoryDto> CreateAsync(SubCategoryUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);
        var code = await ResolveCodeAsync(dto, null, ct);
        await GuardAsync(dto.CategoryId, code, null, ct);

        var entity = new SubCategory
        {
            CategoryId = dto.CategoryId,
            Code = code,
            Name = dto.Name.Trim(),
            Description = dto.Description,
            DisplayOrder = dto.DisplayOrder,
            Status = EnumMaps.ToStatus(dto.Status),
        };
        db.SubCategories.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<SubCategoryDto> UpdateAsync(int id, SubCategoryUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.SubCategories.FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw AppException.NotFound("Sub-category");
        Validate(dto);
        /* Blank on edit means "leave it alone", not "wipe it". */
        var code = Formats.Normalise(dto.Code) is { Length: > 0 } typed ? typed : entity.Code;
        await GuardAsync(dto.CategoryId, code, id, ct);

        entity.CategoryId = dto.CategoryId;
        entity.Code = code;
        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description;
        entity.DisplayOrder = dto.DisplayOrder;
        entity.Status = EnumMaps.ToStatus(dto.Status);

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<SubCategoryDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.SubCategories.FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw AppException.NotFound("Sub-category");
        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    private static void Validate(SubCategoryUpsertDto dto) =>
        Guard.Check()
            .CodeIfPresent(dto.Code, "Sub-category code")
            .Required(dto.Name, "Name")
            .ThrowIfInvalid();

    /// <summary>
    /// Uses what was typed, or builds one under the parent category — so
    /// "Bronze" under ZED Certification becomes ZED-BRO.
    /// </summary>
    private async Task<string> ResolveCodeAsync(
        SubCategoryUpsertDto dto, int? exceptId, CancellationToken ct)
    {
        if (Formats.Normalise(dto.Code) is { Length: > 0 } typed) return typed;

        var parentCode = await db.Categories.AsNoTracking()
            .Where(c => c.Id == dto.CategoryId).Select(c => c.Code).FirstOrDefaultAsync(ct);

        return await CodeFactory.UniqueAsync(
            CodeFactory.Compose(parentCode, CodeFactory.Abbreviate(dto.Name)),
            (candidate, token) => db.SubCategories.AnyAsync(
                s => s.Code == candidate && (exceptId == null || s.Id != exceptId), token),
            ct);
    }

    private async Task GuardAsync(int categoryId, string code, int? exceptId, CancellationToken ct)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == categoryId, ct))
            throw AppException.NotFound("Category");

        var clash = await db.SubCategories.AnyAsync(
            s => s.Code == code && (exceptId == null || s.Id != exceptId), ct);
        if (clash) throw AppException.Conflict($"Sub-category code '{code}' is already in use.");
    }
}

/* ----------------------------------------------------------- program types */

public class ProgramTypeService(NtmsDbContext db)
{
    private IQueryable<ProgramType> Base =>
        db.ProgramTypes.AsNoTracking().Include(p => p.Category).Include(p => p.SubCategory);

    public async Task<PagedResult<ProgramTypeDto>> ListAsync(
        PagedRequest request, int? categoryId, int? subCategoryId,
        string? deliveryMode, string? status, CancellationToken ct)
    {
        var mode = EnumMaps.ParseEnumOrNull<DeliveryMode>(deliveryMode);

        var query = Base
            .WhereIf(categoryId.HasValue, p => p.CategoryId == categoryId)
            .WhereIf(subCategoryId.HasValue, p => p.SubCategoryId == subCategoryId)
            .WhereIf(mode.HasValue, p => p.DeliveryMode == mode)
            .WhereIf(!string.IsNullOrWhiteSpace(status), p => p.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                p => p.Code.Contains(request.Search!) || p.Name.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(ProgramType))!, p => p.Code);

        return await query.ToPagedResultAsync(request, p => p.ToDto(), ct);
    }

    public async Task<List<ProgramTypeDto>> AllAsync(
        int? categoryId, int? subCategoryId, string? status, CancellationToken ct) =>
        [.. (await Base
                .WhereIf(categoryId.HasValue, p => p.CategoryId == categoryId)
                .WhereIf(subCategoryId.HasValue, p => p.SubCategoryId == subCategoryId)
                .WhereIf(!string.IsNullOrWhiteSpace(status), p => p.Status == EnumMaps.ToStatus(status))
                .OrderBy(p => p.Code).ToListAsync(ct))
            .Select(p => p.ToDto())];

    public async Task<ProgramTypeDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.FirstOrDefaultAsync(p => p.Id == id, ct)
         ?? throw AppException.NotFound("Program type")).ToDto();

    public async Task<ProgramTypeDto> CreateAsync(ProgramTypeUpsertDto dto, CancellationToken ct)
    {
        var code = await ResolveCodeAsync(dto, null, ct);
        await GuardAsync(dto, code, null, ct);

        var entity = new ProgramType();
        Apply(entity, dto, code);
        db.ProgramTypes.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<ProgramTypeDto> UpdateAsync(int id, ProgramTypeUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.ProgramTypes.FirstOrDefaultAsync(p => p.Id == id, ct)
                     ?? throw AppException.NotFound("Program type");
        /* Blank on edit means "leave it alone", not "wipe it". */
        var code = Formats.Normalise(dto.Code) is { Length: > 0 } typed ? typed : entity.Code;
        await GuardAsync(dto, code, id, ct);

        Apply(entity, dto, code);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<ProgramTypeDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.ProgramTypes.FirstOrDefaultAsync(p => p.Id == id, ct)
                     ?? throw AppException.NotFound("Program type");
        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    private static void Apply(ProgramType entity, ProgramTypeUpsertDto dto, string code)
    {
        entity.CategoryId = dto.CategoryId;
        entity.SubCategoryId = dto.SubCategoryId;
        entity.Code = code;
        entity.Name = dto.Name.Trim();
        entity.ShortDescription = dto.ShortDescription;
        entity.DurationDays = dto.DurationDays;
        entity.DeliveryMode = EnumMaps.ParseEnum(dto.DeliveryMode, DeliveryMode.Physical);
        entity.MinQualification = QualificationLevels.Normalise(dto.MinQualification);
        entity.MinExperienceYears = dto.MinExperienceYears;
        entity.CertificateValidityMonths = dto.CertificateValidityMonths;
        entity.IsExamMandatory = dto.IsExamMandatory;
        entity.IsFeeApplicable = dto.IsFeeApplicable;
        entity.Status = EnumMaps.ToStatus(dto.Status);
    }

    /// <summary>
    /// Uses what was typed, or builds one under the parent sub-category.
    /// </summary>
    private async Task<string> ResolveCodeAsync(
        ProgramTypeUpsertDto dto, int? exceptId, CancellationToken ct)
    {
        if (Formats.Normalise(dto.Code) is { Length: > 0 } typed) return typed;

        var parentCode = await db.SubCategories.AsNoTracking()
            .Where(s => s.Id == dto.SubCategoryId).Select(s => s.Code).FirstOrDefaultAsync(ct);

        return await CodeFactory.UniqueAsync(
            CodeFactory.Compose(parentCode, CodeFactory.Abbreviate(dto.Name)),
            (candidate, token) => db.ProgramTypes.AnyAsync(
                p => p.Code == candidate && (exceptId == null || p.Id != exceptId), token),
            ct);
    }

    private async Task GuardAsync(ProgramTypeUpsertDto dto, string code, int? exceptId, CancellationToken ct)
    {
        Guard.Check()
            .CodeIfPresent(dto.Code, "Program type code")
            .Required(dto.Name, "Name")
            .When(!QualificationLevels.IsValid(dto.MinQualification),
                "Select a minimum educational qualification from the list.")
            .Range(dto.DurationDays, 1, 365, "Duration (days)")
            .Range(dto.MinExperienceYears, 0, 60, "Minimum experience")
            .Range(dto.CertificateValidityMonths, 1, 240, "Certificate validity")
            .ThrowIfInvalid();

        var sub = await db.SubCategories.FirstOrDefaultAsync(s => s.Id == dto.SubCategoryId, ct)
                  ?? throw AppException.NotFound("Sub-category");
        if (sub.CategoryId != dto.CategoryId)
            throw new AppException("The sub-category does not belong to the selected category.");

        var clash = await db.ProgramTypes.AnyAsync(
            p => p.Code == code && (exceptId == null || p.Id != exceptId), ct);
        if (clash) throw AppException.Conflict($"Program type code '{code}' is already in use.");
    }
}
