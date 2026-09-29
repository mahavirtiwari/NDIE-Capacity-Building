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

public class RoleService(NtmsDbContext db, ICurrentUser currentUser)
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

        var tier = EnumMaps.ParseEnum(dto.BaseRole, BaseRole.Admin);
        EnsureMayShape(tier);
        EnsureMayGrant(dto.Permissions);

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

        /* The role as it stands, and the role it would become: both have to be
           beneath the caller. Checking only the target would let somebody
           promote a role they may edit into one they may not. */
        EnsureMayShape(entity.BaseRole);
        if (!entity.IsSystemRole) EnsureMayShape(EnumMaps.ParseEnum(dto.BaseRole, entity.BaseRole));
        EnsureMayGrant(dto.Permissions, entity.Permissions.Select(p => p.Permission));

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
        EnsureMayShape(entity.BaseRole);

        if (entity.IsSystemRole)
            throw new AppException("System roles cannot be disabled.");

        entity.Status = EnumMaps.ToStatus(status);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>
    /// A role may only be shaped by somebody above it.
    ///
    /// Without this, anybody holding roles.manage could edit the Super Admin
    /// role, or promote a role they already control to a tier above their own.
    /// The permission to administer roles is not the permission to administer
    /// every role.
    /// </summary>
    private void EnsureMayShape(BaseRole target)
    {
        var actor = currentUser.Tier;

        if (actor is null)
            throw AppException.Forbidden("Sign in again before changing roles.");

        if (actor == BaseRole.SuperAdmin) return;

        if (!RoleHierarchy.Outranks(actor.Value, target))
        {
            throw AppException.Forbidden(
                $"{Article(actor.Value, capital: true)} cannot change " +
                $"{Article(target)} role. A role can only be changed from above it.");
        }
    }

    /// <summary>
    /// "An Admin", "a Super Admin" — the article the name actually takes, and
    /// only the article is lower cased. The role's own name is a proper noun
    /// on the screens that show it, so it keeps its capitals here too.
    /// </summary>
    private static string Article(BaseRole role, bool capital = false)
    {
        var name = RoleHierarchy.DisplayName(role);
        var article = "AEIOU".Contains(char.ToUpperInvariant(name[0])) ? "an" : "a";
        return (capital ? char.ToUpperInvariant(article[0]) + article[1..] : article) + " " + name;
    }

    /// <summary>
    /// Nobody hands on what they do not hold.
    ///
    /// The other half of the same hole: a role you may edit is a role you
    /// could otherwise load with every permission in the system and then
    /// assign to yourself. What you may grant is bounded by what you have.
    /// </summary>
    private void EnsureMayGrant(
        IEnumerable<string> permissions, IEnumerable<string>? alreadyOnTheRole = null)
    {
        if (currentUser.Tier == BaseRole.SuperAdmin) return;

        var held = currentUser.Permissions.ToHashSet(StringComparer.OrdinalIgnoreCase);

        /* Only what is being added. Saving a role replaces its whole permission
           set, so without this an Operation Manager role holding one permission
           the Admin lacks could never be edited by that Admin at all — not even
           to change its description. Keeping what is already there is not a
           grant; adding to it is. */
        foreach (var existing in alreadyOnTheRole ?? []) held.Add(existing);

        var beyond = permissions.Distinct().Where(p => !held.Contains(p)).ToList();

        if (beyond.Count > 0)
        {
            throw AppException.Forbidden(
                "You can only grant permissions you hold yourself. Not yours to give: " +
                string.Join(", ", beyond.Order()) + ".");
        }
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

        /* Whoever creates an account is who it answers to. Taken from the
           caller rather than from a picker on the form: the chain is one tier
           down at a time, so the creator is the only correct answer, and a
           picker only offers a way to record a wrong one. It is also what the
           list is filtered by, so an account with no creator recorded would
           be invisible to everybody who could act on it. */
        entity.ReportsToUserId = currentUser.UserId;

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
        await notifications.SendAccountUpdatedAsync(entity, ct);

        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Enable or disable. Available to every tier above the account, which is
    /// the reach senior tiers keep where they cannot create.
    /// </summary>
    public async Task<PortalUserDto> SetStatusAsync(
        int id, string status, string? reason, CancellationToken ct)
    {
        var entity = await db.Users.FirstOrDefaultAsync(u => u.Id == id, ct)
                     ?? throw AppException.NotFound("User");
        delegation.EnsureOutranks(entity.BaseRole, "enable or disable");

        var next = EnumMaps.ToStatus(status);
        var trimmed = reason?.Trim();

        /* Required, and required of both directions. Turning an account back on
           is as much a decision as turning it off, and a history with reasons
           on only half its rows answers half the questions asked of it. */
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            throw new AppException(
                next == RecordStatus.Active
                    ? "Give a reason for enabling this account."
                    : "Give a reason for disabling this account.");
        }

        if (trimmed.Length > 500)
            throw new AppException("The reason must be 500 characters or fewer.");

        if (entity.Status == next)
        {
            throw new AppException(
                $"{entity.FullName} is already {(next == RecordStatus.Active ? "enabled" : "disabled")}.");
        }

        db.UserStatusEvents.Add(new UserStatusEvent
        {
            UserId = entity.Id,
            FromStatus = entity.Status,
            ToStatus = next,
            Reason = trimmed,
            ByUserId = currentUser.UserId,
            ByUserName = currentUser.DisplayName ?? "System",
            ByUserCode = currentUser.UserCode ?? string.Empty,
            On = DateTime.UtcNow,
        });

        entity.Status = next;

        /* Every session dies with the account. Leaving them alive would mean a
           disabled account carries on working until its token expires — the
           same hole the permissions had. */
        if (next != RecordStatus.Active)
        {
            var tokens = await db.RefreshTokens
                .Where(t => t.UserId == id && t.RevokedOn == null).ToListAsync(ct);
            foreach (var token in tokens) token.RevokedOn = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);
        await notifications.SendAccountStatusChangedAsync(
            entity, trimmed, currentUser.DisplayName ?? "an administrator", ct);

        return await GetAsync(id, ct);
    }

    /// <summary>
    /// The account's status history, and the login it belongs to.
    ///
    /// Read through the same visibility rule as the list: an account you
    /// cannot see is an account whose history you cannot read.
    /// </summary>
    public async Task<UserHistoryDto> HistoryAsync(int id, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking()
            .VisibleTo(currentUser)
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw AppException.NotFound("User");

        var events = await db.UserStatusEvents.AsNoTracking()
            .Where(e => e.UserId == id)
            .OrderByDescending(e => e.On)
            .Select(e => new UserStatusEventDto
            {
                Id = e.Id,
                FromStatus = e.FromStatus.ToApi(),
                ToStatus = e.ToStatus.ToApi(),
                Reason = e.Reason,
                ByUserName = e.ByUserName,
                ByUserCode = e.ByUserCode,
                On = e.On,
            })
            .ToListAsync(ct);

        return new UserHistoryDto
        {
            UserId = user.Id,
            UserCode = user.UserCode,
            FullName = user.FullName,
            Email = user.Email,
            RoleName = user.Role?.Name ?? string.Empty,
            Status = user.Status.ToApi(),
            LastLoginOn = user.LastLoginOn,
            Events = events,
        };
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
