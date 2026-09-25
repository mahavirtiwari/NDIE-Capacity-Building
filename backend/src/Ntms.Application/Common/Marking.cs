using Ntms.Domain.Common;
using Ntms.Domain.Entities;

namespace Ntms.Application.Common;

/// <summary>
/// What a candidate's marks add up to, and whether they passed.
///
/// One place decides this. The portal marksheet, the coordinator's app and the
/// certificate screen all have to agree about whether somebody qualified, and
/// three implementations of the same arithmetic is three chances to disagree
/// about it in front of the candidate.
/// </summary>
public static class Marking
{
    /// <summary>
    /// The outcome for one candidate.
    ///
    /// <paramref name="Pending"/> is set when there is not enough marked to
    /// decide, and says what is missing. <paramref name="Shortfall"/> is set
    /// when the candidate did not qualify, and says which bar they missed —
    /// which is the question they will ask.
    /// </summary>
    public readonly record struct Outcome(
        ParticipantResult Result,
        decimal? Written,
        decimal? Viva,
        decimal? Total,
        string? Pending,
        string? Shortfall);

    /// <summary>
    /// Decides a result from what has been marked so far.
    ///
    /// Nothing is guessed. A section that the scheme does not examine carries
    /// no marks and is not waited for; a section it does examine has to be
    /// marked before there is any result at all, because a candidate marked on
    /// half the paper has not failed, they have not been marked.
    /// </summary>
    public static Outcome Decide(
        EvaluationScheme scheme,
        decimal? written,
        decimal? viva,
        bool allSkillsMarked)
    {
        if (scheme.Kind == ExaminationKind.None)
        {
            /* Nothing is examined, so nothing decides a pass. Attendance and
               the certification policy carry the programme from here. */
            return new Outcome(ParticipantResult.Pending, null, null, null,
                "This program type has no examination.", null);
        }

        var writtenMark = scheme.HasWritten ? written : null;
        var vivaMark = scheme.HasViva ? viva : null;

        if (scheme.HasWritten && writtenMark is null)
        {
            return new Outcome(ParticipantResult.Pending, null, vivaMark, null,
                "The written paper is not marked yet.", null);
        }

        if (scheme.HasViva && !allSkillsMarked)
        {
            return new Outcome(ParticipantResult.Pending, writtenMark, vivaMark, null,
                "Every skill in the viva has to be marked.", null);
        }

        var total = (writtenMark ?? 0m) + (vivaMark ?? 0m);

        /* Reported in the order they would be checked on a marksheet, and only
           the first is shown: a candidate who missed two bars missed the
           examination, and a list of them reads as piling on. */
        string? shortfall = null;
        if (scheme.HasWritten && writtenMark < scheme.WrittenPassMarks)
        {
            shortfall = $"Written {writtenMark} is below the minimum of {scheme.WrittenPassMarks}.";
        }
        else if (scheme.HasViva && vivaMark < scheme.VivaPassMarks)
        {
            shortfall = $"Viva {vivaMark} is below the minimum of {scheme.VivaPassMarks}.";
        }
        else if (total < scheme.OverallPassMarks)
        {
            shortfall = $"Total {total} is below the overall minimum of {scheme.OverallPassMarks}.";
        }

        return new Outcome(
            shortfall is null ? ParticipantResult.Pass : ParticipantResult.Fail,
            writtenMark, vivaMark, total, null, shortfall);
    }
}
