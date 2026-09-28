namespace Ntms.Application.Common;

/// <summary>
/// Rounding for anything a person is told a number for.
///
/// <see cref="Math.Round(decimal, int)"/> rounds a midpoint to the nearest
/// even digit — 0.125 becomes 0.12 and 0.135 becomes 0.14. That is the right
/// default for a long run of figures that should not drift upwards, and the
/// wrong one for a mark: a candidate told 0.12 when every calculator they own
/// says 0.13 has found a discrepancy, and explaining bankers' rounding is not
/// an answer they will accept.
/// </summary>
public static class Rounding
{
    /// <summary>Two decimal places, midpoints away from zero.</summary>
    public static decimal Half(decimal value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);
}
