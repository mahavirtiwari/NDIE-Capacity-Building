using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// The applicant registration form for one program type. Super Admin designs it
/// field by field; a finished form can be replicated onto another track.
/// </summary>
public class RegistrationForm : AuditableStatusEntity
{
    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }

    public string Version { get; set; } = "v1.0";

    public ICollection<RegistrationSection> Sections { get; set; } = [];
}

public class RegistrationSection : AuditableEntity
{
    public int FormId { get; set; }
    public RegistrationForm? Form { get; set; }

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

    public ICollection<RegistrationField> Fields { get; set; } = [];
}

public class RegistrationField : AuditableEntity
{
    public int SectionId { get; set; }
    public RegistrationSection? Section { get; set; }

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

    public FieldValidation Validation { get; set; } = new();

    /// <summary>Show this field only when another answer matches.</summary>
    public string? VisibleWhenFieldKey { get; set; }
    /// <summary>Comma separated list of values that reveal the field.</summary>
    public string? VisibleWhenValues { get; set; }

    public ICollection<RegistrationFieldOption> Options { get; set; } = [];
}

/// <summary>Owned value object persisted into the field row.</summary>
public class FieldValidation
{
    public bool Required { get; set; }
    public int? MinLength { get; set; }
    public int? MaxLength { get; set; }
    public decimal? Min { get; set; }
    public decimal? Max { get; set; }
    public string? Pattern { get; set; }
    /// <summary>Comma separated extensions for file fields.</summary>
    public string? AllowedExtensions { get; set; }
    public int? MaxFileSizeMb { get; set; }
}

public class RegistrationFieldOption : AuditableEntity
{
    public int FieldId { get; set; }
    public RegistrationField? Field { get; set; }

    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}
