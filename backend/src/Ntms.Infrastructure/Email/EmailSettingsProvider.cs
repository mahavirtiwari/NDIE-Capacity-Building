using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Email;

/// <summary>
/// Resolves the SMTP settings actually in force. Anything Super Admin has saved
/// in the portal wins; anything left blank falls back to configuration, so an
/// untouched deployment keeps behaving exactly as appsettings says.
/// </summary>
public interface IEmailSettingsProvider
{
    Task<EmailOptions> GetAsync(CancellationToken ct = default);
}

public class EmailSettingsProvider(NtmsDbContext db, IOptions<EmailOptions> configured)
    : IEmailSettingsProvider
{
    public async Task<EmailOptions> GetAsync(CancellationToken ct = default)
    {
        var fallback = configured.Value;
        var row = await db.EmailSettings.AsNoTracking().FirstOrDefaultAsync(e => e.Id == 1, ct);
        if (row is null) return fallback;

        var host = Pick(row.Host, fallback.Host);

        return new EmailOptions
        {
            /* Sending is only on when it is switched on and there is somewhere
               to send through. */
            Enabled = row.Enabled && !string.IsNullOrWhiteSpace(host),
            Host = host,
            Port = row.Port > 0 ? row.Port : fallback.Port,
            UseSsl = row.UseSsl,
            UserName = Pick(row.UserName, fallback.UserName),
            Password = Pick(row.Password, fallback.Password),
            FromAddress = Pick(row.FromAddress, fallback.FromAddress),
            FromName = Pick(row.FromName, fallback.FromName),
            ReplyTo = PickOptional(row.ReplyTo, fallback.ReplyTo),
            RedirectAllTo = PickOptional(row.RedirectAllTo, fallback.RedirectAllTo),
            TimeoutSeconds = row.TimeoutSeconds > 0 ? row.TimeoutSeconds : fallback.TimeoutSeconds,
            OtpValidityMinutes =
                row.OtpValidityMinutes > 0 ? row.OtpValidityMinutes : fallback.OtpValidityMinutes,
        };
    }

    /// <summary>A blank value in the database means "not overridden".</summary>
    private static string Pick(string? saved, string fallback) =>
        string.IsNullOrWhiteSpace(saved) ? fallback : saved.Trim();

    private static string? PickOptional(string? saved, string? fallback) =>
        string.IsNullOrWhiteSpace(saved) ? fallback : saved.Trim();
}
