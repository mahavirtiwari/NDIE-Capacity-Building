using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/* ------------------------------------------------------------------ lookups */

public class LookupService(NtmsDbContext db, ICurrentUser currentUser)
{
    public Task<List<LookupItemDto>> CategoriesAsync(CancellationToken ct) =>
        db.Categories.AsNoTracking()
            .Where(c => c.Status == RecordStatus.Active)
            .OrderBy(c => c.DisplayOrder)
            .Select(c => new LookupItemDto { Id = c.Id, Name = c.Name, Code = c.Code })
            .ToListAsync(ct);

    public Task<List<LookupItemDto>> SubCategoriesAsync(int? categoryId, CancellationToken ct) =>
        db.SubCategories.AsNoTracking()
            .Where(s => s.Status == RecordStatus.Active)
            .WhereIf(categoryId.HasValue, s => s.CategoryId == categoryId)
            .OrderBy(s => s.DisplayOrder)
            .Select(s => new LookupItemDto
            {
                Id = s.Id, Name = s.Name, Code = s.Code, ParentId = s.CategoryId,
            })
            .ToListAsync(ct);

    public Task<List<LookupItemDto>> ProgramTypesAsync(
        int? categoryId, int? subCategoryId, CancellationToken ct) =>
        db.ProgramTypes.AsNoTracking()
            .Where(p => p.Status == RecordStatus.Active)
            .WhereIf(categoryId.HasValue, p => p.CategoryId == categoryId)
            .WhereIf(subCategoryId.HasValue, p => p.SubCategoryId == subCategoryId)
            .OrderBy(p => p.Code)
            .Select(p => new LookupItemDto
            {
                Id = p.Id, Name = p.Name, Code = p.Code, ParentId = p.SubCategoryId,
            })
            .ToListAsync(ct);

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
    /// The educational qualification ladder, in order. Served from the shared
    /// catalogue so the dropdown and the server validation can never disagree.
    /// </summary>
    public Task<List<LookupItemDto>> QualificationsAsync(CancellationToken ct) =>
        Task.FromResult(QualificationLevels.All
            .Select(l => new LookupItemDto { Id = l.Rank, Name = l.Label, Code = l.Code })
            .ToList());

    public Task<List<LookupItemDto>> RolesAsync(CancellationToken ct) =>
        db.Roles.AsNoTracking()
            .Where(r => r.Status == RecordStatus.Active)
            .OrderBy(r => r.Name)
            .Select(r => new LookupItemDto { Id = r.Id, Name = r.Name, Code = r.Code })
            .ToListAsync(ct);

    /// <summary>LGD state master. The lookup id is the LGD state code.</summary>
    public Task<List<LookupItemDto>> StatesAsync(CancellationToken ct) =>
        db.States.AsNoTracking()
            .OrderBy(s => s.Name)
            .Select(s => new LookupItemDto
            {
                Id = s.Code, Name = s.Name, Code = s.Code.ToString(),
            })
            .ToListAsync(ct);

    /// <summary>LGD district master for one state.</summary>
    public Task<List<LookupItemDto>> DistrictsAsync(int? stateCode, string? state, CancellationToken ct) =>
        db.Districts.AsNoTracking()
            .WhereIf(stateCode.HasValue, d => d.StateCode == stateCode)
            .WhereIf(!string.IsNullOrWhiteSpace(state), d => d.State!.Name == state!.ToUpperInvariant())
            .OrderBy(d => d.Name)
            .Select(d => new LookupItemDto
            {
                Id = d.Code, Name = d.Name, Code = d.Code.ToString(), ParentId = d.StateCode,
            })
            .ToListAsync(ct);
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
                ProgramTypes = g.Select(p => p.ProgramTypeId).Distinct().Count(),
                /* Conducted only, because the column is headed "Programmes
                   conducted" and has to agree with the KPI of that name.
                   Counting scheduled batches here put 12 under the table
                   against 10 in the card beside it. */
                Programmes = g.Count(p => p.Status == ProgramStatus.Conducted),
                /* Everyone enrolled, whatever the batch's status — the same
                   population as the "Candidates participated" KPI. */
                Participants = g.SelectMany(p => p.Participants).Count(),
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
        /* Presence, not completion: a state with a batch in the calendar is
           covered even though nothing has been conducted there yet. A state has
           a programme type recorded only if it has at least one programme. */
        result.StatesCovered = result.States.Count(s => s.ProgramTypes > 0);
        return result;
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

        /* Scoped like every other read. Without this the headline figures
           showed the whole estate to every tier while the map beside them
           showed only the caller's slice. */
        var applications = db.Applications.AsNoTracking()
            .WithinScope(currentUser)
            .Include(a => a.Applicant)
            .Include(a => a.Category)
            .Include(a => a.SubCategory)
            .Include(a => a.ProgramType)
            .Include(a => a.AssignedToUser)
            .Include(a => a.State)
            .Include(a => a.Documents)
            .Include(a => a.History)
            .WhereIf(filter.CategoryId.HasValue, a => a.CategoryId == filter.CategoryId)
            .WhereIf(filter.SubCategoryId.HasValue, a => a.SubCategoryId == filter.SubCategoryId)
            .WhereIf(filter.ProgramTypeId.HasValue, a => a.ProgramTypeId == filter.ProgramTypeId)
            .WhereIf(!string.IsNullOrWhiteSpace(filter.State),
                a => a.State!.Name == filter.State!.ToUpperInvariant())
            .WhereIf(fromStamp.HasValue, a => a.SubmittedOn >= fromStamp)
            .WhereIf(toStamp.HasValue, a => a.SubmittedOn <= toStamp);

        var programmes = db.Programmes.AsNoTracking()
            .WithinScope(currentUser)
            /* Through to the programme type: the curriculum's code lives there now. */
            .Include(p => p.Curriculum)!.ThenInclude(c => c!.ProgramType)
            .Include(p => p.Category)
            .Include(p => p.SubCategory)
            .Include(p => p.ProgramType)
            .Include(p => p.Agency)
            .Include(p => p.Coordinator)
            .Include(p => p.OperationManager)
            .Include(p => p.State)
            .Include(p => p.Sessions)
            .Include(p => p.Participants).ThenInclude(x => x.Applicant)
            .Include(p => p.Participants).ThenInclude(x => x.Application)
            .WhereIf(filter.CategoryId.HasValue, p => p.CategoryId == filter.CategoryId)
            .WhereIf(filter.SubCategoryId.HasValue, p => p.SubCategoryId == filter.SubCategoryId)
            .WhereIf(filter.ProgramTypeId.HasValue, p => p.ProgramTypeId == filter.ProgramTypeId)
            .WhereIf(filter.AgencyId.HasValue, p => p.AgencyId == filter.AgencyId)
            .WhereIf(mode.HasValue, p => p.Mode == mode)
            .WhereIf(!string.IsNullOrWhiteSpace(filter.State),
                p => p.State!.Name == filter.State!.ToUpperInvariant())
            .WhereIf(from.HasValue, p => p.StartDate >= from)
            .WhereIf(to.HasValue, p => p.StartDate <= to);

        var applicationRows = await applications.ToListAsync(ct);
        var programmeRows = await programmes.ToListAsync(ct);

        var approved = applicationRows.Count(a =>
            a.Status is ApplicationStatus.Approved or ApplicationStatus.Enrolled);
        var conducted = programmeRows.Count(p => p.Status == ProgramStatus.Conducted);
        /* Everyone enrolled on a programme, whatever the outcome — distinct from
           the certified count, which is only those who passed. */
        var participated = programmeRows.Sum(p => p.Participants.Count);
        var certified = programmeRows
            .Where(p => p.Status == ProgramStatus.Conducted)
            .Sum(p => p.Participants.Count(x => x.Result == ParticipantResult.Pass));

        /* Counted over the same participant rows the "Candidates participated"
           headline counts, so the two can never disagree. */
        var participants = programmeRows
            .SelectMany(p => p.Participants)
            .Select(x => x.Applicant)
            .Where(a => a is not null)
            .ToList();

        return new DashboardDto
        {
            Kpis =
            [
                new() { Key = "applications", Label = "Applications received", Value = applicationRows.Count, Tone = "primary", Icon = "inbox" },
                new() { Key = "approved", Label = "Approved applications", Value = approved, Tone = "success", Icon = "check" },
                new() { Key = "programs", Label = "Programmes conducted", Value = conducted, Tone = "info", Icon = "calendar" },
                new() { Key = "participated", Label = "Candidates participated", Value = participated, Tone = "primary", Icon = "users" },
                new() { Key = "certified", Label = "Candidates certified", Value = certified, Tone = "success", Icon = "award" },
            ],
            ProgramsByMonth = MonthSeries(programmeRows, from, to),
            ParticipantsByGender = Profile(
                participants,
                a => a!.Gender,
                g => g == Gender.Other ? "Others" : g.ToString()),
            ParticipantsBySocialCategory = Profile(
                participants,
                a => a!.SocialCategory,
                c => c.ToString()),
        };
    }

    /// <summary>
    /// Programmes per calendar month, newest first.
    ///
    /// The month the reader is standing in comes first and history runs away to
    /// the right, because "how are we doing now" is the question the card is
    /// there to answer; last January is context, not the headline.
    ///
    /// Labels carry the year — "Sep 26" — since the series is no longer one
    /// calendar year and "Jan" alone would be ambiguous across the fold.
    /// </summary>
    private static List<SeriesPointDto> MonthSeries(
        List<Programme> programmes, DateOnly? from, DateOnly? to)
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
                Value = programmes.Count(p =>
                    p.StartDate.Year == month.Year && p.StartDate.Month == month.Month),
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
        IReadOnlyCollection<Applicant?> participants,
        Func<Applicant?, T?> pick,
        Func<T, string> label)
        where T : struct, Enum
    {
        var points = Enum.GetValues<T>()
            .Select(option => new SeriesPointDto
            {
                Label = label(option),
                Value = participants.Count(a => Equals(pick(a), option)),
            })
            .ToList();

        var unstated = participants.Count(a => pick(a) is null);
        if (unstated > 0)
        {
            points.Add(new SeriesPointDto { Label = "Not stated", Value = unstated });
        }

        return points;
    }
}
