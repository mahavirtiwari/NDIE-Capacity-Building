using Microsoft.EntityFrameworkCore;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// What stands between one applicant and the programmes on offer.
///
/// The rules are the department's, and they are about the person rather
/// than the programme: somebody who has passed a track is finished with it,
/// somebody already booked on one cannot be in two places at once, and
/// somebody who has used their attempts has used them.
///
/// Read once per applicant and asked of each programme in turn, so the
/// listing and the registration itself give the same answer. They used to
/// be two sets of rules in two files — the listing let somebody press
/// Register and the register call explained why not.
/// </summary>
public class ApplicantEligibilityService(NtmsDbContext db)
{
    /// <summary>
    /// Everything about one applicant's history that closes a programme to
    /// them, read in two queries.
    /// </summary>
    public sealed class Standing
    {
        /// <summary>Tracks they have passed. Finished with, and not listed.</summary>
        public required HashSet<int> Passed { get; init; }

        /// <summary>
        /// Tracks they hold a live booking in: a seat on a batch that has
        /// not finished, or a registration whose fee has not arrived.
        /// Another batch of the same nature is one booking too many.
        /// </summary>
        public required HashSet<int> Booked { get; init; }

        /// <summary>Tracks whose attempts are used up, and the allowance.</summary>
        public required HashSet<int> Exhausted { get; init; }
        public required int AttemptsAllowed { get; init; }

        /// <summary>
        /// Tracks that certify nobody and have already been taken once:
        /// there is nothing further to be had from sitting them again.
        /// </summary>
        public required HashSet<int> Taken { get; init; }

        /// <summary>
        /// Dates already committed to. Whole ranges, not start dates: a
        /// five-day programme occupies five days, and the second booking
        /// that clashes is usually the one that overlaps rather than the
        /// one that starts on the same morning.
        /// </summary>
        public required List<(DateOnly From, DateOnly To)> Committed { get; init; }

        /// <summary>
        /// Why this programme is closed to them, or null where it is not.
        /// Worded for the applicant: it is shown on the card and thrown
        /// back at them if they try anyway.
        /// </summary>
        public string? Refuse(Programme programme)
        {
            if (Passed.Contains(programme.ProgramTypeId))
                return "You have already cleared this program.";

            if (Taken.Contains(programme.ProgramTypeId))
                return "You have already taken this program.";

            if (Exhausted.Contains(programme.ProgramTypeId))
                return $"You have used all {AttemptsAllowed} attempts at this program.";

            if (Booked.Contains(programme.ProgramTypeId))
            {
                return "You are already registered for this program. "
                       + "Finish that one before taking another.";
            }

            if (Committed.Any(held => held.From <= programme.EndDate
                                      && programme.StartDate <= held.To))
            {
                return "You are registered for another program on these dates.";
            }

            return null;
        }

        /// <summary>
        /// Whether the programme should be listed at all.
        ///
        /// Only a track they have finished with is hidden. The rest stay on
        /// the list with the reason on them: "you are booked on these dates"
        /// is an answer, and a programme that silently disappeared would
        /// leave somebody wondering whether it had been cancelled.
        /// </summary>
        public bool Hide(Programme programme) =>
            Passed.Contains(programme.ProgramTypeId) || Taken.Contains(programme.ProgramTypeId);
    }

    public async Task<Standing> ReadAsync(int applicantId, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var seats = await db.ProgrammeParticipants.AsNoTracking()
            .Where(p => p.ApplicantId == applicantId)
            .Select(p => new
            {
                p.Programme!.ProgramTypeId,
                p.Programme.StartDate,
                p.Programme.EndDate,
                p.Programme.ProgramType!.CertificationPolicy,
                p.AttendancePercent,
                p.Result,
            })
            .ToListAsync(ct);

        /* Registered and still owing the fee. No participant row exists
           yet, but the dates are spoken for and so is the track: somebody
           who has chosen a batch and is halfway through paying for it
           should not be offered a clashing one.

           Owing is Pending or Failed, not "anything other than Paid". A
           free programme's application is NotApplicable and its seat was
           taken on the spot, and reading that as money outstanding held
           the applicant's dates for a batch they had already finished. */
        var awaiting = await db.Applications.AsNoTracking()
            .Where(a => a.ApplicantId == applicantId
                        && a.ProgrammeId != null
                        && a.Status != ApplicationStatus.Rejected
                        && (a.PaymentStatus == PaymentStatus.Pending
                            || a.PaymentStatus == PaymentStatus.Failed)
                        && a.Programme!.EndDate >= today
                        /* The seat may already have been taken on a later
                           attempt; the participant row is then the record
                           and this application is only its history. */
                        && !db.ProgrammeParticipants.Any(
                            p => p.ApplicantId == applicantId
                                 && p.ProgrammeId == a.ProgrammeId))
            .Select(a => new
            {
                a.ProgramTypeId,
                a.Programme!.StartDate,
                a.Programme.EndDate,
            })
            .ToListAsync(ct);

        var allowed = await db.SystemSettings.AsNoTracking()
            .Where(s => s.Id == 1)
            .Select(s => s.ProgramTypeMaxAttempts)
            .FirstOrDefaultAsync(ct);
        allowed = Math.Clamp(allowed > 0 ? allowed : 3, 1, 10);

        /* Turning up is what makes a sitting an attempt. Somebody who
           registered and never came has not had their try at the paper, so
           the place is not held against them and they may register again. */
        var attended = seats.Where(s => s.AttendancePercent > 0).ToList();

        var passed = attended
            .Where(s => s.Result == ParticipantResult.Pass)
            .Select(s => s.ProgramTypeId)
            .ToHashSet();

        var exhausted = attended
            .Where(s => s.Result == ParticipantResult.Fail)
            .GroupBy(s => s.ProgramTypeId)
            .Where(group => group.Count() >= allowed)
            .Select(group => group.Key)
            .ToHashSet();

        /* A track that certifies nobody has no pass and no fail to its
           name, so attendance alone is the whole of it. */
        var taken = attended
            .Where(s => s.CertificationPolicy == CertificationPolicy.None)
            .Select(s => s.ProgramTypeId)
            .ToHashSet();

        var live = seats
            .Where(s => s.Result == ParticipantResult.Pending && s.EndDate >= today)
            .ToList();

        var booked = live.Select(s => s.ProgramTypeId)
            .Concat(awaiting.Select(a => a.ProgramTypeId))
            .ToHashSet();

        var committed = live.Select(s => (s.StartDate, s.EndDate))
            .Concat(awaiting.Select(a => (a.StartDate, a.EndDate)))
            .ToList();

        return new Standing
        {
            Passed = passed,
            Booked = booked,
            Exhausted = exhausted,
            AttemptsAllowed = allowed,
            Taken = taken,
            Committed = committed,
        };
    }
}
