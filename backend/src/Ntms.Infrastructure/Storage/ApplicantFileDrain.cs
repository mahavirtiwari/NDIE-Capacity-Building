using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Storage;

/// <summary>
/// Moves the applicant files that are still bytes in the database out to
/// disk: the pictures and documents on a profile, and the selfie taken at
/// the start of an exam.
///
/// The pictures used to be kept on the row. New ones are written to disk
/// from the moment this release is up, but the ones already taken are
/// sitting in the table and a migration cannot move them — it speaks SQL,
/// and the destination is a filesystem. So it happens here, once, in the
/// background, after the application has started.
///
/// Written to be run again safely. It takes rows that have bytes and no
/// path, a few at a time, and for each one writes the file, records the
/// path and clears the column in a single save. An interrupted run leaves
/// every row either fully moved or entirely untouched, and starting again
/// simply picks up what is left.
///
/// Nothing waits on it. A row it has not reached yet is still readable from
/// its column, which is why that column is nullable rather than gone, and
/// the application serves pictures throughout. The column is dropped in a
/// later release, once this has reported nothing left to do.
/// </summary>
public class ApplicantFileDrain(
    IServiceScopeFactory scopes,
    ILogger<ApplicantFileDrain> logger) : BackgroundService
{
    /// <summary>Small, because each row carries a photograph.</summary>
    private const int Batch = 20;

    protected override async Task ExecuteAsync(CancellationToken stopping)
    {
        /* Let the application finish coming up first. Nothing depends on
           this having run, and competing with the first requests for the
           database would be a poor trade for finishing a minute sooner. */
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(20), stopping);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        var moved = 0;
        var failed = 0;

        try
        {
            while (!stopping.IsCancellationRequested)
            {
                using var scope = scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<NtmsDbContext>();
                var files = scope.ServiceProvider.GetRequiredService<ApplicantFileStore>();

                var batch = await db.ProfileAttachments
                    .Where(a => a.RelativePath == "" && a.Content != null)
                    .OrderBy(a => a.Id)
                    .Take(Batch)
                    .ToListAsync(stopping);

                if (batch.Count == 0) break;

                foreach (var held in batch)
                {
                    if (held.Content is not { Length: > 0 } bytes)
                    {
                        /* An empty column and no file: nothing to move, and
                           nothing to keep reading it for. */
                        held.Content = null;
                        continue;
                    }

                    try
                    {
                        var stored = await files.SaveAsync(
                            bytes, held.ContentType, held.ApplicantId, stopping);

                        held.RelativePath = stored.RelativePath;
                        held.SizeBytes = stored.SizeBytes;
                        held.Content = null;
                        moved++;
                    }
                    catch (Exception caught)
                    {
                        /* Left exactly as it was, so the next run tries it
                           again and the picture stays readable meanwhile. */
                        failed++;
                        logger.LogWarning(
                            caught,
                            "Profile attachment {Id} could not be moved to disk.", held.Id);
                    }
                }

                await db.SaveChangesAsync(stopping);

                /* A batch where every row failed would otherwise spin:
                   the same rows come back, fail again, and the loop never
                   ends. Stop and leave them for the next start. */
                if (batch.All(a => a.RelativePath == "")) break;
            }

            moved += await DrainSelfiesAsync(stopping);
        }
        catch (OperationCanceledException)
        {
            /* Shutting down. What was saved is saved. */
        }
        catch (Exception caught)
        {
            logger.LogError(caught, "The profile attachment drain stopped early.");
        }

        if (moved > 0 || failed > 0)
        {
            logger.LogInformation(
                "Applicant files moved to disk: {Moved} written, {Failed} left for next time.",
                moved, failed);
        }
    }

    /// <summary>
    /// The same job for the pictures taken when a candidate starts an exam,
    /// which were kept on the attempt row for the same reason and move to
    /// the same place - the candidate's own folder.
    /// </summary>
    private async Task<int> DrainSelfiesAsync(CancellationToken stopping)
    {
        var moved = 0;

        while (!stopping.IsCancellationRequested)
        {
            using var scope = scopes.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<NtmsDbContext>();
            var files = scope.ServiceProvider.GetRequiredService<ApplicantFileStore>();

            var batch = await db.ExamAttempts
                .Include(a => a.Participant)
                .Where(a => a.SelfiePath == "" && a.SelfieData != null)
                .OrderBy(a => a.Id)
                .Take(Batch)
                .ToListAsync(stopping);

            if (batch.Count == 0) break;

            foreach (var attempt in batch)
            {
                if (attempt.SelfieData is not { Length: > 0 } bytes
                    || attempt.Participant is null)
                {
                    attempt.SelfieData = null;
                    continue;
                }

                try
                {
                    var stored = await files.SaveAsync(
                        bytes, attempt.SelfieContentType, attempt.Participant.ApplicantId,
                        stopping);

                    attempt.SelfiePath = stored.RelativePath;
                    attempt.SelfieSizeBytes = stored.SizeBytes;
                    attempt.SelfieData = null;
                    moved++;
                }
                catch (Exception caught)
                {
                    logger.LogWarning(
                        caught, "Exam selfie {Id} could not be moved to disk.", attempt.Id);
                }
            }

            await db.SaveChangesAsync(stopping);

            if (batch.All(a => a.SelfiePath == "")) break;
        }

        return moved;
    }

}
