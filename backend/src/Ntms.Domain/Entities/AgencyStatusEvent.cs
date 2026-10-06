using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// One time an agency was empanelled back in or suspended, and why.
///
/// The same shape as <see cref="UserStatusEvent"/> and for the same reason:
/// the question is never "is it off" — the register already answers that —
/// but who switched it, when, and on what grounds. Suspending an agency
/// stops every batch it would raise, so the grounds matter more here than
/// almost anywhere.
///
/// Until this existed the status simply changed and nothing was written, so
/// the agency's own history sheet could not show that it had happened at
/// all.
///
/// Nothing here is edited or removed. A reason recorded in error is
/// corrected by recording the correction.
/// </summary>
public class AgencyStatusEvent
{
    public int Id { get; set; }

    public int AgencyId { get; set; }
    public ImplementingAgency? Agency { get; set; }

    public RecordStatus FromStatus { get; set; }
    public RecordStatus ToStatus { get; set; }

    /// <summary>Required in both directions. Letting one back in is a decision too.</summary>
    public string Reason { get; set; } = string.Empty;

    public int? ByUserId { get; set; }
    public string ByUserName { get; set; } = string.Empty;
    public string ByUserCode { get; set; } = string.Empty;

    public DateTime On { get; set; } = DateTime.UtcNow;
}
