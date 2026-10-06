using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

public class AuthService(
    NtmsDbContext db,
    IPasswordService passwords,
    ITokenService tokens,
    INotificationService notifications,
    IOptions<JwtOptions> jwtOptions,
    ILogger<AuthService> logger)
{
    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan LockoutWindow = TimeSpan.FromMinutes(15);

    private const int ResetValidityMinutes = 15;
    private const int MaxResetAttempts = 5;
    private static readonly TimeSpan ResetCooldown = TimeSpan.FromSeconds(60);
    /// <summary>
    /// Channel tag on the shared OTP table, keeping reset codes apart from
    /// sign-up codes. Short, because the column allows 10 characters.
    /// </summary>
    private const string ResetChannel = "Reset";

    /// <summary>
    /// Signs in with the system generated user ID. E-mail is deliberately not
    /// accepted: users change it, so it can never be the account's identity.
    /// </summary>
    public async Task<LoginResponseDto> LoginAsync(LoginRequestDto request, CancellationToken ct)
    {
        var userCode = (request.Username ?? string.Empty).Trim().ToUpperInvariant();

        var user = await db.Users
            .Include(u => u.Role).ThenInclude(r => r!.Permissions)
            .Include(u => u.Categories)
            .Include(u => u.SubCategories)
            .Include(u => u.ProgramTypes)
            .Include(u => u.States)
            .Include(u => u.Districts)
            /* Split, not joined: the scope collections multiply together. */
            .AsSplitQuery()
            .FirstOrDefaultAsync(u => u.UserCode == userCode, ct);

        /* One message for every failure, so the response never reveals whether
           a given user ID exists. */
        if (user is null || !passwords.Verify(user.PasswordHash, request.Password))
        {
            if (user is not null) await RecordFailureAsync(user, ct);
            logger.LogWarning("Failed sign-in attempt for {UserCode}", userCode);
            throw new AppException("Invalid user ID or password.", 401);
        }

        if (user.LockedOutUntil is { } until && until > DateTime.UtcNow)
        {
            throw new AppException(
                $"Too many failed attempts. Try again after {until:HH:mm} UTC.", 423);
        }

        if (user.Status != RecordStatus.Active)
            throw new AppException("This account has been deactivated.", 403);

        if (user.Role is null || user.Role.Status != RecordStatus.Active)
            throw new AppException("The role assigned to this account is disabled.", 403);

        var permissions = RoleHierarchy.Effective(
            user.Role.BaseRole, user.Role.Permissions.Select(p => p.Permission));
        var (token, expiresIn) = tokens.CreateAccessToken(user, permissions);
        var refresh = tokens.CreateRefreshToken();

        user.LastLoginOn = DateTime.UtcNow;
        user.FailedLoginCount = 0;
        user.LockedOutUntil = null;

        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            Token = refresh,
            ExpiresOn = DateTime.UtcNow.AddDays(jwtOptions.Value.RefreshTokenDays),
        });
        await db.SaveChangesAsync(ct);

        return new LoginResponseDto
        {
            Token = token,
            RefreshToken = refresh,
            ExpiresInSeconds = expiresIn,
            User = ToAuthUser(user, permissions),
        };
    }

    public async Task<LoginResponseDto> RefreshAsync(RefreshRequestDto request, CancellationToken ct)
    {
        var stored = await db.RefreshTokens
            .Include(t => t.User).ThenInclude(u => u!.Role).ThenInclude(r => r!.Permissions)
            .Include(t => t.User).ThenInclude(u => u!.Categories)
            .Include(t => t.User).ThenInclude(u => u!.SubCategories)
            .Include(t => t.User).ThenInclude(u => u!.ProgramTypes)
            /* Geography travels on the token too: without these the refreshed
               token would carry no states, and an empty allocation now means
               no access rather than unrestricted. */
            .Include(t => t.User).ThenInclude(u => u!.States)
            .Include(t => t.User).ThenInclude(u => u!.Districts)
            .FirstOrDefaultAsync(t => t.Token == request.RefreshToken, ct);

        if (stored is null || stored.RevokedOn is not null || stored.ExpiresOn < DateTime.UtcNow)
            throw new AppException("The session has expired. Please sign in again.", 401);

        var user = stored.User!;
        if (user.Status != RecordStatus.Active)
            throw new AppException("This account has been deactivated.", 403);

        var permissions = RoleHierarchy.Effective(
            user.Role?.BaseRole, user.Role?.Permissions.Select(p => p.Permission) ?? []);
        var (token, expiresIn) = tokens.CreateAccessToken(user, permissions);
        var replacement = tokens.CreateRefreshToken();

        /* Rotate: the old token dies the moment a new one is handed out. */
        stored.RevokedOn = DateTime.UtcNow;
        db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id,
            Token = replacement,
            ExpiresOn = DateTime.UtcNow.AddDays(jwtOptions.Value.RefreshTokenDays),
        });
        await db.SaveChangesAsync(ct);

        return new LoginResponseDto
        {
            Token = token,
            RefreshToken = replacement,
            ExpiresInSeconds = expiresIn,
            User = ToAuthUser(user, permissions),
        };
    }

    public async Task LogoutAsync(string refreshToken, CancellationToken ct)
    {
        var stored = await db.RefreshTokens.FirstOrDefaultAsync(t => t.Token == refreshToken, ct);
        if (stored is null || stored.RevokedOn is not null) return;
        stored.RevokedOn = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    public async Task<AuthUserDto> MeAsync(int userId, CancellationToken ct)
    {
        var user = await db.Users
            .Include(u => u.Role).ThenInclude(r => r!.Permissions)
            .Include(u => u.Categories)
            .Include(u => u.SubCategories)
            .Include(u => u.ProgramTypes)
            .Include(u => u.States)
            .Include(u => u.Districts)
            /* Split, not joined: the scope collections multiply together. */
            .AsSplitQuery()
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw AppException.NotFound("User");

        return ToAuthUser(user, RoleHierarchy.Effective(
            user.Role?.BaseRole, user.Role?.Permissions.Select(p => p.Permission) ?? []));
    }

    public async Task ChangePasswordAsync(int userId, ChangePasswordDto dto, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw AppException.NotFound("User");

        if (!passwords.Verify(user.PasswordHash, dto.CurrentPassword))
            throw new AppException("The current password is not correct.");

        if (dto.NewPassword.Length < 8)
            throw new AppException("The new password must be at least 8 characters.");
        if (dto.NewPassword == dto.CurrentPassword)
            throw new AppException("The new password must be different from the current one.");

        user.PasswordHash = passwords.Hash(dto.NewPassword);
        user.MustChangePassword = false;

        var sessions = await db.RefreshTokens
            .Where(t => t.UserId == userId && t.RevokedOn == null).ToListAsync(ct);
        foreach (var session in sessions) session.RevokedOn = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        await notifications.SendPasswordChangedAsync(user, "changed from the portal", ct);
    }

    /* ------------------------------------------------------ forgot password */

    /// <summary>
    /// Finds the account behind whatever the person typed on the reset form:
    /// their user ID, or the email address held against it. Identity is still
    /// the user ID — the email is only a way in, for the common case of
    /// someone who remembers their address but not a code like SA0001.
    ///
    /// An address shared by two accounts is rejected rather than guessed at,
    /// because sending someone else's reset code would be worse than failing.
    /// </summary>
    private async Task<PortalUser?> ResolveForResetAsync(string? identifier, CancellationToken ct)
    {
        var typed = (identifier ?? string.Empty).Trim();
        if (typed.Length == 0) return null;

        var asCode = typed.ToUpperInvariant();
        var byCode = await db.Users.FirstOrDefaultAsync(u => u.UserCode == asCode, ct);
        if (byCode is not null) return byCode;

        if (!typed.Contains('@')) return null;

        var matches = await db.Users
            .Where(u => u.Email == typed && u.Status == RecordStatus.Active)
            .Take(2).ToListAsync(ct);

        return matches.Count == 1 ? matches[0] : null;
    }

    /// <summary>
    /// Mails a one-time code to the address on file. The reply is identical
    /// whether or not the account exists, so this cannot be used to discover
    /// which user IDs or addresses are real.
    /// </summary>
    public async Task<ForgotPasswordResultDto> ForgotPasswordAsync(
        ForgotPasswordDto dto, CancellationToken ct)
    {
        var vague = new ForgotPasswordResultDto
        {
            Message = "If that account exists, a reset code has been sent to the email on file.",
            ValidityMinutes = ResetValidityMinutes,
        };

        var user = await ResolveForResetAsync(dto.UserCode, ct);

        /* A disabled account is treated as absent, for the same reason. */
        if (user is null || user.Status != RecordStatus.Active
            || string.IsNullOrWhiteSpace(user.Email))
        {
            logger.LogInformation("Password reset requested for an unknown or inactive account");
            return vague;
        }

        /* Challenges are always filed under the user ID, never under whatever
           was typed, so the second step finds them either way. */
        var userCode = user.UserCode;

        var now = DateTime.UtcNow;
        var last = await db.OtpChallenges
            .Where(o => o.Destination == userCode && o.Channel == ResetChannel)
            .OrderByDescending(o => o.CreatedOn)
            .FirstOrDefaultAsync(ct);

        /* Silent on cooldown: saying "too soon" would confirm the ID exists. */
        if (last is not null && now - last.CreatedOn < ResetCooldown) return vague;

        var live = await db.OtpChallenges
            .Where(o => o.Destination == userCode && o.Channel == ResetChannel && !o.IsUsed)
            .ToListAsync(ct);
        foreach (var stale in live) stale.IsUsed = true;

        var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        db.OtpChallenges.Add(new OtpChallenge
        {
            Channel = ResetChannel,
            Destination = userCode,
            CodeHash = passwords.Hash(code),
            ExpiresOn = now.AddMinutes(ResetValidityMinutes),
        });
        await db.SaveChangesAsync(ct);

        await notifications.SendPasswordResetCodeAsync(user, code, ResetValidityMinutes, ct);
        logger.LogInformation("Password reset code sent for {UserCode}", userCode);
        return vague;
    }

    /// <summary>Consumes the code, sets the new password and kills every session.</summary>
    public async Task ResetPasswordAsync(ResetPasswordDto dto, CancellationToken ct)
    {
        if ((dto.NewPassword ?? string.Empty).Length < 8)
            throw new AppException("The new password must be at least 8 characters.");

        /* Resolved the same way as the request step, so someone who asked by
           email can finish by email. */
        var resolved = await ResolveForResetAsync(dto.UserCode, ct);
        var userCode = resolved?.UserCode ?? string.Empty;

        var challenge = await db.OtpChallenges
            .Where(o => o.Destination == userCode && o.Channel == ResetChannel && !o.IsUsed)
            .OrderByDescending(o => o.CreatedOn)
            .FirstOrDefaultAsync(ct)
            ?? throw new AppException("Request a reset code first.");

        if (challenge.ExpiresOn < DateTime.UtcNow)
        {
            challenge.IsUsed = true;
            await db.SaveChangesAsync(ct);
            throw new AppException("That code has expired. Request a new one.");
        }

        if (challenge.Attempts >= MaxResetAttempts)
        {
            challenge.IsUsed = true;
            await db.SaveChangesAsync(ct);
            throw new AppException("Too many incorrect attempts. Request a new code.");
        }

        if (!passwords.Verify(challenge.CodeHash, dto.Code ?? string.Empty))
        {
            challenge.Attempts++;
            await db.SaveChangesAsync(ct);
            throw new AppException("That code is not correct.");
        }

        var user = await db.Users.FirstOrDefaultAsync(u => u.UserCode == userCode, ct)
                   ?? throw new AppException("That code is not correct.");

        challenge.IsUsed = true;
        user.PasswordHash = passwords.Hash(dto.NewPassword!);
        user.MustChangePassword = false;
        user.FailedLoginCount = 0;
        user.LockedOutUntil = null;

        /* A reset is also the remedy for a stolen session. */
        var sessions = await db.RefreshTokens
            .Where(t => t.UserId == user.Id && t.RevokedOn == null).ToListAsync(ct);
        foreach (var session in sessions) session.RevokedOn = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Password reset completed for {UserCode}", userCode);

        /* Confirm it to the address on file. If the reset was not the account
           holder's doing, this is how they find out. */
        await notifications.SendPasswordChangedAsync(user, "reset with an emailed code", ct);
    }

    /// <summary>Contact details are the user's own; the user ID never changes.</summary>
    public async Task<AuthUserDto> UpdateContactAsync(int userId, UpdateContactDto dto, CancellationToken ct)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct)
                   ?? throw AppException.NotFound("User");

        if (!Formats.IsEmail(dto.Email) || string.IsNullOrWhiteSpace(dto.Email))
            throw new AppException("Email address is invalid.");
        if (!Formats.IsMobile(dto.Mobile))
            throw new AppException("Mobile must be 10 digits starting 6-9.");

        user.Email = dto.Email.Trim();
        user.Mobile = dto.Mobile.Trim();
        await db.SaveChangesAsync(ct);

        return await MeAsync(userId, ct);
    }

    private async Task RecordFailureAsync(PortalUser user, CancellationToken ct)
    {
        user.FailedLoginCount++;
        if (user.FailedLoginCount >= MaxFailedAttempts)
        {
            user.LockedOutUntil = DateTime.UtcNow.Add(LockoutWindow);
            user.FailedLoginCount = 0;
        }
        await db.SaveChangesAsync(ct);
    }

    private static AuthUserDto ToAuthUser(PortalUser user, List<string> permissions) => new()
    {
        Id = user.Id,
        UserCode = user.UserCode,
        FullName = user.FullName,
        Email = user.Email,
        Mobile = user.Mobile,
        Role = user.BaseRole.ToApi(),
        RoleName = user.Role?.Name ?? user.BaseRole.ToApi(),
        Permissions = [.. permissions.Distinct().Order()],
        CategoryIds = [.. user.Categories.Select(c => c.CategoryId)],
        SubCategoryIds = [.. user.SubCategories.Select(c => c.SubCategoryId)],
        ProgramTypeIds = [.. user.ProgramTypes.Select(c => c.ProgramTypeId)],
        AgencyId = user.AgencyId,
        AvatarInitials = Initials(user.FullName),
        MustChangePassword = user.MustChangePassword,
    };

    private static string Initials(string name) =>
        string.Concat(name.Split(' ', StringSplitOptions.RemoveEmptyEntries)
            .Take(2)
            .Select(part => char.ToUpperInvariant(part[0])));
}
