using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Invoicing;

/// <summary>What came back, or why nothing did.</summary>
public sealed record FetchedInvoice(
    string? Number,
    string ContentType,
    string FileName,
    byte[] Content);

public sealed record InvoiceFetchResult(FetchedInvoice? Invoice, string? Unavailable)
{
    public static InvoiceFetchResult Got(FetchedInvoice invoice) => new(invoice, null);
    public static InvoiceFetchResult No(string because) => new(null, because);
}

/// <summary>
/// Asks the ERP for an invoice.
///
/// Everything specific to a particular ERP is configuration rather than code:
/// the address, the key and the header it travels in, which of our
/// identifiers the invoice is keyed on, and — when the reply is JSON rather
/// than the document itself — where in that JSON the document and its number
/// sit. Super Admin sets all of it under System Settings, so contracting a
/// different ERP is not a release.
///
/// Two reply shapes are understood, because both are common: the endpoint
/// answers with the PDF directly, or it answers with JSON carrying either the
/// document inline as base64 or an address to fetch it from.
/// </summary>
public class InvoiceFetcher(
    IHttpClientFactory factory,
    NtmsDbContext db,
    ILogger<InvoiceFetcher> logger)
{
    public async Task<InvoiceFetchResult> FetchAsync(
        string reference, string fallbackName, CancellationToken ct)
    {
        var row = await db.SystemSettings.AsNoTracking().FirstOrDefaultAsync(s => s.Id == 1, ct);

        if (row is null || !row.ErpInvoiceEnabled)
            return InvoiceFetchResult.No("Invoices are not switched on yet.");

        if (string.IsNullOrWhiteSpace(row.ErpInvoiceEndpoint))
            return InvoiceFetchResult.No("No invoicing endpoint has been configured.");

        /* The placeholder is optional: an ERP that takes the reference as a
           query parameter has it written into the configured address
           already, and one that takes it in the path uses {reference}. */
        var url = row.ErpInvoiceEndpoint.Replace(
            "{reference}", Uri.EscapeDataString(reference), StringComparison.OrdinalIgnoreCase);

        try
        {
            var client = factory.CreateClient(nameof(InvoiceFetcher));
            client.Timeout = TimeSpan.FromSeconds(Math.Clamp(row.ErpTimeoutSeconds, 3, 120));

            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/pdf"));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            if (!string.IsNullOrWhiteSpace(row.ErpApiKey))
            {
                request.Headers.TryAddWithoutValidation(
                    string.IsNullOrWhiteSpace(row.ErpApiKeyHeader) ? "X-API-KEY" : row.ErpApiKeyHeader,
                    row.ErpApiKey);
            }

            using var response = await client.SendAsync(request, ct);

            /* The ERP saying "not yet" is an ordinary answer, not a fault:
               an invoice raised on a nightly run does not exist the moment
               the money lands. */
            if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
                return InvoiceFetchResult.No("The invoice for this payment has not been raised yet.");

            if (!response.IsSuccessStatusCode)
            {
                /* The reference is ours and harmless; the key is never
                   logged, and neither is the body, which is the invoice. */
                logger.LogWarning(
                    "ERP answered {Status} for invoice {Reference}.",
                    (int)response.StatusCode, reference);
                return InvoiceFetchResult.No("The invoicing system did not answer. Try again shortly.");
            }

            var type = response.Content.Headers.ContentType?.MediaType ?? string.Empty;

            if (type.Contains("pdf", StringComparison.OrdinalIgnoreCase))
            {
                var bytes = await response.Content.ReadAsByteArrayAsync(ct);
                if (bytes.Length == 0)
                    return InvoiceFetchResult.No("The invoicing system returned an empty document.");

                return InvoiceFetchResult.Got(new FetchedInvoice(
                    NameFrom(response) is { Length: > 0 } named ? Number(named) : null,
                    "application/pdf",
                    NameFrom(response) ?? fallbackName,
                    bytes));
            }

            return await FromJsonAsync(response, row.ErpInvoicePdfPath, row.ErpInvoiceNumberPath,
                fallbackName, client, row, ct);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return InvoiceFetchResult.No("The invoicing system timed out. Try again shortly.");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Fetching invoice {Reference} failed.", reference);
            return InvoiceFetchResult.No("The invoicing system could not be reached.");
        }
    }

    /// <summary>
    /// A JSON reply: the document is either inline as base64 or behind an
    /// address, and which it is can be told from the value itself rather
    /// than asking an administrator to declare it.
    /// </summary>
    private async Task<InvoiceFetchResult> FromJsonAsync(
        HttpResponseMessage response,
        string? pdfPath,
        string? numberPath,
        string fallbackName,
        HttpClient client,
        Domain.Entities.SystemSetting row,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(pdfPath))
        {
            logger.LogWarning("ERP answered JSON but no PDF field is configured.");
            return InvoiceFetchResult.No("The invoicing system gave an answer we could not read.");
        }

        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(ct));

        var value = ReadString(document.RootElement, pdfPath);
        if (string.IsNullOrWhiteSpace(value))
            return InvoiceFetchResult.No("The invoice for this payment has not been raised yet.");

        var number = string.IsNullOrWhiteSpace(numberPath)
            ? null
            : ReadString(document.RootElement, numberPath);

        if (Uri.TryCreate(value, UriKind.Absolute, out var link)
            && (link.Scheme == Uri.UriSchemeHttp || link.Scheme == Uri.UriSchemeHttps))
        {
            /* The address came out of the ERP's reply, so the ERP was
               choosing which host this server would call next — from
               inside the network, with the ERP key attached, and the
               answer handed back to whichever applicant asked for their
               invoice. It may only point at itself. */
            if (!SameHostAsConfigured(link, row.ErpInvoiceEndpoint))
            {
                logger.LogWarning(
                    "ERP document link pointed at {Host}, which is not the configured "
                    + "invoicing host. Refused.", link.Host);
                return InvoiceFetchResult.No(
                    "The invoice could not be downloaded. Try again shortly.");
            }

            using var follow = new HttpRequestMessage(HttpMethod.Get, link);
            if (!string.IsNullOrWhiteSpace(row.ErpApiKey))
            {
                follow.Headers.TryAddWithoutValidation(
                    string.IsNullOrWhiteSpace(row.ErpApiKeyHeader) ? "X-API-KEY" : row.ErpApiKeyHeader,
                    row.ErpApiKey);
            }

            using var document2 = await client.SendAsync(follow, ct);
            if (!document2.IsSuccessStatusCode)
            {
                logger.LogWarning("ERP document link answered {Status}.", (int)document2.StatusCode);
                return InvoiceFetchResult.No("The invoice could not be downloaded. Try again shortly.");
            }

            var linked = await document2.Content.ReadAsByteArrayAsync(ct);
            return linked.Length == 0
                ? InvoiceFetchResult.No("The invoicing system returned an empty document.")
                : InvoiceFetchResult.Got(new FetchedInvoice(
                    number,
                    document2.Content.Headers.ContentType?.MediaType ?? "application/pdf",
                    NameFrom(document2) ?? fallbackName,
                    linked));
        }

        /* Not an address, so it is the document itself. A data URI prefix is
           stripped, because some systems send one and some do not. */
        var payload = value.Contains("base64,", StringComparison.OrdinalIgnoreCase)
            ? value[(value.IndexOf("base64,", StringComparison.OrdinalIgnoreCase) + 7)..]
            : value;

        try
        {
            var bytes = Convert.FromBase64String(payload.Trim());
            return bytes.Length == 0
                ? InvoiceFetchResult.No("The invoicing system returned an empty document.")
                : InvoiceFetchResult.Got(
                    new FetchedInvoice(number, "application/pdf", fallbackName, bytes));
        }
        catch (FormatException)
        {
            logger.LogWarning("ERP PDF field was neither an address nor base64.");
            return InvoiceFetchResult.No("The invoicing system gave an answer we could not read.");
        }
    }

    /// <summary>
    /// Whether a link the ERP handed back points at the ERP.
    ///
    /// Host and port must match what an administrator configured. A reply
    /// naming anywhere else is the remote end steering this server, which
    /// is the whole of the attack: loopback, the cloud metadata address,
    /// or an internal service that trusts anything inside the perimeter.
    /// </summary>
    private static bool SameHostAsConfigured(Uri link, string? configured)
    {
        if (string.IsNullOrWhiteSpace(configured)) return false;
        if (!Uri.TryCreate(configured.Trim(), UriKind.Absolute, out var home)) return false;

        return string.Equals(link.Host, home.Host, StringComparison.OrdinalIgnoreCase)
               && link.Port == home.Port
               && string.Equals(link.Scheme, home.Scheme, StringComparison.OrdinalIgnoreCase);
    }

    private static string? NameFrom(HttpResponseMessage response) =>
        response.Content.Headers.ContentDisposition?.FileNameStar
        ?? response.Content.Headers.ContentDisposition?.FileName?.Trim('"');

    /// <summary>The file name without its extension, used where the ERP sends
    /// no number of its own but names the file after one.</summary>
    private static string? Number(string fileName) =>
        Path.GetFileNameWithoutExtension(fileName) is { Length: > 0 } stem ? stem : null;

    /* Dotted paths, so a differently shaped reply is a settings change. */
    private static string? ReadString(JsonElement root, string path)
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

        return current.ValueKind switch
        {
            JsonValueKind.String => current.GetString(),
            JsonValueKind.Number => current.ToString(),
            _ => null,
        };
    }
}
