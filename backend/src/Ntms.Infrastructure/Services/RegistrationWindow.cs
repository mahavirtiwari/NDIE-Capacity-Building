using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Whether a batch is still taking registrations, asked in one place.
///
/// Three things close it and they were not all being asked. The flag on
/// the batch is turned off when the manager puts it off, when a report is
/// sent back, and when the last seat goes. What nothing asked was whether
/// the batch had already begun - so a course that started on Monday went
/// on accepting people on Thursday, from the app and from the desk, and
/// the register said "Open" while it did.
///
/// A batch cannot be joined once it is running. Somebody who was not there
/// on the first day did not attend the course, whatever the attendance
/// sheet is made to say afterwards, and the certificate at the end of it
/// would be evidence of something that did not happen.
///
/// India's today, like everything else dated in this system. The server
/// runs on UTC and a course does not.
/// </summary>
public static class RegistrationWindow
{
    /// <summary>Why registration is shut, or null while it is open.</summary>
    public static string? Closed(Programme batch)
    {
        var today = DateOnly.FromDateTime(IndianTime.From(DateTime.UtcNow));

        if (today > batch.EndDate) return "This program has already been held.";

        if (today >= batch.StartDate)
        {
            return $"This program started on {batch.StartDate:dd MMM yyyy} and is no longer "
                   + "taking registrations.";
        }

        if (Seats(batch) is { } seats && batch.ParticipantCount >= seats)
            return "This program is full.";

        if (!batch.RegistrationsOpen) return "Registrations for this program are closed.";

        return null;
    }

    /// <summary>
    /// How many places the batch takes before it shuts, or null for no
    /// limit at all.
    ///
    /// The ceiling the agency set on the batch, and only that. The program
    /// type also carries a number - MinParticipants - and registration
    /// closing was briefly read from it as well, on the lower of the two.
    /// It is not a second cap: it is the fewest candidates a batch of that
    /// type is worth running for, which is a question about whether to run
    /// the batch at all and not about when to stop filling it. Read as a
    /// cap it shut a batch raised for thirty at its type's twenty, and the
    /// agency's own number stopped meaning anything.
    ///
    /// So: the floor decides whether a batch is worth running, and is
    /// checked where that decision is made - a batch cannot be raised with
    /// a ceiling below its type's floor. The ceiling decides when
    /// registration closes, which is here.
    ///
    /// Zero means unset, which is how a batch with no ceiling at all
    /// reads: it takes everybody until it starts.
    /// </summary>
    public static int? Seats(Programme batch) =>
        batch.MaxParticipants > 0 ? batch.MaxParticipants : null;

    /// <summary>The same question, where only yes or no is wanted.</summary>
    public static bool IsOpen(Programme batch) => Closed(batch) is null;
}
