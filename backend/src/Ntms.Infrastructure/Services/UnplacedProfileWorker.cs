using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Gives a desk to profiles that were handed in when no officer covered
/// them.
///
/// A profile is placed the moment it arrives. Sometimes there is nobody
/// to place it with - no Operation Manager yet holds that sub-category
/// in that state - and it waits. This is what comes back for those.
///
/// It used to run at the top of every read of the scrutiny queue, which
/// is where it was found: the queue took fifty-nine seconds a page
/// against ten thousand profiles, because each unplaced one costs a
/// query to pick an officer, a query to load the row and a save of its
/// own, and all of it ran again for every officer who opened the screen.
/// Twenty-five people looking at the queue did the same twenty thousand
/// round trips twenty-five times over, and fought each other for the
/// rows while they did it.
///
/// None of that belongs on a read. It is the same work on the same rows
/// in the same order, off the request path, where taking a few seconds
/// costs nobody anything.
/// </summary>
public class UnplacedProfileWorker(
    IServiceScopeFactory scopes,
    ILogger<UnplacedProfileWorker> logger) : BackgroundService
{
    /// <summary>
    /// Often enough that a profile does not sit unseen for long, rarely
    /// enough to be nothing: a profile arriving to an empty rota is the
    /// uncommon case, and the common one is this finding nothing to do.
    /// </summary>
    private static readonly TimeSpan Every = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stopping)
    {
        /* At once on startup, so a release picks up whatever was waiting
           while the rule lived on the read path. */
        await SweepAsync(stopping);

        using var timer = new PeriodicTimer(Every);
        while (await timer.WaitForNextTickAsync(stopping))
        {
            await SweepAsync(stopping);
        }
    }

    private async Task SweepAsync(CancellationToken ct)
    {
        try
        {
            using var scope = scopes.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<ProfileSubmissionService>();

            var placed = await service.PlaceUnassignedAsync(ct);
            if (placed > 0) logger.LogInformation("Placed {Count} waiting profile(s).", placed);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            /* Shutting down. */
        }
        catch (Exception caught)
        {
            /* A pass that throws must not take the worker with it: a
               BackgroundService that falls over stops ticking, and every
               profile after it would wait for good. */
            logger.LogError(caught, "The unplaced-profile sweep failed; it will run again.");
        }
    }
}
