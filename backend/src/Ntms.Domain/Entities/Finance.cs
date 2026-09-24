using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// Effective dated fee for one program type. The structure declares which TDS
/// rates an applicant may opt for; the TAN itself is collected from the
/// applicant on the registration form and never stored here.
/// </summary>
public class FeeStructure : AuditableStatusEntity
{
    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }

    public string Title { get; set; } = string.Empty;
    public string Currency { get; set; } = "INR";
    public decimal GstPercent { get; set; } = 18m;

    /// <summary>Comma separated TDS rates offered, e.g. "2,10". Empty when none.</summary>
    public string TdsOptions { get; set; } = string.Empty;

    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }

    public ICollection<FeeComponent> Components { get; set; } = [];
    public ICollection<FeeConcession> Concessions { get; set; } = [];
}

public class FeeComponent : AuditableEntity
{
    public int FeeStructureId { get; set; }
    public FeeStructure? FeeStructure { get; set; }

    public FeeComponentKind Kind { get; set; } = FeeComponentKind.Base;
    public string Label { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public bool IsTaxable { get; set; } = true;
}

public class FeeConcession : AuditableEntity
{
    public int FeeStructureId { get; set; }
    public FeeStructure? FeeStructure { get; set; }

    public string Label { get; set; } = string.Empty;
    public decimal Percentage { get; set; }
    public string? Remarks { get; set; }
}
