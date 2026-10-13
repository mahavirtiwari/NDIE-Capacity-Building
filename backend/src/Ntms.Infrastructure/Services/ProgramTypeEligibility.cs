using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Whether an applicant's profile clears the bar a programme type sets, and
/// how that bar reads.
///
/// A type may state more than one way in — a graduate with five years, or a
/// diploma holder with eight — and any one of them is enough. Three screens
/// ask this question: the tracks on the applicant's home screen, the dated
/// batches they register from, and the register call itself. They used to
/// ask it in two different ways, which is how a card said Register and the
/// server said no.
///
/// Static and passed the context, because the answer is a reading of stored
/// data with nothing of its own to hold, and because the two services that
/// need it already take enough constructor arguments.
/// </summary>
public static class ProgramTypeEligibility
{
    /// <summary>
    /// What one accepted profile says about qualification and experience.
    ///
    /// Each answer carries a flag rather than a default, because "they did
    /// not say" and "they said none" are different things and only the
    /// second is a reason to close a programme. A dimension the form never
    /// nominated a field for is not measured at all, and a bar that cannot
    /// be measured against does not stand: the officer who accepted the
    /// profile is the one who checked it.
    /// </summary>
    public sealed record Profile(
        bool HasQualification,
        string? QualificationCode,
        int QualificationRank,
        bool HasExperience,
        decimal ExperienceYears)
    {
        /// <summary>Nothing read, so nothing measured.</summary>
        public static readonly Profile Unknown = new(false, null, 0, false, 0m);

        /// <summary>How this profile reads on a refusal.</summary>
        public string Describe()
        {
            var parts = new List<string>();
            if (HasQualification)
                parts.Add(QualificationLevels.LabelFor(QualificationCode) ?? "no qualification");
            if (HasExperience)
                parts.Add(Years(ExperienceYears));
            return parts.Count == 0 ? "nothing of the kind" : string.Join(" with ", parts);
        }
    }

    /* ------------------------------------------------------ the reading */

    /// <summary>
    /// What this applicant's accepted profiles say, per discipline.
    ///
    /// Per discipline because an account may hold a profile in each
    /// category it has entered, and the answer that matters for a
    /// programme is the one on the profile for that programme's own
    /// sub-category. Nothing is carried over from another.
    ///
    /// The newest accepted attempt wins. Nothing is inferred from a
    /// field's name: only the fields the form designer gave a role to are
    /// read.
    /// </summary>
    public static async Task<Dictionary<int, Profile>> ReadProfilesAsync(
        NtmsDbContext db, int applicantId, CancellationToken ct)
    {
        var accepted = await db.ProfileSubmissions.AsNoTracking()
            .Where(s => s.ApplicantId == applicantId
                        && s.Status == ProfileSubmissionStatus.Approved)
            .OrderByDescending(s => s.AttemptNo)
            .Select(s => new { s.SubCategoryId, s.ProfileFormId, s.Responses })
            .ToListAsync(ct);

        if (accepted.Count == 0) return [];

        var newest = accepted
            .GroupBy(s => s.SubCategoryId)
            .ToDictionary(group => group.Key, group => group.First());

        /* Every role mapping on the forms involved, in one query rather
           than one per discipline. */
        var formIds = newest.Values
            .Select(s => s.ProfileFormId)
            .Distinct()
            .ToList();

        var mapped = await db.ProfileFields.AsNoTracking()
            .Where(f => formIds.Contains(f.Section!.FormId)
                        && f.Role != ProfileFieldRole.None)
            .Select(f => new { f.Section!.FormId, f.Key, f.Role })
            .ToListAsync(ct);

        var profiles = new Dictionary<int, Profile>();

        foreach (var (subCategoryId, submission) in newest)
        {
            var roles = mapped.Where(m => m.FormId == submission.ProfileFormId).ToList();
            if (roles.Count == 0)
            {
                profiles[subCategoryId] = Profile.Unknown;
                continue;
            }

            Dictionary<string, JsonElement>? answers;
            try
            {
                answers = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(
                    submission.Responses);
            }
            catch (JsonException)
            {
                /* A profile whose answers cannot be read must not close
                   every programme to somebody. It is left unmeasured. */
                profiles[subCategoryId] = Profile.Unknown;
                continue;
            }

            if (answers is null)
            {
                profiles[subCategoryId] = Profile.Unknown;
                continue;
            }

            var hasQualification = false;
            string? code = null;
            var rank = 0;
            var hasExperience = false;
            var years = 0m;

            foreach (var field in roles)
            {
                if (!answers.TryGetValue(field.Key, out var value)) continue;

                var text = value.ValueKind switch
                {
                    JsonValueKind.String => value.GetString(),
                    JsonValueKind.Number => value.ToString(),
                    _ => null,
                };

                if (string.IsNullOrWhiteSpace(text)) continue;

                if (field.Role == ProfileFieldRole.Qualification)
                {
                    var found = QualificationLevels.RankOf(text);
                    /* Rank 0 means the catalogue does not know the value,
                       which is not the same as the lowest rung — treat it
                       as unsaid. */
                    if (found > 0)
                    {
                        hasQualification = true;
                        code = QualificationLevels.Normalise(text);
                        rank = found;
                    }
                }
                else if (field.Role == ProfileFieldRole.ExperienceYears
                         && decimal.TryParse(text, out var parsed))
                {
                    hasExperience = true;
                    years = parsed;
                }
            }

            profiles[subCategoryId] = new Profile(
                hasQualification, code, rank, hasExperience, years);
        }

        return profiles;
    }

    /* ------------------------------------------------------- the ruling */

    /// <summary>
    /// Why this programme type is closed to that profile, or null where it
    /// is not.
    ///
    /// Any one route is enough. Where the type lists none, its single
    /// minimum is the whole rule — which is what every type set up before
    /// routes existed has, and reads exactly as it did then.
    ///
    /// The evidence a route asks for is not weighed here. It is produced
    /// with the profile and read by the officer scrutinising it; refusing
    /// on it would hide programmes from people whose papers are in order.
    /// </summary>
    public static string? Refuse(
        string? minQualification,
        int minExperienceYears,
        IEnumerable<ProgramTypeEligibilityRoute>? routes,
        Profile profile)
    {
        var ways = Ordered(routes);

        if (ways.Count > 0)
        {
            if (ways.Any(route => Satisfies(route, profile))) return null;

            var wanted = string.Join(", or ", ways.Select(route =>
                Summarise(route.QualificationCode, route.MinExperienceYears)));

            return $"This program asks for {wanted}. Your profile says {profile.Describe()}.";
        }

        if (profile.HasQualification
            && !string.IsNullOrWhiteSpace(minQualification)
            && profile.QualificationRank < QualificationLevels.RankOf(minQualification))
        {
            return $"This program needs {QualificationLevels.LabelFor(minQualification)}. "
                   + "Your profile says otherwise.";
        }

        if (profile.HasExperience
            && minExperienceYears > 0
            && profile.ExperienceYears < minExperienceYears)
        {
            return $"This program needs {Years(minExperienceYears)}. "
                   + $"Your profile says {Years(profile.ExperienceYears)}.";
        }

        return null;
    }

    /// <inheritdoc cref="Refuse(string?, int, IEnumerable{ProgramTypeEligibilityRoute}?, Profile)"/>
    public static string? Refuse(ProgramType type, Profile profile) =>
        Refuse(type.MinQualification, type.MinExperienceYears, type.EligibilityRoutes, profile);

    /// <summary>
    /// Whether this one route is cleared.
    ///
    /// A dimension the profile does not measure clears every route on that
    /// dimension, so a form that asks for a qualification and not for
    /// years of service gates on the qualification alone.
    /// </summary>
    private static bool Satisfies(ProgramTypeEligibilityRoute route, Profile profile) =>
        (!profile.HasQualification
         || profile.QualificationRank >= QualificationLevels.RankOf(route.QualificationCode))
        && (!profile.HasExperience || profile.ExperienceYears >= route.MinExperienceYears);

    /* ------------------------------------------------------ the wording */

    /// <summary>The routes as the clients read them, in the listed order.</summary>
    public static List<EligibilityRouteDto> Describe(
        IEnumerable<ProgramTypeEligibilityRoute>? routes) =>
    [
        .. Ordered(routes).Select(route => new EligibilityRouteDto
        {
            QualificationCode = route.QualificationCode,
            QualificationLabel = QualificationLevels.LabelFor(route.QualificationCode),
            MinExperienceYears = route.MinExperienceYears,
            Requirements = SplitRequirements(route.Requirements),
            Summary = Summarise(route.QualificationCode, route.MinExperienceYears),
        }),
    ];

    /// <summary>One route as a single line.</summary>
    public static string Summarise(string? qualificationCode, int years)
    {
        var label = QualificationLevels.LabelFor(qualificationCode);
        if (string.IsNullOrWhiteSpace(label) || qualificationCode == QualificationLevels.None)
            return years > 0 ? Years(years) : "no minimum";

        return years > 0 ? $"{label} with {Years(years)}" : label;
    }

    /// <summary>One requirement per line, blanks dropped.</summary>
    public static List<string> SplitRequirements(string? text) =>
        string.IsNullOrWhiteSpace(text)
            ? []
            : [.. text.Split('\n')
                .Select(line => line.Trim().TrimEnd('\r').Trim())
                .Where(line => line.Length > 0)];

    /// <summary>The lines as they are stored: one per line, nothing blank.</summary>
    public static string? JoinRequirements(IEnumerable<string>? lines)
    {
        var kept = (lines ?? [])
            .Select(line => (line ?? string.Empty).Trim())
            .Where(line => line.Length > 0)
            .ToList();

        return kept.Count == 0 ? null : string.Join('\n', kept);
    }

    /// <summary>
    /// Lowest rung first, which is the order the routes are shown in and
    /// also the order the single-line minimum is taken from: the lowest
    /// qualification the track accepts.
    /// </summary>
    public static List<ProgramTypeEligibilityRoute> Ordered(
        IEnumerable<ProgramTypeEligibilityRoute>? routes) =>
    [
        .. (routes ?? [])
            .OrderBy(route => QualificationLevels.RankOf(route.QualificationCode))
            .ThenBy(route => route.MinExperienceYears),
    ];

    private static string Years(decimal years)
    {
        var whole = years == decimal.Truncate(years) ? decimal.Truncate(years).ToString() : years.ToString("0.#");
        return $"{whole} {(years == 1m ? "year" : "years")} of experience";
    }
}
