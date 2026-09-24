using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>Top level grouping, e.g. "ZED Certification".</summary>
public class Category : AuditableStatusEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }

    public ICollection<SubCategory> SubCategories { get; set; } = [];
}

/// <summary>Maturity level or stream under a category, e.g. "Bronze".</summary>
public class SubCategory : AuditableStatusEntity
{
    public int CategoryId { get; set; }
    public Category? Category { get; set; }

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }

    public ICollection<ProgramType> ProgramTypes { get; set; } = [];
}

/// <summary>
/// The applicant facing track — Master Trainer, Assessor, Consultant. Drives the
/// registration form, fee, curriculum and exam paper.
/// </summary>
public class ProgramType : AuditableStatusEntity
{
    public int CategoryId { get; set; }
    public Category? Category { get; set; }

    public int SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ShortDescription { get; set; }
    public int DurationDays { get; set; }
    public DeliveryMode DeliveryMode { get; set; } = DeliveryMode.Physical;
    public string? MinQualification { get; set; }
    public int MinExperienceYears { get; set; }
    public int CertificateValidityMonths { get; set; } = 36;
    public bool IsExamMandatory { get; set; } = true;
    public bool IsFeeApplicable { get; set; } = true;

    /// <summary>
    /// What this programme awards. Defaults to the behaviour the system had
    /// before the setting existed: certify whoever qualifies, and give nothing
    /// to anyone else.
    /// </summary>
    public CertificationPolicy CertificationPolicy { get; set; } =
        CertificationPolicy.QualificationOnly;

    public ICollection<CertificateTemplate> CertificateTemplates { get; set; } = [];
}

/// <summary>
/// The artwork a certificate is produced from, uploaded per programme type and
/// per kind of certificate.
///
/// The file sits on disk with its metadata here, the same way monitoring
/// photographs do: templates are large, few are read at once, and none of them
/// is ever queried by content.
/// </summary>
public class CertificateTemplate : AuditableEntity
{
    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }

    public CertificateKind Kind { get; set; }

    /// <summary>Path under the template storage root, using forward slashes.</summary>
    public string RelativePath { get; set; } = string.Empty;
    /// <summary>The name the file was uploaded under, shown back to the reader.</summary>
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
}

/// <summary>Empanelled body that conducts programmes on the ground.</summary>
public class ImplementingAgency : AuditableStatusEntity
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public AgencyType AgencyType { get; set; } = AgencyType.GovernmentBody;

    public string ContactPerson { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string? Gstin { get; set; }
    public string? Pan { get; set; }

    public string AddressLine1 { get; set; } = string.Empty;
    public string? AddressLine2 { get; set; }
    public string City { get; set; } = string.Empty;
    /// <summary>LGD state code.</summary>
    public int StateCode { get; set; }
    public LgdState? State { get; set; }
    /// <summary>LGD district code.</summary>
    public int? DistrictCode { get; set; }
    public LgdDistrict? District { get; set; }
    public string Pincode { get; set; } = string.Empty;

    public DateOnly EmpanelledOn { get; set; }
    public DateOnly? EmpanelmentValidTill { get; set; }

    public ICollection<AgencyCategory> Categories { get; set; } = [];
    public ICollection<AgencySubCategory> SubCategories { get; set; } = [];
    public ICollection<AgencyProgramType> ProgramTypes { get; set; } = [];

    /// <summary>
    /// The states the agency is empanelled to operate in, allocated by the
    /// Operation Manager. Distinct from <see cref="StateCode"/>, which is the
    /// registered office.
    /// </summary>
    public ICollection<AgencyState> States { get; set; } = [];
}

public class AgencyState
{
    public int AgencyId { get; set; }
    public ImplementingAgency? Agency { get; set; }
    /// <summary>LGD state code.</summary>
    public int StateCode { get; set; }
    public LgdState? State { get; set; }
}

public class AgencyCategory
{
    public int AgencyId { get; set; }
    public ImplementingAgency? Agency { get; set; }
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
}

public class AgencySubCategory
{
    public int AgencyId { get; set; }
    public ImplementingAgency? Agency { get; set; }
    public int SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }
}

public class AgencyProgramType
{
    public int AgencyId { get; set; }
    public ImplementingAgency? Agency { get; set; }
    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }
}
