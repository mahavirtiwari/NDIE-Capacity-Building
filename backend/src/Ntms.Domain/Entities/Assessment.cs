using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>Certification question paper for one program type.</summary>
public class ExamPaper : AuditableStatusEntity
{
    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }

    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Instructions { get; set; }
    public int DurationMinutes { get; set; } = 60;
    public decimal PassPercentage { get; set; } = 60m;
    public int MaxAttempts { get; set; } = 3;
    public bool ShuffleQuestions { get; set; } = true;
    public bool NegativeMarking { get; set; }

    public ICollection<ExamQuestion> Questions { get; set; } = [];
}

public class ExamQuestion : AuditableEntity
{
    public int ExamPaperId { get; set; }
    public ExamPaper? ExamPaper { get; set; }

    public int DisplayOrder { get; set; }
    public string Text { get; set; } = string.Empty;
    public QuestionType Type { get; set; } = QuestionType.SingleChoice;
    public DifficultyLevel Difficulty { get; set; } = DifficultyLevel.Moderate;
    public decimal Marks { get; set; } = 2m;
    public decimal NegativeMarks { get; set; }
    public string? ModuleRef { get; set; }
    public string? Explanation { get; set; }

    public ICollection<ExamQuestionOption> Options { get; set; } = [];
}

public class ExamQuestionOption : AuditableEntity
{
    public int QuestionId { get; set; }
    public ExamQuestion? Question { get; set; }

    public string Text { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>
/// One candidate's sitting of an online paper.
///
/// The attempt is opened before a single question is shown, so the clock is the
/// server's and an app that is closed, crashed or put in a pocket does not give
/// anybody longer than the paper allows.
///
/// What the paper was out of is copied onto the attempt. A paper that gains a
/// question next month must not restate a mark somebody was already given.
/// </summary>
public class ExamAttempt : AuditableEntity
{
    public int ParticipantId { get; set; }
    public ProgrammeParticipant? Participant { get; set; }

    public int ExamPaperId { get; set; }
    public ExamPaper? ExamPaper { get; set; }

    /// <summary>1 for the first sitting, counted against the paper's limit.</summary>
    public int AttemptNo { get; set; }

    public DateTime StartedOn { get; set; } = DateTime.UtcNow;
    /// <summary>Started plus the paper's duration. The clock nobody can argue with.</summary>
    public DateTime ExpiresOn { get; set; }
    public DateTime? SubmittedOn { get; set; }

    public ExamAttemptStatus Status { get; set; } = ExamAttemptStatus.InProgress;

    /// <summary>Marks scored, after negative marking if the paper uses it.</summary>
    public decimal Score { get; set; }
    /// <summary>What the paper was out of when it was sat.</summary>
    public decimal PaperTotal { get; set; }
    public decimal Percentage { get; set; }

    /// <summary>
    /// Against the paper's own pass percentage, which is what the candidate is
    /// told. Whether they qualify for the programme is a separate question,
    /// decided by the program type's scheme on the marksheet.
    /// </summary>
    public bool Passed { get; set; }

    public ICollection<ExamAnswer> Answers { get; set; } = [];
}

/// <summary>
/// One answer, marked as it is given.
///
/// Scored on save rather than all at once at the end, so a sitting that expires
/// or a phone that dies still has everything answered up to that point marked.
/// </summary>
public class ExamAnswer
{
    public int Id { get; set; }

    public int AttemptId { get; set; }
    public ExamAttempt? Attempt { get; set; }

    public int QuestionId { get; set; }
    public ExamQuestion? Question { get; set; }

    /// <summary>
    /// The options chosen, as ids separated by commas.
    ///
    /// One column for one and for many: a multiple-choice question is marked
    /// all-or-nothing on the whole set, so the set is the answer, and a table
    /// of one row per tick would only have to be reassembled to mark it.
    /// </summary>
    public string SelectedOptionIds { get; set; } = string.Empty;

    public bool IsCorrect { get; set; }
    public decimal MarksAwarded { get; set; }
    public DateTime AnsweredOn { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// File, video or link published against a program type. Visibility is role
/// scoped, so a coordinator and an applicant can see different material.
/// </summary>
public class TrainingMaterial : AuditableStatusEntity
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public MaterialKind Kind { get; set; } = MaterialKind.Document;

    public int CategoryId { get; set; }
    public Category? Category { get; set; }
    public int SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }
    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }

    public int? CurriculumSessionId { get; set; }
    public CurriculumSession? CurriculumSession { get; set; }

    public string? FileName { get; set; }
    public long? FileSizeKb { get; set; }
    public string? MimeType { get; set; }
    /// <summary>Relative storage path, or the external URL for a link.</summary>
    public string? Url { get; set; }
    public int? DurationMinutes { get; set; }
    public string Language { get; set; } = "English";

    /// <summary>Comma separated <see cref="BaseRole"/> names allowed to open it.</summary>
    public string VisibleToRoles { get; set; } = string.Empty;

    public string Version { get; set; } = "v1.0";
    public DateOnly PublishedOn { get; set; }
    public bool DownloadAllowed { get; set; } = true;
}
