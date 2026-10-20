namespace Ntms.Domain.Common;

/// <summary>
/// How a person's name is put together, in one place.
///
/// The parts are stored separately and the whole is stored beside them,
/// because both are wanted and neither can be derived from the other
/// without guessing: a scheme addresses somebody by their given name,
/// sorts by their family name, and prints the whole on a certificate.
///
/// Composing here rather than at each of the places that read a name is
/// what keeps the three consistent. Splitting here, likewise, is used
/// once — to recover the parts from the names recorded before there were
/// two columns to put them in.
/// </summary>
public static class Naming
{
    /// <summary>The two parts as one name, with no stray spacing.</summary>
    public static string Compose(string? first, string? last)
    {
        var given = (first ?? string.Empty).Trim();
        var family = (last ?? string.Empty).Trim();

        if (given.Length == 0) return family;
        if (family.Length == 0) return given;
        return $"{given} {family}";
    }

    /// <summary>
    /// A whole name split back into its parts, for records written before
    /// the parts were asked for separately.
    ///
    /// The last word is the family name and everything before it is the
    /// given name, which is the convention these records were entered
    /// under. It is a guess, and only ever applied to names that have no
    /// better answer available — a single word stays whole, as a given
    /// name, because somebody with one name has a given name and no
    /// family name rather than the other way round.
    /// </summary>
    public static (string First, string Last) Split(string? whole)
    {
        var parts = (whole ?? string.Empty)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        return parts.Length switch
        {
            0 => (string.Empty, string.Empty),
            1 => (parts[0], string.Empty),
            _ => (string.Join(' ', parts[..^1]), parts[^1]),
        };
    }
}
