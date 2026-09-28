using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Looking back at what a candidate answered.
///
/// A mark from an online paper is only as accountable as the paper behind it,
/// so a candidate who disputes one has to be answerable with the sitting
/// itself: what was asked, what they chose, and what each question scored.
///
/// The answer key is a separate matter. Which option was correct belongs to the
/// paper rather than to the result, so it is included only for an account that
/// may already read papers — everyone who may see the programme can still see
/// what was chosen and what it came to.
///
/// Read only, throughout. Nothing here can change a mark: a wrong key is fixed
/// on the paper and the sitting is retaken, not edited after the fact.
///
/// The questions come from the paper rather than from the answers, which is
/// only sound because a paper that has been sat can no longer have its
/// questions changed — ExamPaperService refuses. Were that relaxed, this would
/// start showing a candidate questions they were never asked.
/// </summary>
public class ExamReviewService(NtmsDbContext db, ICurrentUser currentUser)
{
    /// <summary>
    /// The programme, if this account may read it — the same rule as the
    /// marksheet, because this is the evidence behind one of its columns.
    /// </summary>
    private async Task<Programme> ForReadAsync(int programmeId, CancellationToken ct)
    {
        var programme = await db.Programmes.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == programmeId, ct)
            ?? throw AppException.NotFound("Programme");

        if (programme.CoordinatorId == currentUser.UserId) return programme;

        if (currentUser.HasPermission(Permissions.ProgramsView))
        {
            var visible = await db.Programmes.AsNoTracking()
                .WithinScope(currentUser)
                .AnyAsync(p => p.Id == programmeId, ct);
            if (visible) return programme;
        }

        throw AppException.Forbidden("This programme is not assigned to you.");
    }

    /// <summary>Every sitting one candidate has had, newest attempt last.</summary>
    public async Task<List<ExamAttemptSummaryDto>> ListAsync(
        int programmeId, int participantId, CancellationToken ct)
    {
        await ForReadAsync(programmeId, ct);

        var attempts = await db.ExamAttempts.AsNoTracking()
            .Include(a => a.Answers)
            .Include(a => a.ExamPaper)!.ThenInclude(p => p!.Questions)
            .Where(a => a.ParticipantId == participantId
                        && a.Participant!.ProgrammeId == programmeId
                        && a.Status != ExamAttemptStatus.InProgress)
            .OrderBy(a => a.AttemptNo)
            .ToListAsync(ct);

        /* Which one carried: the same rule the score was recorded under, so the
           sheet and this list cannot point at different sittings. */
        var best = attempts.OrderByDescending(a => a.Score).FirstOrDefault();

        return [.. attempts.Select(a => Summarise(a, a.Id == best?.Id))];
    }

    /// <summary>One sitting in full.</summary>
    public async Task<ExamAttemptReviewDto> GetAsync(
        int programmeId, int attemptId, CancellationToken ct)
    {
        await ForReadAsync(programmeId, ct);

        var attempt = await db.ExamAttempts.AsNoTracking()
            .Include(a => a.Answers)
            .Include(a => a.Participant)!.ThenInclude(p => p!.Applicant)
            .Include(a => a.Participant)!.ThenInclude(p => p!.Application)
            .Include(a => a.ExamPaper)!.ThenInclude(p => p!.Questions)
                .ThenInclude(q => q.Options)
            .FirstOrDefaultAsync(a => a.Id == attemptId
                                      && a.Participant!.ProgrammeId == programmeId, ct)
            ?? throw AppException.NotFound("Sitting");

        var paper = attempt.ExamPaper!;
        var answers = attempt.Answers.ToDictionary(a => a.QuestionId);

        var best = await db.ExamAttempts.AsNoTracking()
            .Where(a => a.ParticipantId == attempt.ParticipantId
                        && a.Status != ExamAttemptStatus.InProgress)
            .OrderByDescending(a => a.Score)
            .Select(a => a.Id)
            .FirstOrDefaultAsync(ct);

        var showsKey = currentUser.HasPermission(Permissions.ExamsView);

        var dto = new ExamAttemptReviewDto
        {
            ParticipantId = attempt.ParticipantId,
            CandidateName = attempt.Participant?.Applicant?.FullName ?? string.Empty,
            ApplicationNo = attempt.Participant?.Application?.ApplicationNo ?? string.Empty,
            PaperCode = paper.Code,
            PaperTitle = paper.Title,
            NegativeMarking = paper.NegativeMarking,
            ShowsAnswerKey = showsKey,
        };

        Fill(dto, attempt, attempt.Id == best);

        /* The author's order, not the shuffled one the candidate saw. A reader
           comparing two candidates' sittings needs them to line up, and which
           order one of them was shown is not what is in dispute. */
        var questions = paper.Questions.OrderBy(q => q.DisplayOrder).ThenBy(q => q.Id).ToList();

        foreach (var (question, index) in questions.Select((q, i) => (q, i)))
        {
            var answer = answers.GetValueOrDefault(question.Id);
            var chosen = answer is null ? [] : Ids(answer.SelectedOptionIds);

            dto.Questions.Add(new ExamAttemptQuestionDto
            {
                Id = question.Id,
                DisplayOrder = index + 1,
                Text = question.Text,
                Type = question.Type.ToString(),
                Marks = question.Marks,
                NegativeMarks = paper.NegativeMarking ? question.NegativeMarks : 0,
                MarksAwarded = answer?.MarksAwarded ?? 0m,
                IsCorrect = answer?.IsCorrect ?? false,
                Answered = answer is not null,
                Explanation = showsKey ? question.Explanation : null,
                Options =
                [
                    .. question.Options.OrderBy(o => o.DisplayOrder).ThenBy(o => o.Id)
                        .Select(o => new ExamAttemptOptionDto
                        {
                            Id = o.Id,
                            Text = o.Text,
                            Chosen = chosen.Contains(o.Id),
                            IsCorrect = showsKey ? o.IsCorrect : null,
                        }),
                ],
            });
        }

        return dto;
    }

    private static ExamAttemptSummaryDto Summarise(ExamAttempt attempt, bool isBest)
    {
        var dto = new ExamAttemptSummaryDto();
        Fill(dto, attempt, isBest);
        return dto;
    }

    private static void Fill(ExamAttemptSummaryDto dto, ExamAttempt attempt, bool isBest)
    {
        dto.AttemptId = attempt.Id;
        dto.AttemptNo = attempt.AttemptNo;
        dto.Status = attempt.Status.ToString();
        dto.StartedOn = attempt.StartedOn;
        dto.SubmittedOn = attempt.SubmittedOn;
        dto.MinutesTaken = attempt.SubmittedOn is { } done
            ? (int)Math.Round((done - attempt.StartedOn).TotalMinutes)
            : null;
        dto.Score = attempt.Score;
        dto.PaperTotal = attempt.PaperTotal;
        dto.Percentage = attempt.Percentage;
        dto.Passed = attempt.Passed;
        dto.Answered = attempt.Answers.Count;

        /* The paper as it was sat. Reading the count off the paper reports
           what it holds today, and "answered 18 of 20" against a paper that
           has since grown to 25 is a discrepancy nobody can explain.

           Sittings taken before this was recorded have a zero, so the paper is
           the only answer left for them — right for all but a paper edited in
           between, which can no longer happen. */
        dto.QuestionCount = attempt.QuestionCount > 0
            ? attempt.QuestionCount
            : attempt.ExamPaper?.Questions.Count ?? 0;
        dto.IsBest = isBest;
    }

    private static List<int> Ids(string value) =>
        string.IsNullOrWhiteSpace(value)
            ? []
            : [.. value.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse)];
}
