using Microsoft.EntityFrameworkCore;
using Ntms.Domain.Common;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Issues the system generated identities. These codes — not the e-mail
/// address — are what users and applicants sign in with and what every other
/// record refers to, so they are allocated here and never edited afterwards.
/// </summary>
public interface ICodeGenerator
{
    Task<string> NextUserCodeAsync(BaseRole role, CancellationToken ct = default);
    Task<string> NextApplicantCodeAsync(CancellationToken ct = default);
    Task<string> NextApplicationNoAsync(CancellationToken ct = default);
    Task<string> NextProgrammeIdAsync(CancellationToken ct = default);
}

public class CodeGenerator(NtmsDbContext db) : ICodeGenerator
{
    public async Task<string> NextUserCodeAsync(BaseRole role, CancellationToken ct = default)
    {
        var prefix = role switch
        {
            BaseRole.SuperAdmin => "SA",
            BaseRole.Admin => "AD",
            BaseRole.OperationManager => "OM",
            BaseRole.Coordinator => "CO",
            BaseRole.AgencyAdmin => "AG",
            BaseRole.Ministry => "MIN",
            _ => "US",
        };

        var last = await db.Users
            .Where(u => u.UserCode.StartsWith(prefix))
            .OrderByDescending(u => u.UserCode)
            .Select(u => u.UserCode)
            .FirstOrDefaultAsync(ct);

        var next = ParseTrailingNumber(last, prefix.Length) + 1;
        return $"{prefix}{next:D4}";
    }

    public async Task<string> NextApplicantCodeAsync(CancellationToken ct = default)
    {
        const string prefix = "APP";

        /* Only codes with this prefix, the way every other generator here
           does it. Without the filter a database that also holds sample
           accounts (SMP...) sorted one of those to the top, parsed a small
           number out of it, fell back to the floor and minted a code that
           already existed - which surfaced as "could not be saved" on
           sign-up and could not be retried past. */
        var last = await db.Applicants
            .Where(a => a.ApplicantCode.StartsWith(prefix))
            .OrderByDescending(a => a.ApplicantCode)
            .Select(a => a.ApplicantCode)
            .FirstOrDefaultAsync(ct);

        var seed = ParseTrailingNumber(last, prefix.Length);
        var next = seed < 240000 ? 240001 : seed + 1;
        return $"{prefix}{next}";
    }

    public async Task<string> NextApplicationNoAsync(CancellationToken ct = default)
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"APL/{year}/";

        var last = await db.Applications
            .Where(a => a.ApplicationNo.StartsWith(prefix))
            .OrderByDescending(a => a.ApplicationNo)
            .Select(a => a.ApplicationNo)
            .FirstOrDefaultAsync(ct);

        var seed = ParseTrailingNumber(last, prefix.Length);
        var next = seed < 1000 ? 1001 : seed + 1;
        return $"{prefix}{next}";
    }

    public async Task<string> NextProgrammeIdAsync(CancellationToken ct = default)
    {
        const string prefix = "ZEDTP";
        var last = await db.Programmes
            .Where(p => p.ProgrammeId.StartsWith(prefix))
            .OrderByDescending(p => p.ProgrammeId)
            .Select(p => p.ProgrammeId)
            .FirstOrDefaultAsync(ct);

        var seed = ParseTrailingNumber(last, prefix.Length);
        var next = seed < 4500 ? 4501 : seed + 1;
        return $"{prefix}{next}";
    }

    private static int ParseTrailingNumber(string? code, int prefixLength)
    {
        if (string.IsNullOrWhiteSpace(code) || code.Length <= prefixLength) return 0;
        return int.TryParse(code[prefixLength..], out var value) ? value : 0;
    }
}
