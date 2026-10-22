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

        if (batch.MaxParticipants > 0 && batch.ParticipantCount >= batch.MaxParticipants)
            return "This program is full.";

        if (!batch.RegistrationsOpen) return "Registrations for this program are closed.";

        return null;
    }

    /// <summary>The same question, where only yes or no is wanted.</summary>
    public static bool IsOpen(Programme batch) => Closed(batch) is null;
}
