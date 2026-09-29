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

        Guard.Check()
            .When(gateway is not null && !Gateways.Contains(gateway, StringComparer.OrdinalIgnoreCase),
                $"Choose a payment gateway from the list: {string.Join(", ", Gateways)}.")
            .When(dto.MaintenanceMessage?.Length > 500,
                "The maintenance message must be 500 characters or fewer.")
            .When(!IsAbsoluteUrl(dto.ReturnUrl), "The return URL must be a full http or https address.")
            .When(!IsAbsoluteUrl(dto.CancelUrl), "The cancel URL must be a full http or https address.")
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

        await db.SaveChangesAsync(ct);
        return Map(row);
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

        UpdatedOn = row.ModifiedOn ?? row.CreatedOn,
    };

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
