using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// A picture an applicant took for one field of their profile form.
///
/// Separate from the answers, which are JSON, because a photograph is not
/// an answer — it is evidence. The answer records how many were taken; the
/// pictures live here, in order, and are served back as a single PDF so
/// whoever reads the profile opens one document rather than five images.
///
/// Held against the applicant and the field key rather than against a
/// submission: they are taken while the form is being filled in, before
/// there is a submission to hang them on, and a correction after a
/// rejection replaces them in place.
/// </summary>
public class ProfilePhoto : AuditableEntity
{
    public int ApplicantId { get; set; }
    public Applicant? Applicant { get; set; }

    /// <summary>The field on the form these belong to.</summary>
    public string FieldKey { get; set; } = string.Empty;

    /// <summary>Position in the set, from one. The order of the PDF's pages.</summary>
    public int DisplayOrder { get; set; }

    public string ContentType { get; set; } = "image/jpeg";
    public byte[] Content { get; set; } = [];

    public DateTime CapturedOn { get; set; } = DateTime.UtcNow;
}
