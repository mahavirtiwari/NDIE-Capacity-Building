namespace Ntms.Infrastructure.Payments;

/// <summary>What the gateway needs to be told about one attempt.</summary>
public sealed class GatewayRequest
{
    public required string OrderId { get; init; }
    public required decimal Amount { get; init; }
    public required string Currency { get; init; }

    public required string MerchantId { get; init; }
    public required string AccessCode { get; init; }
    public required string WorkingKey { get; init; }
    public required bool TestMode { get; init; }

    /// <summary>Where the gateway posts its answer. Always our own callback.</summary>
    public required string RedirectUrl { get; init; }

    /// <summary>Where it sends somebody who backs out.</summary>
    public required string CancelUrl { get; init; }

    public string? PayerName { get; init; }
    public string? PayerEmail { get; init; }
    public string? PayerMobile { get; init; }

    /// <summary>Shown on the gateway's own page, so the payer knows what for.</summary>
    public string? Description { get; init; }
}

/// <summary>
/// A form the payer's browser submits to the gateway.
///
/// A form and not a link, because every gateway worth using takes its
/// instruction as a signed POST body. The API renders it as a page that
/// submits itself; nothing in it is secret to the payer, whose own browser
/// is carrying it.
/// </summary>
public sealed class GatewayRedirect
{
    public required string PostUrl { get; init; }
    public required IReadOnlyDictionary<string, string> Fields { get; init; }
}

/// <summary>What the gateway said happened, once its answer is unwrapped.</summary>
public sealed class GatewayOutcome
{
    public required string OrderId { get; init; }

    /// <summary>Success, Failure, Aborted or Invalid, in the gateway's words.</summary>
    public required string RawStatus { get; init; }

    public bool Succeeded { get; init; }
    public bool Cancelled { get; init; }

    public decimal? Amount { get; init; }
    public string? Method { get; init; }
    public string? TrackingId { get; init; }
    public string? BankReference { get; init; }
    public string? Message { get; init; }
}

/// <summary>
/// One payment gateway, as far as this system is concerned: somewhere to send
/// the payer, and a way to read what comes back.
///
/// An interface rather than a switch inside the service, because the portal
/// offers five gateways and only the one wired up can actually take money.
/// Adding the next one is a class here, not a change to the flow.
/// </summary>
public interface IPaymentGateway
{
    /// <summary>As named in System Settings.</summary>
    string Name { get; }

    GatewayRedirect BuildRedirect(GatewayRequest request);

    /// <summary>
    /// Reads the gateway's posted answer. <paramref name="payload"/> is
    /// whatever that gateway posts back — for CCAvenue the encrypted blob.
    /// </summary>
    GatewayOutcome ReadOutcome(string payload, string workingKey);
}
