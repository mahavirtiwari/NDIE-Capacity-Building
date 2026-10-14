using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Suspends agencies whose empanelment has run out.
///
/// An empanelment is a term, and a term ends. Until now nothing noticed:
/// an agency whose validity passed in July went on reading as Active, kept
/// appearing in the pickers a batch is raised against, and kept running
/// programmes on an authority it no longer held. The date was on the
/// register for anyone who looked at that column and compared it with
/// today, which is not a control.
///
/// Done as a sweep rather than as a rule read at display time, because the
/// question is asked in a dozen places - the register, the pickers, the
/// scoping queries, the agency's own login - and a status every one of
/// them already reads is worth more than a condition each would have to
/// remember. It also leaves a record: the suspension is written through
/// the same status event a person's suspension is, so the register's
/// Reason column says "Empanelment period over" and the agency's history
/// sheet carries the day it happened.
/// </summary>
public class LapsedEmpanelmentWorker(
    IServiceScopeFactory scopes,
    ILogger<LapsedEmpanelmentWorker> logger) : BackgroundService
{
    /// <summary>What the register's Reason column will say.</summary>
    public const string Reason = "Empanelment period over";

    /// <summary>
    /// Hourly. The thing being watched for changes once a day, so this is
    /// twenty-four reads of one indexed column to catch the turn of a date
    /// within the hour - and it means a deployment, a restart or a clock
    /// that drifted cannot leave a lapsed agency active until tomorrow.
    /// </summary>
    private static readonly TimeSpan Every = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stopping)
    {
        /* At once on startup, so a release picks up everything that lapsed
           while the rule did not exist. */
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
            var db = scope.ServiceProvider.GetRequiredService<NtmsDbContext>();

            var today = DateOnly.FromDateTime(DateTime.UtcNow);

            /* Only the ones still standing. An agency a person suspended
               for some other reason keeps that reason: it is already out,
               and overwriting why would lose the actual decision. */
            var lapsed = await db.Agencies
                .Where(a => a.Status == RecordStatus.Active
                            && a.EmpanelmentValidTill != null
                            && a.EmpanelmentValidTill < today)
                .ToListAsync(ct);

            if (lapsed.Count == 0) return;

            foreach (var agency in lapsed)
            {
                db.AgencyStatusEvents.Add(new AgencyStatusEvent
                {
                    AgencyId = agency.Id,
                    FromStatus = agency.Status,
                    ToStatus = RecordStatus.Inactive,
                    Reason = Reason,
                    /* Nobody decided this; the date did. Named rather than
                       left blank, because the history sheet says who for
                       every other switch and a blank there reads as a
                       missing record rather than as the system. */
                    ByUserName = "System",
                    ByUserCode = "SYSTEM",
                    On = DateTime.UtcNow,
                });

                agency.Status = RecordStatus.Inactive;
            }

            await db.SaveChangesAsync(ct);

            logger.LogInformation(
                "Suspended {Count} agency(ies) whose empanelment has run out: {Codes}",
                lapsed.Count,
                string.Join(", ", lapsed.Select(a => a.Code)));
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            /* Shutting down. */
        }
        catch (Exception caught)
        {
            /* A sweep that throws must not take the worker with it: a
               BackgroundService that falls over stops ticking, and every
               empanelment after it would quietly never lapse. */
            logger.LogError(caught, "The lapsed-empanelment sweep failed; it will run again.");
        }
    }
}
