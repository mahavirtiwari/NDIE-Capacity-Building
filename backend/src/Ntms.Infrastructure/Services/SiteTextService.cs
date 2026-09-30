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
            "Run a program end to end, from *application* to certificate.",
            "Wrap a word in *asterisks* to pick it out in the brand colour."),
        new("signin.point1", "Sign-in page", "Point 1",
            "Set a program up once — its form, fee and exam follow it"),
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
            "{covered} of {total} states and union territories have a program running.",
            "{covered} and {total} are filled in with the numbers."),
        new("dashboard.map.districtSubtitle", "Dashboard", "Map subtitle, one state",
            "{covered} of {total} districts in {state} have a program running.",
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
            "Your program result waits on the rest of the assessment — the viva or practical, where your program has one.",
            null, true),

        /* --------------------------------- marksheet, coordinator's app */
        new("coordinator.marksheet.title", "Marksheet (coordinator app)", "Menu row",
            "Trainer marksheet"),
        new("coordinator.marksheet.status", "Marksheet (coordinator app)", "Menu row status",
            "Written and viva marks for the enrolled candidates"),
        new("coordinator.marksheet.noSkills", "Marksheet (coordinator app)", "Viva has no skills",
            "The viva has no skills set up yet, so it cannot be marked. They are added in the portal, under the program type.",
            null, true),

        /* ------------------------------------ sign in, the applicant's app ---
           The first screen anybody outside the department ever sees, so every
           word on it is here: the line under the logo, what the two fields are
           called, what they show before anything is typed, and the card that
           sends a first-time visitor to registration. */
        new("app.signin.tagline", "Sign in (applicant app)", "Line under the logo",
            "Training and certification for MSME professionals.",
            "The name and the organisation above it come from Branding."),
        new("app.signin.title", "Sign in (applicant app)", "Heading", "Welcome"),
        new("app.signin.subtitle", "Sign in (applicant app)", "Subheading",
            "Sign in to your applicant account"),
        new("app.signin.idLabel", "Sign in (applicant app)", "ID field label", "Applicant ID"),
        new("app.signin.idPlaceholder", "Sign in (applicant app)", "ID field placeholder",
            "APP240001"),
        new("app.signin.idHint", "Sign in (applicant app)", "ID field hint",
            "The ID emailed to you when your account was created — not your email address.",
            null, true),
        new("app.signin.passwordLabel", "Sign in (applicant app)", "Password field label",
            "Password"),
        new("app.signin.passwordPlaceholder", "Sign in (applicant app)",
            "Password field placeholder", "Enter your password"),
        new("app.signin.forgot", "Sign in (applicant app)", "Forgot password link",
            "Forgot password?"),
        new("app.signin.action", "Sign in (applicant app)", "Button", "Sign in"),
        new("app.signin.invalidId", "Sign in (applicant app)", "Wrong ID format",
            "Please enter the valid applicant ID provided during registration.",
            null, true),
        new("app.signin.registerTitle", "Sign in (applicant app)", "Register card heading",
            "New user"),
        new("app.signin.registerBody", "Sign in (applicant app)", "Register card text",
            "If this is your first time here, create an applicant account to begin.",
            null, true),
        new("app.signin.registerCta", "Sign in (applicant app)", "Register card button",
            "Register now"),
        new("app.signin.footNote", "Sign in (applicant app)", "Foot note",
            "Your details are used only to administer training programmes. Sign-in activity is logged.",
            null, true),

        /* ------------------------------ the one-time code, applicant app ---
           Shared by the two screens that ask for one: verifying an e-mail at
           sign-up, and finishing a password reset. */
        new("app.otp.label", "One-time code (applicant app)", "Field label",
            "Verification code"),
        new("app.otp.placeholder", "One-time code (applicant app)", "Field placeholder",
            "Enter OTP",
            "Shown in the empty box. A specimen like “123456” reads as a code already filled in."),

        /* ---------------------------------- forgot password, applicant app */
        new("app.forgot.title", "Forgot password (applicant app)", "Heading", "Reset password"),
        new("app.forgot.subtitle", "Forgot password (applicant app)", "Subheading",
            "Recover access to your applicant account"),
        new("app.forgot.label", "Forgot password (applicant app)", "Field label",
            "Applicant ID or email"),
        new("app.forgot.placeholder", "Forgot password (applicant app)", "Field placeholder",
            "APP240001 or you@example.com"),
        new("app.forgot.hint", "Forgot password (applicant app)", "Field hint",
            "Either one is accepted."),
        new("app.forgot.byId", "Forgot password (applicant app)", "What happens, by ID",
            "The code goes to the email held on that account.",
            null, true),
        new("app.forgot.byEmail", "Forgot password (applicant app)", "What happens, by email",
            "The code goes to that address, as long as it belongs to one account.",
            null, true),
        new("app.forgot.action", "Forgot password (applicant app)", "Button", "Continue"),
        new("app.forgot.invalid", "Forgot password (applicant app)", "Wrong format",
            "Please provide a valid applicant ID or registered email ID.",
            "Shown when what was typed is neither.", true),

        new("app.reset.title", "Reset password (applicant app)", "Heading", "Check your email"),
        new("app.reset.subtitle", "Reset password (applicant app)", "Subheading",
            "Enter the code we sent, then choose a new password"),
        new("app.reset.note", "Reset password (applicant app)", "Validity note",
            "The code is valid for {minutes} minutes and can be used once. Check your spam folder if it has not arrived.",
            "{minutes} is filled in with how long the code lasts.", true),
        new("app.reset.action", "Reset password (applicant app)", "Button", "Set new password"),
        new("app.reset.done", "Reset password (applicant app)", "Confirmation",
            "Your password has been changed. Sign in with the new one.",
            null, true),

        /* ------------------------------ registration complete, applicant app */
        new("app.registered.title", "Registration complete (applicant app)", "Heading",
            "Registration successful"),
        new("app.registered.subtitle", "Registration complete (applicant app)", "Subheading",
            "Your account is ready. Sign in with the applicant ID below.",
            null, true),
        new("app.registered.sentTo", "Registration complete (applicant app)",
            "Where the password went", "Sent to {email}",
            "{email} is filled in with the address on the account."),
        new("app.registered.note", "Registration complete (applicant app)", "Note",
            "Keep the applicant ID safe — it is how you sign in, and it does not change if you later edit your email address.",
            null, true),
        new("app.registered.action", "Registration complete (applicant app)", "Button",
            "Sign in to dashboard"),

        /* --------------------------------------------------- the screens ---
           Every page's heading and the line under it, one group per screen.
           These are the first words on a screen and the ones a department is
           most likely to want in its own wording. */
        new("page.signupForm.title", "Applicant sign-up form", "Page heading", "Applicant sign-up form"),
        new("page.signupForm.subtitle", "Applicant sign-up form", "Page subtitle",
            "The fields somebody fills in to create an account. Switch any of them off, change what they are called, and add your own.",
            null, true),
        new("page.applicants.title", "Applicants", "Page heading", "Applicants"),
        new("page.applicants.subtitle", "Applicants", "Page subtitle",
            "Accounts created from the mobile app. The applicant ID is system generated at sign-up; email and mobile stay editable by the applicant.",
            null, true),
        new("page.applications.title", "Application scrutiny", "Page heading", "Application scrutiny"),
        new("page.applications.subtitle", "Application scrutiny", "Page subtitle",
            "Applications submitted from the mobile app, queued for document verification and eligibility scrutiny.",
            null, true),
        new("page.branding.title", "Branding", "Page heading", "Branding"),
        new("page.branding.subtitle", "Branding", "Page subtitle",
            "Organisation name and logo used by the portal, the applicant app and email.",
            null, true),
        new("page.categories.title", "Categories", "Page heading", "Categories"),
        new("page.categories.subtitle", "Categories", "Page subtitle",
            "Top level grouping for every training program run under the scheme.",
            null, true),
        new("page.curriculum.title", "Curriculum", "Page heading", "Curriculum"),
        new("page.curriculum.subtitle", "Curriculum", "Page subtitle",
            "Program register. Open a program code to maintain its day-wise sessions and topics.",
            null, true),
        new("page.email.title", "Email", "Page heading", "Email"),
        new("page.email.subtitle", "Email", "Page subtitle",
            "The account messages are sent from, and the wording of each one.",
            null, true),
        new("page.examPapers.title", "Exam papers", "Page heading", "Exam papers"),
        new("page.examPapers.subtitle", "Exam papers", "Page subtitle",
            "Certification question papers with marks, negative marking and pass criteria per program type.",
            null, true),
        new("page.fees.title", "Fee structures", "Page heading", "Fee structures"),
        new("page.fees.subtitle", "Fee structures", "Page subtitle",
            "Component-wise fee with GST and concessions, effective dated per program type.",
            null, true),
        new("page.agencies.title", "Implementing agencies", "Page heading", "Implementing agencies"),
        new("page.agencies.subtitle", "Implementing agencies", "Page subtitle",
            "Empanelled bodies that conduct programs on the ground, mapped to the masters they may deliver.",
            null, true),
        new("page.profile.title", "My profile", "Page heading", "My profile"),
        new("page.profile.subtitle", "My profile", "Page subtitle",
            "Your user ID is issued by the system and cannot be changed. Contact details are yours to update.",
            null, true),
        new("page.programTypes.title", "Program types", "Page heading", "Program types"),
        new("page.programTypes.subtitle", "Program types", "Page subtitle",
            "The applicant facing track — Master Trainer, Assessor, Consultant and others. Each type drives its own registration form, fee, curriculum and exam paper.",
            null, true),
        new("page.programmes.title", "Programs", "Page heading", "Programs"),
        new("page.programmes.subtitle", "Programs", "Page subtitle",
            "Every batch conducted physically or virtually, with its permission, calendar and conduct status.",
            null, true),
        new("page.qualifiedProfessionals.title", "Qualified professionals", "Page heading",
            "Qualified professionals"),
        new("page.qualifiedProfessionals.subtitle", "Qualified professionals", "Page subtitle",
            "Everybody the scheme has qualified, with the standing of their certificate.",
            null, true),
        new("page.qualifications.title", "Qualifications", "Page heading", "Qualifications"),
        new("page.qualifications.subtitle", "Qualifications", "Page subtitle",
            "The educational qualifications a program type can ask for, and where each one sits on the ladder.",
            null, true),
        new("page.registrationForms.title", "Registration forms", "Page heading", "Registration forms"),
        new("page.registrationForms.subtitle", "Registration forms", "Page subtitle",
            "Design the applicant registration form for each program type — add fields, switch any of them off, and replicate a finished form onto another track.",
            null, true),
        new("page.trainers.title", "Trainers", "Page heading", "Trainers"),
        new("page.trainers.subtitle", "Trainers", "Page subtitle",
            "Everybody who has delivered a program, and the batch they took it for.",
            null, true),
        new("page.reports.title", "Reports", "Page heading", "View reports"),
        new("page.reports.subtitle", "Reports", "Page subtitle",
            "Every program run under a program type, and the full report behind each one.",
            null, true),
        new("page.roles.title", "Roles and permissions", "Page heading", "Roles & permissions"),
        new("page.roles.subtitle", "Roles and permissions", "Page subtitle",
            "Super Admin defines admin roles and the exact screens and actions each one can reach.",
            null, true),
        new("page.systemSettings.title", "System settings", "Page heading", "System settings"),
        new("page.systemSettings.subtitle", "System settings", "Page subtitle",
            "Whether the portal is open, and how it is set up to take payment.",
            null, true),
        new("page.siteText.title", "Site text", "Page heading", "Site text"),
        new("page.siteText.subtitle", "Site text", "Page subtitle",
            "The headings and wording on the screens that are not driven by data. Change any of them, or put one back to how it shipped.",
            null, true),
        new("page.subCategories.title", "Sub-categories", "Page heading", "Sub-categories"),
        new("page.subCategories.subtitle", "Sub-categories", "Page subtitle",
            "Maturity levels or streams that sit under a category.",
            null, true),
        new("page.materials.title", "Training material", "Page heading", "Training material"),
        new("page.materials.subtitle", "Training material", "Page subtitle",
            "Files and videos published against a program type, with role based visibility.",
            null, true),

        /* Two screens off one component, so two headings. */
        new("page.users.title", "Portal users", "Page heading", "Portal users"),
        new("page.users.subtitle", "Portal users", "Page subtitle",
            "Admins, operation managers and coordinators. Each user gets a system generated user ID.",
            null, true),
        new("page.coordinators.title", "Coordinators", "Page heading", "Coordinators"),
        new("page.coordinators.subtitle", "Coordinators", "Page subtitle",
            "Coordinators capture the programs conducted on the ground, virtually or physically.",
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
