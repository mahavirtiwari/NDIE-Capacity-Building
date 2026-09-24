using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Ntms.Domain.Entities;

namespace Ntms.Infrastructure.Identity;

public class JwtTokenService(IOptions<JwtOptions> options) : ITokenService
{
    private readonly JwtOptions _options = options.Value;

    /// <summary>Claim carrying one permission key; one claim per permission.</summary>
    public const string PermissionClaim = "perm";
    public const string UserCodeClaim = "user_code";
    public const string ApplicantCodeClaim = "applicant_code";
    public const string ApplicantIdClaim = "applicant_id";

    /* The slice of the estate this account was allocated. Absent on Super
       Admin and Ministry tokens, which are unscoped by design. */
    public const string ScopeCategoryClaim = "scope_cat";
    public const string ScopeSubCategoryClaim = "scope_sub";
    public const string ScopeProgramTypeClaim = "scope_pt";
    public const string ScopeStateClaim = "scope_st";
    public const string ScopeDistrictClaim = "scope_dt";
    /// <summary>Marks a token whose holder is confined to its allocation.</summary>
    public const string ScopedClaim = "scoped";
    /// <summary>Set on an Implementing Agency login, tying it to its agency.</summary>
    public const string AgencyIdClaim = "agency_id";

    public (string Token, int ExpiresInSeconds) CreateAccessToken(
        PortalUser user,
        IEnumerable<string> permissions)
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey)),
            SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            /* The subject is the database id; the user code travels alongside it
               because that, not the e-mail, is the account's public identity. */
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new(UserCodeClaim, user.UserCode),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Role, user.BaseRole.ToString()),
        };
        claims.AddRange(permissions.Distinct().Select(p => new Claim(PermissionClaim, p)));

        /* Master scope travels on the token so every query can narrow itself
           without another round trip to the database. */
        claims.AddRange(user.Categories
            .Select(c => new Claim(ScopeCategoryClaim, c.CategoryId.ToString())));
        claims.AddRange(user.SubCategories
            .Select(c => new Claim(ScopeSubCategoryClaim, c.SubCategoryId.ToString())));
        claims.AddRange(user.ProgramTypes
            .Select(c => new Claim(ScopeProgramTypeClaim, c.ProgramTypeId.ToString())));
        claims.AddRange(user.States
            .Select(c => new Claim(ScopeStateClaim, c.StateCode.ToString())));
        claims.AddRange(user.Districts
            .Select(c => new Claim(ScopeDistrictClaim, c.DistrictCode.ToString())));

        /* Stated outright rather than inferred from the presence of scope rows.
           An allocation that is empty now means "nothing", not "everything", so
           the difference between a scoped account and an unscoped one can no
           longer be read off the claim count. */
        if (Application.Common.RoleHierarchy.IsScoped(user.BaseRole))
        {
            claims.Add(new Claim(ScopedClaim, "1"));
        }

        if (user.AgencyId is { } agencyId)
        {
            claims.Add(new Claim(AgencyIdClaim, agencyId.ToString()));
        }

        var expires = DateTime.UtcNow.AddMinutes(_options.AccessTokenMinutes);
        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expires,
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), _options.AccessTokenMinutes * 60);
    }

    public (string Token, int ExpiresInSeconds) CreateApplicantToken(Applicant applicant)
    {
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey)),
            SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, applicant.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            /* The applicant code is the public identity, exactly as the user
               code is for portal users. */
            new(ApplicantCodeClaim, applicant.ApplicantCode),
            new(ApplicantIdClaim, applicant.Id.ToString()),
            new(ClaimTypes.Name, applicant.FullName),
            new(ClaimTypes.Role, "Applicant"),
        };

        var expires = DateTime.UtcNow.AddMinutes(_options.AccessTokenMinutes);
        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: expires,
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(token), _options.AccessTokenMinutes * 60);
    }

    public string CreateRefreshToken() =>
        Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
}
