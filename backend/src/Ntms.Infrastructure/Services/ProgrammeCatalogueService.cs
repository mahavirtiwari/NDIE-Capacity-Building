using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Batches as the outside world sees them: on the shareable link an agency
/// hands out, and in the applicant's app.
///
/// Separate from <see cref="ProgrammeService"/> on purpose. That one is scoped
/// to whoever is signed in and answers "which batches am I responsible for";
/// this one answers "which batches can somebody attend", and its callers are
/// anonymous or an applicant. Keeping them apart means the scope filters on the
/// administrative side cannot accidentally be the thing standing between the
/// public and a page that is meant to be public.
/// </summary>
public class ProgrammeCatalogueService(NtmsDbContext db)
{
    /* Only a batch that has been approved and is running in the future is worth
       showing. A New one has not been permitted yet, and a rejected or
       conducted one cannot be joined. */
    private static readonly ProgramStatus[] Listable =
    [
        ProgramStatus.PermissionAccepted,
        ProgramStatus.CalendarCreated,
    ];

    /* Everything an approval has been given for, including batches already
       run. The listing shows history as well as what is coming: somebody
       deciding whether this training is worth applying for wants to see that it
       runs regularly, not just the one batch currently open. */
    private static readonly ProgramStatus[] Published =
    [
        ProgramStatus.PermissionAccepted,
        ProgramStatus.CalendarCreated,
        ProgramStatus.Conducted,
    ];

    private IQueryable<Programme> Base => db.Programmes.AsNoTracking()
        .Include(p => p.ProgramType)
        .Include(p => p.Category)
        .Include(p => p.SubCategory)
        .Include(p => p.State)
        .Include(p => p.District)
        .Include(p => p.Agency);

    /* --------------------------------------------------------- the link */

    /// <summary>
    /// One batch by its code, for the shareable link.
    ///
    /// A batch that exists but is not open still resolves, and says why — a
    /// link that was shared widely should explain that the batch filled up or
    /// has already run, rather than turning into a dead end.
    /// </summary>
    public async Task<PublicProgrammeDto> ByCodeAsync(string code, CancellationToken ct)
    {
        var trimmed = (code ?? string.Empty).Trim();

        /* Generated codes have no slashes, so they sit in a URL segment as they
           are. Older ones do, and a slash cannot survive a path segment however
           it is encoded — so a hyphenated form of the same code is accepted,
           which is what a shareable link should carry anyway. */
        var slashed = trimmed.Replace('-', '/');

        var programme = await Base
            .FirstOrDefaultAsync(p => p.ProgrammeId == trimmed || p.ProgrammeId == slashed, ct)
            ?? throw AppException.NotFound("Program");

        /* A batch nobody has approved yet is not public. Until then the link
           would advertise something that may never run. */
        if (programme.Status == ProgramStatus.New)
            throw AppException.NotFound("Program");

        return ToPublic(programme);
    }

    /// <summary>
    /// The public programme listing: every published batch, newest first,
    /// narrowed by whatever the reader chose.
    ///
    /// Newest first rather than soonest: the top of this list should be what is
    /// about to happen, and a listing that opened on batches from two years ago
    /// would need scrolling before it said anything useful.
    /// </summary>
    public async Task<PagedResult<PublicProgrammeDto>> SearchAsync(
        PublicProgrammeFilterDto filter, PagedRequest request, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var search = filter.Search?.Trim();

        var query = Base
            .Where(p => Published.Contains(p.Status))
            .WhereIf(filter.ProgramTypeId.HasValue, p => p.ProgramTypeId == filter.ProgramTypeId)
            .WhereIf(filter.StateCode.HasValue, p => p.StateCode == filter.StateCode)
            .WhereIf(filter.DistrictCode.HasValue, p => p.DistrictCode == filter.DistrictCode)
            .WhereIf(filter.From.HasValue, p => p.StartDate >= filter.From)
            .WhereIf(filter.To.HasValue, p => p.StartDate <= filter.To)
            .WhereIf(!string.IsNullOrWhiteSpace(search),
                p => p.ProgrammeId.Contains(search!)
                    || p.ProgrammeName.Contains(search!)
                    || p.Venue.Contains(search!));

        /* Where a batch sits in time is a comparison against today, not a
           stored column, so it is expressed here rather than filtered in memory
           after paging — which would make the page counts wrong. */
        query = (filter.Status ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "upcoming" => query.Where(p => p.StartDate > today),
            "ongoing" => query.Where(p => p.StartDate <= today && p.EndDate >= today),
            "completed" => query.Where(p => p.EndDate < today),
            _ => query,
        };

        return await query
            .OrderByDescending(p => p.StartDate)
            .ThenByDescending(p => p.Id)
            .ToPagedResultAsync(request, ToPublic, ct);
    }

    /// <summary>Every batch currently open for registration, soonest first.</summary>
    public async Task<List<PublicProgrammeDto>> OpenAsync(
        int? programTypeId, int? stateCode, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var rows = await Base
            .Where(p => Listable.Contains(p.Status) && p.RegistrationsOpen && p.StartDate >= today)
            .WhereIf(programTypeId.HasValue, p => p.ProgramTypeId == programTypeId)
            .WhereIf(stateCode.HasValue, p => p.StateCode == stateCode)
            .OrderBy(p => p.StartDate)
            .ToListAsync(ct);

        return [.. rows.Select(ToPublic)];
    }

    /* ----------------------------------------------------- the applicant */

    /// <summary>
    /// The batches an applicant can see, with their own standing on each.
    ///
    /// Narrowed to the tracks their profile qualifies them for, so the list is
    /// what they could actually attend rather than everything on offer.
    /// </summary>
    public async Task<List<ApplicantBatchDto>> ForApplicantAsync(
        int applicantId, CancellationToken ct)
    {
        var applicant = await db.Applicants.AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == applicantId, ct)
            ?? throw AppException.NotFound("Applicant");

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var rows = await Base
            .Where(p => Listable.Contains(p.Status) && p.RegistrationsOpen && p.StartDate >= today)
            /* The applicant registered under one sub-category; batches outside
               it are not theirs to join. */
            .Where(p => p.SubCategoryId == applicant.SubCategoryId)
            .OrderBy(p => p.StartDate)
            .ToListAsync(ct);

        var programmeIds = rows.Select(p => p.Id).ToList();

        var enrolled = await db.ProgrammeParticipants.AsNoTracking()
            .Where(x => x.ApplicantId == applicantId && programmeIds.Contains(x.ProgrammeId))
            .Select(x => x.ProgrammeId)
            .ToListAsync(ct);

        var appliedTypes = await db.Applications.AsNoTracking()
            .Where(a => a.ApplicantId == applicantId
                && a.Status != ApplicationStatus.Rejected
                && a.Status != ApplicationStatus.Draft)
            .Select(a => a.ProgramTypeId)
            .Distinct()
            .ToListAsync(ct);

        return
        [
            .. rows.Select(p =>
            {
                var dto = ToPublic(p);
                return new ApplicantBatchDto
                {
                    Id = p.Id,
                    ProgramTypeId = p.ProgramTypeId,
                    IsEnrolled = enrolled.Contains(p.Id),
                    HasApplied = appliedTypes.Contains(p.ProgramTypeId),
                    ProgrammeId = dto.ProgrammeId,
                    ProgrammeName = dto.ProgrammeName,
                    ProgramTypeName = dto.ProgramTypeName,
                    ShortDescription = dto.ShortDescription,
                    CategoryName = dto.CategoryName,
                    SubCategoryName = dto.SubCategoryName,
                    Mode = dto.Mode,
                    Venue = dto.Venue,
                    City = dto.City,
                    State = dto.State,
                    StartDate = dto.StartDate,
                    EndDate = dto.EndDate,
                    DurationDays = dto.DurationDays,
                    MaxParticipants = dto.MaxParticipants,
                    Enrolled = dto.Enrolled,
                    SeatsLeft = dto.SeatsLeft,
                    RegistrationsOpen = dto.RegistrationsOpen,
                    RegistrationStatus = dto.RegistrationStatus,
                    AgencyName = dto.AgencyName,
                    MinQualificationLabel = dto.MinQualificationLabel,
                    MinExperienceYears = dto.MinExperienceYears,
                    IsFeeApplicable = dto.IsFeeApplicable,
                };
            }),
        ];
    }

    /* ------------------------------------------------------------ filters */

    /// <summary>
    /// The names the listing's filters are built from.
    ///
    /// Only the tracks that actually have a published batch are offered: a
    /// dropdown full of programme types nobody has ever run would produce empty
    /// results and no explanation.
    /// </summary>
    public async Task<PublicFilterOptionsDto> FilterOptionsAsync(CancellationToken ct)
    {
        var typeIds = await db.Programmes.AsNoTracking()
            .Where(p => Published.Contains(p.Status))
            .Select(p => p.ProgramTypeId)
            .Distinct()
            .ToListAsync(ct);

        return new PublicFilterOptionsDto
        {
            ProgramTypes =
            [
                .. await db.ProgramTypes.AsNoTracking()
                    .Where(t => typeIds.Contains(t.Id))
                    .OrderBy(t => t.Name)
                    .Select(t => new LookupItemDto { Id = t.Id, Name = t.Name, Code = t.Code })
                    .ToListAsync(ct),
            ],
            States =
            [
                .. await db.States.AsNoTracking()
                    .OrderBy(x => x.Name)
                    .Select(x => new LookupItemDto { Id = x.Code, Name = x.Name })
                    .ToListAsync(ct),
            ],
            Districts =
            [
                .. await db.Districts.AsNoTracking()
                    .OrderBy(x => x.Name)
                    .Select(x => new LookupItemDto
                    {
                        Id = x.Code,
                        Name = x.Name,
                        ParentId = x.StateCode,
                    })
                    .ToListAsync(ct),
            ],
        };
    }

    /* ------------------------------------------------------------ mapping */

    private static PublicProgrammeDto ToPublic(Programme p)
    {
        var virtualBatch = p.Mode == ProgramMode.Virtual;
        var full = p.MaxParticipants > 0 && p.ParticipantCount >= p.MaxParticipants;
        var over = DateOnly.FromDateTime(DateTime.UtcNow) > p.EndDate;

        return new PublicProgrammeDto
        {
            ProgrammeId = p.ProgrammeId,
            ProgrammeName = p.ProgrammeName,
            ProgramTypeName = p.ProgramType?.Name ?? string.Empty,
            ShortDescription = p.ProgramType?.ShortDescription,
            CategoryName = p.Category?.Name ?? string.Empty,
            SubCategoryName = p.SubCategory?.Name ?? string.Empty,

            Mode = p.Mode.ToString(),
            /* A virtual batch has no place, and saying "Virtual" in the venue
               column is more use to a reader than an empty cell. */
            Venue = virtualBatch ? "Virtual" : p.Venue,
            City = virtualBatch ? null : p.City,
            District = virtualBatch ? null : p.District?.Name,
            State = virtualBatch ? null : p.State?.Name,

            StartDate = p.StartDate,
            EndDate = p.EndDate,
            DurationDays = p.EndDate.DayNumber - p.StartDate.DayNumber + 1,

            MaxParticipants = p.MaxParticipants,
            Enrolled = p.ParticipantCount,
            /* Clamped: lowering a cap below the number already enrolled would
               otherwise advertise a negative number of seats. */
            SeatsLeft = Math.Max(0, p.MaxParticipants - p.ParticipantCount),

            ScheduleStatus = DateOnly.FromDateTime(DateTime.UtcNow) < p.StartDate
                ? "Upcoming"
                : over ? "Completed" : "Ongoing",

            RegistrationsOpen = p.RegistrationsOpen,
            RegistrationStatus = p.RegistrationsOpen
                ? "Open"
                : full ? "Full"
                : over ? "Already held"
                : p.Status == ProgramStatus.New ? "Awaiting approval"
                : "Closed",

            AgencyName = p.Agency?.Name,
            MinQualificationLabel = QualificationLevels.LabelFor(p.ProgramType?.MinQualification),
            MinExperienceYears = p.ProgramType?.MinExperienceYears ?? 0,
            IsFeeApplicable = p.ProgramType?.IsFeeApplicable ?? false,
        };
    }
}
