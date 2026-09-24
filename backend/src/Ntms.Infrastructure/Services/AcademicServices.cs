using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/* ------------------------------------------------------------ fee structures */

public class FeeService(NtmsDbContext db)
{
    /// <summary>The only TDS rates the scheme allows an applicant to opt for.</summary>
    private static readonly int[] AllowedTdsRates = [2, 10];

    private IQueryable<FeeStructure> Base => db.FeeStructures.AsNoTracking()
        .Include(f => f.ProgramType)!.ThenInclude(p => p!.Category)
        .Include(f => f.ProgramType)!.ThenInclude(p => p!.SubCategory)
        .Include(f => f.Components)
        .Include(f => f.Concessions);

    public async Task<PagedResult<FeeStructureDto>> ListAsync(
        PagedRequest request, int? categoryId, int? subCategoryId, int? programTypeId,
        string? status, CancellationToken ct)
    {
        /* Reached through the programme type, which is where a fee structure's
           place in the masters lives. */
        var query = Base
            .WhereIf(categoryId.HasValue, f => f.ProgramType!.CategoryId == categoryId)
            .WhereIf(subCategoryId.HasValue, f => f.ProgramType!.SubCategoryId == subCategoryId)
            .WhereIf(programTypeId.HasValue, f => f.ProgramTypeId == programTypeId)
            .WhereIf(!string.IsNullOrWhiteSpace(status), f => f.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                f => f.Title.Contains(request.Search!) || f.ProgramType!.Name.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(FeeStructure))!, f => f.Title);

        return await query.ToPagedResultAsync(request, f => f.ToDto(), ct);
    }

    public async Task<List<FeeStructureDto>> AllAsync(string? status, CancellationToken ct) =>
        [.. (await Base
                .WhereIf(!string.IsNullOrWhiteSpace(status), f => f.Status == EnumMaps.ToStatus(status))
                .OrderBy(f => f.Title).ToListAsync(ct))
            .Select(f => f.ToDto())];

    public async Task<FeeStructureDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.FirstOrDefaultAsync(f => f.Id == id, ct)
         ?? throw AppException.NotFound("Fee structure")).ToDto();

    /// <summary>The fee an applicant will be charged for a program type today.</summary>
    public async Task<FeeStructureDto?> CurrentForProgramTypeAsync(int programTypeId, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var fee = await Base
            .Where(f => f.ProgramTypeId == programTypeId
                        && f.Status == RecordStatus.Active
                        && f.EffectiveFrom <= today
                        && (f.EffectiveTo == null || f.EffectiveTo >= today))
            .OrderByDescending(f => f.EffectiveFrom)
            .FirstOrDefaultAsync(ct);
        return fee?.ToDto();
    }

    public async Task<FeeStructureDto> CreateAsync(FeeStructureUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);
        var entity = new FeeStructure();
        Apply(entity, dto);
        db.FeeStructures.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<FeeStructureDto> UpdateAsync(int id, FeeStructureUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);
        var entity = await db.FeeStructures
            .Include(f => f.Components).Include(f => f.Concessions)
            .FirstOrDefaultAsync(f => f.Id == id, ct)
            ?? throw AppException.NotFound("Fee structure");

        db.FeeComponents.RemoveRange(entity.Components);
        db.FeeConcessions.RemoveRange(entity.Concessions);
        entity.Components.Clear();
        entity.Concessions.Clear();

        Apply(entity, dto);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<FeeStructureDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.FeeStructures.FirstOrDefaultAsync(f => f.Id == id, ct)
                     ?? throw AppException.NotFound("Fee structure");
        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    private static void Validate(FeeStructureUpsertDto dto)
    {
        Guard.Check().Required(dto.Title, "Title").ThrowIfInvalid();

        if (dto.Components.Count == 0)
            throw new AppException("A fee structure needs at least one component.");
        if (dto.Components.Any(c => c.Amount < 0))
            throw new AppException("Fee component amounts cannot be negative.");
        if (dto.GstPercent is < 0 or > 100)
            throw new AppException("GST percentage must be between 0 and 100.");

        var invalid = dto.TdsOptions.Where(r => !AllowedTdsRates.Contains(r)).ToList();
        if (invalid.Count > 0)
            throw new AppException("TDS can only be offered at 2% or 10%.");
    }

    private static void Apply(FeeStructure entity, FeeStructureUpsertDto dto)
    {
        entity.ProgramTypeId = dto.ProgramTypeId;
        entity.Title = dto.Title.Trim();
        entity.Currency = "INR";
        entity.GstPercent = dto.GstPercent;
        entity.TdsOptions = EnumMaps.JoinInts(dto.TdsOptions);
        entity.EffectiveFrom = dto.EffectiveFrom == default
            ? DateOnly.FromDateTime(DateTime.UtcNow)
            : dto.EffectiveFrom;
        entity.EffectiveTo = dto.EffectiveTo;
        entity.Status = EnumMaps.ToStatus(dto.Status);

        foreach (var component in dto.Components)
        {
            entity.Components.Add(new FeeComponent
            {
                Kind = EnumMaps.ParseEnum(component.Kind, FeeComponentKind.Base),
                Label = component.Label.Trim(),
                Amount = component.Amount,
                IsTaxable = component.IsTaxable,
            });
        }

        foreach (var concession in dto.Concessions.Where(c => !string.IsNullOrWhiteSpace(c.Label)))
        {
            entity.Concessions.Add(new FeeConcession
            {
                Label = concession.Label.Trim(),
                Percentage = concession.Percentage,
                Remarks = concession.Remarks,
            });
        }
    }
}

/* --------------------------------------------------------------- exam papers */

public class ExamPaperService(NtmsDbContext db)
{
    private IQueryable<ExamPaper> Base => db.ExamPapers.AsNoTracking()
        .Include(e => e.ProgramType)!.ThenInclude(p => p!.Category)
        .Include(e => e.ProgramType)!.ThenInclude(p => p!.SubCategory)
        .Include(e => e.Questions).ThenInclude(q => q.Options);

    public async Task<PagedResult<ExamPaperDto>> ListAsync(
        PagedRequest request, int? categoryId, int? subCategoryId, int? programTypeId,
        string? status, CancellationToken ct)
    {
        var query = Base
            .WhereIf(categoryId.HasValue, e => e.ProgramType!.CategoryId == categoryId)
            .WhereIf(subCategoryId.HasValue, e => e.ProgramType!.SubCategoryId == subCategoryId)
            .WhereIf(programTypeId.HasValue, e => e.ProgramTypeId == programTypeId)
            .WhereIf(!string.IsNullOrWhiteSpace(status), e => e.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                e => e.Code.Contains(request.Search!) || e.Title.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(ExamPaper))!, e => e.Code);

        return await query.ToPagedResultAsync(request, e => e.ToDto(), ct);
    }

    public async Task<List<ExamPaperDto>> AllAsync(string? status, CancellationToken ct) =>
        [.. (await Base
                .WhereIf(!string.IsNullOrWhiteSpace(status), e => e.Status == EnumMaps.ToStatus(status))
                .OrderBy(e => e.Code).ToListAsync(ct))
            .Select(e => e.ToDto())];

    public async Task<ExamPaperDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.FirstOrDefaultAsync(e => e.Id == id, ct)
         ?? throw AppException.NotFound("Exam paper")).ToDto();

    public async Task<ExamPaperDto> CreateAsync(ExamPaperUpsertDto dto, CancellationToken ct)
    {
        var code = Formats.Normalise(dto.Code)!;
        if (await db.ExamPapers.AnyAsync(e => e.Code == code, ct))
            throw AppException.Conflict($"Exam paper code '{code}' is already in use.");
        Validate(dto);

        var entity = new ExamPaper();
        Apply(entity, dto, code);
        db.ExamPapers.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<ExamPaperDto> UpdateAsync(int id, ExamPaperUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.ExamPapers
            .Include(e => e.Questions).ThenInclude(q => q.Options)
            .FirstOrDefaultAsync(e => e.Id == id, ct)
            ?? throw AppException.NotFound("Exam paper");

        var code = Formats.Normalise(dto.Code)!;
        if (await db.ExamPapers.AnyAsync(e => e.Code == code && e.Id != id, ct))
            throw AppException.Conflict($"Exam paper code '{code}' is already in use.");
        Validate(dto);

        db.ExamQuestions.RemoveRange(entity.Questions);
        entity.Questions.Clear();
        Apply(entity, dto, code);

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<ExamPaperDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.ExamPapers.FirstOrDefaultAsync(e => e.Id == id, ct)
                     ?? throw AppException.NotFound("Exam paper");
        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    private static void Validate(ExamPaperUpsertDto dto)
    {
        Guard.Check()
            .Code(dto.Code, "Exam paper code")
            .Required(dto.Title, "Title")
            .Range(dto.DurationMinutes, 5, 480, "Duration (minutes)")
            .Range(dto.MaxAttempts, 1, 10, "Maximum attempts")
            .ThrowIfInvalid();

        if (dto.Questions.Count == 0)
            throw new AppException("An exam paper needs at least one question.");
        if (dto.PassPercentage is <= 0 or > 100)
            throw new AppException("Pass percentage must be between 1 and 100.");

        foreach (var question in dto.Questions)
        {
            if (string.IsNullOrWhiteSpace(question.Text))
                throw new AppException("Every question needs text.");

            var type = EnumMaps.ParseEnum(question.Type, QuestionType.SingleChoice);
            if (type == QuestionType.Descriptive) continue;

            if (question.Options.Count < 2)
                throw new AppException($"'{Trim(question.Text)}' needs at least two options.");
            if (!question.Options.Any(o => o.IsCorrect))
                throw new AppException($"'{Trim(question.Text)}' has no correct answer marked.");
            if (type == QuestionType.SingleChoice && question.Options.Count(o => o.IsCorrect) > 1)
                throw new AppException($"'{Trim(question.Text)}' is single choice but has several correct answers.");
        }

        static string Trim(string text) => text.Length <= 40 ? text : text[..40] + "…";
    }

    private static void Apply(ExamPaper entity, ExamPaperUpsertDto dto, string code)
    {
        entity.ProgramTypeId = dto.ProgramTypeId;
        entity.Code = code;
        entity.Title = dto.Title.Trim();
        entity.Instructions = dto.Instructions;
        entity.DurationMinutes = dto.DurationMinutes;
        entity.PassPercentage = dto.PassPercentage;
        entity.MaxAttempts = dto.MaxAttempts;
        entity.ShuffleQuestions = dto.ShuffleQuestions;
        entity.NegativeMarking = dto.NegativeMarking;
        entity.Status = EnumMaps.ToStatus(dto.Status);

        var order = 0;
        foreach (var questionDto in dto.Questions.OrderBy(q => q.DisplayOrder))
        {
            order++;
            var question = new ExamQuestion
            {
                DisplayOrder = order,
                Text = questionDto.Text.Trim(),
                Type = EnumMaps.ParseEnum(questionDto.Type, QuestionType.SingleChoice),
                Difficulty = EnumMaps.ParseEnum(questionDto.Difficulty, DifficultyLevel.Moderate),
                Marks = questionDto.Marks,
                NegativeMarks = dto.NegativeMarking ? questionDto.NegativeMarks : 0m,
                ModuleRef = questionDto.ModuleRef,
                Explanation = questionDto.Explanation,
            };

            var optionOrder = 0;
            foreach (var option in questionDto.Options)
            {
                optionOrder++;
                question.Options.Add(new ExamQuestionOption
                {
                    Text = option.Text.Trim(),
                    IsCorrect = option.IsCorrect,
                    DisplayOrder = optionOrder,
                });
            }

            entity.Questions.Add(question);
        }
    }
}

/* ----------------------------------------------------------- training material */

public class TrainingMaterialService(NtmsDbContext db, ICurrentUserRoles roles)
{
    private IQueryable<TrainingMaterial> Base => db.TrainingMaterials.AsNoTracking()
        .Include(m => m.Category)
        .Include(m => m.SubCategory)
        .Include(m => m.ProgramType);

    public async Task<PagedResult<TrainingMaterialDto>> ListAsync(
        PagedRequest request, int? programTypeId, string? kind, string? role,
        string? status, CancellationToken ct)
    {
        var materialKind = EnumMaps.ParseEnumOrNull<MaterialKind>(kind);

        var query = Base
            .WhereIf(programTypeId.HasValue, m => m.ProgramTypeId == programTypeId)
            .WhereIf(materialKind.HasValue, m => m.Kind == materialKind)
            .WhereIf(!string.IsNullOrWhiteSpace(role), m => m.VisibleToRoles.Contains(role!))
            .WhereIf(!string.IsNullOrWhiteSpace(status), m => m.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                m => m.Title.Contains(request.Search!)
                     || (m.Description != null && m.Description.Contains(request.Search!)))
            .ApplySort(request, db.Model.FindEntityType(typeof(TrainingMaterial))!, m => m.Title);

        return await query.ToPagedResultAsync(request, m => m.ToDto(), ct);
    }

    /// <summary>
    /// What the signed-in role may actually open. Used by the mobile app and by
    /// coordinators, who must not see admin-only material.
    /// </summary>
    public async Task<List<TrainingMaterialDto>> VisibleToMeAsync(int? programTypeId, CancellationToken ct)
    {
        var role = roles.BaseRole ?? "Applicant";
        var rows = await Base
            .Where(m => m.Status == RecordStatus.Active && m.VisibleToRoles.Contains(role))
            .WhereIf(programTypeId.HasValue, m => m.ProgramTypeId == programTypeId)
            .OrderBy(m => m.Title)
            .ToListAsync(ct);
        return [.. rows.Select(m => m.ToDto())];
    }

    public async Task<TrainingMaterialDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.FirstOrDefaultAsync(m => m.Id == id, ct)
         ?? throw AppException.NotFound("Training material")).ToDto();

    public async Task<TrainingMaterialDto> CreateAsync(
        TrainingMaterialUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);
        var entity = new TrainingMaterial();
        Apply(entity, dto);
        db.TrainingMaterials.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<TrainingMaterialDto> UpdateAsync(
        int id, TrainingMaterialUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);
        var entity = await db.TrainingMaterials.FirstOrDefaultAsync(m => m.Id == id, ct)
                     ?? throw AppException.NotFound("Training material");
        Apply(entity, dto);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<TrainingMaterialDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.TrainingMaterials.FirstOrDefaultAsync(m => m.Id == id, ct)
                     ?? throw AppException.NotFound("Training material");
        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    private static void Validate(TrainingMaterialUpsertDto dto)
    {
        Guard.Check().Required(dto.Title, "Title").ThrowIfInvalid();

        if (dto.VisibleToRoles.Count == 0)
            throw new AppException("Choose at least one role that can see this material.");

        var kind = EnumMaps.ParseEnum(dto.Kind, MaterialKind.Document);
        if (kind == MaterialKind.Link && string.IsNullOrWhiteSpace(dto.Url))
            throw new AppException("A link needs a URL.");
        if (kind != MaterialKind.Link && string.IsNullOrWhiteSpace(dto.FileName))
            throw new AppException("Upload a file, or change the material type to Link.");

        foreach (var role in dto.VisibleToRoles)
        {
            _ = EnumMaps.ParseEnum(role, BaseRole.Applicant);
        }
    }

    private static void Apply(TrainingMaterial entity, TrainingMaterialUpsertDto dto)
    {
        entity.Title = dto.Title.Trim();
        entity.Description = dto.Description;
        entity.Kind = EnumMaps.ParseEnum(dto.Kind, MaterialKind.Document);
        entity.CategoryId = dto.CategoryId;
        entity.SubCategoryId = dto.SubCategoryId;
        entity.ProgramTypeId = dto.ProgramTypeId;
        entity.CurriculumSessionId = dto.CurriculumSessionId;
        entity.FileName = dto.FileName;
        entity.FileSizeKb = dto.FileSizeKb;
        entity.MimeType = dto.MimeType;
        entity.Url = dto.Url;
        entity.DurationMinutes = dto.DurationMinutes;
        entity.Language = dto.Language;
        entity.VisibleToRoles = EnumMaps.JoinList(dto.VisibleToRoles);
        entity.Version = dto.Version;
        entity.PublishedOn = dto.PublishedOn == default
            ? DateOnly.FromDateTime(DateTime.UtcNow)
            : dto.PublishedOn;
        entity.DownloadAllowed = dto.DownloadAllowed;
        entity.Status = EnumMaps.ToStatus(dto.Status);
    }
}

/// <summary>Minimal view of the caller's role, for visibility filtering.</summary>
public interface ICurrentUserRoles
{
    string? BaseRole { get; }
}
