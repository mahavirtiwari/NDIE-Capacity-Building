namespace Ntms.Application.Contracts;

public abstract class AuditDto
{
    public string? CreatedBy { get; set; }
    public DateTime CreatedOn { get; set; }
    public string? ModifiedBy { get; set; }
    public DateTime? ModifiedOn { get; set; }
}

/* ---------------------------------------------------------------- category */

public class CategoryDto : AuditDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public string Status { get; set; } = "Active";
    public int SubCategoryCount { get; set; }
}

public class CategoryUpsertDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public string Status { get; set; } = "Active";
}

/* ------------------------------------------------------------ subcategory */

public class SubCategoryDto : AuditDto
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public string Status { get; set; } = "Active";
}

public class SubCategoryUpsertDto
{
    public int CategoryId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int DisplayOrder { get; set; }
    public string Status { get; set; } = "Active";
}

/* ----------------------------------------------------------- program type */

public class ProgramTypeDto : AuditDto
{
    public int Id { get; set; }
    public int CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public int SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ShortDescription { get; set; }
    public int DurationDays { get; set; }
    public string DeliveryMode { get; set; } = "Physical";
    /// <summary>Stored code from the qualification catalogue.</summary>
    public string? MinQualification { get; set; }
    /// <summary>Display text for that code, so clients need no lookup.</summary>
    public string? MinQualificationLabel { get; set; }
    public int MinExperienceYears { get; set; }
    public int CertificateValidityMonths { get; set; }
    public bool IsExamMandatory { get; set; }
    public bool IsFeeApplicable { get; set; }

    /// <summary>None, ParticipationOnly, QualificationOnly or QualificationAndParticipation.</summary>
    public string CertificationPolicy { get; set; } = "QualificationOnly";
    /// <summary>Reader-facing wording for that policy.</summary>
    public string? CertificationPolicyLabel { get; set; }
    /// <summary>The kinds this policy awards, so a client knows which templates to ask for.</summary>
    public List<string> CertificateKinds { get; set; } = [];
    public List<CertificateTemplateDto> CertificateTemplates { get; set; } = [];

    public string Status { get; set; } = "Active";
}

public class CertificateTemplateDto
{
    public int Id { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public DateTime? UploadedOn { get; set; }
    public string? UploadedBy { get; set; }
    /// <summary>Relative API path the file is fetched from.</summary>
    public string Url { get; set; } = string.Empty;
}

public class ProgramTypeUpsertDto
{
    public int CategoryId { get; set; }
    public int SubCategoryId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ShortDescription { get; set; }
    public int DurationDays { get; set; } = 5;
    public string DeliveryMode { get; set; } = "Physical";
    public string? MinQualification { get; set; }
    public int MinExperienceYears { get; set; }
    public int CertificateValidityMonths { get; set; } = 36;
    public bool IsExamMandatory { get; set; } = true;
    public bool IsFeeApplicable { get; set; } = true;
    public string CertificationPolicy { get; set; } = "QualificationOnly";
    public string Status { get; set; } = "Active";
}

/* ----------------------------------------------------------------- agency */

public class AgencyDto : AuditDto
{
    public int Id { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string AgencyType { get; set; } = "Government Body";
    public string ContactPerson { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string? Gstin { get; set; }
    public string? Pan { get; set; }
    public string AddressLine1 { get; set; } = string.Empty;
    public string? AddressLine2 { get; set; }
    public string City { get; set; } = string.Empty;
    public int StateCode { get; set; }
    public string? State { get; set; }
    public int? DistrictCode { get; set; }
    public string? District { get; set; }
    public string Pincode { get; set; } = string.Empty;
    public DateOnly EmpanelledOn { get; set; }
    public DateOnly? EmpanelmentValidTill { get; set; }
    public List<int> CategoryIds { get; set; } = [];
    public List<int> SubCategoryIds { get; set; } = [];
    public List<int> ProgramTypeIds { get; set; } = [];
    /// <summary>LGD state codes the agency is empanelled for.</summary>
    public List<int> StateCodes { get; set; } = [];
    public string Status { get; set; } = "Active";
}

public class AgencyUpsertDto
{
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string AgencyType { get; set; } = "Government Body";
    public string ContactPerson { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string? Gstin { get; set; }
    public string? Pan { get; set; }
    public string AddressLine1 { get; set; } = string.Empty;
    public string? AddressLine2 { get; set; }
    public string City { get; set; } = string.Empty;
    public int StateCode { get; set; }
    public int? DistrictCode { get; set; }
    public string Pincode { get; set; } = string.Empty;
    public DateOnly EmpanelledOn { get; set; }
    public DateOnly? EmpanelmentValidTill { get; set; }
    public List<int> CategoryIds { get; set; } = [];
    public List<int> SubCategoryIds { get; set; } = [];
    public List<int> ProgramTypeIds { get; set; } = [];
    /// <summary>LGD state codes the agency is empanelled to operate in.</summary>
    public List<int> StateCodes { get; set; } = [];
    public string Status { get; set; } = "Active";

    /// <summary>
    /// On create, also issue the agency's own portal login to the contact
    /// person, as an Implementing Agency account carrying this agency's
    /// program types and states. Ignored on update, and skipped when an
    /// account already exists for that address.
    /// </summary>
    public bool CreateLogin { get; set; } = true;
}
