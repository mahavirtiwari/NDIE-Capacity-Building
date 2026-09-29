using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// One time an account was switched on or off, and why.
///
/// Kept as its own row rather than as a column on the account, because the
/// question is never "is it off" — the account already answers that — but
/// "who turned it off, when, and on what grounds". A column holds the latest
/// answer and loses every earlier one, which is exactly the part somebody
/// asks about months later.
///
/// Nothing here is edited or removed. A reason recorded in error is corrected
/// by recording the correction, the same way the scrutiny trail works.
/// </summary>
public class UserStatusEvent
{
    public int Id { get; set; }

    public int UserId { get; set; }
    public PortalUser? User { get; set; }

    public RecordStatus FromStatus { get; set; }
    public RecordStatus ToStatus { get; set; }

    /// <summary>Required. An account switched off without one cannot be explained.</summary>
    public string Reason { get; set; } = string.Empty;

    /* Who did it, captured as it was: the account may later be renamed or
       removed, and the record of who acted must survive either. */
    public int? ByUserId { get; set; }
    public string ByUserName { get; set; } = string.Empty;
    public string ByUserCode { get; set; } = string.Empty;

    public DateTime On { get; set; } = DateTime.UtcNow;
}
