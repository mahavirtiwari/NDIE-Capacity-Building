namespace Ntms.Application.Contracts;

/*
  Sitting the written paper online, from the applicant app.

  Nothing here ever carries which option is correct. The paper is served to the
  candidate through these contracts, and a field that said which answer was
  right would be readable by anyone who opened the response.
*/

/// <summary>Whether this candidate can sit the paper, and what they have done so far.</summary>
public class ExamAvailabilityDto
{
    public int ParticipantId { get; set; }
    public string ProgrammeName { get; set; } = string.Empty;

    /// <summary>False when there is no online paper for this batch at all.</summary>
    public bool HasPaper { get; set; }
    public string? PaperTitle { get; set; }
    public string? Instructions { get; set; }
    public int DurationMinutes { get; set; }
    public int QuestionCount { get; set; }
    public decimal TotalMarks { get; set; }
    public decimal PassPercentage { get; set; }
    public bool NegativeMarking { get; set; }

    /// <summary>When the paper opens. Null when no exam has been scheduled.</summary>
    public DateTime? OpensOn { get; set; }

    public int AttemptsUsed { get; set; }
    public int MaxAttempts { get; set; }

    public bool CanSit { get; set; }
    /// <summary>Why not, when they cannot sit it.</summary>
    public string? Blocker { get; set; }

    /// <summary>A sitting left open, which resuming continues rather than restarts.</summary>
    public int? InProgressAttemptId { get; set; }
    public DateTime? ExpiresOn { get; set; }

    /// <summary>The best sitting so far, which is the one that counts.</summary>
    public ExamResultDto? Best { get; set; }
}

/// <summary>The paper as the candidate sees it: questions, options, no answers.</summary>
public class ExamSittingDto
{
    public int AttemptId { get; set; }
    public int AttemptNo { get; set; }
    public string PaperTitle { get; set; } = string.Empty;
    public string? Instructions { get; set; }
    public decimal TotalMarks { get; set; }
    public bool NegativeMarking { get; set; }

    public DateTime StartedOn { get; set; }
    public DateTime ExpiresOn { get; set; }
    /// <summary>
    /// What is left, worked out on the server. The app counts down from this
    /// rather than from the device clock, which a candidate can change.
    /// </summary>
    public int SecondsRemaining { get; set; }

    public List<ExamSittingQuestionDto> Questions { get; set; } = [];
}

public class ExamSittingQuestionDto
{
    public int Id { get; set; }
    public int DisplayOrder { get; set; }
    public string Text { get; set; } = string.Empty;
    /// <summary>SingleChoice, MultipleChoice or TrueFalse.</summary>
    public string Type { get; set; } = "SingleChoice";
    public decimal Marks { get; set; }
    public decimal NegativeMarks { get; set; }
    public List<ExamSittingOptionDto> Options { get; set; } = [];

    /// <summary>What this candidate has chosen so far, so a resume looks unbroken.</summary>
    public List<int> SelectedOptionIds { get; set; } = [];
}

public class ExamSittingOptionDto
{
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty;
}

/// <summary>One question answered. Sent as they are given, not all at the end.</summary>
public class ExamAnswerSaveDto
{
    public int QuestionId { get; set; }
    /// <summary>Empty takes the answer back and leaves the question unanswered.</summary>
    public List<int> OptionIds { get; set; } = [];
}

public class ExamAnswerBatchDto
{
    public List<ExamAnswerSaveDto> Answers { get; set; } = [];
}

/// <summary>What one sitting came to.</summary>
public class ExamResultDto
{
    public int AttemptId { get; set; }
    public int AttemptNo { get; set; }
    public string Status { get; set; } = "Submitted";
    public DateTime? SubmittedOn { get; set; }

    public decimal Score { get; set; }
    public decimal PaperTotal { get; set; }
    public decimal Percentage { get; set; }
    /// <summary>Against the paper's own pass mark, which is what the candidate is told.</summary>
    public bool Passed { get; set; }

    public int Answered { get; set; }
    public int QuestionCount { get; set; }

    /// <summary>
    /// What this contributed to the programme marksheet, scaled to the marks
    /// the program type gives the written section.
    /// </summary>
    public decimal? WrittenMarks { get; set; }

    /// <summary>
    /// Where the candidate now stands on the programme: Pending until the viva
    /// is marked too, then Pass or Fail. Not the same question as
    /// <see cref="Passed"/>, which is about this paper alone.
    /// </summary>
    public string ProgrammeResult { get; set; } = "Pending";
}

/* ------------------------------------------------------------- reviewing */

/*
  Looking back at a sitting, from the portal.

  A candidate who disputes a mark is owed the paper they answered, not a
  number. These carry what was asked, what they chose and what it scored — and,
  for staff who may see the paper's content, which answer was the right one.
*/

/// <summary>One sitting, as it appears in a candidate's list of attempts.</summary>
public class ExamAttemptSummaryDto
{
    public int AttemptId { get; set; }
    public int AttemptNo { get; set; }
    /// <summary>Submitted, or Expired when the clock ran out first.</summary>
    public string Status { get; set; } = string.Empty;

    public DateTime StartedOn { get; set; }
    public DateTime? SubmittedOn { get; set; }
    /// <summary>How long they actually took, in minutes.</summary>
    public int? MinutesTaken { get; set; }

    public decimal Score { get; set; }
    public decimal PaperTotal { get; set; }
    public decimal Percentage { get; set; }
    public bool Passed { get; set; }

    public int Answered { get; set; }
    public int QuestionCount { get; set; }

    /// <summary>True for the sitting whose score became the written mark.</summary>
    public bool IsBest { get; set; }
}

/// <summary>One sitting in full: every question, and what the candidate did with it.</summary>
public class ExamAttemptReviewDto : ExamAttemptSummaryDto
{
    public int ParticipantId { get; set; }
    public string CandidateName { get; set; } = string.Empty;
    public string ApplicationNo { get; set; } = string.Empty;

    public string PaperCode { get; set; } = string.Empty;
    public string PaperTitle { get; set; } = string.Empty;
    public bool NegativeMarking { get; set; }

    /// <summary>
    /// Whether the right answers are included.
    ///
    /// The paper's content is a separate thing to be trusted with from a
    /// candidate's result: somebody investigating a dispute can always see what
    /// was chosen and what it scored, and only an account that may already read
    /// the paper is shown which option was correct.
    /// </summary>
    public bool ShowsAnswerKey { get; set; }

    public List<ExamAttemptQuestionDto> Questions { get; set; } = [];
}

public class ExamAttemptQuestionDto
{
    public int Id { get; set; }
    public int DisplayOrder { get; set; }
    public string Text { get; set; } = string.Empty;
    public string Type { get; set; } = "SingleChoice";

    public decimal Marks { get; set; }
    public decimal NegativeMarks { get; set; }

    /// <summary>What this question came to for this candidate, negative included.</summary>
    public decimal MarksAwarded { get; set; }
    public bool IsCorrect { get; set; }
    /// <summary>False for a question the candidate never answered.</summary>
    public bool Answered { get; set; }

    /// <summary>The author's note on the answer, where the paper carries one.</summary>
    public string? Explanation { get; set; }

    public List<ExamAttemptOptionDto> Options { get; set; } = [];
}

public class ExamAttemptOptionDto
{
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty;
    /// <summary>Whether the candidate chose it.</summary>
    public bool Chosen { get; set; }
    /// <summary>Null unless the answer key is being shown.</summary>
    public bool? IsCorrect { get; set; }
}
