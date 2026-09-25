using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// The wording on the screens that are not driven by data.
///
/// The headline on the sign-in panel, the section titles on the dashboard, the
/// line under each chart: text that is part of the product rather than part of
/// a record, and which the department may want to word its own way.
///
/// The shipped wording is the registry below, in code. The database holds only
/// what somebody changed, so an empty table means every screen reads as
/// written, a new string ships without a migration, and restoring the original
/// is deleting a row rather than copying a default into it.
/// </summary>
public class SiteTextService(NtmsDbContext db)
{
    /// <summary>One editable string: where it appears, and what it says.</summary>
    private sealed record Entry(
        string Key,
        string Group,
        string Label,
        string Default,
        string? Hint = null,
        bool Multiline = false);

    /// <summary>
    /// Every string that can be reworded, in the order the editor shows them.
    ///
    /// A key is a contract with a template, so it is renamed only by also
    /// renaming it there — an orphaned override is ignored rather than shown,
    /// which is quiet but not wrong.
    /// </summary>
    private static readonly Entry[] Registry =
    [
        /* ------------------------------------------------------ sign-in page */
        new("signin.heading", "Sign-in page", "Headline",
            "Run a programme end to end, from *application* to certificate.",
            "Wrap a word in *asterisks* to pick it out in the brand colour."),
        new("signin.point1", "Sign-in page", "Point 1",
            "Set a programme up once — its form, fee and exam follow it"),
        new("signin.point2", "Sign-in page", "Point 2",
            "One scrutiny queue, with assignment, remarks and an audit trail"),
        new("signin.point3", "Sign-in page", "Point 3",
            "Attendance captured on site or online, in one register"),
        new("signin.point4", "Sign-in page", "Point 4",
            "Every state and district, straight from the LG Directory"),
        new("signin.footerNote", "Sign-in page", "Footer note",
            "Sign-in activity is logged. Your details are used only to administer training programmes.",
            null, true),
        new("signin.title", "Sign-in page", "Form heading", "Sign in"),
        new("signin.subtitle", "Sign-in page", "Form subtitle",
            "Use the system generated user ID issued to you — not your email address.",
            null, true),

        /* -------------------------------------------------------- dashboard */
        new("dashboard.map.title", "Dashboard", "Map heading", "Reach across India"),
        new("dashboard.map.subtitle", "Dashboard", "Map subtitle",
            "{covered} of {total} states and union territories have a programme running.",
            "{covered} and {total} are filled in with the numbers."),
        new("dashboard.map.districtSubtitle", "Dashboard", "Map subtitle, one state",
            "{covered} of {total} districts in {state} have a programme running.",
            "{covered}, {total} and {state} are filled in."),

        /* ----------------------------------------------------------- charts */
        new("charts.monthly.title", "Charts", "Monthly chart heading",
            "Programs conducted per month"),
        new("charts.monthly.subtitle", "Charts", "Monthly chart subtitle",
            "Physical and virtual batches, latest month first"),
        new("charts.gender.title", "Charts", "Gender chart heading", "Participants by gender"),
        new("charts.gender.subtitle", "Charts", "Gender chart subtitle",
            "Share of candidates who attended"),
        new("charts.social.title", "Charts", "Social category chart heading",
            "Participants by social category"),
        new("charts.social.subtitle", "Charts", "Social category chart subtitle",
            "Share of candidates who attended"),

        /* ----------------------------------------------- evaluation skills */
        new("skills.title", "Evaluation skills", "Page heading", "Evaluation Skills"),
        new("skills.subtitle", "Evaluation skills", "Page subtitle",
            "What a trainer marks each candidate on in the viva or practical, set up per program type.",
            null, true),
        new("skills.typeHint", "Evaluation skills", "Program type hint",
            "Only types whose evaluation includes a viva or practical are listed."),
        new("skills.pick", "Evaluation skills", "Nothing picked yet",
            "Pick a program type to set up its marksheet."),
        new("skills.shortfall", "Evaluation skills", "Marks do not add up",
            "The live skills add up to {allocated}, but the viva is marked out of {viva}. A trainer could not award the full marks.",
            "{allocated} and {viva} are filled in with the numbers.", true),

        /* ------------------------------------------------------- marksheet */
        new("marksheet.tab", "Marksheet", "Tab label", "Marksheet"),
        new("marksheet.noExam", "Marksheet", "Nothing to mark",
            "{programType} has no examination, so there is nothing to mark.",
            "{programType} is filled in with the name."),
        new("marksheet.noSkills", "Marksheet", "Viva has no skills",
            "The viva has no skills set up yet, so it cannot be marked. Add them under Evaluation Skills for {programType}.",
            null, true),
        new("marksheet.locked", "Marksheet", "Certificate issued",
            "Certificate issued — marks locked"),
        new("marksheet.fromExam", "Marksheet", "Mark came from the online paper", "Online"),

        /* --------------------------------------------------- exam review */
        new("examReview.keyHidden", "Examination review", "Answer key withheld",
            "What the candidate chose is shown; which option was correct is not. That needs permission to read the question papers.",
            null, true),
        new("examReview.expired", "Examination review", "Sitting expired",
            "The clock ran out. This sitting was marked on what had been answered by then.",
            null, true),
        new("examReview.none", "Examination review", "Never sat", "This candidate has not sat the paper."),

        /* ------------------------------------- examination, applicant app */
        new("exam.clockNote", "Examination (applicant app)", "Before starting",
            "The clock starts as soon as you tap. Stay on this screen until you have a steady connection.",
            null, true),
        new("exam.negativeMarking", "Examination (applicant app)", "Negative marking warning",
            "Wrong answers lose marks on this paper. A question left unanswered costs nothing.",
            null, true),
        new("exam.resumeNote", "Examination (applicant app)", "Resuming a paper",
            "You have a paper open. Continuing picks it up where you left off — the clock has been running.",
            null, true),
        new("exam.unsent", "Examination (applicant app)", "Answers not sent",
            "Find a signal — answers only count once they are sent, and they go again with your next tap.",
            null, true),
        new("exam.resultPending", "Examination (applicant app)", "Result still pending",
            "Your programme result waits on the rest of the assessment — the viva or practical, where your programme has one.",
            null, true),

        /* --------------------------------- marksheet, coordinator's app */
        new("coordinator.marksheet.title", "Marksheet (coordinator app)", "Menu row",
            "Trainer marksheet"),
        new("coordinator.marksheet.status", "Marksheet (coordinator app)", "Menu row status",
            "Written and viva marks for the enrolled candidates"),
        new("coordinator.marksheet.noSkills", "Marksheet (coordinator app)", "Viva has no skills",
            "The viva has no skills set up yet, so it cannot be marked. They are added in the portal, under the program type.",
            null, true),
    ];

    private static readonly HashSet<string> KnownKeys = [.. Registry.Select(e => e.Key)];

    /// <summary>Everything the editor needs: what it says now, and what it shipped as.</summary>
    public async Task<List<SiteTextDto>> ListAsync(CancellationToken ct)
    {
        var overrides = await db.SiteTexts.AsNoTracking()
            .ToDictionaryAsync(t => t.Key, t => t.Value, ct);

        return
        [
            .. Registry.Select(e => new SiteTextDto
            {
                Key = e.Key,
                Group = e.Group,
                Label = e.Label,
                Hint = e.Hint,
                Multiline = e.Multiline,
                Default = e.Default,
                Value = overrides.GetValueOrDefault(e.Key, e.Default),
                IsOverridden = overrides.ContainsKey(e.Key),
            }),
        ];
    }

    /// <summary>
    /// What every client actually renders: key to effective text.
    ///
    /// Anonymous, because the sign-in page is one of the screens it words and
    /// nobody has signed in by then.
    /// </summary>
    public async Task<Dictionary<string, string>> MapAsync(CancellationToken ct)
    {
        var overrides = await db.SiteTexts.AsNoTracking()
            .ToDictionaryAsync(t => t.Key, t => t.Value, ct);

        return Registry.ToDictionary(e => e.Key, e => overrides.GetValueOrDefault(e.Key, e.Default));
    }

    /// <summary>
    /// Changes one string, or puts it back.
    ///
    /// Blank, or the same as the shipped wording, removes the override rather
    /// than storing a copy of the default — so a later change to the shipped
    /// text still reaches anyone who never reworded it.
    /// </summary>
    public async Task<SiteTextDto> SetAsync(string key, string? value, CancellationToken ct)
    {
        var entry = Registry.FirstOrDefault(e => e.Key == key)
            ?? throw AppException.NotFound($"Text '{key}'");

        var trimmed = value?.Trim();
        var existing = await db.SiteTexts.FirstOrDefaultAsync(t => t.Key == key, ct);

        if (string.IsNullOrWhiteSpace(trimmed) || trimmed == entry.Default)
        {
            if (existing is not null) db.SiteTexts.Remove(existing);
        }
        else if (existing is null)
        {
            db.SiteTexts.Add(new SiteText { Key = key, Value = trimmed });
        }
        else
        {
            existing.Value = trimmed;
        }

        await db.SaveChangesAsync(ct);

        var isOverridden = !string.IsNullOrWhiteSpace(trimmed) && trimmed != entry.Default;
        return new SiteTextDto
        {
            Key = entry.Key,
            Group = entry.Group,
            Label = entry.Label,
            Hint = entry.Hint,
            Multiline = entry.Multiline,
            Default = entry.Default,
            Value = isOverridden ? trimmed! : entry.Default,
            IsOverridden = isOverridden,
        };
    }

    /// <summary>Puts every string back to the wording the product ships with.</summary>
    public async Task<List<SiteTextDto>> RestoreAllAsync(CancellationToken ct)
    {
        var all = await db.SiteTexts.ToListAsync(ct);
        if (all.Count > 0)
        {
            db.SiteTexts.RemoveRange(all);
            await db.SaveChangesAsync(ct);
        }
        return await ListAsync(ct);
    }

    /// <summary>Whether a key is one this release knows about.</summary>
    public static bool Knows(string key) => KnownKeys.Contains(key);
}
