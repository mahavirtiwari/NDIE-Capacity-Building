using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Writes a candidate's result back from whatever has been marked.
///
/// Two things can change a result — a trainer marking the viva and a candidate
/// submitting the online paper — and they must reach the same answer. Both go
/// through here, so there is one place that decides what a result is and one
/// place to correct if the rule ever changes.
/// </summary>
public class ResultRecorder(NtmsDbContext db)
{
    /// <summary>
    /// Recomputes from the candidate's own record, fetching what it needs.
    ///
    /// For callers holding one participant — the exam, which touches a single
    /// candidate at a time. A caller working down a whole sheet already has the
    /// scheme and the skills and should use the other overload rather than
    /// fetching them per row.
    /// </summary>
    public async Task RecomputeAsync(ProgrammeParticipant participant, CancellationToken ct)
    {
        var programTypeId = await db.Programmes.AsNoTracking()
            .Where(p => p.Id == participant.ProgrammeId)
            .Select(p => p.ProgramTypeId)
            .FirstAsync(ct);

        var scheme = await db.ProgramTypes.AsNoTracking()
            .Where(p => p.Id == programTypeId)
            .Select(p => p.Evaluation)
            .FirstAsync(ct);

        var skills = await db.EvaluationSkills.AsNoTracking()
            .Where(s => s.ProgramTypeId == programTypeId && s.Status == RecordStatus.Active)
            .ToListAsync(ct);

        /* Not loaded is not the same as none, and the difference is a viva
           total. Read them rather than assume the candidate was unmarked —
           but keep them out of the tracked collection: rows attached to a
           tracked participant would be taken for new ones and inserted. */
        List<ParticipantSkillMark> marks = participant.SkillMarks.Count > 0
            ? [.. participant.SkillMarks]
            : await db.ParticipantSkillMarks.AsNoTracking()
                .Where(m => m.ParticipantId == participant.Id)
                .ToListAsync(ct);

        Recompute(participant, scheme ?? new EvaluationScheme(), skills, marks, DateTime.UtcNow);
    }

    /// <summary>
    /// Adds the marks up and writes the result onto the candidate.
    ///
    /// Only marks against live skills count towards the viva. A retired skill's
    /// mark stays on the record — it was part of a result that may already have
    /// been reported — but is not added to a total being worked out now, or the
    /// same sheet would total differently before and after somebody tidied the
    /// skill list.
    /// </summary>
    public static void Recompute(
        ProgrammeParticipant participant,
        EvaluationScheme scheme,
        IReadOnlyCollection<EvaluationSkill> activeSkills,
        DateTime now) =>
        Recompute(participant, scheme, activeSkills, [.. participant.SkillMarks], now);

    /// <summary>
    /// As above, for a caller holding the marks separately from the entity —
    /// the exam, which reads them without attaching them.
    /// </summary>
    public static void Recompute(
        ProgrammeParticipant participant,
        EvaluationScheme scheme,
        IReadOnlyCollection<EvaluationSkill> activeSkills,
        IReadOnlyCollection<ParticipantSkillMark> skillMarks,
        DateTime now)
    {
        var live = activeSkills.Select(s => s.Id).ToHashSet();
        var counted = skillMarks.Where(m => live.Contains(m.SkillId)).ToList();

        var viva = counted.Count > 0 ? counted.Sum(m => m.Marks) : (decimal?)null;
        var allMarked = activeSkills.Count > 0 && counted.Count == activeSkills.Count;

        var outcome = Marking.Decide(scheme, participant.WrittenMarks, viva, allMarked);

        participant.VivaMarks = outcome.Viva;
        participant.ExamScore = outcome.Total;
        participant.Result = outcome.Result;
        participant.ResultRecordedOn = outcome.Result == ParticipantResult.Pending ? null : now;
    }
}
