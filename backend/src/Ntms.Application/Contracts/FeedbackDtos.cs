using Ntms.Application.Common;

namespace Ntms.Application.Contracts;

/* --------------------------------------------------------- the form */

public class FeedbackFormDto : AuditDto
{
    public int Id { get; set; }
    public int ProgramTypeId { get; set; }
    public string? ProgramTypeName { get; set; }
    public string? ProgramTypeCode { get; set; }
    public string Title { get; set; } = "Your feedback";
    public string? Intro { get; set; }
    public string Status { get; set; } = "Active";

    /// <summary>How many sets of answers have come back, in total.</summary>
    public int ResponseCount { get; set; }

    public List<FeedbackQuestionDto> Questions { get; set; } = [];
}

public class FeedbackQuestionDto
{
    public int Id { get; set; }

    /// <summary>
    /// What the answer is stored against. Fixed once the form has been
    /// answered, so rewording a question keeps the answers it already has.
    /// </summary>
    public string Key { get; set; } = string.Empty;

    public string Text { get; set; } = string.Empty;
    public string? HelpText { get; set; }

    /// <summary>Rating, Text, Select, Radio or YesNo.</summary>
    public string Type { get; set; } = "Rating";

    public bool Required { get; set; } = true;
    public int DisplayOrder { get; set; }
    public int MaxRating { get; set; } = 5;

    /// <summary>A shared choice list, if the question reads one.</summary>
    public int? OptionSetId { get; set; }
    public string? OptionSetName { get; set; }

    /// <summary>
    /// What to offer, whether it came from the question or from a shared
    /// list. Filled in by the server either way.
    /// </summary>
    public List<FieldOptionDto> Options { get; set; } = [];
}

public class FeedbackFormUpsertDto
{
    public int ProgramTypeId { get; set; }
    public string Title { get; set; } = "Your feedback";
    public string? Intro { get; set; }
    public string Status { get; set; } = "Active";
    public List<FeedbackQuestionDto> Questions { get; set; } = [];
}

/* ------------------------------------------------------- the applicant */

/// <summary>
/// A batch that is over and is waiting on this participant's feedback.
/// </summary>
public class FeedbackInvitationDto
{
    public int ParticipantId { get; set; }
    public int ProgrammeId { get; set; }
    public string ProgrammeName { get; set; } = string.Empty;
    public string ProgrammeCode { get; set; } = string.Empty;
    public string ProgramTypeName { get; set; } = string.Empty;
    public DateOnly EndedOn { get; set; }

    /// <summary>True once they have given it. The answers are not theirs to see again.</summary>
    public bool Given { get; set; }
    public DateTime? GivenOn { get; set; }
}

public class FeedbackSubmitDto
{
    public Dictionary<string, object?> Answers { get; set; } = [];
}

/* -------------------------------------------------------- the reporting */

/// <summary>
/// What a programme type's feedback adds up to. Counts and averages only:
/// there is nothing here to attribute, because the answers were never
/// stored against anybody.
/// </summary>
public class FeedbackSummaryDto
{
    public int ProgramTypeId { get; set; }
    public string? ProgramTypeName { get; set; }
    public int ResponseCount { get; set; }
    public List<FeedbackQuestionSummaryDto> Questions { get; set; } = [];
}

public class FeedbackQuestionSummaryDto
{
    public string Key { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public string Type { get; set; } = "Rating";

    /// <summary>For a rating: the mean, and how many answered it.</summary>
    public decimal? Average { get; set; }
    public int Answered { get; set; }

    /// <summary>For a choice or yes/no: how many picked each.</summary>
    public List<FeedbackTallyDto> Tally { get; set; } = [];

    /// <summary>
    /// For free text: what people wrote, in no particular order and with
    /// nothing attached. Shuffled so the order cannot be lined up against
    /// the order people submitted in.
    /// </summary>
    public List<string> Comments { get; set; } = [];
}

public class FeedbackTallyDto
{
    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int Count { get; set; }
}
