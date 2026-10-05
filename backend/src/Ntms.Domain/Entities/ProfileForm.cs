using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// The applicant profile form for one program type. Super Admin designs it
/// field by field; a finished form can be replicated onto another track.
/// </summary>
public class ProfileForm : AuditableStatusEntity
{
    /// <summary>
    /// The sub-category this form belongs to.
    ///
    /// It used to hang off the program type, which meant an applicant filled
    /// the same declarations again for every track they went near. What the
    /// form asks — who you are, what you have done, what you can prove — is a
    /// property of the discipline, not of one course inside it, so it is
    /// asked once per sub-category and answered once.
    /// </summary>
    public int SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }

    public string Version { get; set; } = "v1.0";

    /// <summary>
    /// Whether what is declared on this form is read before the programs
    /// open.
    ///
    /// On, a submission joins the scrutiny queue and the discipline stays
    /// shut until somebody accepts it. Off, it is accepted as it arrives
    /// and the applicant goes straight on to apply — for a discipline that
    /// asks only for things nobody needs to verify, a queue of submissions
    /// to rubber-stamp helps no one.
    ///
    /// Everything else holds either way: the form is still filled in, the
    /// answers are still kept, and the attempt limit still applies to a
    /// form that is scrutinised and rejected.
    /// </summary>
    public bool RequiresScrutiny { get; set; } = true;

    public ICollection<ProfileSection> Sections { get; set; } = [];
}

public class ProfileSection : AuditableEntity
{
    public int FormId { get; set; }
    public ProfileForm? Form { get; set; }

    /// <summary>
    /// Stable key the section is stored against, and only meaningful when it
    /// repeats: a repeating section's answers are an array of objects under
    /// this key, where a plain section's answers sit at the top level keyed by
    /// the field. Derived from the title when the form is saved, and left
    /// alone afterwards so a retitled section keeps its answers.
    /// </summary>
    public string Key { get; set; } = string.Empty;

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    /// <summary>A disabled section is neither rendered nor validated.</summary>
    public bool IsEnabled { get; set; } = true;

    /// <summary>
    /// The applicant may fill this section more than once — a qualification,
    /// an employer, a previous certification. Off by default, which is every
    /// section that existed before this was added.
    /// </summary>
    public bool IsRepeatable { get; set; }

    /// <summary>How many entries the applicant must fill. Repeating sections only.</summary>
    public int MinEntries { get; set; } = 1;

    /// <summary>The ceiling, so a form cannot be grown without limit.</summary>
    public int MaxEntries { get; set; } = 10;

    /// <summary>
    /// What one entry is called, for the heading on each and the wording of
    /// the button that adds another: "Qualification 2", "Add qualification".
    /// Falls back to the section title.
    /// </summary>
    public string? ItemLabel { get; set; }

    public ICollection<ProfileField> Fields { get; set; } = [];
}

public class ProfileField : AuditableEntity
{
    public int SectionId { get; set; }
    public ProfileSection? Section { get; set; }

    /// <summary>Stable key the applicant's answer is stored against.</summary>
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public FieldType Type { get; set; } = FieldType.Text;
    public bool IsEnabled { get; set; } = true;
    public string? Placeholder { get; set; }
    public string? HelpText { get; set; }
    public int DisplayOrder { get; set; }
    /// <summary>1 = half width, 2 = full width.</summary>
    public int ColSpan { get; set; } = 1;

    /// <summary>
    /// What this answer means to the rest of the system, if anything.
    ///
    /// Left at None the field is just a question. Pointed at a
    /// qualification or a number of years, it becomes what a program type's
    /// minimum is measured against — so the eligibility check reads a field
    /// somebody nominated rather than one it guessed.
    /// </summary>
    public ProfileFieldRole EligibilityRole { get; set; } = ProfileFieldRole.None;

    public FieldValidation Validation { get; set; } = new();

    /// <summary>Show this field only when another answer matches.</summary>
    public string? VisibleWhenFieldKey { get; set; }
    /// <summary>Comma separated list of values that reveal the field.</summary>
    public string? VisibleWhenValues { get; set; }

    /// <summary>
    /// A shared list this field takes its choices from, instead of holding
    /// its own.
    ///
    /// Null and the field owns its options, which is right for a question
    /// asked in one place. Set and <see cref="Options"/> is ignored: the
    /// list is resolved when the form is served, so an app or a portal
    /// reading the form sees ordinary options and needs to know nothing
    /// about where they came from.
    /// </summary>
    public int? OptionSetId { get; set; }
    public OptionSet? OptionSet { get; set; }

    public ICollection<ProfileFieldOption> Options { get; set; } = [];
}

/// <summary>Owned value object persisted into the field row.</summary>
public class FieldValidation
{
    public bool Required { get; set; }
    public int? MinLength { get; set; }
    public int? MaxLength { get; set; }
    public decimal? Min { get; set; }
    public decimal? Max { get; set; }

    /// <summary>
    /// The window a date has to fall in.
    ///
    /// A date field had the number bounds, which do not apply to it, and a
    /// regex, which is no way to say "not in the future". These are what a
    /// date actually needs: a birth date that cannot be tomorrow, a
    /// certificate that cannot have expired before the course.
    /// </summary>
    public DateOnly? MinDate { get; set; }
    public DateOnly? MaxDate { get; set; }
    public string? Pattern { get; set; }
    /// <summary>Comma separated extensions for file fields.</summary>
    public string? AllowedExtensions { get; set; }
    public int? MaxFileSizeMb { get; set; }

    /// <summary>
    /// How many pictures a Photos field accepts. Null falls back to a
    /// sensible few rather than to no limit: an unbounded set is a way to
    /// fill a database by accident.
    /// </summary>
    public int? MaxPhotos { get; set; }
}

public class ProfileFieldOption : AuditableEntity
{
    public int FieldId { get; set; }
    public ProfileField? Field { get; set; }

    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}
