using System.Text.Json;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Middleware;

/// <summary>
/// Closes the API while the site is in maintenance.
///
/// Only the API. The Angular shell and its assets still load, because the
/// portal has to be able to render the notice saying why nothing works — a
/// blank page or a browser error tells a user the site is broken, which is a
/// different message from "we are working on it".
///
/// A Super Admin is let through, so whoever closed the site can still use it
/// to do the work and open it again. Everybody else, signed in or not, gets
/// 503 and the message.
/// </summary>
public class MaintenanceMiddleware(RequestDelegate next)
{
    /// <summary>
    /// What stays open regardless.
    ///
    /// Sign-in has to work or a Super Admin could not get in to lift the
    /// closure. The status endpoint is what the notice reads. Branding is what
    /// the notice is drawn with, and is anonymous already.
    /// </summary>
    private static readonly string[] AlwaysOpen =
    [
        "/api/system/maintenance",
        "/api/auth/login",
        "/api/auth/refresh",
        "/api/health",
        "/api/branding",
    ];

    public async Task InvokeAsync(HttpContext context, SystemSettingService settings)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        if (!path.StartsWith("/api", StringComparison.OrdinalIgnoreCase)
            || AlwaysOpen.Any(open => path.StartsWith(open, StringComparison.OrdinalIgnoreCase)))
        {
            await next(context);
            return;
        }

        var status = await settings.StatusAsync(context.RequestAborted);
        if (!status.MaintenanceMode)
        {
            await next(context);
            return;
        }

        if (IsSuperAdmin(context))
        {
            /* Said on every response rather than assumed: it is otherwise very
               easy to close the site, carry on working, and not realise it is
               still shut for everybody else. */
            context.Response.Headers["X-Maintenance-Mode"] = "on";
            await next(context);
            return;
        }

        context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
        context.Response.ContentType = "application/json";
        context.Response.Headers.RetryAfter = "600";

        await context.Response.WriteAsync(JsonSerializer.Serialize(
            new ApiEnvelope<MaintenanceStatusDto>
            {
                Success = false,
                Message = status.Message,
                Data = status,
            },
            new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }

    /* The role claim the token carries is the base role's name, which is what
       IsInRole reads. */
    private static bool IsSuperAdmin(HttpContext context) =>
        context.User?.Identity?.IsAuthenticated == true
        && context.User.IsInRole(nameof(BaseRole.SuperAdmin));
}
