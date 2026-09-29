using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Ntms.Infrastructure.Storage;

/// <summary>
/// One-shot permission to fetch one file.
///
/// The applicant app hands a file to the phone's own browser or PDF viewer,
/// and neither will send a bearer token. Putting the session token in the URL
/// instead would write it into browser history, into any proxy log on the way,
/// and into the referrer of whatever the file links to.
///
/// A ticket avoids all of that. It names one material and one person, it is
/// good for two minutes, it works once, and losing it costs nothing beyond
/// that single file — which the holder was entitled to anyway.
/// </summary>
public class MaterialTickets
{
    private static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(2);

    public sealed record Ticket(int MaterialId, string Holder, bool Download, DateTime ExpiresOn);

    private readonly ConcurrentDictionary<string, Ticket> _issued = new(StringComparer.Ordinal);

    public (string Value, int ExpiresInSeconds) Issue(int materialId, string holder, bool download)
    {
        Prune();

        var value = Convert.ToHexStringLower(RandomNumberGenerator.GetBytes(24));
        _issued[value] = new Ticket(materialId, holder, download, DateTime.UtcNow.Add(Lifetime));
        return (value, (int) Lifetime.TotalSeconds);
    }

    /// <summary>
    /// Takes the ticket out of circulation and returns what it stood for, or
    /// null when it never existed or has run out. Removing it first is what
    /// makes it single use even if two requests arrive together.
    /// </summary>
    public Ticket? Redeem(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        if (!_issued.TryRemove(value, out var ticket)) return null;
        return ticket.ExpiresOn < DateTime.UtcNow ? null : ticket;
    }

    /// <summary>
    /// Clears out what has expired. Done on issue rather than on a timer: the
    /// dictionary only grows when tickets are being issued, so that is the
    /// only moment it can need tidying.
    /// </summary>
    private void Prune()
    {
        if (_issued.Count < 256) return;

        var now = DateTime.UtcNow;
        foreach (var (key, ticket) in _issued)
        {
            if (ticket.ExpiresOn < now) _issued.TryRemove(key, out _);
        }
    }
}
