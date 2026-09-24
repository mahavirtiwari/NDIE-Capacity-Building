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

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    /// <summary>A disabled section is neither rendered nor validated.</summary>
    public bool IsEnabled { get; set; } = true;

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
