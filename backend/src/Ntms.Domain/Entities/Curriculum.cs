using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>
/// One curriculum is one programme, identified by its programme code, holding a
/// day-wise list of sessions and their topics. <see cref="RecordStatus.Inactive"/>
/// is presented as "Blocked" on the register.
/// </summary>
public class Curriculum : AuditableStatusEntity
{
    /// <summary>
    /// The programme type this curriculum belongs to. It is the curriculum's
    /// identity: the code, the name and the category all come from the master
    /// rather than being retyped here, so they can never drift apart.
    /// </summary>
    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }

    public string? Objective { get; set; }
    public int DurationDays { get; set; }
    public DateOnly EffectiveFrom { get; set; }

    public ICollection<CurriculumSession> Sessions { get; set; } = [];
}

/// <summary>A slot in the day plan; codes follow &lt;programTypeCode&gt;/S01.</summary>
public class CurriculumSession : AuditableStatusEntity
{
    public int CurriculumId { get; set; }
    public Curriculum? Curriculum { get; set; }

    public string SessionCode { get; set; } = string.Empty;
    public string SessionName { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public int? Day { get; set; }

    public ICollection<CurriculumTopic> Topics { get; set; } = [];
}

/// <summary>A topic under a session; codes follow &lt;sessionCode&gt;/T01.</summary>
public class CurriculumTopic : AuditableStatusEntity
{
    public int SessionId { get; set; }
    public CurriculumSession? Session { get; set; }

    public string TopicCode { get; set; } = string.Empty;
    public string TopicName { get; set; } = string.Empty;
    public int DisplayOrder { get; set; }
    public int? DurationMinutes { get; set; }
    public string? LearningOutcome { get; set; }
}
