using Ntms.Application.Common;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Builds the short codes on the programme-setup masters, so nobody has to
/// invent one. A code left blank is derived from the name — and from the
/// parent's code, where there is a parent — then made unique.
///
/// Anything typed in is still honoured: these codes appear in reports and on
/// certificates, so a division that has its own numbering keeps it.
/// </summary>
internal static class CodeFactory
{
    /// <summary>Longest a generated segment may be, to stay inside the 20-character limit.</summary>
    private const int MaxSegment = 8;

    /// <summary>
    /// Shortens a name to a few capitals. Multi-word names become their
    /// initials when that gives enough to read — "Lean Manufacturing
    /// Competitiveness" becomes LMC — and otherwise the opening letters are
    /// used, so "ZED Certification" becomes ZED rather than the unhelpful ZC.
    /// </summary>
    internal static string Abbreviate(string? name, int length = 3)
    {
        var words = (name ?? string.Empty)
            .Split([' ', '-', '/', ',', '.', '(', ')', '&'], StringSplitOptions.RemoveEmptyEntries)
            .Select(w => new string([.. w.Where(char.IsLetterOrDigit)]).ToUpperInvariant())
            .Where(w => w.Length > 0)
            .ToList();

        if (words.Count == 0) return "GEN";

        if (words.Count > 1)
        {
            var initials = new string([.. words.Select(w => w[0])]);
            if (initials.Length >= length) return Clip(initials);
        }

        var joined = string.Concat(words);
        var derived = Clip(joined.Length <= length ? joined : joined[..length]);

        /* The code format demands at least two characters, and a name like "A"
           would otherwise produce one the validator would reject. */
        return derived.Length >= 2 ? derived : derived.PadRight(2, 'X');
    }

    private static string Clip(string value) =>
        value.Length <= MaxSegment ? value : value[..MaxSegment];

    /// <summary>Joins a parent code to a derived one, e.g. ZED-BRO.</summary>
    internal static string Compose(string? parentCode, string abbreviation)
    {
        var parent = Clip(Formats.Normalise(parentCode) ?? string.Empty);
        return parent.Length == 0 ? abbreviation : $"{parent}-{abbreviation}";
    }

    /// <summary>
    /// Returns the first free code, trying the seed and then numbered variants.
    /// The caller supplies the clash test so each master checks its own table.
    /// </summary>
    internal static async Task<string> UniqueAsync(
        string seed,
        Func<string, CancellationToken, Task<bool>> isTaken,
        CancellationToken ct)
    {
        if (!await isTaken(seed, ct)) return seed;

        for (var suffix = 2; suffix <= 99; suffix++)
        {
            var candidate = $"{seed}{suffix}";
            if (!await isTaken(candidate, ct)) return candidate;
        }

        /* Ninety-nine collisions on one name means the naming, not the
           generator, needs a decision — so ask for one instead of guessing. */
        throw new AppException(
            $"Could not derive a free code from '{seed}'. Please enter one.");
    }
}
