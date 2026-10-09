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

public class PermissionHandler(IHttpContextAccessor accessor)
    : AuthorizationHandler<PermissionRequirement>
{
    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        /* No tier is waved through. Super Admin used to be, on the reading
           that whoever owns the portal owns everything in it — but it does
           not run the operation: it neither raises nor approves a batch,
           empanels an agency, appoints a coordinator or a trainer, nor
           decides a profile. A blanket pass here made the permission set
           on its role decorative, and the one tier nobody can hold to
           account the one tier nothing could stop. */

        /* An applicant holds no portal permission, whatever is on the
           request. Checked here as well as in the middleware so a route
           that forgets its role attribute is still shut: a permission key
           is the portal's currency and the applicant app does not deal in
           it. */
        if (context.User.HasClaim(JwtTokenService.PrincipalTypeClaim,
                                  JwtTokenService.ApplicantPrincipal)
            || context.User.FindFirst(JwtTokenService.ApplicantIdClaim) is not null
            || context.User.IsInRole("Applicant"))
        {
            return Task.CompletedTask;
        }

        if (PermissionSet.Current(accessor) is { } granted)
        {
            /* The role as it stands now, loaded this request. A permission
               taken away stops working on the next call rather than whenever
               the holder's token happens to expire. */
            if (granted.Contains(requirement.Permission)) context.Succeed(requirement);
            return Task.CompletedTask;
        }

        /* Nothing loaded: a context the middleware does not run in. The claims
           minted at sign-in are the fallback, which is what the whole system
           ran on before. */
        if (context.User.HasClaim(JwtTokenService.PermissionClaim, requirement.Permission))
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

/// <summary>Reads the permissions the middleware loaded for this request.</summary>
internal static class PermissionSet
{
    public static IReadOnlyCollection<string>? Current(IHttpContextAccessor accessor) =>
        accessor.HttpContext?.Items
            .TryGetValue(Middleware.UserScopeMiddleware.PermissionsKey, out var value) == true
            ? value as IReadOnlyCollection<string>
            : null;
}

/// <summary>Reads the signed-in principal out of the current request.</summary>
public class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser, ICurrentUserRoles
{
    private ClaimsPrincipal? Principal => accessor.HttpContext?.User;

    /// <summary>
    /// The portal account behind this request, or null.
    ///
    /// Null for an applicant even though their token has a subject: the two
    /// id spaces overlap, and reading one as the other handed an applicant
    /// the permissions of whichever portal user shared their row number.
    /// </summary>
    public int? UserId =>
        IsApplicant
            ? null
            : int.TryParse(Principal?.FindFirstValue(ClaimTypes.NameIdentifier)
                           ?? Principal?.FindFirstValue("sub"), out var id)
                ? id
                : null;

    /// <summary>
    /// Whether this is a token from the applicant app rather than the portal.
    ///
    /// Belt and braces: the principal marker, the applicant id and the role
    /// name are all checked, so a token minted before the marker existed is
    /// still recognised for what it is.
    /// </summary>
    public bool IsApplicant =>
        Principal?.HasClaim(JwtTokenService.PrincipalTypeClaim,
                            JwtTokenService.ApplicantPrincipal) == true
        || Principal?.FindFirstValue(JwtTokenService.ApplicantIdClaim) is not null
        || string.Equals(Principal?.FindFirstValue(ClaimTypes.Role), "Applicant",
                         StringComparison.OrdinalIgnoreCase);

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

    /// <summary>
    /// What this account may do, as its role grants it now.
    ///
    /// The loaded set wins over the token's claims for the same reason the
    /// loaded allocation does: the claims are what was true at sign-in, and a
    /// permission that has since been withdrawn must not still work.
    /// </summary>
    public bool HasPermission(string permission)
    {
        return PermissionSet.Current(accessor) is { } granted
            ? granted.Contains(permission)
            : Principal?.HasClaim(JwtTokenService.PermissionClaim, permission) == true;
    }

    /// <summary>Everything this account may do, for the callers that need the set.</summary>
    public IReadOnlyCollection<string> Permissions =>
        PermissionSet.Current(accessor)
        ?? [.. (Principal?.FindAll(JwtTokenService.PermissionClaim) ?? []).Select(c => c.Value)];

    /* Loaded onto the request by UserScopeMiddleware, which runs for every
       scoped account. Null means the middleware had nothing to load for this
       principal — an unscoped tier, or a context it does not run in — and the
       claim fallback below covers that.

       A token issued before the allocation moved off it still carries the old
       claims, but the freshly loaded lists win, which is the behaviour worth
       having: those tokens keep working and pick up the current allocation
       rather than the one frozen at sign-in. */
    private UserScope? Loaded => accessor.HttpContext?.Items
        .TryGetValue(Middleware.UserScopeMiddleware.ItemKey, out var value) == true
        ? value as UserScope
        : null;

    public IReadOnlyList<int> ScopeCategoryIds =>
        Loaded?.CategoryIds ?? Ids(JwtTokenService.ScopeCategoryClaim);
    public IReadOnlyList<int> ScopeSubCategoryIds =>
        Loaded?.SubCategoryIds ?? Ids(JwtTokenService.ScopeSubCategoryClaim);
    public IReadOnlyList<int> ScopeProgramTypeIds =>
        Loaded?.ProgramTypeIds ?? Ids(JwtTokenService.ScopeProgramTypeClaim);
    public IReadOnlyList<int> ScopeStateCodes =>
        Loaded?.StateCodes ?? Ids(JwtTokenService.ScopeStateClaim);
    public IReadOnlyList<int> ScopeDistrictCodes =>
        Loaded?.DistrictCodes ?? Ids(JwtTokenService.ScopeDistrictClaim);

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
