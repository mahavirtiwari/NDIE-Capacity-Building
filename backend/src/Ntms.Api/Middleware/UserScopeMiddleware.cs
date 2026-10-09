using Ntms.Infrastructure.Identity;

namespace Ntms.Api.Middleware;

/// <summary>
/// Puts the signed-in account's allocation on the request, for the scope
/// filters to read.
///
/// It has to happen here rather than inside <c>CurrentUser</c> because the
/// filters read the lists synchronously while composing a query, and a
/// database call cannot be made from there without blocking a request thread.
/// Loading it once, up front and asynchronously, keeps that honest.
///
/// Only scoped tiers pay for it. Super Admin and the Ministry are unscoped by
/// design, so their requests never touch the database for this.
/// </summary>
public class UserScopeMiddleware(RequestDelegate next)
{
    /// <summary>Where the loaded scope is left for <c>CurrentUser</c> to find.</summary>
    public const string ItemKey = "ntms.user-scope";

    /// <summary>Where the loaded permissions are left, for the same readers.</summary>
    public const string PermissionsKey = "ntms.user-permissions";

    public async Task InvokeAsync(HttpContext context, UserScopeProvider scopes)
    {
        var principal = context.User;

        /* An applicant's token carries a subject too, and the two id spaces
           overlap: applicant 1 and portal user 1 are different people. Read
           one as the other and the applicant is handed that user's
           permissions, unscoped. So the population is established first and
           nothing is looked up for the wrong one. */
        var isApplicant =
            principal?.HasClaim(JwtTokenService.PrincipalTypeClaim,
                                JwtTokenService.ApplicantPrincipal) == true
            || principal?.FindFirst(JwtTokenService.ApplicantIdClaim) is not null
            || principal?.IsInRole("Applicant") == true;

        var scoped = principal?.HasClaim(JwtTokenService.ScopedClaim, "1") == true;
        var userId = 0;
        var hasId = !isApplicant && int.TryParse(
            principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? principal?.FindFirst("sub")?.Value,
            out userId);

        if (scoped && hasId)
        {
            context.Items[ItemKey] = await scopes.LoadAsync(userId, context.RequestAborted);
        }

        /* Every portal account, scoped or not, because a permission is not a
           scope: an Admin and the Ministry are unscoped and still answer to
           what their role grants. Super Admin included — it was skipped here
           while it was waved through the handler, and now that it is not,
           skipping the load would leave it with no permissions at all rather
           than with its own.

           Still not an applicant: hasId is false for one, by the check
           above. */
        if (hasId)
        {
            context.Items[PermissionsKey] =
                await scopes.LoadPermissionsAsync(userId, context.RequestAborted);
        }

        await next(context);
    }
}
