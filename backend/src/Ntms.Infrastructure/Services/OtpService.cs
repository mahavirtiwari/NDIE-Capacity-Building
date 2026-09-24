using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Ntms.Application.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Email OTP for applicant sign-up. The code is only ever stored hashed, and a
/// challenge is single use with a small attempt budget.
/// </summary>
public class OtpService(
    NtmsDbContext db,
    IPasswordService passwords,
    INotificationService notifications,
    IServiceProvider services,
    IOptions<EmailOptions> emailOptions)
{
    private const int MaxAttempts = 5;

    /* The send endpoint is anonymous by necessity — the caller has no account
       yet — so it is throttled instead. Without this, anyone could bomb an
       arbitrary inbox, and, because a new code retires the previous one, could
       also stop a genuine applicant from ever completing verification. */
    private static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan SendWindow = TimeSpan.FromHours(1);
    private const int MaxSendsPerWindow = 5;
    private readonly int _validityMinutes = emailOptions.Value.OtpValidityMinutes;

    /// <summary>
    /// Resolved lazily to avoid a circular dependency: the applicant auth
    /// service needs the OTP service to send codes, and this needs it back to
    /// issue the first password.
    /// </summary>
    private Task issueCredentials(Domain.Entities.Applicant applicant, CancellationToken ct) =>
        ((ApplicantAuthService)services.GetService(typeof(ApplicantAuthService))!)
            .IssueFirstPasswordAsync(applicant, ct);

    public async Task SendEmailOtpAsync(string email, string name, CancellationToken ct = default)
    {
        if (!Formats.IsEmail(email) || string.IsNullOrWhiteSpace(email))
            throw new AppException("Email address is invalid.");

        var destination = email.Trim().ToLowerInvariant();
        var now = DateTime.UtcNow;

        var recent = await db.OtpChallenges
            .Where(o => o.Destination == destination && o.Channel == "Email"
                        && o.CreatedOn > now - SendWindow)
            .OrderByDescending(o => o.CreatedOn)
            .ToListAsync(ct);

        if (recent.Count >= MaxSendsPerWindow)
        {
            throw new AppException(
                "Too many verification codes requested for this address. Try again later.", 429);
        }

        if (recent.FirstOrDefault() is { } last && now - last.CreatedOn < ResendCooldown)
        {
            var wait = (int)Math.Ceiling((ResendCooldown - (now - last.CreatedOn)).TotalSeconds);
            throw new AppException(
                $"A code was just sent. Please wait {wait} seconds before asking for another.", 429);
        }

        /* Only one live challenge per address, so an old code cannot be reused. */
        var live = await db.OtpChallenges
            .Where(o => o.Destination == destination && o.Channel == "Email" && !o.IsUsed)
            .ToListAsync(ct);
        foreach (var stale in live) stale.IsUsed = true;

        var code = RandomNumberGenerator.GetInt32(100000, 1000000).ToString();
        db.OtpChallenges.Add(new OtpChallenge
        {
            Channel = "Email",
            Destination = destination,
            CodeHash = passwords.Hash(code),
            ExpiresOn = now.AddMinutes(_validityMinutes),
        });

        await db.SaveChangesAsync(ct);
        await notifications.SendOtpAsync(destination, name, code, ct);
    }

    /// <summary>Verifies the code and marks the applicant's e-mail as confirmed.</summary>
    public async Task<bool> VerifyEmailOtpAsync(string email, string code, CancellationToken ct = default)
    {
        var destination = (email ?? string.Empty).Trim().ToLowerInvariant();

        var challenge = await db.OtpChallenges
            .Where(o => o.Destination == destination && o.Channel == "Email" && !o.IsUsed)
            .OrderByDescending(o => o.CreatedOn)
            .FirstOrDefaultAsync(ct)
            ?? throw new AppException("Request a verification code first.");

        if (challenge.ExpiresOn < DateTime.UtcNow)
        {
            challenge.IsUsed = true;
            await db.SaveChangesAsync(ct);
            throw new AppException("The verification code has expired. Request a new one.");
        }

        if (challenge.Attempts >= MaxAttempts)
        {
            challenge.IsUsed = true;
            await db.SaveChangesAsync(ct);
            throw new AppException("Too many incorrect attempts. Request a new code.");
        }

        if (!passwords.Verify(challenge.CodeHash, code ?? string.Empty))
        {
            challenge.Attempts++;
            await db.SaveChangesAsync(ct);
            throw new AppException("The verification code is not correct.");
        }

        challenge.IsUsed = true;

        /* E-mail is not an identity key, so a household may register more than
           one applicant against the same mailbox. Whoever holds the code has
           proven control of it, so every account on that address is verified —
           otherwise the second registration could never be confirmed. */
        var applicants = await db.Applicants
            .Where(a => a.Email == destination)
            .ToListAsync(ct);

        foreach (var applicant in applicants) applicant.EmailVerified = true;

        await db.SaveChangesAsync(ct);

        /* First verification is what turns a registration into an account: the
           system issues the password and mails it with the applicant ID. */
        foreach (var applicant in applicants.Where(a => string.IsNullOrEmpty(a.PasswordHash)))
        {
            await issueCredentials(applicant, ct);
        }

        return true;
    }
}
