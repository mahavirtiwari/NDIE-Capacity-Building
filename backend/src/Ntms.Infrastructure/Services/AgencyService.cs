using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

public class AgencyService(
    NtmsDbContext db,
    ICodeGenerator codes,
    IPasswordService passwords,
    INotificationService notifications,
    DelegationGuard delegation,
    ICurrentUser currentUser,
    ILogger<AgencyService> logger)
{
    /* Scoped at the base query, so no read path can see an agency outside the
       manager's allocation however it reaches the data. */
    private IQueryable<ImplementingAgency> Base => db.Agencies.AsNoTracking()
        .Include(a => a.State)
        .Include(a => a.District)
        /* The masters behind the scope, because the register names what an
           agency is empanelled for rather than counting it. */
        .Include(a => a.Categories).ThenInclude(x => x.Category)
        .Include(a => a.SubCategories)
        .Include(a => a.ProgramTypes).ThenInclude(x => x.ProgramType)
        .Include(a => a.States).ThenInclude(x => x.State)
        /* Split, not joined: the scope collections multiply together. */
        .AsSplitQuery()
        .WithinScope(currentUser);

    public async Task<PagedResult<AgencyDto>> ListAsync(
        PagedRequest request, string? agencyType, int? categoryId, int? subCategoryId,
        int? programTypeId, string? state, string? status, CancellationToken ct)
    {
        var type = EnumMaps.ParseEnumOrNull<AgencyType>(agencyType);

        /* Matched on what the agency is empanelled for, not on a parent record:
           an agency can hold several categories at once, so this asks whether
           the chosen one is among them. */
        var query = Base
            .WhereIf(categoryId.HasValue, a => a.Categories.Any(c => c.CategoryId == categoryId))
            .WhereIf(subCategoryId.HasValue,
                a => a.SubCategories.Any(c => c.SubCategoryId == subCategoryId))
            .WhereIf(programTypeId.HasValue,
                a => a.ProgramTypes.Any(p => p.ProgramTypeId == programTypeId))
            .WhereIf(type.HasValue, a => a.AgencyType == type)
            .WhereIf(!string.IsNullOrWhiteSpace(state), a => a.State!.Name == state!.ToUpperInvariant())
            .WhereIf(!string.IsNullOrWhiteSpace(status), a => a.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                a => a.Code.Contains(request.Search!) || a.Name.Contains(request.Search!)
                     || a.ContactPerson.Contains(request.Search!) || a.Email.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(ImplementingAgency))!, a => a.Name);

        var page = await query.ToPagedResultAsync(request, Describe, ct);
        await FillLoginsAsync(page.Items, ct);
        return page;
    }

    /// <summary>
    /// Attaches each agency's own login, in one query for the page rather
    /// than one per row.
    /// </summary>
    private async Task FillLoginsAsync(IReadOnlyList<AgencyDto> rows, CancellationToken ct)
    {
        if (rows.Count == 0) return;

        var ids = rows.Select(r => r.Id).ToList();

        var logins = await db.Users.AsNoTracking()
            .Where(u => u.AgencyId != null && ids.Contains(u.AgencyId.Value)
                        && u.BaseRole == BaseRole.AgencyAdmin)
            .Select(u => new
            {
                AgencyId = u.AgencyId!.Value,
                u.UserCode,
                u.Email,
                u.Status,
                u.LastLoginOn,
            })
            .ToListAsync(ct);

        /* The first by user code where an agency somehow has two. One is
           the rule; showing one of them beats showing none. */
        var byAgency = logins
            .GroupBy(l => l.AgencyId)
            .ToDictionary(g => g.Key, g => g.OrderBy(l => l.UserCode).First());

        foreach (var row in rows)
        {
            if (!byAgency.TryGetValue(row.Id, out var login)) continue;
            row.LoginUserCode = login.UserCode;
            row.LoginEmail = login.Email;
            row.LoginStatus = login.Status.ToApi();
            row.LoginLastSeenOn = login.LastLoginOn;
        }
    }

    public async Task<List<AgencyDto>> AllAsync(string? status, CancellationToken ct) =>
        [.. (await Base
                .WhereIf(!string.IsNullOrWhiteSpace(status), a => a.Status == EnumMaps.ToStatus(status))
                .OrderBy(a => a.Name).ToListAsync(ct))
            .Select(Describe)];

    public async Task<AgencyDto> GetAsync(int id, CancellationToken ct)
    {
        var dto = Describe(await Base.FirstOrDefaultAsync(a => a.Id == id, ct)
                           ?? throw AppException.NotFound("Implementing agency"));

        /* The login too, as the list does. Reading one agency used to report
           no login whatever it had, which the details panel showed as "No
           login yet" and which made Issue login look as though it had done
           nothing. */
        await FillLoginsAsync([dto], ct);
        return dto;
    }

    /// <summary>
    /// The record plus whether this caller may change it, so the screen can
    /// withhold an Edit button the API would refuse rather than offering one
    /// that fails when pressed.
    /// </summary>
    private AgencyDto Describe(ImplementingAgency entity)
    {
        var dto = entity.ToDto();
        dto.CanEdit = delegation.CanEditRecord(BaseRole.AgencyAdmin, entity.CreatedBy);
        return dto;
    }

    /// <summary>
    /// Everything that has happened to one agency, oldest first: the
    /// empanelment, the login it was given, the coordinators it added and
    /// the batches it ran.
    ///
    /// An agency has no event log of its own - there was never anywhere to
    /// write one - so this is read from the dated records it left behind.
    /// That is honest about what is known: it can say when a batch was
    /// raised and when it ran, and cannot say who permitted it, because
    /// nothing wrote that down.
    /// </summary>
    public async Task<AgencyHistoryDto> HistoryAsync(int id, CancellationToken ct)
    {
        var agency = await Base.FirstOrDefaultAsync(a => a.Id == id, ct)
                     ?? throw AppException.NotFound("Implementing agency");

        var timeline = new List<TimelineEventDto>
        {
            new()
            {
                On = agency.EmpanelledOn.ToDateTime(TimeOnly.MinValue),
                Area = "Empanelment",
                Title = "Empanelled",
                Detail = agency.EmpanelmentValidTill is { } till
                    ? $"Valid till {till:dd MMM yyyy}."
                    : "No end date recorded.",
                Reference = agency.Code,
                By = agency.CreatedBy,
            },
        };

        /* Only once it has actually passed. A date in the future is a term,
           not something that has happened. */
        if (agency.EmpanelmentValidTill is { } expiry
            && expiry < DateOnly.FromDateTime(DateTime.UtcNow))
        {
            timeline.Add(new TimelineEventDto
            {
                On = expiry.ToDateTime(TimeOnly.MinValue),
                Area = "Empanelment",
                Title = "Empanelment lapsed",
                Reference = agency.Code,
            });
        }

        var people = await db.Users.AsNoTracking()
            .Where(u => u.AgencyId == id)
            .Select(u => new
            {
                u.UserCode, u.FullName, u.BaseRole, u.CreatedOn, u.CreatedBy, u.Status,
            })
            .ToListAsync(ct);

        foreach (var person in people)
        {
            timeline.Add(new TimelineEventDto
            {
                On = person.CreatedOn,
                Area = person.BaseRole == BaseRole.AgencyAdmin ? "Login" : "Coordinator",
                Title = person.BaseRole == BaseRole.AgencyAdmin
                    ? "Agency login created"
                    : "Coordinator added",
                Detail = person.FullName,
                Reference = person.UserCode,
                By = person.CreatedBy,
            });
        }

        var batches = await db.Programmes.AsNoTracking()
            .Where(p => p.AgencyId == id)
            .Select(p => new
            {
                p.ProgrammeId, p.ProgrammeName, p.Status, p.CreatedOn, p.StartDate, p.EndDate,
            })
            .ToListAsync(ct);

        foreach (var batch in batches)
        {
            timeline.Add(new TimelineEventDto
            {
                On = batch.CreatedOn,
                Area = "Programme",
                Title = "Batch raised",
                Detail = batch.ProgrammeName,
                Reference = batch.ProgrammeId,
            });

            /* Where it stands is known; when it got there is not, because
               no event was written. So the standing is reported against
               the batch's own dates rather than invented. */
            if (batch.Status == ProgramStatus.Conducted)
            {
                timeline.Add(new TimelineEventDto
                {
                    On = batch.EndDate.ToDateTime(TimeOnly.MinValue),
                    Area = "Programme",
                    Title = "Batch conducted",
                    Detail = batch.ProgrammeName,
                    Reference = batch.ProgrammeId,
                });
            }
        }

        return new AgencyHistoryDto
        {
            AgencyId = agency.Id,
            Code = agency.Code,
            Name = agency.Name,
            Status = agency.Status.ToApi(),
            EmpanelledOn = agency.EmpanelledOn,
            EmpanelmentValidTill = agency.EmpanelmentValidTill,
            Timeline = [.. timeline.OrderBy(e => e.On)],
        };
    }

    public async Task<AgencyDto> CreateAsync(AgencyUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);

        /* System generated, like every other identity here. A typed code
           produced QQQQQ on the live panel, and a code that somebody chooses
           is a code two people can choose differently for the same body — or
           the same for two. What the caller sent is ignored. */
        var code = await codes.NextAgencyCodeAsync(ct);

        /* An agency is empanelled on all four axes, and a manager can only hand
           down what they hold on each of them. */
        var scope = await ResolveEmpanelmentAsync(dto, ct);

        var entity = new ImplementingAgency();
        Apply(entity, dto, code);
        ReplaceMappings(entity, scope);

        db.Agencies.Add(entity);
        await db.SaveChangesAsync(ct);

        /* Tell the agency it is on the panel, and — unless asked not to — give
           its contact a way in. Neither is allowed to fail the creation: the
           agency exists either way, and the credentials can be reissued. */
        await NotifyAsync(entity, dto.CreateLogin, ct);

        return await GetAsync(entity.Id, ct);
    }

    /// <summary>
    /// The empanelment email, plus an optional login for the contact person.
    /// Both are best effort; a mail failure never rolls back the agency.
    /// </summary>
    private async Task NotifyAsync(
        ImplementingAgency entity, bool createLogin, CancellationToken ct)
    {
        try
        {
            await notifications.SendAgencyEmpanelledAsync(entity, await ScopeTextAsync(entity, ct), ct);
            if (createLogin) await CreateLoginAsync(entity, ct);
        }
        catch (Exception ex)
        {
            /* The agency is saved either way, so this must not throw — but it
               must not vanish either, or "no email arrived" is unanswerable. */
            logger.LogError(ex, "Agency {Code} saved, but notifying it failed", entity.Code);
        }
    }

    /// <summary>
    /// Gives the agency's contact a way in, and e-mails it to them.
    ///
    /// Returns false, having said why in the log, when there is nothing to
    /// create a login from. Called both when an agency is empanelled and
    /// afterwards, from Issue login, for the ones that ended up without one.
    /// </summary>
    private async Task<bool> CreateLoginAsync(ImplementingAgency entity, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(entity.Email))
        {
            logger.LogWarning(
                "Agency {Code} has no contact e-mail, so no login was created", entity.Code);
            return false;
        }

        /* Not refused because the address is already on another account.

           Identity here is the generated user code, never the e-mail — that
           is why sign-in takes a user ID and why the e-mail index is not
           unique. One person can be an Admin and also the contact for an
           agency; those are two accounts with two sets of permissions, not
           one identity seen twice.

           The rule that used to stand here returned silently, so an agency
           whose contact happened to hold any other account was empanelled
           with no login and nobody was told: the register said "No login yet"
           and the credentials e-mail that never arrived had never been
           sent. */
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Code == "AGENCY_ADMIN", ct);
        if (role is null)
        {
            logger.LogError(
                "Agency {Code}: no AGENCY_ADMIN role, so no login was created", entity.Code);
            return false;
        }

        var temporaryPassword = passwords.GenerateTemporaryPassword();
        var user = new PortalUser
        {
            UserCode = await codes.NextUserCodeAsync(role.BaseRole, ct),
            FullName = entity.ContactPerson,
            Email = entity.Email.Trim(),
            Mobile = entity.Mobile,
            Designation = "Agency contact",
            PasswordHash = passwords.Hash(temporaryPassword),
            MustChangePassword = true,
            RoleId = role.Id,
            BaseRole = role.BaseRole,
            AgencyId = entity.Id,
            StateCode = entity.StateCode,
            City = entity.City,
            Status = RecordStatus.Active,
        };

        /* The login inherits exactly what the agency was empanelled for, so
           the coordinators it goes on to create cannot reach further. */
        foreach (var mapping in entity.ProgramTypes)
            user.ProgramTypes.Add(new UserProgramType { ProgramTypeId = mapping.ProgramTypeId });
        foreach (var mapping in entity.States)
            user.States.Add(new UserState { StateCode = mapping.StateCode });

        db.Users.Add(user);
        await db.SaveChangesAsync(ct);
        await notifications.SendCredentialsForRoleAsync(user, temporaryPassword, ct);
        return true;
    }

    /// <summary>
    /// Issues a login to an agency that has none, after the fact.
    ///
    /// Empanelment creates one, but an agency can end up without: no contact
    /// address at the time, a failure while notifying, or a record from
    /// before any of this. Without a way to issue one afterwards the only
    /// remedy was to delete the agency and add it again.
    /// </summary>
    public async Task<AgencyDto> IssueLoginAsync(int id, CancellationToken ct)
    {
        var entity = await db.Agencies
                         .Include(a => a.ProgramTypes).Include(a => a.States)
                         .FirstOrDefaultAsync(a => a.Id == id, ct)
                     ?? throw AppException.NotFound("Agency");

        delegation.EnsureCanEditRecord(BaseRole.AgencyAdmin, entity.CreatedBy, "agency");

        if (await db.Users.AnyAsync(u => u.AgencyId == id, ct))
            throw new AppException("This agency already has a login. Use Resend password instead.");

        if (string.IsNullOrWhiteSpace(entity.Email))
            throw new AppException("The agency has no contact e-mail to send credentials to.");

        if (!await CreateLoginAsync(entity, ct))
            throw new AppException("The login could not be created. The log says why.");

        return await GetAsync(id, ct);
    }

    /// <summary>
    /// A fresh first-time password for the agency's login, e-mailed to it.
    ///
    /// The same thing the portal users register offers, where the account an
    /// agency signs in with is not listed.
    /// </summary>
    public async Task<AgencyDto> ResendLoginPasswordAsync(int id, CancellationToken ct)
    {
        var entity = await db.Agencies.FirstOrDefaultAsync(a => a.Id == id, ct)
                     ?? throw AppException.NotFound("Agency");

        delegation.EnsureCanEditRecord(BaseRole.AgencyAdmin, entity.CreatedBy, "agency");

        var user = await db.Users.FirstOrDefaultAsync(u => u.AgencyId == id, ct)
                   ?? throw new AppException(
                       "This agency has no login yet. Use Issue login first.");

        var temporaryPassword = passwords.GenerateTemporaryPassword();
        user.PasswordHash = passwords.Hash(temporaryPassword);
        user.MustChangePassword = true;
        await db.SaveChangesAsync(ct);

        await notifications.SendCredentialsForRoleAsync(user, temporaryPassword, ct);
        return await GetAsync(id, ct);
    }

    /// <summary>A readable summary of what the agency is empanelled for.</summary>
    private async Task<string> ScopeTextAsync(ImplementingAgency entity, CancellationToken ct)
    {
        var categoryIds = entity.Categories.Select(c => c.CategoryId).ToList();
        var names = await db.Categories
            .Where(c => categoryIds.Contains(c.Id))
            .Select(c => c.Name)
            .ToListAsync(ct);
        return string.Join(", ", names);
    }

    public async Task<AgencyDto> UpdateAsync(int id, AgencyUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);
        var entity = await db.Agencies
            .Include(a => a.Categories).Include(a => a.SubCategories).Include(a => a.ProgramTypes)
            .Include(a => a.States)
            /* Split, not joined: the scope collections multiply together. */
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw AppException.NotFound("Implementing agency");

        /* An agency is an Implementing Agency account plus its empanelment, so
           editing one is editing that account: it sits with the Operation
           Manager who appointed them, or with whoever added the record. */
        delegation.EnsureCanEditRecord(BaseRole.AgencyAdmin, entity.CreatedBy, "agency");

        /* Never reissued. Other records refer to an agency by its code, and
           an identity that changes is not one. */
        var scope = await ResolveEmpanelmentAsync(dto, ct);

        Apply(entity, dto, entity.Code);
        entity.Categories.Clear();
        entity.SubCategories.Clear();
        entity.ProgramTypes.Clear();
        entity.States.Clear();
        ReplaceMappings(entity, scope);

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<AgencyDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.Agencies.FirstOrDefaultAsync(a => a.Id == id, ct)
                     ?? throw AppException.NotFound("Implementing agency");
        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Server side format checks. The portal validates the same rules, but the
    /// API is what decides what actually reaches the database.
    /// </summary>
    private static void Validate(AgencyUpsertDto dto) =>
        Guard.Check()
            .Required(dto.Name, "Agency name")
            .Required(dto.ContactPerson, "Contact person")
            .Email(dto.Email)
            .Mobile(dto.Mobile)
            .Gstin(dto.Gstin)
            .Pan(dto.Pan)
            .Required(dto.AddressLine1, "Address")
            .Required(dto.City, "City")
            .Pincode(dto.Pincode)
            .When(dto.StateCode <= 0, "Select a state.")
            .ThrowIfInvalid();

    private static void Apply(ImplementingAgency entity, AgencyUpsertDto dto, string code)
    {
        entity.Code = code;
        entity.Name = dto.Name.Trim();
        entity.AgencyType = EnumMaps.ParseEnum(dto.AgencyType, AgencyType.GovernmentBody);
        entity.ContactPerson = dto.ContactPerson.Trim();
        entity.Email = dto.Email.Trim();
        entity.Mobile = dto.Mobile.Trim();
        entity.Gstin = Formats.Normalise(dto.Gstin);
        entity.Pan = Formats.Normalise(dto.Pan);
        entity.AddressLine1 = dto.AddressLine1.Trim();
        entity.AddressLine2 = dto.AddressLine2;
        entity.City = dto.City.Trim();
        entity.StateCode = dto.StateCode;
        entity.DistrictCode = dto.DistrictCode;
        entity.Pincode = dto.Pincode.Trim();
        entity.EmpanelledOn = dto.EmpanelledOn;
        entity.EmpanelmentValidTill = dto.EmpanelmentValidTill;
        entity.Status = EnumMaps.ToStatus(dto.Status);
    }

    /// <summary>What the agency may be empanelled for, narrowed to the
    /// caller's own allocation on every axis.</summary>
    private sealed record Empanelment(
        List<int> Categories, List<int> SubCategories, List<int> ProgramTypes, List<int> States);

    /// <summary>
    /// What the agency is empanelled for.
    ///
    /// Program types and states are chosen and checked against the caller's
    /// own allocation. The categories and sub-categories are not chosen at
    /// all: they are read off the program types, because that is what they
    /// are. You cannot empanel somebody for "ZED Certification" in the
    /// abstract - you empanel them for named program types, and those sit
    /// in a sub-category which sits in a category.
    ///
    /// They were asked for separately, which let an agency be recorded
    /// against a category none of its program types belonged to, and meant
    /// an operation manager had to hold a category it is not allocated on
    /// just to fill the form in.
    /// </summary>
    private async Task<Empanelment> ResolveEmpanelmentAsync(
        AgencyUpsertDto dto, CancellationToken ct)
    {
        var programTypes = await delegation.ResolveAsync(
            ScopeAxis.ProgramType, BaseRole.AgencyAdmin, dto.ProgramTypeIds, ct);

        var states = await delegation.ResolveAsync(
            ScopeAxis.State, BaseRole.AgencyAdmin, dto.StateCodes, ct);

        var pairs = await db.ProgramTypes.AsNoTracking()
            .Where(p => programTypes.Contains(p.Id))
            .Select(p => new { p.CategoryId, p.SubCategoryId })
            .ToListAsync(ct);

        return new Empanelment(
            [.. pairs.Select(p => p.CategoryId).Distinct()],
            [.. pairs.Select(p => p.SubCategoryId).Distinct()],
            programTypes,
            states);
    }

    private static void ReplaceMappings(ImplementingAgency entity, Empanelment scope)
    {
        foreach (var id in scope.Categories)
            entity.Categories.Add(new AgencyCategory { CategoryId = id });
        foreach (var id in scope.SubCategories)
            entity.SubCategories.Add(new AgencySubCategory { SubCategoryId = id });
        foreach (var id in scope.ProgramTypes)
            entity.ProgramTypes.Add(new AgencyProgramType { ProgramTypeId = id });
        foreach (var code in scope.States)
            entity.States.Add(new AgencyState { StateCode = code });
    }
}
