using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// The written paper, sat online from the applicant app.
///
/// Three things are the server's alone and never the app's: which options are
/// correct, how much time is left, and what the answers scored. The app is sent
/// questions with no answer key, counts down from a figure the server worked
/// out, and is told the score once it submits.
///
/// Answers are marked as they arrive rather than all at the end, so a sitting
/// that expires — or a phone that dies in the last minute — still counts
/// everything the candidate had answered.
/// </summary>
public class ExamSittingService(NtmsDbContext db, ResultRecorder results)
{
    /* ------------------------------------------------------------ access */

    /// <summary>
    /// The enrolment, if it belongs to this applicant.
    ///
    /// Everything else takes the participant from here, so no route can be
    /// pointed at somebody else's paper by changing a number in the URL.
    /// </summary>
    private async Task<ProgrammeParticipant> MineAsync(
        int applicantId, int participantId, CancellationToken ct) =>
        await db.ProgrammeParticipants
            .Include(p => p.Programme)!.ThenInclude(p => p!.ProgramType)
            .FirstOrDefaultAsync(p => p.Id == participantId && p.ApplicantId == applicantId, ct)
        ?? throw AppException.NotFound("Enrolment");

    /// <summary>
    /// The paper this batch sits: the one chosen when the exam was scheduled,
    /// or the program type's single live paper when only one exists.
    ///
    /// Not guessed when there are several. Two live papers and no choice
    /// recorded is a question for whoever scheduled it, not something to settle
    /// by picking one.
    /// </summary>
    private async Task<(ExamPaper? Paper, string? Problem)> PaperForAsync(
        Programme programme, CancellationToken ct)
    {
        if (programme.ExamPaperId is { } chosen)
        {
            var paper = await LoadPaperAsync(chosen, ct);
            return paper is null ? (null, "The paper set for this batch is no longer available.")
                                 : (paper, null);
        }

        var live = await db.ExamPapers.AsNoTracking()
            .Where(e => e.ProgramTypeId == programme.ProgramTypeId && e.Status == RecordStatus.Active)
            .Select(e => e.Id)
            .ToListAsync(ct);

        return live.Count switch
        {
            0 => (null, null),
            1 => (await LoadPaperAsync(live[0], ct), null),
            _ => (null, "This program type has more than one live paper and the batch has not " +
                        "been told which to use."),
        };
    }

    private Task<ExamPaper?> LoadPaperAsync(int id, CancellationToken ct) =>
        db.ExamPapers.AsNoTracking()
            .Include(e => e.Questions).ThenInclude(q => q.Options)
            .FirstOrDefaultAsync(e => e.Id == id, ct);

    /* ------------------------------------------------------ availability */

    public async Task<ExamAvailabilityDto> AvailabilityAsync(
        int applicantId, int participantId, CancellationToken ct)
    {
        var participant = await MineAsync(applicantId, participantId, ct);
        var programme = participant.Programme!;
        var (paper, problem) = await PaperForAsync(programme, ct);

        var dto = new ExamAvailabilityDto
        {
            ParticipantId = participant.Id,
            ProgrammeName = programme.ProgrammeName,
            OpensOn = programme.ExamDateTime,
            HasPaper = paper is not null,
        };

        var attempts = await db.ExamAttempts.AsNoTracking()
            .Include(a => a.Answers)
            .Where(a => a.ParticipantId == participant.Id)
            .OrderBy(a => a.AttemptNo)
            .ToListAsync(ct);

        if (paper is null)
        {
            dto.Blocker = problem ?? "There is no online paper for this program.";
            return dto;
        }

        dto.PaperTitle = paper.Title;
        dto.Instructions = paper.Instructions;
        dto.DurationMinutes = paper.DurationMinutes;
        dto.QuestionCount = paper.Questions.Count;
        dto.TotalMarks = paper.Questions.Sum(q => q.Marks);
        dto.PassPercentage = paper.PassPercentage;
        dto.NegativeMarking = paper.NegativeMarking;
        dto.MaxAttempts = paper.MaxAttempts;
        dto.AttemptsUsed = attempts.Count;

        /* Expire anything whose time is up before reporting, so a candidate who
           closed the app mid-paper is not shown a sitting they cannot finish. */
        var open = attempts.FirstOrDefault(a => a.Status == ExamAttemptStatus.InProgress);
        if (open is not null && open.ExpiresOn <= DateTime.UtcNow)
        {
            await CloseAsync(open.Id, ExamAttemptStatus.Expired, ct);
            attempts = await db.ExamAttempts.AsNoTracking()
                .Include(a => a.Answers)
                .Where(a => a.ParticipantId == participant.Id)
                .OrderBy(a => a.AttemptNo)
                .ToListAsync(ct);
            open = null;
        }

        var best = attempts
            .Where(a => a.Status != ExamAttemptStatus.InProgress)
            .OrderByDescending(a => a.Score)
            .FirstOrDefault();

        if (best is not null)
        {
            dto.Best = ToResult(best, participant);
        }

        if (open is not null)
        {
            dto.InProgressAttemptId = open.Id;
            dto.ExpiresOn = open.ExpiresOn;
            dto.CanSit = true;
            return dto;
        }

        dto.Blocker = WhyNot(participant, programme, paper, attempts.Count);
        dto.CanSit = dto.Blocker is null;
        return dto;
    }

    /// <summary>
    /// Every reason a candidate cannot start a sitting, in the order they would
    /// be raised at an exam hall door.
    /// </summary>
    private static string? WhyNot(
        ProgrammeParticipant participant, Programme programme, ExamPaper paper, int used)
    {
        var scheme = programme.ProgramType?.Evaluation ?? new EvaluationScheme();

        if (!scheme.HasWritten)
        {
            return $"{programme.ProgramType?.Name} is not examined by a written paper.";
        }

        if (paper.Status != RecordStatus.Active) return "This paper is not in use.";
        if (paper.Questions.Count == 0) return "The paper has no questions in it yet.";

        /* A descriptive answer cannot be marked by a machine, so a paper with
           one is marked by hand on the marksheet rather than sat here. */
        if (paper.Questions.Any(q => q.Type == QuestionType.Descriptive))
        {
            return "This paper has written-answer questions and is marked by the examiner.";
        }

        if (programme.ExamDateTime is null) return "The exam has not been scheduled yet.";
        if (programme.ExamDateTime > DateTime.UtcNow)
        {
            return $"The paper opens on {IndianTime.Format(programme.ExamDateTime.Value)}.";
        }

        if (used >= paper.MaxAttempts)
        {
            return paper.MaxAttempts == 1
                ? "You have already sat this paper."
                : $"You have used all {paper.MaxAttempts} attempts.";
        }

        if (participant.CertificateNo is not null)
        {
            return "Your certificate has been issued, so the result cannot change.";
        }

        return null;
    }

    /* ---------------------------------------------------------- sitting */

    /// <summary>
    /// Opens a sitting and serves the paper.
    ///
    /// The clock starts here, not when the first question is rendered: the
    /// alternative is a candidate who opens the paper, reads it and starts the
    /// timer afterwards.
    /// </summary>
    public async Task<ExamSittingDto> StartAsync(
        int applicantId, int participantId, CancellationToken ct)
    {
        var participant = await MineAsync(applicantId, participantId, ct);
        var programme = participant.Programme!;
        var (paper, problem) = await PaperForAsync(programme, ct);

        if (paper is null)
        {
            throw new AppException(problem ?? "There is no online paper for this program.");
        }

        var attempts = await db.ExamAttempts
            .Where(a => a.ParticipantId == participant.Id)
            .ToListAsync(ct);

        var open = attempts.FirstOrDefault(a => a.Status == ExamAttemptStatus.InProgress);
        if (open is not null)
        {
            /* Resuming, not restarting. A second start would hand out a fresh
               clock on the same attempt. */
            if (open.ExpiresOn > DateTime.UtcNow) return await SittingAsync(open.Id, paper, ct);

            /* Closed, but still counted. It was a sitting: dropping it from the
               tally would hand out an extra attempt, and would give the next
               one the number this one already holds. */
            await CloseAsync(open.Id, ExamAttemptStatus.Expired, ct);
        }

        if (WhyNot(participant, programme, paper, attempts.Count) is { } refusal)
            throw new AppException(refusal);

        var now = DateTime.UtcNow;
        var attempt = new ExamAttempt
        {
            ParticipantId = participant.Id,
            ExamPaperId = paper.Id,
            AttemptNo = attempts.Count == 0 ? 1 : attempts.Max(a => a.AttemptNo) + 1,
            StartedOn = now,
            ExpiresOn = now.AddMinutes(paper.DurationMinutes),
            Status = ExamAttemptStatus.InProgress,
            PaperTotal = paper.Questions.Sum(q => q.Marks),
            QuestionCount = paper.Questions.Count,
        };

        db.ExamAttempts.Add(attempt);
        await db.SaveChangesAsync(ct);

        return await SittingAsync(attempt.Id, paper, ct);
    }

    /// <summary>The paper as it stands for one open sitting.</summary>
    public async Task<ExamSittingDto> ResumeAsync(
        int applicantId, int attemptId, CancellationToken ct)
    {
        var attempt = await OwnedAttemptAsync(applicantId, attemptId, ct);
        var paper = await LoadPaperAsync(attempt.ExamPaperId, ct)
                    ?? throw AppException.NotFound("Paper");
        return await SittingAsync(attempt.Id, paper, ct);
    }

    private async Task<ExamSittingDto> SittingAsync(
        int attemptId, ExamPaper paper, CancellationToken ct)
    {
        var attempt = await db.ExamAttempts.AsNoTracking()
            .Include(a => a.Answers)
            .FirstAsync(a => a.Id == attemptId, ct);

        var given = attempt.Answers.ToDictionary(a => a.QuestionId, a => Ids(a.SelectedOptionIds));

        /* Shuffled per sitting when the paper says so, seeded on the attempt so
           a resume shows the same order the candidate was working through. */
        var questions = paper.Questions.OrderBy(q => q.DisplayOrder).ThenBy(q => q.Id).ToList();
        if (paper.ShuffleQuestions) questions = Shuffle(questions, attempt.Id);

        var remaining = (int)Math.Max(0, (attempt.ExpiresOn - DateTime.UtcNow).TotalSeconds);

        return new ExamSittingDto
        {
            AttemptId = attempt.Id,
            AttemptNo = attempt.AttemptNo,
            PaperTitle = paper.Title,
            Instructions = paper.Instructions,
            TotalMarks = attempt.PaperTotal,
            NegativeMarking = paper.NegativeMarking,
            StartedOn = attempt.StartedOn,
            ExpiresOn = attempt.ExpiresOn,
            SecondsRemaining = remaining,
            Questions =
            [
                .. questions.Select((q, index) => new ExamSittingQuestionDto
                {
                    Id = q.Id,
                    DisplayOrder = index + 1,
                    Text = q.Text,
                    Type = q.Type.ToString(),
                    Marks = q.Marks,
                    NegativeMarks = paper.NegativeMarking ? q.NegativeMarks : 0,
                    Options =
                    [
                        /* Option order is the author's, never shuffled: "all of
                           the above" has to stay below the above. */
                        .. q.Options.OrderBy(o => o.DisplayOrder).ThenBy(o => o.Id)
                            .Select(o => new ExamSittingOptionDto { Id = o.Id, Text = o.Text }),
                    ],
                    SelectedOptionIds = given.GetValueOrDefault(q.Id, []),
                }),
            ],
        };
    }

    /* --------------------------------------------------------- answering */

    /// <summary>
    /// Records answers and marks them.
    ///
    /// Sent in batches as the candidate moves through the paper, so nothing is
    /// riding on the submit request getting through.
    /// </summary>
    public async Task<int> AnswerAsync(
        int applicantId, int attemptId, ExamAnswerBatchDto dto, CancellationToken ct)
    {
        var attempt = await OwnedAttemptAsync(applicantId, attemptId, ct);

        if (attempt.Status != ExamAttemptStatus.InProgress)
            throw AppException.Conflict("This sitting is already closed.");

        if (attempt.ExpiresOn <= DateTime.UtcNow)
        {
            /* Whatever arrives after the bell is not accepted, and the sitting
               is closed on what was answered before it. */
            await CloseAsync(attempt.Id, ExamAttemptStatus.Expired, ct);
            throw AppException.Conflict("Your time is up. The paper has been submitted as it was.");
        }

        var questionIds = dto.Answers.Select(a => a.QuestionId).Distinct().ToList();
        var questions = await db.ExamQuestions.AsNoTracking()
            .Include(q => q.Options)
            .Where(q => q.ExamPaperId == attempt.ExamPaperId && questionIds.Contains(q.Id))
            .ToListAsync(ct);

        var paper = await db.ExamPapers.AsNoTracking()
            .FirstAsync(e => e.Id == attempt.ExamPaperId, ct);

        var existing = await db.ExamAnswers
            .Where(a => a.AttemptId == attempt.Id)
            .ToListAsync(ct);

        foreach (var given in dto.Answers)
        {
            var question = questions.FirstOrDefault(q => q.Id == given.QuestionId)
                           ?? throw AppException.NotFound("Question");

            var row = existing.FirstOrDefault(a => a.QuestionId == question.Id);

            if (given.OptionIds.Count == 0)
            {
                /* Taken back rather than recorded as wrong: an unanswered
                   question costs nothing, and under negative marking the
                   difference is real. */
                if (row is not null) db.ExamAnswers.Remove(row);
                continue;
            }

            var chosen = given.OptionIds.Distinct().OrderBy(id => id).ToList();
            if (chosen.Any(id => question.Options.All(o => o.Id != id)))
                throw new AppException("That option is not on this question.");

            if (question.Type != QuestionType.MultipleChoice && chosen.Count > 1)
                throw new AppException("Only one answer may be chosen for this question.");

            var correct = question.Options.Where(o => o.IsCorrect).Select(o => o.Id)
                .OrderBy(id => id).ToList();

            /* All or nothing on a multiple-choice question: part marks for a
               partly right answer is a policy nobody has set. */
            var isCorrect = chosen.SequenceEqual(correct);
            var awarded = isCorrect
                ? question.Marks
                : paper.NegativeMarking ? -question.NegativeMarks : 0m;

            if (row is null)
            {
                db.ExamAnswers.Add(new ExamAnswer
                {
                    AttemptId = attempt.Id,
                    QuestionId = question.Id,
                    SelectedOptionIds = string.Join(',', chosen),
                    IsCorrect = isCorrect,
                    MarksAwarded = awarded,
                    AnsweredOn = DateTime.UtcNow,
                });
            }
            else
            {
                row.SelectedOptionIds = string.Join(',', chosen);
                row.IsCorrect = isCorrect;
                row.MarksAwarded = awarded;
                row.AnsweredOn = DateTime.UtcNow;
            }
        }

        await db.SaveChangesAsync(ct);
        return dto.Answers.Count;
    }

    /* -------------------------------------------------------- submitting */

    public async Task<ExamResultDto> SubmitAsync(
        int applicantId, int attemptId, CancellationToken ct)
    {
        var attempt = await OwnedAttemptAsync(applicantId, attemptId, ct);

        if (attempt.Status != ExamAttemptStatus.InProgress)
            throw AppException.Conflict("This sitting has already been submitted.");

        var status = attempt.ExpiresOn <= DateTime.UtcNow
            ? ExamAttemptStatus.Expired
            : ExamAttemptStatus.Submitted;

        return await CloseAsync(attempt.Id, status, ct);
    }

    /// <summary>
    /// Totals a sitting, writes the score, and carries the best one through to
    /// the marksheet.
    ///
    /// The paper's own pass percentage decides what the candidate is told about
    /// the paper. Whether they qualify for the programme is a different
    /// question, decided from the program type's scheme once the viva is marked
    /// too — so the written mark is handed over and
    /// <see cref="ResultRecorder"/> has the last word.
    /// </summary>
    private async Task<ExamResultDto> CloseAsync(
        int attemptId, ExamAttemptStatus status, CancellationToken ct)
    {
        var attempt = await db.ExamAttempts
            .Include(a => a.Answers)
            .FirstAsync(a => a.Id == attemptId, ct);

        var raw = attempt.Answers.Sum(a => a.MarksAwarded);

        /* Floored at zero: negative marking takes marks off a paper, it does
           not put a candidate in debt. */
        attempt.Score = Math.Max(0m, raw);
        attempt.Percentage = attempt.PaperTotal > 0
            ? Rounding.Half(attempt.Score / attempt.PaperTotal * 100m)
            : 0m;

        var paper = await db.ExamPapers.AsNoTracking()
            .Include(e => e.Questions)
            .FirstAsync(e => e.Id == attempt.ExamPaperId, ct);

        attempt.Passed = attempt.Percentage >= paper.PassPercentage;
        attempt.Status = status;
        attempt.SubmittedOn = DateTime.UtcNow;

        var participant = await db.ProgrammeParticipants
            .Include(p => p.SkillMarks)
            .FirstAsync(p => p.Id == attempt.ParticipantId, ct);

        /* A certificate issued while the paper was open settles the result. The
           sitting is still recorded — it happened — but it does not restate a
           mark somebody is already holding a certificate for. */
        var settled = await db.Certificates.AsNoTracking()
            .AnyAsync(c => c.ParticipantId == participant.Id && c.RevokedOn == null, ct);

        if (settled)
        {
            await db.SaveChangesAsync(ct);
            return ToResult(attempt, participant);
        }

        var scheme = await db.Programmes.AsNoTracking()
            .Where(p => p.Id == participant.ProgrammeId)
            .Select(p => p.ProgramType!.Evaluation)
            .FirstAsync(ct);

        /* The best sitting counts, which is why a retake can only help. A
           worse attempt leaves the recorded mark alone. */
        var best = await db.ExamAttempts.AsNoTracking()
            .Where(a => a.ParticipantId == participant.Id
                        && a.Status != ExamAttemptStatus.InProgress
                        && a.Id != attempt.Id)
            .OrderByDescending(a => a.Score)
            .FirstOrDefaultAsync(ct);

        var written = attempt.Score >= (best?.Score ?? -1m)
            ? Scale(attempt, scheme)
            : participant.WrittenMarks;

        participant.WrittenMarks = written;
        await db.SaveChangesAsync(ct);

        await results.RecomputeAsync(participant, ct);
        await db.SaveChangesAsync(ct);

        return ToResult(attempt, participant);
    }

    /// <summary>
    /// The paper's score in the marks the program type gives the written
    /// section — a 40 out of 50 paper is 56 of a 70-mark written section.
    ///
    /// Scaled rather than used as-is, because the paper and the scheme are set
    /// up by different people for different reasons and neither should have to
    /// know the other's totals.
    /// </summary>
    private static decimal? Scale(ExamAttempt attempt, EvaluationScheme scheme)
    {
        if (!scheme.HasWritten || attempt.PaperTotal <= 0) return null;
        return Rounding.Half(attempt.Score / attempt.PaperTotal * scheme.WrittenMarks);
    }

    private static ExamResultDto ToResult(
        ExamAttempt attempt, ProgrammeParticipant participant) => new()
    {
        AttemptId = attempt.Id,
        AttemptNo = attempt.AttemptNo,
        Status = attempt.Status.ToString(),
        SubmittedOn = attempt.SubmittedOn,
        Score = attempt.Score,
        PaperTotal = attempt.PaperTotal,
        Percentage = attempt.Percentage,
        Passed = attempt.Passed,
        Answered = attempt.Answers.Count,
        QuestionCount = attempt.QuestionCount,
        WrittenMarks = participant.WrittenMarks,
        ProgrammeResult = participant.Result.ToString(),
    };

    private async Task<ExamAttempt> OwnedAttemptAsync(
        int applicantId, int attemptId, CancellationToken ct) =>
        await db.ExamAttempts
            .FirstOrDefaultAsync(a => a.Id == attemptId
                                      && a.Participant!.ApplicantId == applicantId, ct)
        ?? throw AppException.NotFound("Sitting");

    private static List<int> Ids(string value) =>
        string.IsNullOrWhiteSpace(value)
            ? []
            : [.. value.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse)];

    /// <summary>
    /// A fixed shuffle, seeded on the attempt.
    ///
    /// Deterministic on purpose: the order has to survive a resume, and storing
    /// it would be a column that only repeats what the attempt id already says.
    /// </summary>
    private static List<ExamQuestion> Shuffle(List<ExamQuestion> questions, int seed)
    {
        var random = new Random(seed);
        return [.. questions.OrderBy(_ => random.Next())];
    }
}
