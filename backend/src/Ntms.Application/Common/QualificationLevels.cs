namespace Ntms.Application.Common;

/// <summary>
/// The educational qualification ladder used for programme eligibility.
///
/// Held as a fixed, ordered catalogue rather than free text. The field states a
/// <b>minimum</b>, so the values have to be comparable — "is this applicant at
/// or above the bar" is not a question you can ask of a sentence like
/// "Graduate / Diploma in Engineering". <see cref="Rank"/> is what makes that
/// comparison possible, and the gaps between ranks leave room to slot a level
/// in later without renumbering.
///
/// Records store <see cref="Code"/>; screens show <see cref="Label"/>. Keeping
/// them apart means the wording can be reworded without touching stored data.
/// </summary>
public static class QualificationLevels
{
    public sealed record Level(string Code, string Label, int Rank);

    public const string None = "NONE";

    public static readonly IReadOnlyList<Level> All =
    [
        new(None, "No minimum", 0),
        new("CLASS_8", "Class 8 (Middle)", 10),
        new("CLASS_10", "Class 10 (Secondary)", 20),
        new("CLASS_12", "Class 12 (Higher Secondary)", 30),
        new("ITI", "ITI", 40),
        new("DIPLOMA", "Diploma", 50),
        new("GRADUATION", "Graduation", 60),
        new("POST_GRADUATION", "Post Graduation", 70),
        new("DOCTORATE", "Doctorate", 80),
    ];

    private static readonly Dictionary<string, Level> ByCode =
        All.ToDictionary(l => l.Code, StringComparer.OrdinalIgnoreCase);

    /// <summary>True for a code in the catalogue. Blank is allowed and means no minimum.</summary>
    public static bool IsValid(string? code) =>
        string.IsNullOrWhiteSpace(code) || ByCode.ContainsKey(code.Trim());

    /// <summary>The stored form: trimmed and upper case, or null when blank.</summary>
    public static string? Normalise(string? code) =>
        string.IsNullOrWhiteSpace(code) ? null : code.Trim().ToUpperInvariant();

    /// <summary>Display text for a stored code.</summary>
    public static string? LabelFor(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        return ByCode.TryGetValue(code.Trim(), out var level)
            ? level.Label
            /* An unrecognised value is shown as-is rather than hidden, so
               anything the migration could not place stays visible. */
            : code;
    }

    public static int RankOf(string? code) =>
        code is not null && ByCode.TryGetValue(code.Trim(), out var level) ? level.Rank : 0;

    /// <summary>
    /// Best-effort reading of the free text this field used to hold.
    ///
    /// Where a phrase names several levels — "Graduate / Diploma in
    /// Engineering" — the <b>lowest</b> is taken, because that is the bar the
    /// sentence actually sets: a diploma holder was always eligible.
    /// Returns null when nothing matches, so the caller can leave it alone.
    /// </summary>
    public static string? Interpret(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        if (ByCode.ContainsKey(text.Trim())) return Normalise(text);

        var lower = text.ToLowerInvariant();
        var hits = new List<Level>();

        void Match(string code, params string[] needles)
        {
            if (needles.Any(lower.Contains)) hits.Add(ByCode[code]);
        }

        Match("DOCTORATE", "doctor", "ph.d", "phd");
        Match("POST_GRADUATION", "post grad", "postgrad", "post-grad", "masters", "master's",
            "m.tech", "mtech", "m.e.", "mba", "m.sc", "msc");
        Match("GRADUATION", "graduat", "degree", "bachelor", "b.e", "be/", "b.tech", "btech",
            "b.sc", "bsc", "b.com", "bcom");
        Match("DIPLOMA", "diploma");
        Match("ITI", "iti");
        Match("CLASS_12", "class 12", "12th", "higher secondary", "intermediate", "+2");
        Match("CLASS_10", "class 10", "10th", "secondary", "matric", "sslc");
        Match("CLASS_8", "class 8", "8th", "middle");

        return hits.Count == 0 ? null : hits.OrderBy(h => h.Rank).First().Code;
    }
}
