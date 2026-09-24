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
        .Include(a => a.Categories)
        .Include(a => a.SubCategories)
        .Include(a => a.ProgramTypes)
        .Include(a => a.States).ThenInclude(x => x.State)
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

        return await query.ToPagedResultAsync(request, a => a.ToDto(), ct);
    }

    public async Task<List<AgencyDto>> AllAsync(string? status, CancellationToken ct) =>
        [.. (await Base
                .WhereIf(!string.IsNullOrWhiteSpace(status), a => a.Status == EnumMaps.ToStatus(status))
                .OrderBy(a => a.Name).ToListAsync(ct))
            .Select(a => a.ToDto())];

    public async Task<AgencyDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.FirstOrDefaultAsync(a => a.Id == id, ct)
         ?? throw AppException.NotFound("Implementing agency")).ToDto();

    public async Task<AgencyDto> CreateAsync(AgencyUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);
        var code = Formats.Normalise(dto.Code)!;
        if (await db.Agencies.AnyAsync(a => a.Code == code, ct))
            throw AppException.Conflict($"Agency code '{code}' is already in use.");

        /* An agency is empanelled for program types and states, and a manager
           can only hand down what they hold. */
        var programTypes = await delegation.ResolveAsync(
            ScopeAxis.ProgramType, BaseRole.AgencyAdmin, dto.ProgramTypeIds, ct);
        var states = await delegation.ResolveAsync(
            ScopeAxis.State, BaseRole.AgencyAdmin, dto.StateCodes, ct);

        var entity = new ImplementingAgency();
        Apply(entity, dto, code);
        ReplaceMappings(entity, dto, programTypes, states);

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

            if (!createLogin || string.IsNullOrWhiteSpace(entity.Email)) return;

            /* One login per address: a contact who already has an account keeps
               the one they have rather than being handed a second identity. */
            var email = entity.Email.Trim();
            if (await db.Users.AnyAsync(u => u.Email == email, ct)) return;

            var role = await db.Roles.FirstOrDefaultAsync(r => r.Code == "AGENCY_ADMIN", ct);
            if (role is null) return;

            var temporaryPassword = passwords.GenerateTemporaryPassword();
            var user = new PortalUser
            {
                UserCode = await codes.NextUserCodeAsync(role.BaseRole, ct),
                FullName = entity.ContactPerson,
                Email = email,
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
        }
        catch (Exception ex)
        {
            /* The agency is saved either way, so this must not throw — but it
               must not vanish either, or "no email arrived" is unanswerable. */
            logger.LogError(ex, "Agency {Code} saved, but notifying it failed", entity.Code);
        }
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
            .FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw AppException.NotFound("Implementing agency");

        var code = Formats.Normalise(dto.Code)!;
        if (await db.Agencies.AnyAsync(a => a.Code == code && a.Id != id, ct))
            throw AppException.Conflict($"Agency code '{code}' is already in use.");

        var programTypes = await delegation.ResolveAsync(
            ScopeAxis.ProgramType, BaseRole.AgencyAdmin, dto.ProgramTypeIds, ct);
        var states = await delegation.ResolveAsync(
            ScopeAxis.State, BaseRole.AgencyAdmin, dto.StateCodes, ct);

        Apply(entity, dto, code);
        entity.Categories.Clear();
        entity.SubCategories.Clear();
        entity.ProgramTypes.Clear();
        entity.States.Clear();
        ReplaceMappings(entity, dto, programTypes, states);

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
            .Code(dto.Code, "Agency code")
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

    private static void ReplaceMappings(
        ImplementingAgency entity, AgencyUpsertDto dto,
        List<int> programTypes, List<int> states)
    {
        foreach (var id in dto.CategoryIds.Distinct())
            entity.Categories.Add(new AgencyCategory { CategoryId = id });
        foreach (var id in dto.SubCategoryIds.Distinct())
            entity.SubCategories.Add(new AgencySubCategory { SubCategoryId = id });
        foreach (var id in programTypes)
            entity.ProgramTypes.Add(new AgencyProgramType { ProgramTypeId = id });
        foreach (var code in states)
            entity.States.Add(new AgencyState { StateCode = code });
    }
}
