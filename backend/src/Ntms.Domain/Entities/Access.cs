using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>Admin role minted by Super Admin from the permission catalogue.</summary>
public class AdminRole : AuditableStatusEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public BaseRole BaseRole { get; set; } = BaseRole.Admin;
    public string? Description { get; set; }
    /// <summary>System roles cannot be disabled or deleted.</summary>
    public bool IsSystemRole { get; set; }

    /// <summary>
    /// The account that shaped this role, and the only one that may reshape it.
    ///
    /// A tier settles what the tier beneath it may do, so two Admins each
    /// appoint Operation Managers and neither has business changing what the
    /// other's can reach. Ownership is what keeps those apart; without it one
    /// shared role per tier meant whoever saved last decided for everybody.
    ///
    /// Null is a seeded default: the starting point offered to every creator
    /// at that tier and reshaped by none of them. A creator who wants
    /// something else makes their own role, which is theirs.
    /// </summary>
    public int? OwnerUserId { get; set; }
    public PortalUser? OwnerUser { get; set; }

    public ICollection<RolePermission> Permissions { get; set; } = [];
    public ICollection<PortalUser> Users { get; set; } = [];
}

public class RolePermission
{
    public int Id { get; set; }
    public int RoleId { get; set; }
    public AdminRole? Role { get; set; }
    /// <summary>Permission key, e.g. "applications.scrutinise".</summary>
    public string Permission { get; set; } = string.Empty;
}

/// <summary>
/// A back-office user: Admin, Operation Manager or Coordinator. Identity is the
/// system generated <see cref="UserCode"/>; e-mail is ordinary profile data the
/// user may change at any time and is never a login key.
/// </summary>
public class PortalUser : AuditableStatusEntity
{
    /// <summary>System generated, e.g. OM0005. Unique, immutable.</summary>
    public string UserCode { get; set; } = string.Empty;

    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string? Designation { get; set; }

    public string PasswordHash { get; set; } = string.Empty;
    public bool MustChangePassword { get; set; } = true;
    public DateTime? LastLoginOn { get; set; }
    public int FailedLoginCount { get; set; }
    public DateTime? LockedOutUntil { get; set; }

    public int RoleId { get; set; }
    public AdminRole? Role { get; set; }
    public BaseRole BaseRole { get; set; } = BaseRole.Coordinator;

    public int? AgencyId { get; set; }
    public ImplementingAgency? Agency { get; set; }

    public int? ReportsToUserId { get; set; }
    public PortalUser? ReportsToUser { get; set; }

    public int? StateCode { get; set; }
    public LgdState? State { get; set; }
    public int? DistrictCode { get; set; }
    public LgdDistrict? District { get; set; }
    public string? City { get; set; }

    /// <summary>
    /// Postal code of where this person sits. Optional, like the rest of the
    /// address: an account works without one, and the accounts that predate
    /// the field have none.
    /// </summary>
    public string? Pincode { get; set; }

    public ICollection<UserCategory> Categories { get; set; } = [];
    public ICollection<UserSubCategory> SubCategories { get; set; } = [];
    public ICollection<UserProgramType> ProgramTypes { get; set; } = [];

    /// <summary>
    /// The territory this user works in. Separate from <see cref="StateCode"/>,
    /// which is where the person sits: an Admin posted in Delhi may be
    /// allocated fifteen states.
    /// </summary>
    public ICollection<UserState> States { get; set; } = [];
    /// <summary>Districts, used by coordinators — the narrowest tier.</summary>
    public ICollection<UserDistrict> Districts { get; set; } = [];
}

public class UserCategory
{
    public int UserId { get; set; }
    public PortalUser? User { get; set; }
    public int CategoryId { get; set; }
    public Category? Category { get; set; }
}

public class UserSubCategory
{
    public int UserId { get; set; }
    public PortalUser? User { get; set; }
    public int SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }
}

public class UserProgramType
{
    public int UserId { get; set; }
    public PortalUser? User { get; set; }
    public int ProgramTypeId { get; set; }
    public ProgramType? ProgramType { get; set; }
}

public class UserState
{
    public int UserId { get; set; }
    public PortalUser? User { get; set; }
    /// <summary>LGD state code.</summary>
    public int StateCode { get; set; }
    public LgdState? State { get; set; }
}

public class UserDistrict
{
    public int UserId { get; set; }
    public PortalUser? User { get; set; }
    /// <summary>LGD district code.</summary>
    public int DistrictCode { get; set; }
    public LgdDistrict? District { get; set; }
}

/// <summary>Issued refresh token, so a session can be revoked server side.</summary>
public class RefreshToken
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public PortalUser? User { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresOn { get; set; }
    public DateTime CreatedOn { get; set; } = DateTime.UtcNow;
    public DateTime? RevokedOn { get; set; }
}
