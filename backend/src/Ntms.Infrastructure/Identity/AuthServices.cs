using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Ntms.Domain.Entities;

namespace Ntms.Infrastructure.Identity;

/// <summary>The signed-in principal, as the infrastructure layer sees it.</summary>
public interface ICurrentUser
{
    int? UserId { get; }
    /// <summary>Set only on a token issued to the mobile applicant app.</summary>
    int? ApplicantId { get; }
    string? UserCode { get; }
    string? DisplayName { get; }
    string? RoleName { get; }
    bool IsAuthenticated { get; }
    bool HasPermission(string permission);

    /// <summary>
    /// Everything this account may do. Needed where the question is not "may
    /// I do this" but "may I hand this on" — nobody grants what they do not
    /// hold.
    /// </summary>
    IReadOnlyCollection<string> Permissions { get; }

    /// <summary>
    /// The slice of the estate this account was allocated, one list per axis.
    /// On a scoped account an empty list means "nothing on that axis" — an
    /// unfinished allocation grants no access rather than all of it.
    /// </summary>
    IReadOnlyList<int> ScopeCategoryIds { get; }
    IReadOnlyList<int> ScopeSubCategoryIds { get; }
    IReadOnlyList<int> ScopeProgramTypeIds { get; }
    IReadOnlyList<int> ScopeStateCodes { get; }
    IReadOnlyList<int> ScopeDistrictCodes { get; }

    /// <summary>
    /// True when this account is confined to its allocation. False only for
    /// Super Admin and the Ministry, who see the whole estate by design.
    /// </summary>
    bool IsMasterScoped { get; }

    /// <summary>The account's tier, used for the delegation rules.</summary>
    Domain.Common.BaseRole? Tier { get; }

    /// <summary>The agency behind an Implementing Agency login, else null.</summary>
    int? AgencyId { get; }
}

/// <summary>Hashes and verifies passwords with ASP.NET Core's PBKDF2 hasher.</summary>
public interface IPasswordService
{
    string Hash(string password);
    bool Verify(string hash, string password);
    string GenerateTemporaryPassword();
}

public class PasswordService : IPasswordService
{
    private readonly PasswordHasher<object> _hasher = new();
    private static readonly object Subject = new();

    private const string Upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    private const string Lower = "abcdefghijkmnopqrstuvwxyz";
    private const string Digits = "23456789";
    private const string Symbols = "@#$%&*";

    public string Hash(string password) => _hasher.HashPassword(Subject, password);

    public bool Verify(string hash, string password) =>
        _hasher.VerifyHashedPassword(Subject, hash, password) != PasswordVerificationResult.Failed;

    /// <summary>
    /// A readable one-time password the admin can dictate over the phone. The
    /// user is forced to change it at first sign-in.
    /// </summary>
    public string GenerateTemporaryPassword()
    {
        Span<char> chars =
        [
            Pick(Upper), Pick(Lower), Pick(Lower), Pick(Digits),
            Pick(Digits), Pick(Symbols), Pick(Lower), Pick(Digits),
        ];
        return new string(chars);
    }

    private static char Pick(string alphabet) => alphabet[RandomNumberGenerator.GetInt32(alphabet.Length)];
}

/// <summary>Issues the access and refresh tokens.</summary>
public interface ITokenService
{
    (string Token, int ExpiresInSeconds) CreateAccessToken(PortalUser user, IEnumerable<string> permissions);
    /// <summary>Token for the mobile applicant app; carries no portal permissions.</summary>
    (string Token, int ExpiresInSeconds) CreateApplicantToken(Applicant applicant);
    string CreateRefreshToken();
}

/// <summary>Reads the JWT settings from configuration.</summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";
    public string Issuer { get; set; } = "ntms-api";
    public string Audience { get; set; } = "ntms-clients";
    public string SigningKey { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 60;
    public int RefreshTokenDays { get; set; } = 7;
}
