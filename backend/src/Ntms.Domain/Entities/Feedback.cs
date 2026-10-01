using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// What a programme type asks its participants once the batch is over.
///
/// One form per programme type: the questions worth asking about a
/// five-day assessor course are the same whichever batch of it somebody
/// sat, and a form per batch would make the answers impossible to compare
/// across the year.
/// </summary>
public class FeedbackForm : AuditableStatusEntity
{
    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }

    public string Title { get; set; } = "Your feedback";

    /// <summary>A line or two above the questions, if it helps.</summary>
    public string? Intro { get; set; }

    public ICollection<FeedbackQuestion> Questions { get; set; } = [];
}

/// <summary>One question on a feedback form.</summary>
public class FeedbackQuestion : AuditableEntity
{
    public int FormId { get; set; }
    public FeedbackForm? Form { get; set; }

    /// <summary>
    /// Stable key the answer is stored against, so a question reworded
    /// later does not orphan what people have already said.
    /// </summary>
    public string Key { get; set; } = string.Empty;

    public string Text { get; set; } = string.Empty;
    public string? HelpText { get; set; }

    public FeedbackQuestionType Type { get; set; } = FeedbackQuestionType.Rating;

    public bool Required { get; set; } = true;
    public int DisplayOrder { get; set; }

    /// <summary>
    /// Top of the scale for a rating. Five unless somebody says otherwise;
    /// a scale that changes between questions is a scale nobody can add up.
    /// </summary>
    public int MaxRating { get; set; } = 5;

    /// <summary>
    /// A shared choice list for a question that offers choices, so the
    /// same list the profile forms use can be reused here.
    /// </summary>
    public int? OptionSetId { get; set; }
    public OptionSet? OptionSet { get; set; }

    public ICollection<FeedbackQuestionOption> Options { get; set; } = [];
}

/// <summary>A choice on a feedback question that holds its own.</summary>
public class FeedbackQuestionOption : AuditableEntity
{
    public int QuestionId { get; set; }
    public FeedbackQuestion? Question { get; set; }

    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}

/// <summary>
/// One set of answers. Deliberately not attributable to anybody.
///
/// Feedback is reported anonymously, and the only way to mean that is to
/// have nothing to attribute it to: this row carries the batch and the
/// programme type it is about, and no applicant, no participant, no
/// account that wrote it. Joining it back to a person is not something an
/// administrator is prevented from doing — it is something the data does
/// not support.
///
/// That somebody has given feedback is recorded separately, on
/// <see cref="FeedbackReceipt"/>, which is what stops a second submission
/// and marks the task done in the app. The two cannot be matched up: one
/// row per participant and one row per response, written in the same
/// transaction and never linked.
/// </summary>
public class FeedbackResponse
{
    /* Not an AuditableEntity, and that is the whole point of the class.
       Those bring CreatedBy, which the context fills with the signed-in
       person's name on every write - which would have put the author's
       name on an anonymous answer. There is no author column here to
       fill. */
    public int Id { get; set; }

    public int ProgrammeId { get; set; }
    public Programme? Programme { get; set; }

    /// <summary>
    /// Written down as well as the batch, because a report groups by what
    /// was asked and the batch could in principle be deleted.
    /// </summary>
    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }

    /// <summary>The form version the answers were given against.</summary>
    public int? FeedbackFormId { get; set; }

    /// <summary>Answers as JSON, keyed by question key.</summary>
    public string Answers { get; set; } = "{}";

    /// <summary>
    /// The day, not the moment.
    ///
    /// A receipt is written at the same instant as the answers it belongs
    /// to, so an exact timestamp on both would let the two be matched up
    /// by time and the anonymity undone by anybody who could read the
    /// tables. The day is all a report needs.
    /// </summary>
    public DateOnly SubmittedOn { get; set; } = DateOnly.FromDateTime(DateTime.UtcNow);
}

/// <summary>
/// That one participant has given their feedback, and when.
///
/// The counterpart to <see cref="FeedbackResponse"/>: this says who has
/// finished, that says what was said, and nothing connects the two. Both
/// are needed — without this a participant could be asked forever or
/// submit twice; with a link between them the anonymity would be a
/// promise rather than a fact.
/// </summary>
public class FeedbackReceipt : AuditableEntity
{
    public int ParticipantId { get; set; }
    public ProgrammeParticipant? Participant { get; set; }

    public DateTime SubmittedOn { get; set; } = DateTime.UtcNow;
}
