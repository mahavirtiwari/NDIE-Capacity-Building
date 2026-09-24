namespace Ntms.Domain.Entities;

/// <summary>
/// State / UT from the Local Government Directory (LGD), Ministry of Panchayati
/// Raj. The primary key is the LGD state code itself so the values stored here
/// line up with every other government system.
/// </summary>
public class LgdState
{
    /// <summary>LGD state code — the primary key, not an identity column.</summary>
    public int Code { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsUnionTerritory { get; set; }

    public ICollection<LgdDistrict> Districts { get; set; } = [];
}

/// <summary>District from the LGD master, keyed by its LGD district code.</summary>
public class LgdDistrict
{
    /// <summary>LGD district code — the primary key.</summary>
    public int Code { get; set; }
    public int StateCode { get; set; }
    public LgdState? State { get; set; }
    public string Name { get; set; } = string.Empty;
}
