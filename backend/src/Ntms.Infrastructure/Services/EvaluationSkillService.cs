using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// What a trainer marks a candidate on in the viva or practical, kept per
/// programme type.
///
/// A skill is retired rather than deleted once it has been marked against,
/// because a marksheet that loses the name of what was marked stops being
/// evidence of anything.
/// </summary>
public class EvaluationSkillService(NtmsDbContext db)
{
    private IQueryable<EvaluationSkill> Base =>
        db.EvaluationSkills.AsNoTracking().Include(s => s.ProgramType);

    /// <summary>
    /// The skills for one programme type, or across all of them.
    ///
    /// Ordered the way they are marked — the display order the administrator
    /// set, then by name — so a trainer's sheet reads in the same order every
    /// time rather than in insertion order.
    /// </summary>
    public async Task<List<EvaluationSkillDto>> ListAsync(
        int? programTypeId, string? status, CancellationToken ct) =>
        [.. (await Base
                .WhereIf(programTypeId.HasValue, s => s.ProgramTypeId == programTypeId)
                .WhereIf(!string.IsNullOrWhiteSpace(status),
                    s => s.Status == EnumMaps.ToStatus(status))
                .OrderBy(s => s.ProgramType!.Name)
                .ThenBy(s => s.DisplayOrder)
                .ThenBy(s => s.Name)
                .ToListAsync(ct))
            .Select(s => s.ToDto())];

    public async Task<EvaluationSkillDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.FirstOrDefaultAsync(s => s.Id == id, ct)
         ?? throw AppException.NotFound("Skill")).ToDto();

    public async Task<EvaluationSkillDto> CreateAsync(
        EvaluationSkillUpsertDto dto, CancellationToken ct)
    {
        await GuardAsync(dto, null, ct);

        var entity = new EvaluationSkill { ProgramTypeId = dto.ProgramTypeId };
        Apply(entity, dto);

        /* Left blank, a new skill goes to the end of the sheet rather than
           joining everything else at position zero. */
        if (entity.DisplayOrder == 0)
        {
            entity.DisplayOrder = await db.EvaluationSkills
                .Where(s => s.ProgramTypeId == dto.ProgramTypeId)
                .Select(s => (int?)s.DisplayOrder).MaxAsync(ct) is { } last ? last + 1 : 1;
        }

        db.EvaluationSkills.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<EvaluationSkillDto> UpdateAsync(
        int id, EvaluationSkillUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.EvaluationSkills.FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw AppException.NotFound("Skill");
        await GuardAsync(dto, id, ct);

        entity.ProgramTypeId = dto.ProgramTypeId;
        Apply(entity, dto);

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<EvaluationSkillDto> SetStatusAsync(
        int id, string status, CancellationToken ct)
    {
        var entity = await db.EvaluationSkills.FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw AppException.NotFound("Skill");
        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    private static void Apply(EvaluationSkill entity, EvaluationSkillUpsertDto dto)
    {
        entity.Name = dto.Name.Trim();
        entity.Description = dto.Description;
        entity.MaxMarks = dto.MaxMarks;
        entity.DisplayOrder = dto.DisplayOrder;
        entity.Status = EnumMaps.ToStatus(dto.Status);
    }

    /// <summary>
    /// Refuses a skill that could not be marked, or that a trainer could not
    /// tell apart from one already on the sheet.
    /// </summary>
    private async Task GuardAsync(EvaluationSkillUpsertDto dto, int? exceptId, CancellationToken ct)
    {
        Guard.Check()
            .Required(dto.Name, "Skill name")
            .ThrowIfInvalid();

        if (dto.MaxMarks <= 0) throw new AppException("A skill needs marks to be marked out of.");

        var programType = await db.ProgramTypes.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == dto.ProgramTypeId, ct)
            ?? throw AppException.NotFound("Program type");

        /* The skills are the viva marksheet, so a type with no viva has nothing
           to put them on. Said here rather than silently allowed, because the
           alternative is skills nobody will ever be shown. */
        if (!programType.Evaluation.HasViva)
        {
            throw new AppException(
                $"{programType.Name} has no viva or practical, so there is nothing to mark " +
                "skills against. Change its evaluation first.");
        }

        var name = dto.Name.Trim();
        var clash = await db.EvaluationSkills.AnyAsync(
            s => s.ProgramTypeId == dto.ProgramTypeId
                 && s.Name == name
                 && (exceptId == null || s.Id != exceptId), ct);
        if (clash)
        {
            throw AppException.Conflict(
                $"'{name}' is already a skill on this program type.");
        }
    }
}
