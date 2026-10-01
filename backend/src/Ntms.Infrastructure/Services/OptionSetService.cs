using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// The shared choice lists, and the fields that point at them.
///
/// A list exists so the same question asked on three forms offers the same
/// three answers. That only holds if the list stays the one thing: an item
/// is switched off rather than removed once answers exist against it, and
/// a list still in use cannot be deleted at all.
/// </summary>
public class OptionSetService(NtmsDbContext db)
{
    private IQueryable<OptionSet> Base =>
        db.OptionSets.Include(s => s.Items.OrderBy(i => i.DisplayOrder).ThenBy(i => i.Id));

    public async Task<PagedResult<OptionSetDto>> ListAsync(
        PagedRequest request, string? status, CancellationToken ct)
    {
        var query = Base.AsNoTracking()
            .WhereIf(!string.IsNullOrWhiteSpace(status), s => s.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                s => s.Name.Contains(request.Search!) || s.Code.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(OptionSet))!, s => s.Name);

        var page = await query.ToPagedResultAsync(request, Map, ct);
        await FillUsageAsync(page.Items, ct);
        return page;
    }

    /// <summary>Every active list, for the picker in the form designer.</summary>
    public async Task<List<OptionSetDto>> AllAsync(CancellationToken ct) =>
        [.. (await Base.AsNoTracking()
                .Where(s => s.Status == RecordStatus.Active)
                .OrderBy(s => s.Name)
                .ToListAsync(ct))
            .Select(Map)];

    public async Task<OptionSetDto> GetAsync(int id, CancellationToken ct)
    {
        var dto = Map(await Base.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id, ct)
                      ?? throw AppException.NotFound("Option set"));
        await FillUsageAsync([dto], ct);
        return dto;
    }

    /// <summary>
    /// How many fields point at each list, so the screen can say what a
    /// change will reach before somebody makes it.
    /// </summary>
    private async Task FillUsageAsync(IReadOnlyList<OptionSetDto> rows, CancellationToken ct)
    {
        if (rows.Count == 0) return;

        var ids = rows.Select(r => r.Id).ToList();

        var counts = await db.ProfileFields.AsNoTracking()
            .Where(f => f.OptionSetId != null && ids.Contains(f.OptionSetId.Value))
            .GroupBy(f => f.OptionSetId!.Value)
            .Select(g => new { Id = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);

        foreach (var row in rows) row.UsedByFieldCount = counts.GetValueOrDefault(row.Id);
    }

    public async Task<OptionSetDto> CreateAsync(OptionSetUpsertDto dto, CancellationToken ct)
    {
        var code = Normalise(dto.Code);
        Validate(dto, code);

        if (await db.OptionSets.AnyAsync(s => s.Code == code, ct))
            throw AppException.Conflict($"A list with the code '{code}' already exists.");

        var entity = new OptionSet
        {
            Code = code,
            Name = dto.Name.Trim(),
            Description = Blank(dto.Description),
            Status = EnumMaps.ToStatus(dto.Status),
        };

        Apply(entity, dto);
        db.OptionSets.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<OptionSetDto> UpdateAsync(int id, OptionSetUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.OptionSets.Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == id, ct)
            ?? throw AppException.NotFound("Option set");

        var code = Normalise(dto.Code);
        Validate(dto, code);

        if (await db.OptionSets.AnyAsync(s => s.Code == code && s.Id != id, ct))
            throw AppException.Conflict($"A list with the code '{code}' already exists.");

        entity.Code = code;
        entity.Name = dto.Name.Trim();
        entity.Description = Blank(dto.Description);
        entity.Status = EnumMaps.ToStatus(dto.Status);

        Apply(entity, dto);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<OptionSetDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.OptionSets.FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw AppException.NotFound("Option set");

        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var entity = await db.OptionSets.FirstOrDefaultAsync(s => s.Id == id, ct)
                     ?? throw AppException.NotFound("Option set");

        var inUse = await db.ProfileFields.CountAsync(f => f.OptionSetId == id, ct);
        if (inUse > 0)
        {
            throw AppException.Conflict(
                $"'{entity.Name}' is used by {inUse} field{(inUse == 1 ? "" : "s")}. "
                + "Point those at another list first, or switch this one off instead.");
        }

        db.OptionSets.Remove(entity);
        await db.SaveChangesAsync(ct);
    }

    /* ------------------------------------------------------------ helpers */

    /// <summary>
    /// Replaces the items, keeping the rows whose value is unchanged.
    ///
    /// Matched on value rather than cleared and re-added, so an item that
    /// only had its label reworded keeps its row - and so the unique index
    /// on (list, value) is not tripped by a delete and an insert of the
    /// same value in one save.
    /// </summary>
    private static void Apply(OptionSet entity, OptionSetUpsertDto dto)
    {
        var wanted = dto.Items
            .Where(i => !string.IsNullOrWhiteSpace(i.Label))
            .Select((i, index) => new
            {
                Value = string.IsNullOrWhiteSpace(i.Value) ? Slug(i.Label) : Normalise(i.Value),
                Label = i.Label.Trim(),
                Order = index + 1,
                Status = EnumMaps.ToStatus(i.Status),
            })
            .GroupBy(i => i.Value)
            .Select(g => g.First())
            .ToList();

        foreach (var gone in entity.Items.Where(i => wanted.All(w => w.Value != i.Value)).ToList())
            entity.Items.Remove(gone);

        foreach (var item in wanted)
        {
            var existing = entity.Items.FirstOrDefault(i => i.Value == item.Value);
            if (existing is null)
            {
                entity.Items.Add(new OptionSetItem
                {
                    Value = item.Value,
                    Label = item.Label,
                    DisplayOrder = item.Order,
                    Status = item.Status,
                });
                continue;
            }

            existing.Label = item.Label;
            existing.DisplayOrder = item.Order;
            existing.Status = item.Status;
        }
    }

    private static void Validate(OptionSetUpsertDto dto, string code)
    {
        Guard.Check()
            .Required(dto.Name, "Name")
            .When(string.IsNullOrWhiteSpace(code), "A code is required.")
            .When(dto.Items.Count(i => !string.IsNullOrWhiteSpace(i.Label)) == 0,
                "A list needs at least one choice in it.")
            .ThrowIfInvalid();
    }

    private static string Normalise(string value) =>
        new(value.Trim().ToUpperInvariant()
            .Select(c => char.IsLetterOrDigit(c) ? c : '_').ToArray());

    private static string Slug(string label) =>
        new(label.Trim().ToLowerInvariant()
            .Select(c => char.IsLetterOrDigit(c) ? c : '-').ToArray());

    private static string? Blank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static OptionSetDto Map(OptionSet s) => new()
    {
        Id = s.Id,
        Code = s.Code,
        Name = s.Name,
        Description = s.Description,
        Status = s.Status.ToApi(),
        Items =
        [
            .. s.Items.OrderBy(i => i.DisplayOrder).ThenBy(i => i.Id)
                .Select(i => new OptionSetItemDto
                {
                    Id = i.Id,
                    Value = i.Value,
                    Label = i.Label,
                    DisplayOrder = i.DisplayOrder,
                    Status = i.Status.ToApi(),
                }),
        ],
    };
}
