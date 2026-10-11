using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

public class CurriculumService(NtmsDbContext db)
{
    private IQueryable<Curriculum> Base => db.Curricula.AsNoTracking()
        .Include(c => c.ProgramType)!.ThenInclude(p => p!.Category)
        .Include(c => c.ProgramType)!.ThenInclude(p => p!.SubCategory)
        .Include(c => c.Sessions).ThenInclude(s => s.Topics);

    public async Task<PagedResult<CurriculumDto>> ListAsync(
        PagedRequest request, int? categoryId, int? subCategoryId, int? programTypeId,
        string? status, CancellationToken ct)
    {
        /* Searched, sorted and filtered through the programme type, since the
           curriculum no longer carries a code, name or category of its own. */
        var query = Base
            .WhereIf(categoryId.HasValue, c => c.ProgramType!.CategoryId == categoryId)
            .WhereIf(subCategoryId.HasValue, c => c.ProgramType!.SubCategoryId == subCategoryId)
            .WhereIf(programTypeId.HasValue, c => c.ProgramTypeId == programTypeId)
            .WhereIf(!string.IsNullOrWhiteSpace(status), c => c.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                c => c.ProgramType!.Code.Contains(request.Search!)
                     || c.ProgramType!.Name.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(Curriculum))!,
                c => c.ProgramType!.Code);

        return await query.ToPagedResultAsync(request, c => c.ToDto(), ct);
    }

    public async Task<List<CurriculumDto>> AllAsync(string? status, CancellationToken ct) =>
        [.. (await Base
                .WhereIf(!string.IsNullOrWhiteSpace(status), c => c.Status == EnumMaps.ToStatus(status))
                .OrderBy(c => c.ProgramType!.Code).ToListAsync(ct))
            .Select(c => c.ToDto())];

    public async Task<CurriculumDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.FirstOrDefaultAsync(c => c.Id == id, ct)
         ?? throw AppException.NotFound("Curriculum")).ToDto();

    public async Task<CurriculumDto> CreateAsync(CurriculumUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);
        var code = await ProgramTypeCodeAsync(dto.ProgramTypeId, ct);

        /* One curriculum per programme type: a second would leave the
           programme screen with no way to say which applies. */
        if (await db.Curricula.AnyAsync(c => c.ProgramTypeId == dto.ProgramTypeId, ct))
            throw AppException.Conflict($"{code} already has a curriculum. Edit that one instead.");

        var entity = new Curriculum();
        Apply(entity, dto);
        ReplaceSessions(entity, dto.Sessions ?? [], code);

        db.Curricula.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<CurriculumDto> UpdateAsync(int id, CurriculumUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.Curricula
            .Include(c => c.Sessions).ThenInclude(s => s.Topics)
            .FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw AppException.NotFound("Curriculum");

        Validate(dto);
        var code = await ProgramTypeCodeAsync(dto.ProgramTypeId, ct);
        if (await db.Curricula.AnyAsync(c => c.ProgramTypeId == dto.ProgramTypeId && c.Id != id, ct))
            throw AppException.Conflict($"{code} already has a curriculum. Edit that one instead.");

        Apply(entity, dto);

        /* The register edits the header on its own; the session plan is only
           replaced when the detail screen sends one. */
        if (dto.Sessions is not null)
        {
            db.CurriculumSessions.RemoveRange(entity.Sessions);
            entity.Sessions.Clear();
            ReplaceSessions(entity, dto.Sessions, code);
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<CurriculumDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.Curricula.FirstOrDefaultAsync(c => c.Id == id, ct)
                     ?? throw AppException.NotFound("Curriculum");
        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    private static void Validate(CurriculumUpsertDto dto) =>
        Guard.Check()
            .When(dto.ProgramTypeId <= 0, "Select the program type.")
            .Range(dto.DurationDays, 1, 365, "Duration (days)")
            .ThrowIfInvalid();

    /// <summary>
    /// The programme type's code, which session codes are built from. Also
    /// proves the type exists before anything is written.
    /// </summary>
    private async Task<string> ProgramTypeCodeAsync(int programTypeId, CancellationToken ct) =>
        await db.ProgramTypes.AsNoTracking()
            .Where(p => p.Id == programTypeId)
            .Select(p => p.Code)
            .FirstOrDefaultAsync(ct)
        ?? throw AppException.NotFound("Program type");

    private static void Apply(Curriculum entity, CurriculumUpsertDto dto)
    {
        entity.ProgramTypeId = dto.ProgramTypeId;
        entity.Objective = dto.Objective;
        entity.DurationDays = dto.DurationDays;
        entity.EffectiveFrom = dto.EffectiveFrom == default
            ? DateOnly.FromDateTime(DateTime.UtcNow)
            : dto.EffectiveFrom;
        entity.Status = EnumMaps.ToStatus(dto.Status);
    }

    /// <summary>
    /// Session and topic codes are derived from the programme type's code, so
    /// they stay consistent no matter what the client sends.
    /// </summary>
    private static void ReplaceSessions(
        Curriculum entity, List<CurriculumSessionDto> sessions, string programTypeCode)
    {
        var order = 0;
        foreach (var dto in sessions.OrderBy(s => s.DisplayOrder))
        {
            order++;
            var sessionCode = $"{programTypeCode}/S{order:D2}";
            var session = new CurriculumSession
            {
                SessionCode = sessionCode,
                SessionName = dto.SessionName.Trim(),
                DisplayOrder = order,
                Day = dto.Day,
                StartTime = dto.StartTime,
                /* An end before the start is a typo rather than a session
                   that runs backwards, so it is dropped rather than stored
                   and read back as a negative length later. */
                EndTime = dto.EndTime > dto.StartTime || dto.StartTime is null
                    ? dto.EndTime
                    : null,
                /* Sessions are rebuilt from the payload on every save, so the
                   enabled/disabled state has to travel with them or it would
                   silently reset each time the plan is edited. */
                Status = EnumMaps.ToStatus(dto.Status),
            };

            var topicOrder = 0;
            foreach (var topic in dto.Topics.OrderBy(t => t.DisplayOrder))
            {
                topicOrder++;
                session.Topics.Add(new CurriculumTopic
                {
                    TopicCode = $"{sessionCode}/T{topicOrder:D2}",
                    TopicName = topic.TopicName.Trim(),
                    DisplayOrder = topicOrder,
                    DurationMinutes = topic.DurationMinutes,
                    LearningOutcome = topic.LearningOutcome,
                    Status = EnumMaps.ToStatus(topic.Status),
                });
            }

            entity.Sessions.Add(session);
        }
    }
}
