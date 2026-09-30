using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// The trainer's marksheet for one programme.
///
/// A candidate's result is not typed in; it is worked out from what was marked,
/// every time marks change, by <see cref="Marking"/>. That way the result can
/// never disagree with the marks behind it, and a half-marked candidate stays
/// pending instead of showing as a fail nobody intended.
///
/// Two rules are enforced here rather than at each call site:
///
/// <list type="bullet">
/// <item>Who may mark: the coordinator the programme is assigned to, or a
/// portal account that may manage programmes. Reads are open to anyone whose
/// scope already covers the programme, because a marksheet is worth seeing up
/// the chain without being editable there.</item>
/// <item>A candidate whose certificate has been issued is read only. Changing
/// the marks behind a certificate somebody is already holding is not a
/// correction, it is a contradiction — the certificate is revoked first.</item>
/// </list>
/// </summary>
public class MarksheetService(NtmsDbContext db, ICurrentUser currentUser)
{
    /* ------------------------------------------------------------ access */

    private async Task<Programme> ForReadAsync(int programmeId, CancellationToken ct)
    {
        var programme = await db.Programmes
            .Include(p => p.ProgramType)
            .FirstOrDefaultAsync(p => p.Id == programmeId, ct)
            ?? throw AppException.NotFound("Program");

        if (programme.CoordinatorId == currentUser.UserId) return programme;

        if (currentUser.HasPermission(Permissions.ProgramsView))
        {
            var visible = await db.Programmes.AsNoTracking()
                .WithinScope(currentUser)
                .AnyAsync(p => p.Id == programmeId, ct);
            if (visible) return programme;
        }

        throw AppException.Forbidden("This program is not assigned to you.");
    }

    /// <summary>
    /// Whether this account may mark, and why not when it may not.
    ///
    /// Returned rather than thrown on the read path, so the sheet opens read
    /// only with the reason on it instead of refusing to open at all.
    /// </summary>
    private string? WhyReadOnly(Programme programme)
    {
        if (programme.CoordinatorId == currentUser.UserId) return null;
        if (currentUser.HasPermission(Permissions.ProgramsManage)) return null;
        return "Marks are entered by the coordinator this program is assigned to.";
    }

    /* -------------------------------------------------------------- read */

    public async Task<MarksheetDto> GetAsync(int programmeId, CancellationToken ct)
    {
        var programme = await ForReadAsync(programmeId, ct);
        var scheme = programme.ProgramType?.Evaluation ?? new EvaluationScheme();

        var participants = await db.ProgrammeParticipants.AsNoTracking()
            .Include(p => p.Applicant)
            .Include(p => p.Application)
            .Include(p => p.SkillMarks)
            .Where(p => p.ProgrammeId == programmeId)
            .ToListAsync(ct);

        /* Live skills, plus any retired one this sheet already carries marks
           for: dropping it would change totals that have been reported. */
        var markedSkillIds = participants
            .SelectMany(p => p.SkillMarks).Select(m => m.SkillId).Distinct().ToList();

        var skills = await db.EvaluationSkills.AsNoTracking()
            .Where(s => s.ProgramTypeId == programme.ProgramTypeId
                        && (s.Status == RecordStatus.Active || markedSkillIds.Contains(s.Id)))
            .OrderBy(s => s.DisplayOrder).ThenBy(s => s.Name)
            .ToListAsync(ct);

        var trainers = await db.ProgrammeTrainers.AsNoTracking()
            .Where(t => t.ProgrammeId == programmeId)
            .OrderBy(t => t.FullName)
            .ToListAsync(ct);

        var trainerNames = trainers.ToDictionary(t => t.Id, t => t.FullName);

        var issued = await db.Certificates.AsNoTracking()
            .Where(c => c.ProgrammeId == programmeId && c.RevokedOn == null)
            .Select(c => c.ParticipantId)
            .ToListAsync(ct);

        var activeSkillIds = skills.Where(s => s.Status == RecordStatus.Active)
            .Select(s => s.Id).ToHashSet();

        /* Sittings of the online paper, so a written mark the candidate earned
           can be shown as theirs rather than as somebody's typing. */
        var sittings = await db.ExamAttempts.AsNoTracking()
            .Where(a => a.Participant!.ProgrammeId == programmeId
                        && a.Status != ExamAttemptStatus.InProgress)
            .GroupBy(a => a.ParticipantId)
            .Select(g => new
            {
                ParticipantId = g.Key,
                Attempts = g.Count(),
                Best = g.Max(a => a.Percentage),
            })
            .ToDictionaryAsync(x => x.ParticipantId, ct);

        var dto = new MarksheetDto
        {
            ProgrammeId = programme.Id,
            ProgrammeCode = programme.ProgrammeId,
            ProgrammeName = programme.ProgrammeName,
            ProgramTypeName = programme.ProgramType?.Name ?? string.Empty,
            Evaluation = scheme.ToDto(),
            Skills =
            [
                .. skills.Select(s => new MarksheetSkillDto
                {
                    Id = s.Id,
                    Name = s.Name,
                    Description = s.Description,
                    MaxMarks = s.MaxMarks,
                    DisplayOrder = s.DisplayOrder,
                    IsRetired = s.Status != RecordStatus.Active,
                }),
            ],
            Trainers =
            [
                .. trainers.Select(t => new MarksheetTrainerDto
                {
                    Id = t.Id,
                    FullName = t.FullName,
                    Organisation = t.Organisation,
                }),
            ],
            ReadOnlyReason = WhyReadOnly(programme),
        };

        dto.CanEdit = dto.ReadOnlyReason is null;

        foreach (var participant in participants.OrderBy(p => p.Applicant?.FullName))
        {
            var marks = participant.SkillMarks.ToDictionary(m => m.SkillId);
            var allMarked = activeSkillIds.Count > 0 && activeSkillIds.All(marks.ContainsKey);

            /* Live skills only, the same rule the save path totals by, so the
               figure on the sheet is the one the result was decided on. */
            var counted = marks.Values.Where(m => activeSkillIds.Contains(m.SkillId)).ToList();
            var viva = counted.Count > 0 ? counted.Sum(m => m.Marks) : (decimal?)null;

            var outcome = Marking.Decide(scheme, participant.WrittenMarks, viva, allMarked);

            dto.Rows.Add(new MarksheetRowDto
            {
                ParticipantId = participant.Id,
                Name = participant.Applicant?.FullName ?? string.Empty,
                ApplicationNo = participant.Application?.ApplicationNo ?? string.Empty,
                AttendancePercent = participant.AttendancePercent,
                WrittenMarks = participant.WrittenMarks,
                VivaMarks = participant.VivaMarks ?? viva,
                Total = participant.ExamScore ?? outcome.Total,
                Result = participant.Result.ToString(),
                ResultRecordedOn = participant.ResultRecordedOn,
                Pending = outcome.Pending,
                Shortfall = outcome.Shortfall,
                IsLocked = issued.Contains(participant.Id),
                WrittenFromExam = sittings.ContainsKey(participant.Id),
                ExamPercentage = sittings.GetValueOrDefault(participant.Id)?.Best,
                ExamAttempts = sittings.GetValueOrDefault(participant.Id)?.Attempts ?? 0,
                SkillMarks =
                [
                    .. participant.SkillMarks
                        .OrderBy(m => m.SkillId)
                        .Select(m => new MarksheetSkillMarkDto
                        {
                            SkillId = m.SkillId,
                            Marks = m.Marks,
                            TrainerId = m.TrainerId,
                            TrainerName = m.TrainerId is { } id
                                ? trainerNames.GetValueOrDefault(id)
                                : null,
                            MarkedOn = m.MarkedOn,
                        }),
                ],
            });
        }

        dto.MarkedCount = dto.Rows.Count(r => r.Result != nameof(ParticipantResult.Pending));
        dto.PassCount = dto.Rows.Count(r => r.Result == nameof(ParticipantResult.Pass));
        dto.FailCount = dto.Rows.Count(r => r.Result == nameof(ParticipantResult.Fail));
        return dto;
    }

    /* -------------------------------------------------------------- save */

    /// <summary>
    /// Records a pass of the sheet and returns it as it now stands.
    ///
    /// The whole pass is one transaction: a row that cannot be marked stops the
    /// lot, rather than leaving half a hall marked and the coordinator guessing
    /// which half.
    /// </summary>
    public async Task<MarksheetDto> SaveAsync(
        int programmeId, MarksheetSaveDto dto, CancellationToken ct)
    {
        var programme = await ForReadAsync(programmeId, ct);
        if (WhyReadOnly(programme) is { } refusal) throw AppException.Forbidden(refusal);

        var scheme = programme.ProgramType?.Evaluation ?? new EvaluationScheme();
        if (scheme.Kind == ExaminationKind.None)
        {
            throw new AppException(
                $"{programme.ProgramType?.Name} has no examination, so there is nothing to mark.");
        }

        if (dto.Rows.Count == 0) return await GetAsync(programmeId, ct);

        var ids = dto.Rows.Select(r => r.ParticipantId).Distinct().ToList();

        var participants = await db.ProgrammeParticipants
            .Include(p => p.SkillMarks)
            .Where(p => p.ProgrammeId == programmeId && ids.Contains(p.Id))
            .ToListAsync(ct);

        if (participants.Count != ids.Count)
            throw AppException.NotFound("One of the candidates on this sheet");

        var locked = await db.Certificates.AsNoTracking()
            .Where(c => c.ProgrammeId == programmeId && c.RevokedOn == null && ids.Contains(c.ParticipantId))
            .Select(c => c.ParticipantId)
            .ToListAsync(ct);

        var skills = await db.EvaluationSkills.AsNoTracking()
            .Where(s => s.ProgramTypeId == programme.ProgramTypeId)
            .ToListAsync(ct);

        var activeSkills = skills.Where(s => s.Status == RecordStatus.Active).ToList();
        var byId = skills.ToDictionary(s => s.Id);

        /* Whose written mark is the paper's, and so not open to typing. */
        var sat = await db.ExamAttempts.AsNoTracking()
            .Where(a => ids.Contains(a.ParticipantId) && a.Status != ExamAttemptStatus.InProgress)
            .Select(a => a.ParticipantId)
            .Distinct()
            .ToListAsync(ct);

        var trainerIds = await db.ProgrammeTrainers.AsNoTracking()
            .Where(t => t.ProgrammeId == programmeId)
            .Select(t => t.Id)
            .ToListAsync(ct);

        var now = DateTime.UtcNow;

        foreach (var row in dto.Rows)
        {
            var participant = participants.First(p => p.Id == row.ParticipantId);

            if (locked.Contains(participant.Id))
            {
                throw AppException.Conflict(
                    "A certificate has already been issued against this candidate's result. " +
                    "Revoke it before changing the marks.");
            }

            if (row.TrainerId is { } trainerId && !trainerIds.Contains(trainerId))
                throw AppException.NotFound("Trainer");

            if (row.WrittenMarks is { } written)
            {
                if (!scheme.HasWritten)
                    throw new AppException("This program type has no written paper.");

                if (sat.Contains(participant.Id))
                {
                    throw AppException.Conflict(
                        "This candidate's written mark comes from the paper they sat online " +
                        "and cannot be typed over.");
                }

                if (written < 0 || written > scheme.WrittenMarks)
                {
                    throw new AppException(
                        $"The written paper is marked out of {scheme.WrittenMarks}.");
                }
                participant.WrittenMarks = written;
            }

            foreach (var mark in row.SkillMarks)
            {
                if (!scheme.HasViva)
                    throw new AppException("This program type has no viva or practical.");

                if (!byId.TryGetValue(mark.SkillId, out var skill)
                    || skill.ProgramTypeId != programme.ProgramTypeId)
                {
                    throw AppException.NotFound("Skill");
                }

                var existing = participant.SkillMarks.FirstOrDefault(m => m.SkillId == mark.SkillId);

                if (mark.Clear)
                {
                    if (existing is not null)
                    {
                        /* Out of the collection as well as the table: the total
                           is worked out from what is loaded, and a row deleted
                           only in the change tracker would still be counted. */
                        participant.SkillMarks.Remove(existing);
                        db.Remove(existing);
                    }
                    continue;
                }

                if (skill.Status != RecordStatus.Active)
                {
                    throw new AppException(
                        $"'{skill.Name}' has been retired and can no longer be marked.");
                }

                if (mark.Marks < 0 || mark.Marks > skill.MaxMarks)
                    throw new AppException($"'{skill.Name}' is marked out of {skill.MaxMarks}.");

                if (existing is null)
                {
                    participant.SkillMarks.Add(new ParticipantSkillMark
                    {
                        ParticipantId = participant.Id,
                        SkillId = mark.SkillId,
                        Marks = mark.Marks,
                        TrainerId = row.TrainerId,
                        MarkedOn = now,
                    });
                }
                else
                {
                    existing.Marks = mark.Marks;
                    /* Only overwritten when the app said who marked it: a
                       correction from the portal must not blank the trainer
                       who gave the mark in the hall. */
                    existing.TrainerId = row.TrainerId ?? existing.TrainerId;
                    existing.MarkedOn = now;
                }
            }

            ResultRecorder.Recompute(participant, scheme, activeSkills, now);
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(programmeId, ct);
    }

}
