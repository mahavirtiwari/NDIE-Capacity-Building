namespace Ntms.Application.Common;

/// <summary>
/// The educational qualification ladder used for programme eligibility.
///
/// Held as an ordered catalogue rather than free text. The field states a
/// <b>minimum</b>, so the values have to be comparable — "is this applicant at
/// or above the bar" is not a question you can ask of a sentence like
/// "Graduate / Diploma in Engineering". <see cref="Level.Rank"/> is what makes
/// that comparison possible.
///
/// Records store <see cref="Level.Code"/>; screens show <see cref="Level.Label"/>.
/// Keeping them apart means the wording can be reworded without touching
/// stored data.
///
/// <para>
/// The catalogue itself lives in the database — administrators add rungs from
/// the Qualifications screen — and this class holds a read-only copy of it so
/// that the places which only need a label (DTO mapping, the public catalogue,
/// the applicant app) do not each have to query for one. The copy is replaced
/// by <see cref="Replace"/> at start-up and after every edit.
/// </para>
/// <para>
/// Anything that <i>decides</i> something — the dropdown the administrator
/// picks from, the check that a submitted code exists — reads the database
/// directly instead of this copy, so a stale copy can never reject a rung that
/// was just added. The worst a stale copy can do is show a code where a label
/// was expected, which is what an unrecognised value has always looked like.
/// </para>
/// </summary>
public static class QualificationLevels
{
    /// <param name="Active">False for a rung that is still referenced by older
    /// records but is no longer offered on the form.</param>
    public sealed record Level(string Code, string Label, int Rank, bool Active = true);

    public const string None = "NONE";

    /// <summary>
    /// What a database that has never been edited contains: the ladder the
    /// system ships with. The gaps between ranks leave room to slot a rung in
    /// without renumbering, and this is what the first migration seeds.
    /// </summary>
    public static readonly IReadOnlyList<Level> Defaults =
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

    private static readonly Dictionary<string, Level> BuiltIn =
        Defaults.ToDictionary(l => l.Code, StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// The current copy. Swapped whole rather than mutated, so a reader either
    /// sees the catalogue as it was or as it now is, never half of each.
    /// </summary>
    private sealed record Snapshot(IReadOnlyList<Level> Levels, Dictionary<string, Level> ByCode);

    private static Snapshot _current = Build(Defaults);

    private static Snapshot Build(IEnumerable<Level> levels)
    {
        var ordered = levels.OrderBy(l => l.Rank).ThenBy(l => l.Label).ToList();
        /* First one wins on a duplicate code: the database enforces uniqueness,
           and a dictionary that throws would take the application down over a
           display label. */
        var byCode = new Dictionary<string, Level>(StringComparer.OrdinalIgnoreCase);
        foreach (var level in ordered) byCode.TryAdd(level.Code, level);
        return new Snapshot(ordered, byCode);
    }

    /// <summary>Installs the catalogue as the database now holds it.</summary>
    public static void Replace(IEnumerable<Level> levels)
    {
        var built = Build(levels);
        /* Never leave the application with nothing to show a label from. An
           empty read — a table not yet migrated, a query that came back with
           nothing — keeps what is already loaded. */
        if (built.Levels.Count == 0) return;
        Volatile.Write(ref _current, built);
    }

    /// <summary>Every rung, offered or not, lowest first.</summary>
    public static IReadOnlyList<Level> All => Volatile.Read(ref _current).Levels;

    /// <summary>The rungs a form may offer, lowest first.</summary>
    public static IReadOnlyList<Level> Selectable =>
        [.. Volatile.Read(ref _current).Levels.Where(l => l.Active)];

    /// <summary>True for a code in the catalogue. Blank is allowed and means no minimum.</summary>
    public static bool IsValid(string? code) =>
        string.IsNullOrWhiteSpace(code) || Volatile.Read(ref _current).ByCode.ContainsKey(code.Trim());

    /// <summary>The stored form: trimmed and upper case, or null when blank.</summary>
    public static string? Normalise(string? code) =>
        string.IsNullOrWhiteSpace(code) ? null : code.Trim().ToUpperInvariant();

    /// <summary>Display text for a stored code.</summary>
    public static string? LabelFor(string? code)
    {
        if (string.IsNullOrWhiteSpace(code)) return null;
        return Volatile.Read(ref _current).ByCode.TryGetValue(code.Trim(), out var level)
            ? level.Label
            /* An unrecognised value is shown as-is rather than hidden, so
               anything the migration could not place stays visible. */
            : code;
    }

    public static int RankOf(string? code) =>
        code is not null && Volatile.Read(ref _current).ByCode.TryGetValue(code.Trim(), out var level)
            ? level.Rank
            : 0;

    /// <summary>
    /// Best-effort reading of the free text this field used to hold.
    ///
    /// Where a phrase names several levels — "Graduate / Diploma in
    /// Engineering" — the <b>lowest</b> is taken, because that is the bar the
    /// sentence actually sets: a diploma holder was always eligible.
    /// Returns null when nothing matches, so the caller can leave it alone.
    ///
    /// Reads the shipped ladder, not the current catalogue: it is interpreting
    /// text written before the catalogue existed, and must give the same answer
    /// however the catalogue has since been edited.
    /// </summary>
    public static string? Interpret(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        if (IsValid(text.Trim())) return Normalise(text);

        var lower = text.ToLowerInvariant();
        var hits = new List<Level>();

        void Match(string code, params string[] needles)
        {
            if (needles.Any(lower.Contains)) hits.Add(BuiltIn[code]);
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
