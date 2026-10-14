using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// The faculty register: everybody who has delivered a programme.
///
/// A trainer is held against the programme they took rather than as a shared
/// master, because the record is of who actually turned up to deliver it —
/// correcting one workshop's record must not rewrite another's. This reads
/// across all of them so the scheme can see its faculty as a whole, and lets
/// an administrator add or correct one from the portal, which until now only
/// the coordinator could do from the app.
/// </summary>
public class FacultyService(NtmsDbContext db, ICurrentUser currentUser)
{
    public async Task<PagedResult<FacultyDto>> ListAsync(
        PagedRequest request,
        int? categoryId,
        int? subCategoryId,
        int? programTypeId,
        int? agencyId,
        int? stateCode,
        int? programmeId,
        CancellationToken ct)
    {
        /* Scoped through the programme, as every estate-wide list is: the
           trainer is visible because the programme is. */
        var scoped = db.Programmes.AsNoTracking().WithinScope(currentUser).Select(p => p.Id);

        /* Except for a coordinator, who is scoped to their own work.
           Programme scope is by allocation - program types and states -
           so a coordinator could read every trainer on every batch of
           its discipline in its state, including the ones other
           coordinators registered. What a coordinator registers is a
           record of who turned up for the batch they were running, and
           theirs is the only one they have any business in. */
        var self = currentUser.UserId ?? 0;
        var coordinator = currentUser.Tier == Domain.Common.BaseRole.Coordinator;

        var query = db.ProgrammeTrainers.AsNoTracking()
            .Where(t => scoped.Contains(t.ProgrammeId))
            .WhereIf(coordinator, t => t.RegisteredByUserId == self)
            .WhereIf(programmeId.HasValue, t => t.ProgrammeId == programmeId)
            .WhereIf(categoryId.HasValue, t => t.Programme!.CategoryId == categoryId)
            .WhereIf(subCategoryId.HasValue, t => t.Programme!.SubCategoryId == subCategoryId)
            .WhereIf(programTypeId.HasValue, t => t.Programme!.ProgramTypeId == programTypeId)
            .WhereIf(agencyId.HasValue, t => t.Programme!.AgencyId == agencyId)
            .WhereIf(stateCode.HasValue, t => t.Programme!.StateCode == stateCode)
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                t => t.FullName.Contains(request.Search!)
                     || t.Mobile.Contains(request.Search!)
                     || (t.Organisation != null && t.Organisation.Contains(request.Search!)));

        query = (request.SortBy?.ToLowerInvariant()) switch
        {
            "organisation" => request.SortDir == "desc"
                ? query.OrderByDescending(t => t.Organisation)
                : query.OrderBy(t => t.Organisation),
            "programme" => request.SortDir == "desc"
                ? query.OrderByDescending(t => t.Programme!.ProgrammeId)
                : query.OrderBy(t => t.Programme!.ProgrammeId),
            "conducted" => request.SortDir == "desc"
                ? query.OrderByDescending(t => t.Programme!.StartDate)
                : query.OrderBy(t => t.Programme!.StartDate),
            _ => request.SortDir == "desc"
                ? query.OrderByDescending(t => t.FullName)
                : query.OrderBy(t => t.FullName),
        };

        var total = await query.CountAsync(ct);
        var page = Math.Max(1, request.Page);
        var size = Math.Clamp(request.PageSize, 1, 200);

        /* Projected field by field: mapping off loaded entities is how the
           report register ended up with a column of blanks. */
        var rows = await query
            .Skip((page - 1) * size)
            .Take(size)
            .Select(t => new FacultyDto
            {
                Id = t.Id,
                FullName = t.FullName,
                Mobile = t.Mobile,
                Email = t.Email,
                Designation = t.Designation,
                Organisation = t.Organisation,
                Engagement = t.Engagement == null ? null : t.Engagement.ToString(),
                YearsExperience = t.YearsExperience,
                Qualification = t.Qualification,
                /* The last four. The register lists every trainer in the
                   scheme, and handing back a column of Aadhaar numbers
                   to anybody who can open it is the whole problem. */
                AadhaarLast4 = t.Aadhaar == null || t.Aadhaar.Length < 4
                    ? null
                    : t.Aadhaar.Substring(t.Aadhaar.Length - 4),

                ProgrammeId = t.ProgrammeId,
                ProgrammeCode = t.Programme!.ProgrammeId,
                ProgrammeName = t.Programme!.ProgrammeName,
                ProgramTypeName = t.Programme!.ProgramType!.Name,
                AgencyName = t.Programme!.Agency!.Name,
                StateName = t.Programme!.State!.Name,
                StartDate = t.Programme!.StartDate,
                EndDate = t.Programme!.EndDate,
            })
            .ToListAsync(ct);

        return new PagedResult<FacultyDto>
        {
            Items = rows, Total = total, Page = page, PageSize = size,
        };
    }

    public async Task<FacultyDto> AddAsync(
        int programmeId, TrainerUpsertDto dto, CancellationToken ct)
    {
        await ForWriteAsync(programmeId, ct);
        Validate(dto);

        /* The web is not where a coordinator does this. They register
           whoever turned up from the app, on the day and on the spot,
           and this door is the administrator's - for adding one that was
           missed and for correcting what was taken down. Held here as
           well as hidden on the screen, because a hidden button is not a
           rule. */
        EnsureNotACoordinator();

        var trainer = new ProgrammeTrainer
        {
            ProgrammeId = programmeId,
            RegisteredByUserId = currentUser.UserId,
        };
        Apply(trainer, dto);

        db.ProgrammeTrainers.Add(trainer);
        await db.SaveChangesAsync(ct);

        return await OneAsync(trainer.Id, ct);
    }

    public async Task<FacultyDto> UpdateAsync(
        int trainerId, TrainerUpsertDto dto, CancellationToken ct)
    {
        EnsureNotACoordinator();

        var trainer = await db.ProgrammeTrainers.FirstOrDefaultAsync(t => t.Id == trainerId, ct)
                      ?? throw AppException.NotFound("Trainer");

        await ForWriteAsync(trainer.ProgrammeId, ct);
        Validate(dto);
        Apply(trainer, dto);

        await db.SaveChangesAsync(ct);
        return await OneAsync(trainerId, ct);
    }

    /// <summary>
    /// The programme, if this account may change its record.
    ///
    /// Scope rather than coordinator identity — this is the portal, not the
    /// app — but the same seal. A programme that has been finally submitted
    /// stops accepting changes from everybody, because "sealed" that an
    /// administrator can quietly reopen is not sealed.
    /// </summary>
    /// <summary>
    /// Keeps the portal's door shut to a coordinator.
    ///
    /// They hold trainers.manage because they are the people who take
    /// this down - from the app, at the venue, with the person in front
    /// of them. The web form is the administrator's, for the one that
    /// was missed and for correcting what was written, and a coordinator
    /// reaching it is a coordinator who has left the room.
    /// </summary>
    private void EnsureNotACoordinator()
    {
        if (currentUser.Tier != Domain.Common.BaseRole.Coordinator) return;

        throw AppException.Forbidden(
            "Trainers are registered from the coordinator app, on the day. "
            + "Ask the implementing agency to add one that was missed.");
    }

    private async Task ForWriteAsync(int programmeId, CancellationToken ct)
    {
        var visible = await db.Programmes.AsNoTracking()
            .WithinScope(currentUser)
            .AnyAsync(p => p.Id == programmeId, ct);

        if (!visible) throw AppException.NotFound("Program");

        var sealedOn = await db.ProgrammeSubmissions.AsNoTracking()
            .Where(s => s.ProgrammeId == programmeId)
            .Select(s => (DateTime?) s.SubmittedOn)
            .FirstOrDefaultAsync(ct);

        if (sealedOn is not null)
        {
            throw AppException.Conflict(
                $"This program was finally submitted on {IndianTime.Format(sealedOn.Value)} " +
                "and its record can no longer be changed.");
        }
    }

    private static void Validate(TrainerUpsertDto dto) =>
        Guard.Check()
            .Required(dto.FullName, "Trainer name")
            .Mobile(dto.Mobile)
            .Email(dto.Email, required: false)
            .ThrowIfInvalid();

    private static void Apply(ProgrammeTrainer trainer, TrainerUpsertDto dto)
    {
        trainer.FullName = dto.FullName.Trim();
        trainer.Mobile = dto.Mobile.Trim();
        trainer.Email = string.IsNullOrWhiteSpace(dto.Email)
            ? null
            : dto.Email.Trim().ToLowerInvariant();
        trainer.Designation = dto.Designation?.Trim();
        trainer.Organisation = dto.Organisation?.Trim();
    }

    /// <summary>The row as the register shows it, after a write.</summary>
    private async Task<FacultyDto> OneAsync(int trainerId, CancellationToken ct) =>
        await db.ProgrammeTrainers.AsNoTracking()
            .Where(t => t.Id == trainerId)
            .Select(t => new FacultyDto
            {
                Id = t.Id,
                FullName = t.FullName,
                Mobile = t.Mobile,
                Email = t.Email,
                Designation = t.Designation,
                Organisation = t.Organisation,
                Engagement = t.Engagement == null ? null : t.Engagement.ToString(),
                YearsExperience = t.YearsExperience,
                Qualification = t.Qualification,
                /* The last four. The register lists every trainer in the
                   scheme, and handing back a column of Aadhaar numbers
                   to anybody who can open it is the whole problem. */
                AadhaarLast4 = t.Aadhaar == null || t.Aadhaar.Length < 4
                    ? null
                    : t.Aadhaar.Substring(t.Aadhaar.Length - 4),

                ProgrammeId = t.ProgrammeId,
                ProgrammeCode = t.Programme!.ProgrammeId,
                ProgrammeName = t.Programme!.ProgrammeName,
                ProgramTypeName = t.Programme!.ProgramType!.Name,
                AgencyName = t.Programme!.Agency!.Name,
                StateName = t.Programme!.State!.Name,
                StartDate = t.Programme!.StartDate,
                EndDate = t.Programme!.EndDate,
            })
            .FirstAsync(ct);
}
