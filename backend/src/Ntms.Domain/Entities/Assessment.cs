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
