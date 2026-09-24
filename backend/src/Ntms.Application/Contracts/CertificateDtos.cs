namespace Ntms.Application.Contracts;

/// <summary>A certificate that has been issued.</summary>
public class CertificateDto
{
    public int Id { get; set; }
    public string Number { get; set; } = string.Empty;
    public string Kind { get; set; } = string.Empty;
    public string KindLabel { get; set; } = string.Empty;

    public int ParticipantId { get; set; }
    public int ProgrammeId { get; set; }
    public string RecipientName { get; set; } = string.Empty;
    public string ProgrammeName { get; set; } = string.Empty;
    public string ProgramTypeName { get; set; } = string.Empty;

    public DateOnly IssuedOn { get; set; }
    public DateOnly? ValidTill { get; set; }
    public string? IssuedBy { get; set; }

    public bool IsRevoked { get; set; }
    public DateTime? RevokedOn { get; set; }
    public string? RevokedReason { get; set; }

    /// <summary>Relative API path the printable document is fetched from.</summary>
    public string Url { get; set; } = string.Empty;
}

/// <summary>
/// One participant's standing: what they are owed, and whether it can be
/// issued yet.
/// </summary>
public class CertificateEligibilityDto
{
    public int ParticipantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Result { get; set; } = "Pending";

    /// <summary>The kind this participant earns, or null where nothing is awarded.</summary>
    public string? Kind { get; set; }
    public string? KindLabel { get; set; }

    public bool CanIssue { get; set; }
    /// <summary>Why not, when <see cref="CanIssue"/> is false and nothing is issued.</summary>
    public string? Blocker { get; set; }

    /// <summary>The certificate already issued to them, if there is one.</summary>
    public CertificateDto? Certificate { get; set; }
}

/// <summary>What a whole programme's certificates look like before issuing them.</summary>
public class ProgrammeCertificateSummaryDto
{
    public int ProgrammeId { get; set; }
    public string ProgrammeName { get; set; } = string.Empty;
    public string CertificationPolicy { get; set; } = string.Empty;
    public string CertificationPolicyLabel { get; set; } = string.Empty;

    /// <summary>Kinds awarded here that have no artwork uploaded yet.</summary>
    public List<string> MissingTemplates { get; set; } = [];

    public int Issued { get; set; }
    public int Pending { get; set; }
    public int NotEligible { get; set; }

    public List<CertificateEligibilityDto> Participants { get; set; } = [];
}

public class RevokeCertificateDto
{
    public string Reason { get; set; } = string.Empty;
}

/// <summary>The answer to "is this certificate real?", looked up by number.</summary>
public class CertificateVerificationDto
{
    public bool Found { get; set; }
    public string Number { get; set; } = string.Empty;
    public string? RecipientName { get; set; }
    public string? ProgramTypeName { get; set; }
    public string? KindLabel { get; set; }
    public DateOnly? IssuedOn { get; set; }
    public DateOnly? ValidTill { get; set; }
    public bool IsRevoked { get; set; }
    public bool IsExpired { get; set; }
    /// <summary>A plain sentence a counter clerk can read out.</summary>
    public string Status { get; set; } = string.Empty;
}
