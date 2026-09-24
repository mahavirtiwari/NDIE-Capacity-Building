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

    public async Task InvokeAsync(HttpContext context, UserScopeProvider scopes)
    {
        var principal = context.User;

        var scoped = principal?.HasClaim(JwtTokenService.ScopedClaim, "1") == true;
        var hasId = int.TryParse(
            principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? principal?.FindFirst("sub")?.Value,
            out var userId);

        if (scoped && hasId)
        {
            context.Items[ItemKey] = await scopes.LoadAsync(userId, context.RequestAborted);
        }

        await next(context);
    }
}
