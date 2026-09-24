using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// A certificate that has been issued to one participant.
///
/// The row is the record of the award, not a cache of it. The recipient's name
/// and the programme's are copied in at the moment of issue, because a
/// certificate states what was true on the day it was awarded — correcting a
/// spelling in an applicant's profile two years later must not silently rewrite
/// a document somebody is holding, and a verification check has to answer with
/// what was printed.
///
/// Nothing here is deleted. A certificate issued in error is revoked, which
/// leaves the number spent and the reason on the record.
/// </summary>
public class Certificate : AuditableEntity
{
    /// <summary>
    /// The certificate number, e.g. <c>ZED-MT-B/2026/00042</c>. Unique across
    /// the system and never reused, including by a revoked certificate.
    /// </summary>
    public string Number { get; set; } = string.Empty;

    public CertificateKind Kind { get; set; }

    public int ParticipantId { get; set; }
    public ProgrammeParticipant? Participant { get; set; }

    public int ProgrammeId { get; set; }
    public Programme? Programme { get; set; }

    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }

    /* Snapshots, taken at issue. See the note above. */
    public string RecipientName { get; set; } = string.Empty;
    public string ProgrammeName { get; set; } = string.Empty;
    public string ProgramTypeName { get; set; } = string.Empty;

    public DateOnly IssuedOn { get; set; }
    /// <summary>Null where the programme type sets no expiry.</summary>
    public DateOnly? ValidTill { get; set; }

    public int IssuedByUserId { get; set; }
    public PortalUser? IssuedBy { get; set; }

    public DateTime? RevokedOn { get; set; }
    public string? RevokedReason { get; set; }
    public int? RevokedByUserId { get; set; }

    public bool IsRevoked => RevokedOn is not null;
}
