using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// The deployment's own settings: whether the site is open, and how it is set
/// up to take money.
/// </summary>
public class SystemSettingService(NtmsDbContext db)
{
    /// <summary>The gateways the portal offers. Adding one is a code change,
    /// because integrating one is too.</summary>
    public static readonly IReadOnlyList<string> Gateways =
        ["CCAvenue", "Razorpay", "PayU", "BillDesk", "Paytm"];

    /// <summary>
    /// What the ERP may key an invoice on. All four are identifiers this
    /// system already holds against a payment, so whichever the two sides
    /// agreed on can be picked rather than built.
    /// </summary>
    public static readonly IReadOnlyList<string> InvoiceReferences =
        ["OrderId", "TrackingId", "ApplicationNo", "ApplicantCode"];

    private async Task<SystemSetting> LoadAsync(CancellationToken ct)
    {
        var existing = await db.SystemSettings.FirstOrDefaultAsync(s => s.Id == 1, ct);
        if (existing is not null) return existing;

        var seeded = new SystemSetting { Id = 1 };
        db.SystemSettings.Add(seeded);
        await db.SaveChangesAsync(ct);
        return seeded;
    }

    public async Task<SystemSettingsDto> GetAsync(CancellationToken ct) => Map(await LoadAsync(ct));

    /// <summary>
    /// What the sign-in screen is allowed to know without a token: that the
    /// site is closed, and what to say about it. Nothing else leaves here
    /// unauthenticated.
    /// </summary>
    public async Task<MaintenanceStatusDto> StatusAsync(CancellationToken ct)
    {
        var row = await db.SystemSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1, ct);

        return new MaintenanceStatusDto
        {
            MaintenanceMode = row?.MaintenanceMode ?? false,
            Message = row?.MaintenanceMode == true ? Message(row) : null,
            Until = row?.MaintenanceMode == true ? row.MaintenanceUntil : null,
        };
    }

    public async Task<SystemSettingsDto> UpdateAsync(
        SystemSettingsUpdateDto dto, CancellationToken ct)
    {
        var gateway = string.IsNullOrWhiteSpace(dto.PaymentGateway) ? null : dto.PaymentGateway.Trim();
        var reference = Blank(dto.ErpInvoiceReference);

        Guard.Check()
            .When(gateway is not null && !Gateways.Contains(gateway, StringComparer.OrdinalIgnoreCase),
                $"Choose a payment gateway from the list: {string.Join(", ", Gateways)}.")
            .When(dto.MaintenanceMessage?.Length > 500,
                "The maintenance message must be 500 characters or fewer.")
            .When(!IsAbsoluteUrl(dto.ReturnUrl), "The return URL must be a full http or https address.")
            .When(!IsAbsoluteUrl(dto.CancelUrl), "The cancel URL must be a full http or https address.")
            .When(dto.MaxUploadMb is < 1 or > 512,
                "The upload limit must be between 1 MB and 512 MB.")
            .When(!IsAbsoluteUrl(dto.PanEndpoint),
                "The PAN endpoint must be a full http or https address.")
            .When(dto.PanTimeoutSeconds is < 3 or > 60,
                "The PAN timeout must be between 3 and 60 seconds.")
            .When(!IsAbsoluteUrl(dto.ErpInvoiceEndpoint),
                "The ERP invoice endpoint must be a full http or https address.")
            .When(reference is not null
                    && !InvoiceReferences.Contains(reference, StringComparer.OrdinalIgnoreCase),
                $"Choose what the ERP keys an invoice on: {string.Join(", ", InvoiceReferences)}.")
            .When(dto.ErpTimeoutSeconds is < 3 or > 120,
                "The ERP timeout must be between 3 and 120 seconds.")
            .When(dto.ProfileMaxAttempts is < 1 or > 10,
                "Profile attempts must be between 1 and 10.")
            .When(dto.ProfileBlockMonths is < 1 or > 60,
                "The profile block must be between 1 and 60 months.")
            .When(dto.ProgramTypeMaxAttempts is < 1 or > 10,
                "Program type attempts must be between 1 and 10.")
            .ThrowIfInvalid();

        var row = await LoadAsync(ct);

        row.MaintenanceMode = dto.MaintenanceMode;
        row.MaintenanceMessage = Blank(dto.MaintenanceMessage);
        row.MaintenanceUntil = dto.MaintenanceUntil;

        row.PaymentGateway = gateway;
        row.PaymentTestMode = dto.PaymentTestMode;
        row.MerchantId = Blank(dto.MerchantId);
        row.AccessCode = Blank(dto.AccessCode);
        row.ReturnUrl = Blank(dto.ReturnUrl);
        row.CancelUrl = Blank(dto.CancelUrl);

        /* Null means "leave it alone", so the screen never has to round-trip a
           secret it was not shown; an empty string is an explicit clear. */
        if (dto.WorkingKey is not null) row.WorkingKey = Blank(dto.WorkingKey);

        /* Switching payments on with the gateway half configured would send a
           payer to a page that cannot take their money, after they have been
           told a fee is due. Refused, with what is missing named. */
        row.PaymentEnabled = dto.PaymentEnabled;
        if (row.PaymentEnabled && Missing(row) is { Count: > 0 } missing)
        {
            throw new AppException(
                $"Payments cannot be switched on yet — {string.Join(", ", missing)} " +
                (missing.Count == 1 ? "is missing." : "are missing."));
        }

        row.MaxUploadMb = dto.MaxUploadMb;

        row.PanProvider = Blank(dto.PanProvider);
        row.PanEndpoint = Blank(dto.PanEndpoint);
        row.PanApiKeyHeader = Blank(dto.PanApiKeyHeader) ?? "X-API-KEY";
        row.PanValidPath = Blank(dto.PanValidPath) ?? "valid";
        row.PanNamePath = Blank(dto.PanNamePath) ?? "name";
        row.PanTimeoutSeconds = dto.PanTimeoutSeconds;
        row.PanRefuseWhenUnavailable = dto.PanRefuseWhenUnavailable;

        if (dto.PanApiKey is not null) row.PanApiKey = Blank(dto.PanApiKey);

        /* Same rule as the gateway: switched on with nowhere to ask means
           every registration fails a check that never ran. */
        row.PanVerificationEnabled = dto.PanVerificationEnabled;
        if (row.PanVerificationEnabled && PanMissing(row) is { Count: > 0 } lacking)
        {
            throw new AppException(
                $"PAN verification cannot be switched on yet — {string.Join(", ", lacking)} " +
                (lacking.Count == 1 ? "is missing." : "are missing."));
        }

        row.ProfileMaxAttempts = dto.ProfileMaxAttempts;
        row.ProfileBlockMonths = dto.ProfileBlockMonths;
        row.ProgramTypeMaxAttempts = dto.ProgramTypeMaxAttempts;

        row.ErpProvider = Blank(dto.ErpProvider);
        row.ErpInvoiceEndpoint = Blank(dto.ErpInvoiceEndpoint);
        row.ErpApiKeyHeader = Blank(dto.ErpApiKeyHeader) ?? "X-API-KEY";
        row.ErpInvoiceReference = reference ?? "OrderId";
        row.ErpInvoicePdfPath = Blank(dto.ErpInvoicePdfPath);
        row.ErpInvoiceNumberPath = Blank(dto.ErpInvoiceNumberPath);
        row.ErpTimeoutSeconds = dto.ErpTimeoutSeconds;
        row.ErpStoreInvoiceCopy = dto.ErpStoreInvoiceCopy;

        if (dto.ErpApiKey is not null) row.ErpApiKey = Blank(dto.ErpApiKey);

        /* Same rule again: switched on with nowhere to ask means every
           applicant who opens their invoice is shown a failure. */
        row.ErpInvoiceEnabled = dto.ErpInvoiceEnabled;
        if (row.ErpInvoiceEnabled && ErpMissing(row) is { Count: > 0 } wanting)
        {
            throw new AppException(
                $"ERP invoicing cannot be switched on yet — {string.Join(", ", wanting)} " +
                (wanting.Count == 1 ? "is missing." : "are missing."));
        }

        await db.SaveChangesAsync(ct);
        return Map(row);
    }

    /// <summary>What the ERP still needs before an invoice can be fetched.</summary>
    private static List<string> ErpMissing(SystemSetting row)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(row.ErpInvoiceEndpoint)) missing.Add("the endpoint");
        if (string.IsNullOrWhiteSpace(row.ErpApiKey)) missing.Add("the API key");
        return missing;
    }

    /// <summary>What the gateway still needs before it can be used.</summary>
    private static List<string> Missing(SystemSetting row)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(row.PaymentGateway)) missing.Add("the gateway");
        if (string.IsNullOrWhiteSpace(row.MerchantId)) missing.Add("the merchant ID");
        if (string.IsNullOrWhiteSpace(row.AccessCode)) missing.Add("the access code");
        if (string.IsNullOrWhiteSpace(row.WorkingKey)) missing.Add("the working key");
        return missing;
    }

    /// <summary>What the PAN service still needs before it can be used.</summary>
    private static List<string> PanMissing(SystemSetting row)
    {
        var missing = new List<string>();
        if (string.IsNullOrWhiteSpace(row.PanEndpoint)) missing.Add("the endpoint");
        if (string.IsNullOrWhiteSpace(row.PanApiKey)) missing.Add("the API key");
        return missing;
    }

    private static SystemSettingsDto Map(SystemSetting row) => new()
    {
        MaintenanceMode = row.MaintenanceMode,
        MaintenanceMessage = row.MaintenanceMessage,
        MaintenanceUntil = row.MaintenanceUntil,

        PaymentEnabled = row.PaymentEnabled,
        PaymentGateway = row.PaymentGateway,
        PaymentTestMode = row.PaymentTestMode,
        MerchantId = row.MerchantId,
        AccessCode = row.AccessCode,
        HasWorkingKey = !string.IsNullOrWhiteSpace(row.WorkingKey),
        ReturnUrl = row.ReturnUrl,
        CancelUrl = row.CancelUrl,
        PaymentConfigured = Missing(row).Count == 0,

        MaxUploadMb = row.MaxUploadMb,

        PanVerificationEnabled = row.PanVerificationEnabled,
        PanProvider = row.PanProvider,
        PanEndpoint = row.PanEndpoint,
        HasPanApiKey = !string.IsNullOrWhiteSpace(row.PanApiKey),
        PanApiKeyHeader = row.PanApiKeyHeader,
        PanValidPath = row.PanValidPath,
        PanNamePath = row.PanNamePath,
        PanTimeoutSeconds = row.PanTimeoutSeconds,
        PanRefuseWhenUnavailable = row.PanRefuseWhenUnavailable,
        PanConfigured = PanMissing(row).Count == 0,

        ProfileMaxAttempts = row.ProfileMaxAttempts,
        ProfileBlockMonths = row.ProfileBlockMonths,
        ProgramTypeMaxAttempts = row.ProgramTypeMaxAttempts,

        ErpInvoiceEnabled = row.ErpInvoiceEnabled,
        ErpProvider = row.ErpProvider,
        ErpInvoiceEndpoint = row.ErpInvoiceEndpoint,
        HasErpApiKey = !string.IsNullOrWhiteSpace(row.ErpApiKey),
        ErpApiKeyHeader = row.ErpApiKeyHeader,
        ErpInvoiceReference = row.ErpInvoiceReference,
        ErpInvoicePdfPath = row.ErpInvoicePdfPath,
        ErpInvoiceNumberPath = row.ErpInvoiceNumberPath,
        ErpTimeoutSeconds = row.ErpTimeoutSeconds,
        ErpStoreInvoiceCopy = row.ErpStoreInvoiceCopy,
        ErpConfigured = ErpMissing(row).Count == 0,
        ErpInvoiceReferences = InvoiceReferences,

        UpdatedOn = row.ModifiedOn ?? row.CreatedOn,
    };

    /// <summary>
    /// The upload ceiling, in bytes, for whatever is about to be written.
    ///
    /// Read per call rather than cached: it changes rarely, but when somebody
    /// raises it they expect the next upload to go through, not the one after
    /// a recycle.
    /// </summary>
    public async Task<long> MaxUploadBytesAsync(CancellationToken ct)
    {
        var megabytes = await db.SystemSettings.AsNoTracking()
            .Where(s => s.Id == 1).Select(s => (int?) s.MaxUploadMb).FirstOrDefaultAsync(ct);
        return (long) (megabytes ?? 64) * 1024 * 1024;
    }

    /// <summary>
    /// The stored PAN configuration, or null where none is set up. Returned
    /// whole, key included, because the only caller is the verifier itself.
    /// </summary>
    public async Task<SystemSetting?> PanSettingsAsync(CancellationToken ct) =>
        await db.SystemSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1, ct);

    private static string Message(SystemSetting row) =>
        string.IsNullOrWhiteSpace(row.MaintenanceMessage)
            ? "The portal is closed for maintenance. Please try again shortly."
            : row.MaintenanceMessage;

    private static string? Blank(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    /* A relative path would send the payer somewhere the gateway cannot
       resolve, and the failure would only show once money had changed hands. */
    private static bool IsAbsoluteUrl(string? value) =>
        string.IsNullOrWhiteSpace(value)
        || (Uri.TryCreate(value.Trim(), UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps));
}
