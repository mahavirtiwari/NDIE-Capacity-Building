namespace Ntms.Application.Contracts;

/* ------------------------------------------------------------------- auth */

public class LoginRequestDto
{
    /// <summary>The system generated user ID — never the e-mail address.</summary>
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class AuthUserDto
{
    public int Id { get; set; }
    public string UserCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public List<string> Permissions { get; set; } = [];
    public List<int> CategoryIds { get; set; } = [];
    public List<int> SubCategoryIds { get; set; } = [];
    public List<int> ProgramTypeIds { get; set; } = [];
    /// <summary>LGD state codes this account is allocated to work in.</summary>
    public List<int> StateCodes { get; set; } = [];
    /// <summary>LGD district codes; coordinators only.</summary>
    public List<int> DistrictCodes { get; set; } = [];
    public int? AgencyId { get; set; }
    public string AvatarInitials { get; set; } = string.Empty;
    public bool MustChangePassword { get; set; }
}

public class LoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public int ExpiresInSeconds { get; set; }
    public AuthUserDto User { get; set; } = new();
}

public class RefreshRequestDto
{
    public string RefreshToken { get; set; } = string.Empty;
}

public class ChangePasswordDto
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

/// <summary>Starts a self-service reset. Identified by the user ID, as sign-in is.</summary>
public class ForgotPasswordDto
{
    public string UserCode { get; set; } = string.Empty;
}

public class ResetPasswordDto
{
    public string UserCode { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

/// <summary>
/// Deliberately vague: byte for byte the same response whether or not the user
/// ID exists. It carries no masked address on purpose — returning one only for
/// real accounts would hand back exactly the signal the generic message is
/// there to withhold.
/// </summary>
public class ForgotPasswordResultDto
{
    public string Message { get; set; } = string.Empty;
    public int ValidityMinutes { get; set; }
}

public class UpdateContactDto
{
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
}

/* ------------------------------------------------------------------ roles */

public class PermissionGroupDto
{
    public string Group { get; set; } = string.Empty;
    public List<string> Permissions { get; set; } = [];
}

public class AdminRoleDto : AuditDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string BaseRole { get; set; } = "Admin";
    public string? Description { get; set; }
    public List<string> Permissions { get; set; } = [];
    public int UserCount { get; set; }
    public bool IsSystemRole { get; set; }

    /// <summary>
    /// Which axes an account on this role is allocated on, so the screen
    /// that allocates one shows the right pickers.
    ///
    /// Sent with the role rather than looked up from a copy of the map in
    /// the browser. There was such a copy, and it drifted: an Operation
    /// Manager was given categories and sub-categories on both sides long
    /// after the role had stopped being allocated on them, and nothing
    /// could have caught it because the two were never compared.
    /// </summary>
    public ScopeAxesDto Axes { get; set; } = new();

    public string Status { get; set; } = "Active";
}

/// <summary>The allocation axes of one tier, as flags a screen can read.</summary>
public class ScopeAxesDto
{
    public bool Category { get; set; }
    public bool SubCategory { get; set; }
    public bool ProgramType { get; set; }
    public bool State { get; set; }
    public bool District { get; set; }

    /// <summary>True where the tier sees the whole estate and allocates nothing.</summary>
    public bool None => !Category && !SubCategory && !ProgramType && !State && !District;
}

public class AdminRoleUpsertDto
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string BaseRole { get; set; } = "Admin";
    public string? Description { get; set; }
    public List<string> Permissions { get; set; } = [];
    public string Status { get; set; } = "Active";
}

/* ------------------------------------------------------------------ users */

public class PortalUserDto : AuditDto
{
    public int Id { get; set; }
    public string UserCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string? Designation { get; set; }
    public int RoleId { get; set; }
    public string? RoleName { get; set; }
    public string BaseRole { get; set; } = "Coordinator";
    public List<int> CategoryIds { get; set; } = [];
    public List<int> SubCategoryIds { get; set; } = [];
    public List<int> ProgramTypeIds { get; set; } = [];
    /// <summary>LGD state codes allocated to this account.</summary>
    public List<int> StateCodes { get; set; } = [];
    /// <summary>LGD district codes; coordinators only.</summary>
    public List<int> DistrictCodes { get; set; } = [];
    public int? AgencyId { get; set; }
    public string? AgencyName { get; set; }
    public int? ReportsToUserId { get; set; }
    public string? ReportsToName { get; set; }
    public int? StateCode { get; set; }
    public string? State { get; set; }
    public int? DistrictCode { get; set; }
    public string? District { get; set; }
    public string? City { get; set; }
    public DateTime? LastLoginOn { get; set; }
    public string Status { get; set; } = "Active";
}

public class PortalUserUpsertDto
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string? Designation { get; set; }
    public int RoleId { get; set; }
    public List<int> CategoryIds { get; set; } = [];
    public List<int> SubCategoryIds { get; set; } = [];
    public List<int> ProgramTypeIds { get; set; } = [];
    /// <summary>LGD state codes to allocate. Must sit inside the creator's own.</summary>
    public List<int> StateCodes { get; set; } = [];
    /// <summary>LGD district codes; coordinators only.</summary>
    public List<int> DistrictCodes { get; set; } = [];
    public int? AgencyId { get; set; }
    public int? ReportsToUserId { get; set; }
    /// <summary>Where the person sits, as distinct from the states they cover.</summary>
    public int? StateCode { get; set; }
    public int? DistrictCode { get; set; }
    public string? City { get; set; }
    public string Status { get; set; } = "Active";
}

/// <summary>Returned once, when an account is created or its password is reset.</summary>
public class GeneratedCredentialsDto
{
    public string UserCode { get; set; } = string.Empty;
    public string TemporaryPassword { get; set; } = string.Empty;
}

/// <summary>One switch of an account on or off, and the grounds for it.</summary>
public class UserStatusEventDto
{
    public int Id { get; set; }
    public string FromStatus { get; set; } = string.Empty;
    public string ToStatus { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string ByUserName { get; set; } = string.Empty;
    public string ByUserCode { get; set; } = string.Empty;
    public DateTime On { get; set; }
}

/// <summary>
/// An account's status history, with the account named on it so the popup
/// showing it does not have to be told twice who it is about.
/// </summary>
public class UserHistoryDto
{
    public int UserId { get; set; }
    /// <summary>The login the account signs in with.</summary>
    public string UserCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? LastLoginOn { get; set; }

    /// <summary>Switching on and off, kept for the panel that explains it.</summary>
    public List<UserStatusEventDto> Events { get; set; } = [];

    /// <summary>Everything that has happened to this account, oldest first.</summary>
    public List<TimelineEventDto> Timeline { get; set; } = [];
}

/// <summary>
/// What the agency history popup shows: the empanelment, the login, the
/// coordinators it added and the batches it ran.
/// </summary>
public class AgencyHistoryDto
{
    public int AgencyId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateOnly EmpanelledOn { get; set; }
    public DateOnly? EmpanelmentValidTill { get; set; }

    public List<TimelineEventDto> Timeline { get; set; } = [];
}
