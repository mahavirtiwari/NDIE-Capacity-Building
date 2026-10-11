using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Ntms.Infrastructure.Email;

/// <summary>
/// Messages that nobody is waiting for, sent after the answer has gone back.
///
/// Every other e-mail in this system is sent inside the request that caused
/// it, which is right when one person did one thing and wants to be told it
/// worked. It is wrong for a batch: closing a forty-person programme issues
/// forty certificates, and sending forty messages down an SMTP connection
/// with a thirty-second timeout each meant a coordinator's phone holding a
/// request open for as long as it took — in a field, on a bad line, with no
/// way to tell a slow send from a failed submission.
///
/// So the work is handed to this and the request returns. What is queued is
/// a closure over a scope, not a built message: the sender, the templates
/// and the database it reads them from are all scoped services, and keeping
/// a reference to any of them past the end of the request is how you get a
/// disposed DbContext in a log at two in the morning.
///
/// The trade is honest and worth stating: a message queued and not yet sent
/// is lost if the process recycles. Nothing here is the record — the
/// certificate is in the database the moment it is issued, it verifies, and
/// Resend will send it again — so what is lost is a notification, not an
/// award.
/// </summary>
public interface IEmailQueue
{
    /// <summary>
    /// Queues work to run after the current request, in a scope of its own.
    /// Returns immediately; never throws for the caller to handle.
    /// </summary>
    void Enqueue(string description, Func<IServiceProvider, CancellationToken, Task> work);
}

public class EmailQueue(ILogger<EmailQueue> logger) : IEmailQueue
{
    internal record Job(string Description, Func<IServiceProvider, CancellationToken, Task> Work);

    /* Unbounded, because the alternative is dropping a certificate e-mail to
       protect memory, and the realistic ceiling is one batch of participants.
       Single reader so sends stay sequential: an SMTP server handed forty
       connections at once is a server that starts refusing them. */
    private readonly Channel<Job> channel = Channel.CreateUnbounded<Job>(
        new UnboundedChannelOptions { SingleReader = true });

    internal ChannelReader<Job> Reader => channel.Reader;

    public void Enqueue(string description, Func<IServiceProvider, CancellationToken, Task> work)
    {
        if (!channel.Writer.TryWrite(new Job(description, work)))
        {
            /* Only reachable once the channel is completed, which happens at
               shutdown. Worth a line rather than a silent drop. */
            logger.LogWarning("Could not queue {Work}: the e-mail queue is closed.", description);
        }
    }
}

/// <summary>
/// Drains the queue, one message at a time, for the life of the process.
/// </summary>
public class EmailQueueWorker(
    EmailQueue queue,
    IServiceScopeFactory scopes,
    ILogger<EmailQueueWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stopping)
    {
        await foreach (var job in queue.Reader.ReadAllAsync(stopping))
        {
            try
            {
                using var scope = scopes.CreateScope();
                await job.Work(scope.ServiceProvider, stopping);
            }
            catch (OperationCanceledException) when (stopping.IsCancellationRequested)
            {
                /* Shutting down. The rest of the queue goes with it, which is
                   the trade this class documents. */
                break;
            }
            catch (Exception caught)
            {
                /* One message that will not send must not take the worker
                   with it — a BackgroundService that throws stops draining,
                   and every message after it is silently never sent. */
                logger.LogError(caught, "Queued e-mail failed: {Work}", job.Description);
            }
        }
    }
}
