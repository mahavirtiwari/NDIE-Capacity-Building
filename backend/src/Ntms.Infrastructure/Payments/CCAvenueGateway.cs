using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Ntms.Application.Common;

namespace Ntms.Infrastructure.Payments;

/// <summary>
/// CCAvenue, the gateway this deployment is set up for: the settings screen
/// asks for a merchant id, an access code and a working key, which is exactly
/// the set CCAvenue issues.
///
/// The wire format is theirs, not a choice made here: parameters joined with
/// ampersands, encrypted with AES-128-CBC under the MD5 of the working key,
/// with the fixed initialisation vector they publish, and sent as hex. The
/// same treatment in reverse reads the answer.
/// </summary>
public sealed class CCAvenueGateway : IPaymentGateway
{
    public string Name => "CCAvenue";

    private const string LiveUrl =
        "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction";
    private const string TestUrl =
        "https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction";

    /* CCAvenue's published IV: 0x00 through 0x0f. Fixed by them, not by us —
       which is one of the reasons the order id is never reused. */
    private static readonly byte[] Iv =
        [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
         0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f];

    public GatewayRedirect BuildRedirect(GatewayRequest request)
    {
        var parameters = new Dictionary<string, string?>
        {
            ["merchant_id"] = request.MerchantId,
            ["order_id"] = request.OrderId,
            ["amount"] = request.Amount.ToString("F2", CultureInfo.InvariantCulture),
            ["currency"] = request.Currency,
            ["redirect_url"] = request.RedirectUrl,
            ["cancel_url"] = request.CancelUrl,
            ["language"] = "EN",
            ["billing_name"] = request.PayerName,
            ["billing_email"] = request.PayerEmail,
            ["billing_tel"] = request.PayerMobile,
            ["merchant_param1"] = request.Description,
        };

        /* Their parser splits on & and =, so a value carrying either would be
           read as two parameters. Encoding is what keeps a name with an
           ampersand in it from rewriting the instruction. */
        var joined = string.Join('&', parameters
            .Where(pair => !string.IsNullOrWhiteSpace(pair.Value))
            .Select(pair => $"{pair.Key}={Uri.EscapeDataString(pair.Value!)}"));

        return new GatewayRedirect
        {
            PostUrl = request.TestMode ? TestUrl : LiveUrl,
            Fields = new Dictionary<string, string>
            {
                ["encRequest"] = Encrypt(joined, request.WorkingKey),
                ["access_code"] = request.AccessCode,
            },
        };
    }

    public GatewayOutcome ReadOutcome(string payload, string workingKey)
    {
        var plain = Decrypt(payload, workingKey);
        var values = Parse(plain);

        var status = Value(values, "order_status") ?? "Unknown";

        return new GatewayOutcome
        {
            OrderId = Value(values, "order_id") ?? string.Empty,
            RawStatus = status,
            Succeeded = status.Equals("Success", StringComparison.OrdinalIgnoreCase),
            Cancelled = status.Equals("Aborted", StringComparison.OrdinalIgnoreCase),
            Amount = decimal.TryParse(Value(values, "amount"),
                NumberStyles.Any, CultureInfo.InvariantCulture, out var amount)
                ? amount
                : null,
            Method = Value(values, "payment_mode"),
            TrackingId = Value(values, "tracking_id"),
            BankReference = Value(values, "bank_ref_no"),
            Message = Value(values, "failure_message") is { Length: > 0 } failure
                ? failure
                : Value(values, "status_message"),
        };
    }

    /* ----------------------------------------------------------- crypto */

    private static string Encrypt(string plain, string workingKey)
    {
        using var aes = Create(workingKey);
        using var encryptor = aes.CreateEncryptor();

        var bytes = Encoding.UTF8.GetBytes(plain);
        var cipher = encryptor.TransformFinalBlock(bytes, 0, bytes.Length);
        return Convert.ToHexStringLower(cipher);
    }

    private static string Decrypt(string hex, string workingKey)
    {
        byte[] cipher;
        try
        {
            cipher = Convert.FromHexString(hex.Trim());
        }
        catch (FormatException)
        {
            throw new AppException("The gateway's response could not be read.");
        }

        using var aes = Create(workingKey);
        using var decryptor = aes.CreateDecryptor();

        try
        {
            var plain = decryptor.TransformFinalBlock(cipher, 0, cipher.Length);
            return Encoding.UTF8.GetString(plain);
        }
        catch (CryptographicException)
        {
            /* Either the response was not theirs or the working key on file is
               not the one they signed with. Both mean the same thing here:
               nothing in it can be believed. */
            throw new AppException("The gateway's response could not be verified.");
        }
    }

    private static Aes Create(string workingKey)
    {
        var aes = Aes.Create();
        aes.Mode = CipherMode.CBC;
        aes.Padding = PaddingMode.PKCS7;
        aes.Key = MD5.HashData(Encoding.UTF8.GetBytes(workingKey));
        aes.IV = Iv;
        return aes;
    }

    private static Dictionary<string, string> Parse(string plain)
    {
        var values = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        foreach (var pair in plain.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var split = pair.IndexOf('=');
            if (split <= 0) continue;

            var key = pair[..split];
            var value = pair[(split + 1)..];
            values[key] = Uri.UnescapeDataString(value);
        }

        return values;
    }

    private static string? Value(Dictionary<string, string> values, string key) =>
        values.TryGetValue(key, out var found) && !string.IsNullOrWhiteSpace(found)
            ? found.Trim()
            : null;
}
