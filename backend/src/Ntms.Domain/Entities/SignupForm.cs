using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// One field on the form an applicant fills in to create their account.
///
/// This is not the same thing as a <see cref="RegistrationForm"/>. That one is
/// per programme type and is answered when applying; this is the single form
/// that exists before an applicant has an account at all, so it has no owner
/// to hang off and there is exactly one of it.
///
/// Two kinds of field live here. A built-in field maps to a column on the
/// applicant record — the name the certificate is printed with, the email the
/// account is reached at — and the code that creates an account reads it by
/// <see cref="Key"/>. A custom field is a question somebody added, and its
/// answer is kept in <see cref="ApplicantAnswer"/>.
///
/// The distinction decides what may be done to a field. A custom field can be
/// added and removed freely. A built-in one can be relabelled, reordered and
/// in most cases switched off, but never deleted: the column stays either way,
/// and a key the sign-up code looks for must not vanish from under it.
/// </summary>
public class SignupField : AuditableStatusEntity
{
    /// <summary>
    /// The sub-category this field belongs to, or null for the default set.
    ///
    /// A scheme does not ask an assessor and a master trainer the same
    /// questions, so the form is per sub-category. Null is the set used by a
    /// sub-category that has not been given one of its own, which is every
    /// sub-category until somebody says otherwise — so the form that existed
    /// before this went on carrying on.
    /// </summary>
    public int? SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }

    /// <summary>
    /// What the answer is stored against. For a built-in field this matches
    /// the property on the applicant record, so it is fixed once created.
    /// </summary>
    public string Key { get; set; } = string.Empty;

    public string Label { get; set; } = string.Empty;
    public string? Placeholder { get; set; }
    public string? HelpText { get; set; }

    public FieldType Type { get; set; } = FieldType.Text;
    public bool Required { get; set; }
    public int DisplayOrder { get; set; }

    /// <summary>Backed by a column on the applicant, so it cannot be deleted.</summary>
    public bool IsBuiltIn { get; set; }

    /// <summary>
    /// An account cannot exist without it, so it cannot be switched off either
    /// — a name to address somebody by, an address to send the credentials to.
    /// Disabling one of these would produce accounts nobody can sign in to.
    /// </summary>
    public bool IsLocked { get; set; }

    public ICollection<SignupFieldOption> Options { get; set; } = [];
}

/// <summary>A choice on a Select, Radio or MultiSelect sign-up field.</summary>
public class SignupFieldOption : AuditableEntity
{
    public int FieldId { get; set; }
    public SignupField? Field { get; set; }

    public string Value { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
}

/// <summary>
/// An answer to a custom sign-up field.
///
/// A row per answer rather than a JSON blob on the applicant: these are asked
/// precisely so somebody can report on them later, and a column of JSON is
/// where that intention goes to die.
/// </summary>
public class ApplicantAnswer : AuditableEntity
{
    public int ApplicantId { get; set; }
    public Applicant? Applicant { get; set; }

    /// <summary>Matches <see cref="SignupField.Key"/> as it was at the time.</summary>
    public string Key { get; set; } = string.Empty;
    public string? Value { get; set; }
}
