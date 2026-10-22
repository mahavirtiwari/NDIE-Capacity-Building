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
    /// Two numbers bear on this and the scheme asked for the lower of
    /// them. The agency sets a ceiling on the batch; the Super Admin sets
    /// a floor on the program type - the fewest candidates a batch of
    /// that type is worth running for - and registration is to close once
    /// that number has been reached. So a type with a floor of twenty
    /// takes twenty, whatever ceiling the agency wrote, and a type with
    /// no floor takes the agency's ceiling as before.
    ///
    /// Worth saying plainly, because it reads oddly and is deliberate:
    /// the floor is being used as the batch size. A batch that was raised
    /// for thirty will therefore shut at its type's twenty rather than
    /// filling. If the intention was ever that the floor only decides
    /// whether a batch is worth running, this method is the one place to
    /// change.
    ///
    /// Zero means unset on both, which is how everything that predates
    /// either number reads.
    /// </summary>
    public static int? Seats(Programme batch)
    {
        var ceiling = batch.MaxParticipants > 0 ? batch.MaxParticipants : (int?)null;
        var floor = batch.ProgramType?.MinParticipants > 0
            ? batch.ProgramType!.MinParticipants
            : (int?)null;

        return (ceiling, floor) switch
        {
            (null, null) => null,
            (null, { } f) => f,
            ({ } c, null) => c,
            ({ } c, { } f) => Math.Min(c, f),
        };
    }

    /// <summary>The same question, where only yes or no is wanted.</summary>
    public static bool IsOpen(Programme batch) => Closed(batch) is null;
}
