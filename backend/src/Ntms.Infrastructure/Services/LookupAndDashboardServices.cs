using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/* ------------------------------------------------------------------ lookups */

public class LookupService(
    NtmsDbContext db,
    ICurrentUser currentUser,
    DelegationGuard delegation,
    MasterVisibility visibility,
    IMemoryCache cache)
{
    /// <summary>
    /// Everything the caller may allocate to somebody beneath them, read
    /// from the same authority that refuses an allocation on save. One
    /// call rather than five, because the dialog needs all of them and
    /// the axes have to agree with each other.
    /// </summary>
    public async Task<AllocatableScopeDto> AllocatableScopeAsync(CancellationToken ct)
    {
        var categories = await delegation.PermittedAsync(ScopeAxis.Category, ct);
        var subCategories = await delegation.PermittedAsync(ScopeAxis.SubCategory, ct);
        var programTypes = await delegation.PermittedAsync(ScopeAxis.ProgramType, ct);
        var states = await delegation.PermittedAsync(ScopeAxis.State, ct);
        var districts = await delegation.PermittedAsync(ScopeAxis.District, ct);

        return new AllocatableScopeDto
        {
            Categories = await db.Categories.AsNoTracking()
                .Where(c => c.Status == RecordStatus.Active && categories.Contains(c.Id))
                .OrderBy(c => c.DisplayOrder)
                .Select(c => new LookupItemDto { Id = c.Id, Name = c.Name, Code = c.Code })
                .ToListAsync(ct),

            SubCategories = await db.SubCategories.AsNoTracking()
                .Where(s => s.Status == RecordStatus.Active && subCategories.Contains(s.Id))
                .OrderBy(s => s.DisplayOrder)
                .Select(s => new LookupItemDto
                {
                    Id = s.Id, Name = s.Name, Code = s.Code, ParentId = s.CategoryId,
                })
                .ToListAsync(ct),

            ProgramTypes = await db.ProgramTypes.AsNoTracking()
                .Where(p => p.Status == RecordStatus.Active && programTypes.Contains(p.Id))
                .OrderBy(p => p.Code)
                .Select(p => new LookupItemDto
                {
                    Id = p.Id, Name = p.Name, Code = p.Code, ParentId = p.SubCategoryId,
                })
                .ToListAsync(ct),

            States = await db.States.AsNoTracking()
                .Where(s => states.Contains(s.Code))
                .OrderBy(s => s.Name)
                .Select(s => new LookupItemDto { Id = s.Code, Name = s.Name })
                .ToListAsync(ct),

            Districts = await db.Districts.AsNoTracking()
                .Where(d => districts.Contains(d.Code))
                .OrderBy(d => d.Name)
                .Select(d => new LookupItemDto
                {
                    Id = d.Code, Name = d.Name, ParentId = d.StateCode,
                })
                .ToListAsync(ct),
        };
    }

    /// <summary>
    /// The categories this account can see. Narrowed like every other
    /// read: a filter offering a category somebody holds nothing in can
    /// only ever return an empty list, and invites them to wonder whether
    /// the data is missing.
    /// </summary>
    public async Task<List<LookupItemDto>> CategoriesAsync(CancellationToken ct)
    {
        var visible = await visibility.CategoriesAsync(ct);

        return await db.Categories.AsNoTracking()
            .Where(c => c.Status == RecordStatus.Active)
            .WhereIf(visible is not null, c => visible!.Contains(c.Id))
            .OrderBy(c => c.DisplayOrder)
            .Select(c => new LookupItemDto { Id = c.Id, Name = c.Name, Code = c.Code })
            .ToListAsync(ct);
    }

    /// <summary>
    /// Says which one it is, where the name alone does not.
    ///
    /// Sub-category and program type names repeat across the scheme —
    /// "Consultant" exists under ZED Certification and under MCLS,
    /// "Assessor" under MCLS and SAMAR. In a dropdown they arrive as two
    /// identical lines, and nobody can tell which is which; picking the
    /// wrong one filters a whole screen to the wrong discipline with no
    /// sign that anything is amiss.
    ///
    /// The qualifier is added only to names that actually collide. Putting
    /// the parent on every line would make the common case, where the name
    /// is already unique, harder to read in order to serve the rare one.
    /// </summary>
    private static void Disambiguate(
        List<LookupItemDto> items, IReadOnlyDictionary<int, string> parents)
    {
        var clashing = items
            .GroupBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1)
            .SelectMany(g => g)
            .ToHashSet();

        foreach (var item in clashing)
        {
            if (item.ParentId is { } parentId
                && parents.TryGetValue(parentId, out var parent)
                && !string.IsNullOrWhiteSpace(parent))
            {
                item.Name = $"{item.Name} ({parent})";
            }
        }
    }

    public async Task<List<LookupItemDto>> SubCategoriesAsync(
        int? categoryId, CancellationToken ct)
    {
        var visible = await visibility.SubCategoriesAsync(ct);

        var items = await db.SubCategories.AsNoTracking()
            .Where(s => s.Status == RecordStatus.Active)
            .WhereIf(visible is not null, s => visible!.Contains(s.Id))
            .WhereIf(categoryId.HasValue, s => s.CategoryId == categoryId)
            .OrderBy(s => s.DisplayOrder)
            .Select(s => new LookupItemDto
            {
                Id = s.Id, Name = s.Name, Code = s.Code, ParentId = s.CategoryId,
            })
            .ToListAsync(ct);

        var categories = await db.Categories.AsNoTracking()
            .ToDictionaryAsync(c => c.Id, c => c.Name, ct);

        Disambiguate(items, categories);
        return items;
    }

    public async Task<List<LookupItemDto>> ProgramTypesAsync(
        int? categoryId, int? subCategoryId, CancellationToken ct)
    {
        var visible = await visibility.ProgramTypesAsync(ct);

        var rows = await db.ProgramTypes.AsNoTracking()
            .Where(p => p.Status == RecordStatus.Active)
            .WhereIf(visible is not null, p => visible!.Contains(p.Id))
            .WhereIf(categoryId.HasValue, p => p.CategoryId == categoryId)
            .WhereIf(subCategoryId.HasValue, p => p.SubCategoryId == subCategoryId)
            .OrderBy(p => p.Code)
            .Select(p => new
            {
                p.Id, p.Name, p.Code, p.SubCategoryId,
                /* The category, not the sub-category, qualifies a program
                   type: the sub-category names collide too, so "Consultant"
                   would settle nothing. */
                Qualifier = p.Category!.Name,
            })
            .ToListAsync(ct);

        var items = rows
            .Select(p => new LookupItemDto
            {
                Id = p.Id, Name = p.Name, Code = p.Code, ParentId = p.SubCategoryId,
            })
            .ToList();

        var qualifiers = rows.ToDictionary(p => p.Id, p => p.Qualifier);
        var clashing = items
            .GroupBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
            .Where(g => g.Count() > 1)
            .SelectMany(g => g);

        foreach (var item in clashing)
        {
            if (qualifiers.TryGetValue(item.Id, out var parent)
                && !string.IsNullOrWhiteSpace(parent))
            {
                item.Name = $"{item.Name} ({parent})";
            }
        }

        return items;
    }

    public Task<List<LookupItemDto>> AgenciesAsync(CancellationToken ct) =>
        db.Agencies.AsNoTracking()
            .WithinScope(currentUser)
            .Where(a => a.Status == RecordStatus.Active)
            .OrderBy(a => a.Name)
            .Select(a => new LookupItemDto { Id = a.Id, Name = a.Name, Code = a.Code })
            .ToListAsync(ct);

    public Task<List<LookupItemDto>> CoordinatorsAsync(int? agencyId, CancellationToken ct) =>
        db.Users.AsNoTracking()
            .VisibleTo(currentUser)
            .Where(u => u.BaseRole == BaseRole.Coordinator && u.Status == RecordStatus.Active)
            .WhereIf(agencyId.HasValue, u => u.AgencyId == agencyId)
            .OrderBy(u => u.FullName)
            .Select(u => new LookupItemDto
            {
                Id = u.Id, Name = u.FullName, Code = u.UserCode, ParentId = u.AgencyId,
            })
            .ToListAsync(ct);

    public Task<List<LookupItemDto>> OperationManagersAsync(CancellationToken ct) =>
        db.Users.AsNoTracking()
            .VisibleTo(currentUser)
            .Where(u => u.BaseRole == BaseRole.OperationManager && u.Status == RecordStatus.Active)
            .OrderBy(u => u.FullName)
            .Select(u => new LookupItemDto { Id = u.Id, Name = u.FullName, Code = u.UserCode })
            .ToListAsync(ct);

    /// <summary>
    /// The educational qualification ladder, lowest first. Read from the
    /// master rather than the copy held in memory, so a rung added a moment
    /// ago is on the form straight away. The lookup id is its position on the
    /// ladder; <c>Code</c> is what a programme type stores.
    /// </summary>
    public Task<List<LookupItemDto>> QualificationsAsync(CancellationToken ct) =>
        db.Qualifications.AsNoTracking()
            .Where(q => q.Status == RecordStatus.Active)
            .OrderBy(q => q.Rank).ThenBy(q => q.Label)
            .Select(q => new LookupItemDto { Id = q.Rank, Name = q.Label, Code = q.Code })
            .ToListAsync(ct);

    /// <summary>
    /// The roles, for the screens that allocate one.
    ///
    /// Empty for anybody with no tier, which is how every other lookup
    /// here behaves and what an applicant's token is: it satisfies
    /// [Authorize] like any other, and the portal's organisation chart is
    /// not something the applicant app has any business reading.
    /// </summary>
    public Task<List<LookupItemDto>> RolesAsync(CancellationToken ct) =>
        currentUser.Tier is null
            ? Task.FromResult(new List<LookupItemDto>())
            : db.Roles.AsNoTracking()
            .Where(r => r.Status == RecordStatus.Active)
            .OrderBy(r => r.Name)
            .Select(r => new LookupItemDto { Id = r.Id, Name = r.Name, Code = r.Code })
            .ToListAsync(ct);

    /// <summary>
    /// The states this account can see, for filters and for anywhere a
    /// state narrows what is listed.
    /// </summary>
    public async Task<List<LookupItemDto>> StatesAsync(CancellationToken ct)
    {
        var visible = await visibility.StatesAsync(ct);

        return await db.States.AsNoTracking()
            .WhereIf(visible is not null, s => visible!.Contains(s.Code))
            .OrderBy(s => s.Name)
            .Select(s => new LookupItemDto
            {
                Id = s.Code, Name = s.Name, Code = s.Code.ToString(),
            })
            .ToListAsync(ct);
    }

    /// <summary>LGD district master for one state, narrowed the same way.</summary>
    public async Task<List<LookupItemDto>> DistrictsAsync(
        int? stateCode, string? state, CancellationToken ct)
    {
        var visible = await visibility.DistrictsAsync(ct);

        return await db.Districts.AsNoTracking()
            .WhereIf(visible is not null, d => visible!.Contains(d.Code))
            .WhereIf(stateCode.HasValue, d => d.StateCode == stateCode)
            .WhereIf(!string.IsNullOrWhiteSpace(state),
                d => d.State!.Name == state!.ToUpperInvariant())
            .OrderBy(d => d.Name)
            .Select(d => new LookupItemDto
            {
                Id = d.Code, Name = d.Name, Code = d.Code.ToString(), ParentId = d.StateCode,
            })
            .ToListAsync(ct);
    }

    /* --------------------------------------------- the postal address

       Where somebody lives, or where an agency's office is, is a fact
       about them rather than a slice of the estate. An Admin working two
       states may well appoint a manager who lives in a third, so these
       two stay the whole LGD master however narrow the caller is. */

    /* Held in memory, because this is the one list in the system that
       nothing writes.

       The LGD master arrives with the database and no screen in the
       portal edits it. Every address field on every form asks for it -
       the sign-up form, the profile form, a handset opening section two
       - so at a thousand users it is thousands of identical queries a
       minute for an answer that has not changed since the release.
       Thirty minutes is long enough to carry a crowd and short enough
       that a master reloaded by hand is picked up within one lunch. */
    private static readonly TimeSpan MasterLife = TimeSpan.FromMinutes(30);

    public Task<List<LookupItemDto>> AddressStatesAsync(CancellationToken ct) =>
        cache.GetOrCreateAsync("lgd:states", entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = MasterLife;
            return db.States.AsNoTracking()
                .OrderBy(s => s.Name)
                .Select(s => new LookupItemDto
                {
                    Id = s.Code, Name = s.Name, Code = s.Code.ToString(),
                })
                .ToListAsync(ct);
        })!;

    public Task<List<LookupItemDto>> AddressDistrictsAsync(
        int? stateCode, CancellationToken ct) =>
        cache.GetOrCreateAsync($"lgd:districts:{stateCode?.ToString() ?? "all"}", entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = MasterLife;
            return db.Districts.AsNoTracking()
                .WhereIf(stateCode.HasValue, d => d.StateCode == stateCode)
                .OrderBy(d => d.Name)
                .Select(d => new LookupItemDto
                {
                    Id = d.Code, Name = d.Name, Code = d.Code.ToString(),
                    ParentId = d.StateCode,
                })
                .ToListAsync(ct);
        })!;
}

/* ---------------------------------------------------------------- dashboard */

public class DashboardService(NtmsDbContext db, ICurrentUser currentUser)
{
    /// <summary>How far back the month series reaches when no period is chosen.</summary>
    private const int DefaultMonthsBack = 24;

    /// <summary>
    /// Programme reach by state, for the map. Counts distinct program types and
    /// enrolled participants per state, and returns every state — including the
    /// ones with nothing — so a gap in coverage is visible rather than absent.
    ///
    /// Scoped like every other read: a manager sees the states it holds.
    /// </summary>
    public async Task<StateCoverageResultDto> StateCoverageAsync(
        DashboardFilterDto filter, CancellationToken ct)
    {
        var (from, to) = filter.Window();

        var mode = EnumMaps.ParseEnumOrNull<ProgramMode>(filter.Mode);

        /* Every filter the headline figures honour, honoured here too. Leaving
           sub-category, programme type or mode out made the map answer a wider
           question than the KPIs above it, so the same screen showed two
           different totals for one selection. */
        var programmes = db.Programmes.AsNoTracking()
            .WithinScope(currentUser)
            .WhereIf(filter.AgencyId.HasValue, p => p.AgencyId == filter.AgencyId)
            .WhereIf(filter.CategoryId.HasValue, p => p.CategoryId == filter.CategoryId)
            .WhereIf(filter.SubCategoryId.HasValue, p => p.SubCategoryId == filter.SubCategoryId)
            .WhereIf(filter.ProgramTypeId.HasValue, p => p.ProgramTypeId == filter.ProgramTypeId)
            .WhereIf(mode.HasValue, p => p.Mode == mode)
            .WhereIf(!string.IsNullOrWhiteSpace(filter.State),
                p => p.State!.Name == filter.State!.ToUpperInvariant())
            .WhereIf(from.HasValue, p => p.StartDate >= from)
            .WhereIf(to.HasValue, p => p.StartDate <= to);

        /* Grouped in the database rather than pulled back and counted here:
           this runs on every dashboard load. */
        var rows = await programmes
            .GroupBy(p => p.StateCode)
            .Select(g => new
            {
                StateCode = g.Key,
                /* Conducted only, like the count beside it. Every distinct
                   type raised shaded a state the moment a batch was entered
                   in the calendar, so the map showed reach across three
                   states while the table under it, and the KPI above it,
                   both read zero. One panel cannot answer two questions
                   without saying which is which. */
                ProgramTypes = g.Where(p => p.Status == ProgramStatus.Conducted)
                    .Select(p => p.ProgramTypeId).Distinct().Count(),
                /* Conducted only, because the column is headed "Programmes
                   conducted" and has to agree with the KPI of that name.
                   Counting scheduled batches here put 12 under the table
                   against 10 in the card beside it. */
                Programmes = g.Count(p => p.Status == ProgramStatus.Conducted),
                /* Everyone enrolled, whatever the batch's status — the same
                   population as the "Candidates participated" KPI.

                   Conducted only now, like everything else on this
                   panel. Enrolment is an intention; the scheme reports
                   on what was held, and somebody signed up to a batch
                   that has not happened has not participated in
                   anything. Counting them shaded a state on the map and
                   put a figure in this column while the programmes
                   column beside it, and the card above it, both read
                   zero - the screen disagreeing with itself. */
                Participants = g.Where(p => p.Status == ProgramStatus.Conducted)
                    .SelectMany(p => p.Participants).Count(),
            })
            .ToListAsync(ct);

        var byState = rows.ToDictionary(r => r.StateCode);

        /* Every state is listed, so "no coverage" reads as a deliberate zero
           rather than a missing row the map would have to guess about. */
        var states = await db.States.AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(s => new { s.Code, s.Name })
            .ToListAsync(ct);

        var visible = currentUser.IsMasterScoped && currentUser.ScopeStateCodes.Count > 0
            ? currentUser.ScopeStateCodes.ToHashSet()
            : null;

        var result = new StateCoverageResultDto();
        foreach (var state in states)
        {
            if (visible is not null && !visible.Contains(state.Code)) continue;

            var row = byState.GetValueOrDefault(state.Code);
            result.States.Add(new StateCoverageDto
            {
                StateCode = state.Code,
                State = Title(state.Name),
                ProgramTypes = row?.ProgramTypes ?? 0,
                Programmes = row?.Programmes ?? 0,
                Participants = row?.Participants ?? 0,
            });
        }

        result.MaxProgramTypes = result.States.Count == 0 ? 0 : result.States.Max(s => s.ProgramTypes);
        result.MaxParticipants = result.States.Count == 0 ? 0 : result.States.Max(s => s.Participants);
        result.TotalParticipants = result.States.Sum(s => s.Participants);
        result.TotalProgrammes = result.States.Sum(s => s.Programmes);
        /* Completion, not presence. A batch sitting in a calendar is a plan,
           and counting it here told the reader three states had a programme
           running on a screen whose every other number was zero. A state is
           covered once something has actually been conducted in it. */
        result.StatesCovered = result.States.Count(s => s.Programmes > 0);

        await AddDistrictsAsync(result, programmes, filter, ct);
        return result;
    }

    /// <summary>
    /// The districts behind the map, which is what the table beside it lists.
    ///
    /// Districts everywhere by default, and one state's districts when the
    /// filter names a state. The map itself still draws states, because there
    /// are no district outlines to draw — but the question the table answers
    /// is "where did this happen", and a district is the answer to that.
    ///
    /// Districts with nothing are listed too, for the same reason states were:
    /// an empty district is the more interesting half of the answer, and a
    /// missing row reads as an oversight rather than a zero.
    /// </summary>
    private async Task AddDistrictsAsync(
        StateCoverageResultDto result,
        IQueryable<Programme> programmes,
        DashboardFilterDto filter,
        CancellationToken ct)
    {
        int? onlyState = null;

        if (!string.IsNullOrWhiteSpace(filter.State))
        {
            var name = filter.State.Trim().ToUpperInvariant();
            var state = await db.States.AsNoTracking()
                .Where(s => s.Name == name)
                .Select(s => new { s.Code, s.Name })
                .FirstOrDefaultAsync(ct);

            if (state is null) return;

            /* A manager who does not hold this state sees nothing for it, the
               same way the state list above is filtered. */
            if (currentUser.IsMasterScoped && currentUser.ScopeStateCodes.Count > 0 &&
                !currentUser.ScopeStateCodes.Contains(state.Code))
            {
                return;
            }

            onlyState = state.Code;
            result.DistrictsOf = Title(state.Name);
        }

        /* An allocation of one state is a state filter nobody had to set.

           The table below drops to districts whenever the reader can only
           see one state, but the line above it only said which state those
           districts belonged to when a filter had been chosen by hand. So a
           manager allocated to Delhi alone opened the dashboard and read
           "0 of 36 states and union territories have conducted a program"
           over a list of Delhi's districts: the heading counting one thing
           and the table showing another. */
        if (onlyState is null
            && currentUser.IsMasterScoped
            && currentUser.ScopeStateCodes.Count == 1)
        {
            var only = currentUser.ScopeStateCodes[0];

            var name = await db.States.AsNoTracking()
                .Where(s => s.Code == only)
                .Select(s => s.Name)
                .FirstOrDefaultAsync(ct);

            if (name is not null) result.DistrictsOf = Title(name);
        }

        var rows = await programmes
            .Where(p => p.DistrictCode != null)
            .GroupBy(p => p.DistrictCode!.Value)
            .Select(g => new
            {
                DistrictCode = g.Key,
                /* Conducted, matching the states above and the column head. */
                ProgramTypes = g.Where(p => p.Status == ProgramStatus.Conducted)
                    .Select(p => p.ProgramTypeId).Distinct().Count(),
                Programmes = g.Count(p => p.Status == ProgramStatus.Conducted),
                /* Conducted, like the two above it and like the states. */
                Participants = g.Where(p => p.Status == ProgramStatus.Conducted)
                    .SelectMany(p => p.Participants).Count(),
            })
            .ToListAsync(ct);

        var byDistrict = rows.ToDictionary(r => r.DistrictCode);

        /* Scoped the same way the states are: a manager who holds three states
           gets the districts of those three and no others. */
        var visible = currentUser.IsMasterScoped && currentUser.ScopeStateCodes.Count > 0
            ? currentUser.ScopeStateCodes.ToHashSet()
            : null;

        var districts = await db.Districts.AsNoTracking()
            .WhereIf(onlyState.HasValue, d => d.StateCode == onlyState!.Value)
            .OrderBy(d => d.Name)
            .Select(d => new { d.Code, d.Name, d.StateCode, StateName = d.State!.Name })
            .ToListAsync(ct);

        foreach (var district in districts)
        {
            if (visible is not null && !visible.Contains(district.StateCode)) continue;

            var row = byDistrict.GetValueOrDefault(district.Code);
            result.Districts.Add(new DistrictCoverageDto
            {
                DistrictCode = district.Code,
                District = Title(district.Name),
                StateCode = district.StateCode,
                State = Title(district.StateName),
                ProgramTypes = row?.ProgramTypes ?? 0,
                Programmes = row?.Programmes ?? 0,
                Participants = row?.Participants ?? 0,
            });
        }
    }

    /// <summary>
    /// LGD stores state names in capitals, which shouts on a map label.
    /// </summary>
    private static string Title(string name) =>
        System.Globalization.CultureInfo.GetCultureInfo("en-IN").TextInfo
            .ToTitleCase(name.ToLowerInvariant());

    public async Task<DashboardDto> LoadAsync(DashboardFilterDto filter, CancellationToken ct)
    {
        var mode = EnumMaps.ParseEnumOrNull<ProgramMode>(filter.Mode);
        /* One window for the whole dashboard, whether it came from the rolling
           selector or from an explicit range. */
        var (from, to) = filter.Window();
        var fromStamp = from.HasValue ? from.Value.ToDateTime(TimeOnly.MinValue) : (DateTime?)null;
        /* Inclusive of the closing day, so "to 31 March" includes the 31st. */
        var toStamp = to.HasValue ? to.Value.ToDateTime(TimeOnly.MaxValue) : (DateTime?)null;

        /* No Includes, and nothing materialised.

           This used to pull every programme in scope into memory - with
           its curriculum, category, sub-category, type, agency,
           coordinator, manager, state, sessions, participants and every
           participant's applicant and application hanging off it - and
           then count the rows in C#. Every figure on this dashboard is an
           aggregate, so each one is now a GROUP BY the database answers
           without sending the rows at all.

           It was the slowest thing in the system by an order of
           magnitude: four hundred milliseconds a call against two
           thousand batches on a laptop, and linear in the register, so a
           year of operation and a room full of people signing in at nine
           would have been the first thing to fall over. */
        var programmes = db.Programmes.AsNoTracking()
            .WithinScope(currentUser)
            .WhereIf(filter.CategoryId.HasValue, p => p.CategoryId == filter.CategoryId)
            .WhereIf(filter.SubCategoryId.HasValue, p => p.SubCategoryId == filter.SubCategoryId)
            .WhereIf(filter.ProgramTypeId.HasValue, p => p.ProgramTypeId == filter.ProgramTypeId)
            .WhereIf(filter.AgencyId.HasValue, p => p.AgencyId == filter.AgencyId)
            .WhereIf(mode.HasValue, p => p.Mode == mode)
            .WhereIf(!string.IsNullOrWhiteSpace(filter.State),
                p => p.State!.Name == filter.State!.ToUpperInvariant())
            .WhereIf(from.HasValue, p => p.StartDate >= from)
            .WhereIf(to.HasValue, p => p.StartDate <= to);

        /* The headline pair counts profile scrutiny, not applications.
           Scrutiny happens once, on the profile, and an application is
           accepted as it arrives — so counting applications counted a step
           nobody takes a decision at. The register is gone with it. */
        var profiles = db.ProfileSubmissions.AsNoTracking()
            .Where(s => s.Status != ProfileSubmissionStatus.Draft)
            .WhereIf(filter.CategoryId.HasValue, s => s.CategoryId == filter.CategoryId)
            .WhereIf(filter.SubCategoryId.HasValue, s => s.SubCategoryId == filter.SubCategoryId)
            .WhereIf(filter.ProgramTypeId.HasValue, s => db.ProgramTypes
                .Any(p => p.Id == filter.ProgramTypeId && p.SubCategoryId == s.SubCategoryId))
            .WhereIf(!string.IsNullOrWhiteSpace(filter.State),
                s => s.Applicant!.State!.Name == filter.State!.ToUpperInvariant())
            .WhereIf(fromStamp.HasValue, s => s.SubmittedOn >= fromStamp)
            .WhereIf(toStamp.HasValue, s => s.SubmittedOn <= toStamp);

        /* The same desk the scrutiny queue shows. An Operation Manager's
           register holds the profiles given to them, so a headline counting
           every profile in the scheme sat above a list of their own and the
           two disagreed — five received over an empty queue. */
        if (currentUser.Tier == BaseRole.OperationManager)
        {
            var self = currentUser.UserId ?? 0;
            profiles = profiles.Where(s => s.AssignedToUserId == self);
        }

        /* A dashboard is a summary of what this account is responsible
           for, not a fixed set of five cards. A tier that cannot open the
           scrutiny queue has no business being shown how many profiles
           arrived, and a card reading zero because the reader may not see
           the data is worse than no card: it says the scheme is idle.

           Read before the counts rather than after them, because they now
           decide which counts are worth asking the database for. */
        var seesProfiles = currentUser.HasPermission(Permissions.ApplicationsView);
        var seesProgrammes = currentUser.HasPermission(Permissions.ProgramsView);

        var profilesReceived = await profiles.CountAsync(ct);
        var profilesApproved = await profiles
            .CountAsync(s => s.Status == ProfileSubmissionStatus.Approved, ct);

        var conducted = await programmes
            .CountAsync(p => p.Status == ProgramStatus.Conducted, ct);

        /* Everyone who was on a programme that actually ran, whatever the
           outcome — distinct from the certified count, which is only those
           who passed. Conducted only: enrolment is an intention, and a
           headline counting people onto batches that have not happened
           reports the scheme's hopes as its reach. */
        var participated = await programmes
            .Where(p => p.Status == ProgramStatus.Conducted)
            .SelectMany(p => p.Participants)
            .CountAsync(ct);

        var certified = await programmes
            .Where(p => p.Status == ProgramStatus.Conducted)
            .SelectMany(p => p.Participants)
            .CountAsync(x => x.Result == ParticipantResult.Pass, ct);

        /* The month chart, as one grouped count rather than a pass over
           every row per month. Only the months that have something in
           them come back; the series below fills in the empty ones, which
           it has to do anyway. */
        var byMonth = seesProgrammes
            ? await programmes
                .Where(p => p.Status == ProgramStatus.Conducted)
                .GroupBy(p => new { p.StartDate.Year, p.StartDate.Month })
                .Select(g => new MonthCount(g.Key.Year, g.Key.Month, g.Count()))
                .ToListAsync(ct)
            : [];

        /* And the two participant profiles, counted the same way: over
           the same participant rows the "Candidates participated"
           headline counts, so the three can never disagree. */
        var byGender = seesProgrammes
            ? await programmes
                .Where(p => p.Status == ProgramStatus.Conducted)
                .SelectMany(p => p.Participants)
                .Where(x => x.Applicant != null)
                .GroupBy(x => x.Applicant!.Gender)
                .Select(g => new EnumCount<Gender>(g.Key, g.Count()))
                .ToListAsync(ct)
            : [];

        var bySocialCategory = seesProgrammes
            ? await programmes
                .Where(p => p.Status == ProgramStatus.Conducted)
                .SelectMany(p => p.Participants)
                .Where(x => x.Applicant != null)
                .GroupBy(x => x.Applicant!.SocialCategory)
                .Select(g => new EnumCount<SocialCategory>(g.Key, g.Count()))
                .ToListAsync(ct)
            : [];

        /* The headline counts the scheme, so it belongs to the tiers that
           answer for the scheme. An agency runs the batches it raises and a
           coordinator records the one it was given; neither is answerable
           for how many profiles arrived or how many candidates the country
           certified, and a row of totals they cannot act on reads as though
           it were their own tally. They keep the map and the charts, which
           are the same picture without the scoreboard. */
        var answersForTheScheme = currentUser.Tier
            is BaseRole.SuperAdmin or BaseRole.Ministry
            or BaseRole.Admin or BaseRole.OperationManager;

        var kpis = new List<DashboardKpiDto>();
        if (answersForTheScheme && seesProfiles)
        {
            kpis.Add(new() { Key = "profiles", Label = "Profiles received", Value = profilesReceived, Tone = "primary", Icon = "inbox" });
            kpis.Add(new() { Key = "profilesApproved", Label = "Profiles approved", Value = profilesApproved, Tone = "success", Icon = "check" });
        }

        if (answersForTheScheme && seesProgrammes)
        {
            kpis.Add(new() { Key = "programs", Label = "Programs conducted", Value = conducted, Tone = "info", Icon = "calendar" });
            kpis.Add(new() { Key = "participated", Label = "Candidates participated", Value = participated, Tone = "primary", Icon = "users" });
            kpis.Add(new() { Key = "certified", Label = "Candidates certified", Value = certified, Tone = "success", Icon = "award" });
        }

        return new DashboardDto
        {
            Kpis = kpis,
            /* The charts and the map are drawn from programmes, so they
               stand or fall with the same permission. */
            ProgramsByMonth = MonthSeries(byMonth, from, to),
            ParticipantsByGender = Profile(
                byGender, g => g == Gender.Other ? "Others" : g.ToString()),
            ParticipantsBySocialCategory = Profile(bySocialCategory, c => c.ToString()),
        };
    }

    /// <summary>
    /// Programmes conducted per calendar month, newest first.
    ///
    /// Conducted, and only conducted — which is what the card is titled and
    /// what the figure beside it counts. This counted every batch whose start
    /// date fell in the month whatever had become of it, so a dashboard
    /// reading "Programs conducted 0" sat above a bar of six that were
    /// raised, permitted, or still to run.
    ///
    /// The month the reader is standing in comes first and history runs away to
    /// the right, because "how are we doing now" is the question the card is
    /// there to answer; last January is context, not the headline.
    ///
    /// Labels carry the year — "Sep 26" — since the series is no longer one
    /// calendar year and "Jan" alone would be ambiguous across the fold.
    /// </summary>
    /// <summary>One month's tally, as the database grouped it.</summary>
    private readonly record struct MonthCount(int Year, int Month, int Count);

    /// <summary>One option's tally, for a column the answer is an enum of.</summary>
    private readonly record struct EnumCount<T>(T? Value, int Count) where T : struct, Enum;

    private static List<SeriesPointDto> MonthSeries(
        IReadOnlyCollection<MonthCount> tallies, DateOnly? from, DateOnly? to)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        /* Bounded by the chosen period where there is one, so the chart covers
           the same span as every other figure on the dashboard. */
        var last = to ?? today;
        var first = from ?? last.AddMonths(-(DefaultMonthsBack - 1));

        var cursor = new DateOnly(last.Year, last.Month, 1);
        var stop = new DateOnly(first.Year, first.Month, 1);

        var points = new List<SeriesPointDto>();
        while (cursor >= stop)
        {
            var month = cursor;
            points.Add(new SeriesPointDto
            {
                Label = month.ToString("MMM yy", CultureInfo.InvariantCulture),
                /* The months with nothing in them are not in the
                   tallies and still have to appear on the chart, which is
                   what this loop is for. */
                Value = tallies
                    .FirstOrDefault(t => t.Year == month.Year && t.Month == month.Month)
                    .Count,
            });
            cursor = cursor.AddMonths(-1);
        }

        return points;
    }

    /// <summary>
    /// Counts a self-declared attribute across participants, in the enum's own
    /// order so the bars do not reshuffle between refreshes.
    ///
    /// Every option is listed even at zero — a missing bar reads as "no data
    /// collected" where a zero reads as "none in this group", and those are
    /// different findings. "Not stated" is appended only when some rows really
    /// are unanswered, so the totals add up to the participant count without
    /// carrying a permanently empty slice.
    /// </summary>
    private static List<SeriesPointDto> Profile<T>(
        IReadOnlyCollection<EnumCount<T>> tallies,
        Func<T, string> label)
        where T : struct, Enum
    {
        /* Every option appears, including the ones nobody chose: a bar
           chart missing a bar reads as a category that does not exist
           rather than one at zero. */
        var points = Enum.GetValues<T>()
            .Select(option => new SeriesPointDto
            {
                Label = label(option),
                Value = tallies.FirstOrDefault(t => Equals(t.Value, option)).Count,
            })
            .ToList();

        var unstated = tallies.Where(t => t.Value is null).Sum(t => t.Count);
        if (unstated > 0)
        {
            points.Add(new SeriesPointDto { Label = "Not stated", Value = unstated });
        }

        return points;
    }
}
