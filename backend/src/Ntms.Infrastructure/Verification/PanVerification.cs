using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Verification;

/// <summary>
/// What a PAN check can come back with.
///
/// Three outcomes, not two. A provider that is down, rate limited or timing
/// out has not told us the PAN is wrong — it has told us nothing — and an
/// applicant must not be turned away because a third party had a bad morning.
/// <see cref="Unavailable"/> exists so the caller has to decide what to do
/// about that rather than falling into the same branch as a rejection.
/// </summary>
public enum PanCheck
{
    Valid = 1,
    Invalid = 2,
    Unavailable = 3,
}

public record PanVerificationResult(
    PanCheck Outcome,
    /// <summary>The name the authority holds, when the provider returns one.</summary>
    string? RegisteredName,
    /// <summary>Reader-facing, and safe to show: never the provider's raw error.</summary>
    string Message)
{
    public static PanVerificationResult Valid(string? name) =>
        new(PanCheck.Valid, name, "PAN verified.");

    public static PanVerificationResult Invalid(string message) =>
        new(PanCheck.Invalid, null, message);

    public static PanVerificationResult Unavailable(string message) =>
        new(PanCheck.Unavailable, null, message);
}

public interface IPanVerifier
{
    /// <summary>True when a provider is configured and switched on.</summary>
    bool IsConfigured { get; }

    Task<PanVerificationResult> VerifyAsync(string pan, string? nameToMatch, CancellationToken ct = default);
}

public class PanVerificationOptions
{
    public const string SectionName = "Verification:Pan";

    /// <summary>
    /// Off by default. Nothing about the government's PAN service is decided
    /// here, and turning this on before a provider is contracted would fail
    /// every registration.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>The provider's endpoint. Whoever is procured, it is a POST of a PAN.</summary>
    public string? Endpoint { get; set; }

    /// <summary>Sent as the value of <see cref="ApiKeyHeader"/>.</summary>
    public string? ApiKey { get; set; }

    public string ApiKeyHeader { get; set; } = "X-API-KEY";

    /// <summary>
    /// Where to read the answer from in the provider's JSON, as dotted paths,
    /// so a change of provider is configuration rather than a deployment.
    /// </summary>
    public string ValidPath { get; set; } = "valid";
    public string NamePath { get; set; } = "name";

    public int TimeoutSeconds { get; set; } = 10;

    /// <summary>
    /// What to do when the provider cannot be reached. False - the default -
    /// lets the registration through and leaves the applicant Pending, so an
    /// outage does not close the scheme to new applicants. True refuses, for
    /// when a verified PAN is a hard requirement.
    /// </summary>
    public bool RefuseWhenUnavailable { get; set; }
}

/// <summary>
/// The shape of a PAN, checked locally.
///
/// Five letters, four digits, a letter. The fourth character is the holder
/// type and the fifth is the first letter of the surname, which is why a
/// pattern catches most typos long before a paid API call does.
/// </summary>
public static class PanFormat
{
    private static readonly Regex Pattern =
        new("^[A-Z]{5}[0-9]{4}[A-Z]$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static bool IsWellFormed(string? pan) =>
        !string.IsNullOrWhiteSpace(pan) && Pattern.IsMatch(pan.Trim().ToUpperInvariant());

    public static string Normalise(string pan) => pan.Trim().ToUpperInvariant();
}

/// <summary>
/// Calls whichever PAN service has been configured, and checks the format
/// whether one has been or not.
///
/// The provision is deliberately thin. No PAN provider has been procured, and
/// writing to an imagined contract would mean rewriting this when the real one
/// arrives. What is fixed is everything that does not depend on the provider:
/// the format check, the three outcomes, where the key is read from, and what
/// happens when the service is down.
/// </summary>
public class PanVerifier(
    IHttpClientFactory factory,
    IOptions<PanVerificationOptions> options,
    NtmsDbContext db,
    ILogger<PanVerifier> logger) : IPanVerifier
{
    private readonly PanVerificationOptions _fallback = options.Value;

    /// <summary>
    /// What the deployment is actually set up with.
    ///
    /// System Settings first, appsettings behind it. The portal is where a
    /// department contracts a provider and puts its key in, and that must not
    /// need a deployment; the file stays as the way to configure an
    /// environment that has no database to read yet.
    /// </summary>
    private async Task<PanVerificationOptions> SettingsAsync(CancellationToken ct)
    {
        var row = await db.SystemSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1, ct);
        if (row is null || !row.PanVerificationEnabled) return _fallback;

        return new PanVerificationOptions
        {
            Enabled = true,
            Endpoint = row.PanEndpoint,
            ApiKey = row.PanApiKey,
            ApiKeyHeader = string.IsNullOrWhiteSpace(row.PanApiKeyHeader)
                ? _fallback.ApiKeyHeader
                : row.PanApiKeyHeader,
            ValidPath = string.IsNullOrWhiteSpace(row.PanValidPath) ? _fallback.ValidPath : row.PanValidPath,
            NamePath = string.IsNullOrWhiteSpace(row.PanNamePath) ? _fallback.NamePath : row.PanNamePath,
            TimeoutSeconds = row.PanTimeoutSeconds,
            RefuseWhenUnavailable = row.PanRefuseWhenUnavailable,
        };
    }

    /// <summary>
    /// Whether a provider is set up at all. Reads the database, so it is the
    /// one property here that is not free — callers ask it once.
    /// </summary>
    public bool IsConfigured
    {
        get
        {
            var settings = SettingsAsync(CancellationToken.None).GetAwaiter().GetResult();
            return settings.Enabled && !string.IsNullOrWhiteSpace(settings.Endpoint);
        }
    }

    public async Task<PanVerificationResult> VerifyAsync(
        string pan, string? nameToMatch, CancellationToken ct = default)
    {
        if (!PanFormat.IsWellFormed(pan))
        {
            return PanVerificationResult.Invalid("PAN must be 10 characters, e.g. ABCDE1234F.");
        }

        var settings = await SettingsAsync(ct);

        /* No provider: the format is all anyone has claimed to check, and the
           applicant stays Pending. Saying "verified" here would be a lie the
           rest of the system would then rely on. */
        if (!settings.Enabled || string.IsNullOrWhiteSpace(settings.Endpoint))
            return PanVerificationResult.Unavailable("PAN verification is not switched on.");

        var normalised = PanFormat.Normalise(pan);

        try
        {
            var client = factory.CreateClient(nameof(PanVerifier));
            client.Timeout = TimeSpan.FromSeconds(settings.TimeoutSeconds);

            using var request = new HttpRequestMessage(HttpMethod.Post, settings.Endpoint);
            if (!string.IsNullOrWhiteSpace(settings.ApiKey))
            {
                request.Headers.TryAddWithoutValidation(settings.ApiKeyHeader, settings.ApiKey);
            }
            request.Content = JsonContent.Create(new { pan = normalised, name = nameToMatch });

            using var response = await client.SendAsync(request, ct);

            if (!response.IsSuccessStatusCode)
            {
                /* The PAN is never written to the log. The status is enough to
                   diagnose a provider problem, and the number itself is exactly
                   the kind of thing that should not sit in a log file. */
                logger.LogWarning("PAN provider answered {Status}.", (int)response.StatusCode);
                return PanVerificationResult.Unavailable("The PAN service did not answer. Try again shortly.");
            }

            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));

            var valid = ReadBoolean(document.RootElement, settings.ValidPath);
            if (valid is null)
            {
                logger.LogWarning("PAN provider answered without {Path}.", settings.ValidPath);
                return PanVerificationResult.Unavailable("The PAN service gave an answer we could not read.");
            }

            return valid.Value
                ? PanVerificationResult.Valid(ReadString(document.RootElement, settings.NamePath))
                : PanVerificationResult.Invalid("This PAN could not be verified.");
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return PanVerificationResult.Unavailable("The PAN service timed out. Try again shortly.");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "PAN verification failed before an answer was read.");
            return PanVerificationResult.Unavailable("The PAN service could not be reached.");
        }
    }

    /* Dotted paths, so a differently shaped response is a settings change. */

    private static JsonElement? Walk(JsonElement root, string path)
    {
        var current = root;
        foreach (var part in path.Split('.', StringSplitOptions.RemoveEmptyEntries))
        {
            if (current.ValueKind != JsonValueKind.Object ||
                !current.TryGetProperty(part, out var next))
            {
                return null;
            }
            current = next;
        }
        return current;
    }

    private static bool? ReadBoolean(JsonElement root, string path) => Walk(root, path) switch
    {
        { ValueKind: JsonValueKind.True } => true,
        { ValueKind: JsonValueKind.False } => false,
        /* Some providers answer "VALID", "Y" or 1 rather than a boolean. */
        { ValueKind: JsonValueKind.String } s =>
            s.GetString()?.Trim().ToUpperInvariant() is "TRUE" or "VALID" or "Y" or "YES" or "1",
        { ValueKind: JsonValueKind.Number } n => n.TryGetInt32(out var i) ? i == 1 : null,
        _ => null,
    };

    private static string? ReadString(JsonElement root, string path) =>
        Walk(root, path) is { ValueKind: JsonValueKind.String } s ? s.GetString() : null;
}
