using System.Security.Claims;
using Ntms.Domain.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Security;

/// <summary>Requires one permission key on the caller's token.</summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class HasPermissionAttribute(string permission)
    : AuthorizeAttribute(PermissionPolicy.Prefix + permission);

public sealed class PermissionRequirement(string permission) : IAuthorizationRequirement
{
    public string Permission { get; } = permission;
}

public static class PermissionPolicy
{
    public const string Prefix = "perm:";
}

/// <summary>
/// Builds a policy on demand for any "perm:{key}" name, so a new permission
/// needs no registration ceremony.
/// </summary>
public class PermissionPolicyProvider(IOptions<AuthorizationOptions> options)
    : DefaultAuthorizationPolicyProvider(options)
{
    public override async Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (!policyName.StartsWith(PermissionPolicy.Prefix, StringComparison.OrdinalIgnoreCase))
            return await base.GetPolicyAsync(policyName);

        var permission = policyName[PermissionPolicy.Prefix.Length..];
        return new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .AddRequirements(new PermissionRequirement(permission))
            .Build();
    }
}

public class PermissionHandler : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        /* Super Admin is allowed everything by definition; everyone else needs
           the explicit permission claim minted at sign-in. */
        var isSuperAdmin = context.User.IsInRole(BaseRole.SuperAdmin.ToString());
        var hasClaim = context.User.HasClaim(JwtTokenService.PermissionClaim, requirement.Permission);

        if (isSuperAdmin || hasClaim) context.Succeed(requirement);
        return Task.CompletedTask;
    }
}

/// <summary>Reads the signed-in principal out of the current request.</summary>
public class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser, ICurrentUserRoles
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    public int? UserId =>
        int.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier)
                     ?? Principal?.FindFirstValue("sub"), out var id)
            ? id
            : null;

    public string? UserCode => Principal?.FindFirstValue(JwtTokenService.UserCodeClaim)
                               ?? Principal?.FindFirstValue(JwtTokenService.ApplicantCodeClaim);

    /// <summary>Set only on a token issued to the mobile applicant app.</summary>
    public int? ApplicantId =>
        int.TryParse(Principal?.FindFirstValue(JwtTokenService.ApplicantIdClaim), out var id)
            ? id
            : null;

    public string? DisplayName => Principal?.FindFirstValue(ClaimTypes.Name);

    public string? RoleName => Principal?.FindFirstValue(ClaimTypes.Role);

    public string? BaseRole => Principal?.FindFirstValue(ClaimTypes.Role);

    public bool IsAuthenticated => Principal?.Identity?.IsAuthenticated ?? false;

    public bool HasPermission(string permission) =>
        Principal?.IsInRole(Ntms.Domain.Common.BaseRole.SuperAdmin.ToString()) == true
        || Principal?.HasClaim(JwtTokenService.PermissionClaim, permission) == true;

    public IReadOnlyList<int> ScopeCategoryIds => Ids(JwtTokenService.ScopeCategoryClaim);
    public IReadOnlyList<int> ScopeSubCategoryIds => Ids(JwtTokenService.ScopeSubCategoryClaim);
    public IReadOnlyList<int> ScopeProgramTypeIds => Ids(JwtTokenService.ScopeProgramTypeClaim);
    public IReadOnlyList<int> ScopeStateCodes => Ids(JwtTokenService.ScopeStateClaim);
    public IReadOnlyList<int> ScopeDistrictCodes => Ids(JwtTokenService.ScopeDistrictClaim);

    public int? AgencyId =>
        int.TryParse(Principal?.FindFirstValue(JwtTokenService.AgencyIdClaim), out var id)
            ? id
            : null;

    public Domain.Common.BaseRole? Tier =>
        Enum.TryParse<Domain.Common.BaseRole>(BaseRole, out var tier) ? tier : null;

    /// <summary>
    /// Taken from the token's own marker rather than guessed from how many
    /// scope rows happen to be present — an allocation of nothing has to be
    /// distinguishable from no allocation at all.
    /// </summary>
    public bool IsMasterScoped =>
        Principal?.HasClaim(JwtTokenService.ScopedClaim, "1") == true;

    private IReadOnlyList<int> Ids(string claimType) =>
    [
        .. (Principal?.FindAll(claimType) ?? [])
            .Select(c => int.TryParse(c.Value, out var id) ? id : 0)
            .Where(id => id > 0),
    ];
}
