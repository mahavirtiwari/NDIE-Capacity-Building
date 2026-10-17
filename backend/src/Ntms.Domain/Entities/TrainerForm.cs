using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// One field on the form a coordinator fills in to register a trainer.
///
/// The faculty form used to live in the coordinator app as markup: the
/// questions it asked were whatever that screen had been built with, and
/// changing them meant changing the app and asking every coordinator in
/// the field to update it. The questions belong to the scheme rather than
/// to a build of an app, so they are set up here and the app renders what
/// it is given.
///
/// One form, not one per programme type. A trainer is registered once and
/// reused across every batch their agency runs — the faculty list the app
/// offers is agency-wide — so a form that changed with the batch would be
/// asking the same person different questions depending on which one they
/// were being added to.
///
/// Two kinds of field, as on the sign-up form. A built-in field maps to a
/// column on <see cref="ProgrammeTrainer"/> and the registration code reads
/// it by <see cref="Key"/>; a custom field is a question somebody added,
/// and its answer is kept in <see cref="TrainerAnswer"/>.
///
/// That decides what may be done to a field. A custom one can be added and
/// removed freely. A built-in one can be relabelled, reordered and usually
/// switched off, but never deleted: the column stays either way, and a key
/// the app looks for must not vanish from under it.
/// </summary>
public class TrainerField : AuditableStatusEntity
{
    /// <summary>
    /// What the answer is stored against. For a built-in field this matches
    /// the property on the trainer record, so it is fixed once created.
    /// </summary>
    public string Key { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;
    public string? Placeholder { get; set; }
    public string? HelpText { get; set; }

    public FieldType Type { get; set; } = FieldType.Text;
    public bool Required { get; set; }
    public int DisplayOrder { get; set; }

    /// <summary>Backed by a column on the trainer, so it cannot be deleted.</summary>
    public bool IsBuiltIn { get; set; }

    /// <summary>
    /// A trainer record cannot exist without it, so it cannot be switched
    /// off either. The name is who the faculty list is read by, and the
    /// mobile number is what the same trainer is recognised by across the
    /// agency's batches — without it every programme would register the
    /// same person again as somebody new.
    /// </summary>
    public bool IsLocked { get; set; }

    public ICollection<TrainerFieldOption> Options { get; set; } = [];
}

/// <summary>A choice on a Select, Radio or MultiSelect trainer field.</summary>
public class TrainerFieldOption : AuditableEntity
{
    public int FieldId { get; set; }
    public TrainerField? Field { get; set; }

    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}

/// <summary>
/// An answer to a custom trainer field.
///
/// A row per answer rather than a JSON blob on the trainer: these are asked
/// precisely so somebody can report on the faculty later, and a column of
/// JSON is where that intention goes to die.
/// </summary>
public class TrainerAnswer : AuditableEntity
{
    public int TrainerId { get; set; }
    public ProgrammeTrainer? Trainer { get; set; }

    /// <summary>Matches <see cref="TrainerField.Key"/> as it was at the time.</summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>
    /// The question as it was worded when it was answered.
    ///
    /// Copied rather than looked up, because a field can be relabelled or
    /// removed afterwards and an answer whose question has gone is no
    /// longer evidence of anything.
    /// </summary>
    public string Label { get; set; } = string.Empty;

    public string? Value { get; set; }
}
