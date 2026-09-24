namespace Ntms.Domain.Common;

/// <summary>Every persisted row carries who touched it and when.</summary>
public abstract class AuditableEntity
{
    public int Id { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    public string? ModifiedBy { get; set; }
    public DateTime? ModifiedOn { get; set; }
}

/// <summary>Implemented by anything that can be enabled or disabled.</summary>
public interface IHasStatus
{
    RecordStatus Status { get; set; }
}

/// <summary>An auditable row that can also be switched off.</summary>
public abstract class AuditableStatusEntity : AuditableEntity, IHasStatus
{
    public RecordStatus Status { get; set; } = RecordStatus.Active;
}
