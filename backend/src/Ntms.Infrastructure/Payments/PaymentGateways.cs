using Ntms.Application.Common;

namespace Ntms.Infrastructure.Payments;

/// <summary>
/// The gateways that are actually wired up, looked up by the name the portal
/// stores.
///
/// System Settings offers a list to choose from, and choosing one is not the
/// same as having integrated it. An unimplemented choice is refused here, by
/// name, at the moment somebody tries to pay — which is far better than a
/// half-built request reaching a gateway that cannot read it.
/// </summary>
public class PaymentGateways(IEnumerable<IPaymentGateway> gateways)
{
    private readonly Dictionary<string, IPaymentGateway> _byName =
        gateways.ToDictionary(g => g.Name, StringComparer.OrdinalIgnoreCase);

    public IPaymentGateway For(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new AppException("No payment gateway has been chosen in System Settings.");

        if (_byName.TryGetValue(name.Trim(), out var gateway)) return gateway;

        throw new AppException(
            $"{name.Trim()} is on the list of gateways but is not integrated yet. " +
            $"The ones that work are: {string.Join(", ", _byName.Keys.Order())}.");
    }

    public bool Handles(string? name) =>
        !string.IsNullOrWhiteSpace(name) && _byName.ContainsKey(name.Trim());
}
