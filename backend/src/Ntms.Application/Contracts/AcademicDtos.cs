namespace Ntms.Application.Contracts;

/* ------------------------------------------------------------- curriculum */

public class CurriculumTopicDto
{
    public int Id { get; set; }
    public string TopicCode { get; set; } = string.Empty;
    public string TopicName { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public int? DurationMinutes { get; set; }
    public string? LearningOutcome { get; set; }
    /// <summary>A disabled topic stays on the plan but is not delivered.</summary>
    public string Status { get; set; } = "Active";
}

public class CurriculumSessionDto
{
    public int Id { get; set; }
    public string SessionCode { get; set; } = string.Empty;
    public string SessionName { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public int? Day { get; set; }
    /// <summary>A disabled session stays on the plan but is not delivered.</summary>
    public string Status { get; set; } = "Active";
    public List<CurriculumTopicDto> Topics { get; set; } = [];
}

public class CurriculumDto : AuditDto
{
    public int Id { get; set; }
    public int ProgramTypeId { get; set; }
    /// <summary>Code of the programme type; what session codes are built from.</summary>
    public string? ProgramTypeCode { get; set; }
    public string? ProgramTypeName { get; set; }
    public int? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public int? SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }
    public string? Objective { get; set; }
    public int DurationDays { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public string Status { get; set; } = "Active";
    public List<CurriculumSessionDto> Sessions { get; set; } = [];
}

public class CurriculumUpsertDto
{
    /// <summary>Required: the programme type this curriculum is written for.</summary>
    public int ProgramTypeId { get; set; }
    public string? Objective { get; set; }
    public int DurationDays { get; set; } = 5;
    public DateOnly EffectiveFrom { get; set; }
    public string Status { get; set; } = "Active";
    /// <summary>Omit to leave the existing session plan untouched.</summary>
    public List<CurriculumSessionDto>? Sessions { get; set; }
}

/* ------------------------------------------------------ profile form */

public class FieldValidationDto
{
    public bool Required { get; set; }
    public int? MinLength { get; set; }
    public int? MaxLength { get; set; }
    public decimal? Min { get; set; }
    public decimal? Max { get; set; }
    public string? Pattern { get; set; }
    public List<string>? AllowedExtensions { get; set; }
    public int? MaxFileSizeMb { get; set; }

    /// <summary>How many pictures a Photos field accepts.</summary>
    public int? MaxPhotos { get; set; }
}

public class FieldOptionDto
{
    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}

public class ProfileFieldDto
{
    public int Id { get; set; }

    /// <summary>
    /// The shared list this field takes its choices from, if any. The
    /// designer shows it; everyone else can ignore it, because Options is
    /// already filled in from the list when there is one.
    /// </summary>
    public int? OptionSetId { get; set; }
    public string? OptionSetName { get; set; }

    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Type { get; set; } = "text";
    public bool IsEnabled { get; set; } = true;
    public string? Placeholder { get; set; }
    public string? HelpText { get; set; }
    public int DisplayOrder { get; set; }
    public int ColSpan { get; set; } = 1;

    /// <summary>
    /// None, Qualification or ExperienceYears. What a program type's
    /// minimum is measured against.
    /// </summary>
    public string EligibilityRole { get; set; } = "None";
    public List<FieldOptionDto> Options { get; set; } = [];
    public FieldValidationDto Validation { get; set; } = new();
    public string? VisibleWhenFieldKey { get; set; }
    public List<string>? VisibleWhenValues { get; set; }
}

public class ProfileSectionDto
{
    public int Id { get; set; }

    /// <summary>
    /// Derived from the title by the server on save. Sent back so the designer
    /// can show what a repeating section's answers will be stored under.
    /// </summary>
    public string Key { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public bool IsEnabled { get; set; } = true;

    /// <summary>The applicant can fill this section more than once.</summary>
    public bool IsRepeatable { get; set; }
    public int MinEntries { get; set; } = 1;
    public int MaxEntries { get; set; } = 10;

    /// <summary>What one entry is called. Falls back to the section title.</summary>
    public string? ItemLabel { get; set; }

    public List<ProfileFieldDto> Fields { get; set; } = [];
}

public class ProfileFormDto : AuditDto
{
    public int Id { get; set; }
    public int SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }
    public int? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public string Version { get; set; } = "v1.0";

    /// <summary>False and a submission is accepted as it arrives.</summary>
    public bool RequiresScrutiny { get; set; } = true;
    public string Status { get; set; } = "Active";
    public List<ProfileSectionDto> Sections { get; set; } = [];
}

public class ProfileFormUpsertDto
{
    public int SubCategoryId { get; set; }
    public string Version { get; set; } = "v1.0";
    public bool RequiresScrutiny { get; set; } = true;
    public string Status { get; set; } = "Active";
    public List<ProfileSectionDto> Sections { get; set; } = [];
}

/// <summary>Copies a finished form onto another sub-category.</summary>
public class ReplicateFormDto
{
    public int SourceFormId { get; set; }
    public int TargetSubCategoryId { get; set; }
    public string Version { get; set; } = "v1.0";
}

/* -------------------------------------------------------------------- fee */

public class FeeComponentDto
{
    public int Id { get; set; }
    public string Kind { get; set; } = "Base";
    public string Label { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public bool IsTaxable { get; set; } = true;
}

public class FeeConcessionDto
{
    public int Id { get; set; }
    public string Label { get; set; } = string.Empty;
    public decimal Percentage { get; set; }
    public string? Remarks { get; set; }
}

public class FeeTotalsDto
{
    public decimal Taxable { get; set; }
    public decimal NonTaxable { get; set; }
    public decimal Gst { get; set; }
    public decimal Gross { get; set; }
}

public class FeeStructureDto : AuditDto
{
    public int Id { get; set; }
    public int ProgramTypeId { get; set; }
    public string? ProgramTypeName { get; set; }
    public int? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public int? SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Currency { get; set; } = "INR";
    public decimal GstPercent { get; set; }
    /// <summary>TDS rates the applicant may opt for, e.g. [2, 10].</summary>
    public List<int> TdsOptions { get; set; } = [];
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string Status { get; set; } = "Active";
    public List<FeeComponentDto> Components { get; set; } = [];
    public List<FeeConcessionDto> Concessions { get; set; } = [];
    public FeeTotalsDto Totals { get; set; } = new();
}

public class FeeStructureUpsertDto
{
    public int ProgramTypeId { get; set; }
    public string Title { get; set; } = string.Empty;
    public decimal GstPercent { get; set; } = 18m;
    public List<int> TdsOptions { get; set; } = [];
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string Status { get; set; } = "Active";
    public List<FeeComponentDto> Components { get; set; } = [];
    public List<FeeConcessionDto> Concessions { get; set; } = [];
}

/* ------------------------------------------------------------ exam papers */

public class ExamQuestionOptionDto
{
    public int Id { get; set; }
    public string Text { get; set; } = string.Empty;
    public bool IsCorrect { get; set; }
}

public class ExamQuestionDto
{
    public int Id { get; set; }
    public int DisplayOrder { get; set; }
    public string Text { get; set; } = string.Empty;
    public string Type { get; set; } = "SingleChoice";
    public string Difficulty { get; set; } = "Moderate";
    public decimal Marks { get; set; }
    public decimal NegativeMarks { get; set; }
    public string? ModuleRef { get; set; }
    public string? Explanation { get; set; }
    public List<ExamQuestionOptionDto> Options { get; set; } = [];
}

public class ExamPaperDto : AuditDto
{
    public int Id { get; set; }
    public int ProgramTypeId { get; set; }
    public string? ProgramTypeName { get; set; }
    public int? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public int? SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Instructions { get; set; }
    public int DurationMinutes { get; set; }
    public decimal PassPercentage { get; set; }
    public int MaxAttempts { get; set; }
    public bool ShuffleQuestions { get; set; }
    public bool NegativeMarking { get; set; }
    public string Status { get; set; } = "Active";
    public decimal TotalMarks { get; set; }
    public List<ExamQuestionDto> Questions { get; set; } = [];
}

public class ExamPaperUpsertDto
{
    public int ProgramTypeId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Instructions { get; set; }
    public int DurationMinutes { get; set; } = 60;
    public decimal PassPercentage { get; set; } = 60m;
    public int MaxAttempts { get; set; } = 3;
    public bool ShuffleQuestions { get; set; } = true;
    public bool NegativeMarking { get; set; }
    public string Status { get; set; } = "Active";
    public List<ExamQuestionDto> Questions { get; set; } = [];
}

/* ------------------------------------------------------ training material */

public class TrainingMaterialDto : AuditDto
{
    public int Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Kind { get; set; } = "Document";
    public int CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public int SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }
    public int ProgramTypeId { get; set; }
    public string? ProgramTypeName { get; set; }
    public int? CurriculumSessionId { get; set; }
    public string? FileName { get; set; }
    public long? FileSizeKb { get; set; }
    public string? MimeType { get; set; }
    public string? Url { get; set; }
    public int? DurationMinutes { get; set; }
    public string Language { get; set; } = "English";
    public List<string> VisibleToRoles { get; set; } = [];
    public string Version { get; set; } = "v1.0";
    public DateOnly PublishedOn { get; set; }
    public bool DownloadAllowed { get; set; }
    public string Status { get; set; } = "Active";
}

public class TrainingMaterialUpsertDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Kind { get; set; } = "Document";
    public int CategoryId { get; set; }
    public int SubCategoryId { get; set; }
    public int ProgramTypeId { get; set; }
    public int? CurriculumSessionId { get; set; }
    public string? FileName { get; set; }
    public long? FileSizeKb { get; set; }
    public string? MimeType { get; set; }
    public string? Url { get; set; }
    public int? DurationMinutes { get; set; }
    public string Language { get; set; } = "English";
    public List<string> VisibleToRoles { get; set; } = [];
    public string Version { get; set; } = "v1.0";
    public DateOnly PublishedOn { get; set; }
    public bool DownloadAllowed { get; set; } = true;
    public string Status { get; set; } = "Active";
}

/* ------------------------------------------------- the account sign-up form */

public class SignupFieldOptionDto
{
    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
}

public class SignupFieldDto
{
    public int Id { get; set; }
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? Placeholder { get; set; }
    public string? HelpText { get; set; }
    public string Type { get; set; } = "Text";
    public bool Required { get; set; }
    public int DisplayOrder { get; set; }

    /// <summary>Backed by a column on the applicant: editable, never removable.</summary>
    public bool IsBuiltIn { get; set; }

    /// <summary>Cannot be switched off; an account would not work without it.</summary>
    public bool IsLocked { get; set; }

    public string Status { get; set; } = "Active";
    public List<SignupFieldOptionDto> Options { get; set; } = [];
}

public class SignupFieldUpsertDto
{
    /// <summary>Ignored on update: the key is what answers are stored against.</summary>
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? Placeholder { get; set; }
    public string? HelpText { get; set; }
    public string Type { get; set; } = "Text";
    public bool Required { get; set; }
    public int DisplayOrder { get; set; }
    public string Status { get; set; } = "Active";
    public List<SignupFieldOptionDto>? Options { get; set; }
}

public class ReorderDto
{
    public List<int> Ids { get; set; } = [];
}

/// <summary>The sign-up form: the questions everybody answers, in order.</summary>
public class SignupFormDto
{
    public List<SignupFieldDto> Fields { get; set; } = [];
}

/// <summary>
/// What an upload becomes: enough for the publish form to fill itself in,
/// and nothing about where on disk it really sits beyond the relative path
/// the row stores.
/// </summary>
public class MaterialFileDto
{
    public string Url { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSizeKb { get; set; }
    public string MimeType { get; set; } = string.Empty;

    /// <summary>True when a browser will show it rather than download it.</summary>
    public bool CanPreview { get; set; }
}

/// <summary>
/// A short-lived address for one file, for handing to a viewer that cannot
/// carry a token.
/// </summary>
public class MaterialTicketDto
{
    public string Url { get; set; } = string.Empty;
    public int ExpiresInSeconds { get; set; }
}
