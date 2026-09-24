using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/* -------------------------------------------------------------------- roles */

public class RoleService(NtmsDbContext db)
{
    private IQueryable<AdminRole> Base => db.Roles.AsNoTracking().Include(r => r.Permissions);

    public async Task<PagedResult<AdminRoleDto>> ListAsync(
        PagedRequest request, string? baseRole, string? status, CancellationToken ct)
    {
        var counts = await db.Users
            .GroupBy(u => u.RoleId)
            .Select(g => new { RoleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RoleId, x => x.Count, ct);

        var role = EnumMaps.ParseEnumOrNull<BaseRole>(baseRole);

        var query = Base
            .WhereIf(role.HasValue, r => r.BaseRole == role)
            .WhereIf(!string.IsNullOrWhiteSpace(status), r => r.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                r => r.Name.Contains(request.Search!) || r.Code.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(AdminRole))!, r => r.Name);

        return await query.ToPagedResultAsync(
            request, r => r.ToDto(counts.GetValueOrDefault(r.Id)), ct);
    }

    public async Task<List<AdminRoleDto>> AllAsync(string? status, CancellationToken ct) =>
        [.. (await Base
                .WhereIf(!string.IsNullOrWhiteSpace(status), r => r.Status == EnumMaps.ToStatus(status))
                .OrderBy(r => r.Name).ToListAsync(ct))
            .Select(r => r.ToDto())];

    public async Task<AdminRoleDto> GetAsync(int id, CancellationToken ct)
    {
        var role = await Base.FirstOrDefaultAsync(r => r.Id == id, ct)
                   ?? throw AppException.NotFound("Role");
        var count = await db.Users.CountAsync(u => u.RoleId == id, ct);
        return role.ToDto(count);
    }

    public IReadOnlyList<PermissionGroupDto> Catalogue() =>
        [.. Permissions.Catalogue.Select(g => new PermissionGroupDto
        {
            Group = g.Group,
            Permissions = [.. g.Keys],
        })];

    public async Task<AdminRoleDto> CreateAsync(AdminRoleUpsertDto dto, CancellationToken ct)
    {
        var code = Formats.Normalise(dto.Code)!.Replace('-', '_');
        Validate(dto);
        if (await db.Roles.AnyAsync(r => r.Code == code, ct))
            throw AppException.Conflict($"Role code '{code}' is already in use.");

        var entity = new AdminRole
        {
            Name = dto.Name.Trim(),
            Code = code,
            BaseRole = EnumMaps.ParseEnum(dto.BaseRole, BaseRole.Admin),
            Description = dto.Description,
            IsSystemRole = false,
            Status = EnumMaps.ToStatus(dto.Status),
        };
        foreach (var permission in dto.Permissions.Distinct())
            entity.Permissions.Add(new RolePermission { Permission = permission });

        db.Roles.Add(entity);
        await db.SaveChangesAsync(ct);
        return await GetAsync(entity.Id, ct);
    }

    public async Task<AdminRoleDto> UpdateAsync(int id, AdminRoleUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.Roles.Include(r => r.Permissions).FirstOrDefaultAsync(r => r.Id == id, ct)
                     ?? throw AppException.NotFound("Role");
        Validate(dto);

        /* A system role keeps its identity; only its permission set may move. */
        if (!entity.IsSystemRole)
        {
            var code = Formats.Normalise(dto.Code)!.Replace('-', '_');
            if (await db.Roles.AnyAsync(r => r.Code == code && r.Id != id, ct))
                throw AppException.Conflict($"Role code '{code}' is already in use.");

            entity.Name = dto.Name.Trim();
            entity.Code = code;
            entity.BaseRole = EnumMaps.ParseEnum(dto.BaseRole, BaseRole.Admin);
            entity.Status = EnumMaps.ToStatus(dto.Status);
        }
        entity.Description = dto.Description;

        db.RolePermissions.RemoveRange(entity.Permissions);
        entity.Permissions.Clear();
        foreach (var permission in dto.Permissions.Distinct())
            entity.Permissions.Add(new RolePermission { Permission = permission });

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<AdminRoleDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.Roles.FirstOrDefaultAsync(r => r.Id == id, ct)
                     ?? throw AppException.NotFound("Role");
        if (entity.IsSystemRole)
            throw new AppException("System roles cannot be disabled.");

        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    private static void Validate(AdminRoleUpsertDto dto)
    {
        if (dto.Permissions.Count == 0)
            throw new AppException("A role needs at least one permission.");

        var unknown = dto.Permissions.Except(Permissions.All).ToList();
        if (unknown.Count > 0)
            throw new AppException($"Unknown permission(s): {string.Join(", ", unknown)}.");
    }
}

/* -------------------------------------------------------------- portal users */

public class UserService(
    NtmsDbContext db,
    ICodeGenerator codes,
    IPasswordService passwords,
    INotificationService notifications,
    DelegationGuard delegation,
    ICurrentUser currentUser)
{
    private IQueryable<PortalUser> Base => db.Users.AsNoTracking()
        .Include(u => u.Role)
        .Include(u => u.Agency)
        .Include(u => u.ReportsToUser)
        .Include(u => u.State)
        .Include(u => u.District)
        .Include(u => u.Categories)
        .Include(u => u.SubCategories)
        .Include(u => u.ProgramTypes)
        .Include(u => u.States).ThenInclude(x => x.State)
        .Include(u => u.Districts).ThenInclude(x => x.District)
        /* One query per collection instead of one join across all five.
           Joined together they multiply: a coordinator allocated 763 districts,
           36 states and 4 programme types produces over a hundred thousand rows
           for that one account, which EF then collapses in memory. That is what
           made the user list take five seconds and sit on its skeletons. */
        .AsSplitQuery()
        /* Applied at the base query so no read path can list an account the
           caller has no business seeing. */
        .VisibleTo(currentUser);

    public async Task<PagedResult<PortalUserDto>> ListAsync(
        PagedRequest request, string? baseRole, int? roleId, int? agencyId,
        string? state, string? status, CancellationToken ct)
    {
        var role = EnumMaps.ParseEnumOrNull<BaseRole>(baseRole);

        var query = Base
            .WhereIf(role.HasValue, u => u.BaseRole == role)
            .WhereIf(roleId.HasValue, u => u.RoleId == roleId)
            .WhereIf(agencyId.HasValue, u => u.AgencyId == agencyId)
            .WhereIf(!string.IsNullOrWhiteSpace(state), u => u.State!.Name == state!.ToUpperInvariant())
            .WhereIf(!string.IsNullOrWhiteSpace(status), u => u.Status == EnumMaps.ToStatus(status))
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                u => u.FullName.Contains(request.Search!) || u.UserCode.Contains(request.Search!)
                     || u.Email.Contains(request.Search!) || u.Mobile.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(PortalUser))!, u => u.FullName);

        return await query.ToPagedResultAsync(request, u => u.ToDto(), ct);
    }

    public async Task<List<PortalUserDto>> AllAsync(string? baseRole, string? status, CancellationToken ct)
    {
        var role = EnumMaps.ParseEnumOrNull<BaseRole>(baseRole);
        var rows = await Base
            .WhereIf(role.HasValue, u => u.BaseRole == role)
            .WhereIf(!string.IsNullOrWhiteSpace(status), u => u.Status == EnumMaps.ToStatus(status))
            .OrderBy(u => u.FullName).ToListAsync(ct);
        return [.. rows.Select(u => u.ToDto())];
    }

    public async Task<PortalUserDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.FirstOrDefaultAsync(u => u.Id == id, ct)
         ?? throw AppException.NotFound("User")).ToDto();

    public async Task<(PortalUserDto User, GeneratedCredentialsDto Credentials)> CreateAsync(
        PortalUserUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);
        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == dto.RoleId, ct)
                   ?? throw AppException.NotFound("Role");

        /* One rung down only, and never outside what the caller holds. */
        delegation.EnsureCanCreate(role.BaseRole);
        var scope = await ResolveScopeAsync(role.BaseRole, dto, ct);

        /* The account's identity is the generated code, issued here once. */
        var userCode = await codes.NextUserCodeAsync(role.BaseRole, ct);
        var temporaryPassword = passwords.GenerateTemporaryPassword();

        var entity = new PortalUser
        {
            UserCode = userCode,
            PasswordHash = passwords.Hash(temporaryPassword),
            MustChangePassword = true,
            BaseRole = role.BaseRole,
        };
        Apply(entity, dto);
        BindToCallersAgency(entity);
        ApplyScope(entity, scope);

        db.Users.Add(entity);
        await db.SaveChangesAsync(ct);

        await notifications.SendCredentialsForRoleAsync(entity, temporaryPassword, ct);

        return (await GetAsync(entity.Id, ct),
            new GeneratedCredentialsDto { UserCode = userCode, TemporaryPassword = temporaryPassword });
    }

    public async Task<PortalUserDto> UpdateAsync(int id, PortalUserUpsertDto dto, CancellationToken ct)
    {
        Validate(dto);
        var entity = await db.Users
            .Include(u => u.Categories).Include(u => u.SubCategories).Include(u => u.ProgramTypes)
            .Include(u => u.States).Include(u => u.Districts)
            .FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw AppException.NotFound("User");

        var role = await db.Roles.FirstOrDefaultAsync(r => r.Id == dto.RoleId, ct)
                   ?? throw AppException.NotFound("Role");

        /* Editable only by the tier that creates this kind of account, and only
           into another kind that same tier could have created — otherwise an
           edit becomes either a way to reach past the chain or a way to promote
           someone past yourself. */
        delegation.EnsureCanEdit(entity.BaseRole, "edit");
        if (role.BaseRole != entity.BaseRole) delegation.EnsureCanCreate(role.BaseRole);

        var scope = await ResolveScopeAsync(role.BaseRole, dto, ct);

        /* UserCode is never touched — it is the account's identity. Email is
           ordinary profile data and may change freely. */
        entity.BaseRole = role.BaseRole;
        Apply(entity, dto);
        BindToCallersAgency(entity);

        entity.Categories.Clear();
        entity.SubCategories.Clear();
        entity.ProgramTypes.Clear();
        entity.States.Clear();
        entity.Districts.Clear();
        ApplyScope(entity, scope);

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Enable or disable. Available to every tier above the account, which is
    /// the reach senior tiers keep where they cannot create.
    /// </summary>
    public async Task<PortalUserDto> SetStatusAsync(int id, string status, CancellationToken ct)
    {
        var entity = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
                     ?? throw AppException.NotFound("User");
        delegation.EnsureOutranks(entity.BaseRole, "enable or disable");
        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<GeneratedCredentialsDto> ResetPasswordAsync(int id, CancellationToken ct)
    {
        var entity = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
                     ?? throw AppException.NotFound("User");
        /* Any tier above, not only the one that created it. An agency's portal
           user is created by empanelment rather than by a tier that can edit
           it, so the stricter rule left that account with nobody able to reset
           it and no way to sign in. */
        delegation.EnsureCanRestoreAccess(entity.BaseRole);

        var temporaryPassword = passwords.GenerateTemporaryPassword();
        entity.PasswordHash = passwords.Hash(temporaryPassword);
        entity.MustChangePassword = true;
        entity.FailedLoginCount = 0;
        entity.LockedOutUntil = null;

        /* Every existing session dies with the password. */
        var tokens = await db.RefreshTokens.Where(t => t.UserId == id && t.RevokedOn == null)
            .ToListAsync(ct);
        foreach (var token in tokens) token.RevokedOn = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        await notifications.SendCredentialsForRoleAsync(entity, temporaryPassword, ct);

        return new GeneratedCredentialsDto
        {
            UserCode = entity.UserCode,
            TemporaryPassword = temporaryPassword,
        };
    }

    private static void Validate(PortalUserUpsertDto dto) =>
        Guard.Check()
            .Required(dto.FullName, "Full name")
            .Email(dto.Email)
            .Mobile(dto.Mobile)
            .When(dto.RoleId <= 0, "Select a role.")
            .ThrowIfInvalid();

    private static void Apply(PortalUser entity, PortalUserUpsertDto dto)
    {
        entity.FullName = dto.FullName.Trim();
        entity.Email = dto.Email.Trim();
        entity.Mobile = dto.Mobile.Trim();
        entity.Designation = dto.Designation;
        entity.RoleId = dto.RoleId;
        entity.AgencyId = dto.AgencyId;
        entity.ReportsToUserId = dto.ReportsToUserId;
        entity.StateCode = dto.StateCode;
        entity.DistrictCode = dto.DistrictCode;
        entity.City = dto.City;
        entity.Status = EnumMaps.ToStatus(dto.Status);
    }

    /// <summary>
    /// An agency login only ever creates people for its own agency.
    ///
    /// Without this a coordinator came out unattached: the agency could not see
    /// the account it had just created, and the coordinator belonged to nobody.
    /// The agency on the request is ignored rather than validated, since there
    /// is only one correct answer and it is not the caller's to choose.
    /// </summary>
    private void BindToCallersAgency(PortalUser entity)
    {
        if (currentUser.Tier != BaseRole.AgencyAdmin) return;

        entity.AgencyId = currentUser.AgencyId
            ?? throw new AppException("This agency login is not linked to an agency.", 403);
    }

    /// <summary>
    /// What this account will be allocated, having been checked against what
    /// the caller holds. Axes that do not apply to the tier come back empty.
    /// </summary>
    private async Task<ResolvedScope> ResolveScopeAsync(
        BaseRole target, PortalUserUpsertDto dto, CancellationToken ct) =>
        new(
            await delegation.ResolveAsync(ScopeAxis.Category, target, dto.CategoryIds, ct),
            await delegation.ResolveAsync(ScopeAxis.SubCategory, target, dto.SubCategoryIds, ct),
            await delegation.ResolveAsync(ScopeAxis.ProgramType, target, dto.ProgramTypeIds, ct),
            await delegation.ResolveAsync(ScopeAxis.State, target, dto.StateCodes, ct),
            await delegation.ResolveAsync(ScopeAxis.District, target, dto.DistrictCodes, ct));

    private sealed record ResolvedScope(
        List<int> Categories, List<int> SubCategories, List<int> ProgramTypes,
        List<int> States, List<int> Districts);

    private static void ApplyScope(PortalUser entity, ResolvedScope scope)
    {
        foreach (var id in scope.Categories)
            entity.Categories.Add(new UserCategory { CategoryId = id });
        foreach (var id in scope.SubCategories)
            entity.SubCategories.Add(new UserSubCategory { SubCategoryId = id });
        foreach (var id in scope.ProgramTypes)
            entity.ProgramTypes.Add(new UserProgramType { ProgramTypeId = id });
        foreach (var code in scope.States)
            entity.States.Add(new UserState { StateCode = code });
        foreach (var code in scope.Districts)
            entity.Districts.Add(new UserDistrict { DistrictCode = code });
    }
}
