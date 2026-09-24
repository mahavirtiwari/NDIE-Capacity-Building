using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;

namespace Ntms.Api.Middleware;

/// <summary>
/// Turns every failure into the same envelope the clients already understand,
/// and keeps internal detail out of the response body.
/// </summary>
public class ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (AppException ex)
        {
            logger.LogInformation("Handled application error: {Message}", ex.Message);
            await WriteAsync(context, ex.StatusCode, ex.Message);
        }
        catch (DbUpdateConcurrencyException)
        {
            await WriteAsync(context, StatusCodes.Status409Conflict,
                "Someone else changed this record while you were editing it. Reload and try again.");
        }
        catch (DbUpdateException ex)
        {
            logger.LogError(ex, "Database update failed");
            await WriteAsync(context, StatusCodes.Status409Conflict,
                "The change could not be saved. It may conflict with an existing record.");
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            /* The caller walked away; nothing to report. */
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled error on {Method} {Path}",
                context.Request.Method, context.Request.Path);
            await WriteAsync(context, StatusCodes.Status500InternalServerError,
                "Something went wrong. Please try again, or contact support if it persists.");
        }
    }

    private static async Task WriteAsync(HttpContext context, int statusCode, string message)
    {
        if (context.Response.HasStarted) return;

        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        var body = JsonSerializer.Serialize(
            ApiEnvelope<object>.Fail(message),
            new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

        await context.Response.WriteAsync(body);
    }
}
