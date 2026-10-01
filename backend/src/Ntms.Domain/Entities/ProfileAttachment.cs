using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// What an applicant attached to one field of their profile form — a file
/// they chose, or the pictures they took.
///
/// Separate from the answers, which are JSON, because neither is an answer
/// — they are evidence. The answer records what is here; the bytes live in
/// this table.
///
/// One table for both, because they are the same thing with different
/// rules about how many: a file field holds one row and keeps its name, a
/// camera field holds several in order and is served back merged into a
/// single PDF. Which it is comes from the field's type on the form, not
/// from anything stored here.
///
/// Held against the applicant and the field key rather than against a
/// submission: they are attached while the form is being filled in, before
/// there is a submission to hang them on, and a correction after a
/// rejection replaces them in place.
/// </summary>
public class ProfileAttachment : AuditableEntity
{
    public int ApplicantId { get; set; }
    public Applicant? Applicant { get; set; }

    /// <summary>
    /// Which discipline's profile this belongs to.
    ///
    /// Part of the key, because an applicant can hold a profile per
    /// category and two forms may name a field the same thing. Without it
    /// a certificate uploaded under one discipline would appear under the
    /// other.
    /// </summary>
    public int SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }

    /// <summary>The field on the form these belong to.</summary>
    public string FieldKey { get; set; } = string.Empty;

    /// <summary>Position in the set, from one. The order of the PDF's pages.</summary>
    public int DisplayOrder { get; set; }

    /// <summary>
    /// What the applicant called it, for a file they chose. Null for a
    /// picture, which was never a file on their device and whose name
    /// would be a camera's invention rather than anything they meant.
    /// </summary>
    public string? FileName { get; set; }

    public string ContentType { get; set; } = "image/jpeg";
    public byte[] Content { get; set; } = [];

    /// <summary>When it was taken, or when it was chosen.</summary>
    public DateTime CapturedOn { get; set; } = DateTime.UtcNow;
}
