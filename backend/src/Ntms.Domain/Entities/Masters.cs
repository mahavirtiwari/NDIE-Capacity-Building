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

    /// <summary>
    /// Whether an applicant must answer the sign-up form to register under
    /// this sub-category.
    /// </summary>
    public bool RequiresSignupForm { get; set; } = true;

    /// <summary>
    /// Whether an applicant must complete the profile form, and have it
    /// scrutinised, before the programs under this sub-category open to
    /// them.
    ///
    /// The two go together: scrutiny is the reading of what was declared on
    /// that form, so a sub-category that asks for nothing has nothing to
    /// scrutinise and its programs are open from the start. Splitting them
    /// would allow "no form, but scrutinise it", which is a queue of blank
    /// submissions nobody can act on.
    /// </summary>
    public bool RequiresProfileForm { get; set; } = true;
}

/// <summary>
/// The applicant facing track — Master Trainer, Assessor, Consultant. Drives the
/// profile form, fee, curriculum and exam paper.
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
    /// <summary>
    /// Kept in step with the evaluation scheme rather than set on its own:
    /// true whenever anything is examined. Older code reads this, and two
    /// places to say the same thing is one place to contradict it.
    /// </summary>
    public bool IsExamMandatory { get; set; } = true;

    /// <summary>What is examined, out of how many marks, and what passes.</summary>
    public EvaluationScheme Evaluation { get; set; } = new();

    /// <summary>
    /// What a trainer marks a candidate on in the viva or practical. Empty for
    /// a type with no practical component.
    /// </summary>
    public ICollection<EvaluationSkill> Skills { get; set; } = [];
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
    /// <summary>
    /// The Operation Manager who empanelled this agency.
    ///
    /// Visibility of everything the agency goes on to do follows from here:
    /// a manager sees the batches raised by the agencies it empanelled, and
    /// the Admin above sees those of the managers it appointed. Allocation
    /// alone was not enough — two managers whose program types overlap were
    /// each reading the other's agencies.
    ///
    /// Null for the agencies empanelled before this was recorded, and for
    /// any created by a tier with nobody above the chain.
    /// </summary>
    public int? OwnerUserId { get; set; }
    public PortalUser? OwnerUser { get; set; }

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

/// <summary>
/// The marking pattern for a programme type, owned by it.
///
/// Marks are held per section rather than as one total with a split, because
/// the pass rule is per section: a candidate can reach the overall mark and
/// still fail for missing the written minimum, and that has to be expressible.
/// </summary>
public class EvaluationScheme
{
    public ExaminationKind Kind { get; set; } = ExaminationKind.Written;

    public int TotalMarks { get; set; }
    public int WrittenMarks { get; set; }
    public int VivaMarks { get; set; }

    /// <summary>Minimum for that section on its own.</summary>
    public int WrittenPassMarks { get; set; }
    public int VivaPassMarks { get; set; }

    /// <summary>Minimum across both, which a candidate must also reach.</summary>
    public int OverallPassMarks { get; set; }

    public bool HasWritten => Kind is ExaminationKind.Written or ExaminationKind.WrittenAndViva;
    public bool HasViva => Kind is ExaminationKind.VivaPractical or ExaminationKind.WrittenAndViva;
}

/// <summary>
/// One thing a trainer scores a candidate on in the viva or practical, and how
/// many marks it carries.
///
/// Per programme type, because what is worth marking in an assessor's practical
/// is not what is worth marking in a master trainer's.
/// </summary>
public class EvaluationSkill : AuditableStatusEntity
{
    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }

    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }

    public int MaxMarks { get; set; }
    public int DisplayOrder { get; set; }
}

/// <summary>
/// One rung of the educational qualification ladder, e.g. "Diploma".
///
/// A master rather than a fixed list in code, because the qualifications that
/// matter differ by scheme and nobody should need a release to add one.
///
/// <see cref="Rank"/> is what makes "at or above the bar" answerable: a
/// programme type stores the <see cref="Code"/> of its minimum, and an
/// applicant clears it when their own rung is ranked no lower. Two rungs may
/// share a rank, which is how alternatives that count as equivalent — an ITI
/// and a diploma, say — are expressed.
///
/// <see cref="ProgramType.MinQualification"/> holds the code rather than a
/// foreign key. That is deliberate: a programme type whose qualification was
/// renamed or removed keeps the value it was set up with instead of being
/// silently emptied, and the screens show it as-is when it no longer matches.
/// </summary>
public class Qualification : AuditableStatusEntity
{
    public string Code { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int Rank { get; set; }
}

/// <summary>
/// A named list of choices, kept once and used by any number of fields.
///
/// A dropdown on a form could always have its own options typed into it,
/// and for a one-off question that is the right thing. It stops being the
/// right thing the moment the same list appears on three forms: the three
/// drift, somebody adds a sector to one of them, and a report that groups
/// by sector has to reconcile answers that were never the same set of
/// words.
///
/// A field that points at one of these has no options of its own. Changing
/// the list here changes every form that uses it, which is the point, and
/// is why an item is switched off rather than deleted once answers exist
/// against it - the history has to keep reading.
/// </summary>
public class OptionSet : AuditableStatusEntity
{
    /// <summary>Short stable handle, e.g. SECTORS. Not shown to applicants.</summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>What a form designer picks from the list, e.g. "Sectors".</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>What it is for, so a designer picks the right one.</summary>
    public string? Description { get; set; }

    public ICollection<OptionSetItem> Items { get; set; } = [];
}

/// <summary>One choice in a shared list.</summary>
public class OptionSetItem : AuditableStatusEntity
{
    public int OptionSetId { get; set; }
    public OptionSet? OptionSet { get; set; }

    /// <summary>
    /// What is stored against an answer. Fixed once answers exist: the
    /// label can be reworded, this cannot, or the answers already given
    /// stop meaning anything.
    /// </summary>
    public string Value { get; set; } = string.Empty;

    /// <summary>What the applicant reads.</summary>
    public string Label { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }
}

/// <summary>
/// One reason an application may be turned down.
///
/// A list rather than free text, because a rejection is a decision the
/// scheme has to be able to count. "Documents not legible" typed forty
/// different ways cannot be reported on, and an applicant re-applying needs
/// to be told the same thing every officer means by it.
///
/// Editable by a Super Admin, because what a scheme rejects for is the
/// scheme's business and changes with its rules.
/// </summary>
/// <summary>
/// One reason an applicant's account may be blocked.
///
/// A list of its own rather than a kind on the rejection reasons, because
/// they are different vocabularies about different things: an application is
/// turned down for a document that cannot be read, a person is blocked for
/// something they did. Sharing a table would put "Documents are not legible"
/// in front of somebody deciding whether to lock an account.
/// </summary>
public class BlockReason : AuditableStatusEntity
{
    public string Label { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }

    /// <summary>Whether this is a reason to block or a reason to let back in.</summary>
    public AccessReasonKind Kind { get; set; } = AccessReasonKind.Block;

    /// <summary>True where the reason needs the specifics spelled out.</summary>
    public bool RequiresNote { get; set; }
}

public class RejectionReason : AuditableStatusEntity
{
    public string Label { get; set; } = string.Empty;

    public int DisplayOrder { get; set; }

    /// <summary>
    /// True where the reason is not self-explanatory and the officer has to
    /// say which document, or what exactly was wrong. "Other" is the obvious
    /// one; a scheme may want it on more.
    /// </summary>
    public bool RequiresNote { get; set; }
}
