namespace Ntms.Application.Common;

/// <summary>
/// The permission catalogue. Super Admin composes roles out of these keys; the
/// API enforces them with <c>[HasPermission(...)]</c>. Keys mirror the strings
/// used by the Angular portal so one vocabulary covers both tiers.
/// </summary>
public static class Permissions
{
    public const string MastersView = "masters.view";
    public const string MastersManage = "masters.manage";

    public const string CurriculumView = "curriculum.view";
    public const string CurriculumManage = "curriculum.manage";

    public const string FeesView = "fees.view";
    public const string FeesManage = "fees.manage";

    public const string ExamsView = "exams.view";
    public const string ExamsManage = "exams.manage";

    public const string MaterialsView = "materials.view";
    public const string MaterialsManage = "materials.manage";

    public const string RolesView = "roles.view";
    public const string RolesManage = "roles.manage";

    public const string UsersView = "users.view";
    public const string UsersManage = "users.manage";
    /// <summary>
    /// Enable or disable an account without being able to create or edit one.
    /// This is the reach a senior tier keeps over everything beneath it, and
    /// it is deliberately withheld from the Ministry, which only observes.
    /// </summary>
    public const string UsersStatus = "users.status";

    public const string AgenciesView = "agencies.view";
    public const string AgenciesManage = "agencies.manage";

    public const string ApplicationsView = "applications.view";
    public const string ApplicationsScrutinise = "applications.scrutinise";

    public const string ProgramsView = "programs.view";

    /// <summary>
    /// Raise a new batch. Held apart from running one, because they are
    /// different jobs done by different tiers: an implementing agency
    /// proposes a batch and the operation manager above it decides whether
    /// it may run. Super Admin owns the masters and the portal and does not
    /// hold this, so a batch has an agency behind it from the moment it
    /// exists rather than appearing from the top of the system with nobody
    /// accountable for delivering it.
    /// </summary>
    public const string ProgramsCreate = "programs.create";

    /// <summary>
    /// Run a batch that exists: accept its permission, close registrations,
    /// set the exam time, record sessions and attendance, enrol.
    /// </summary>
    public const string ProgramsManage = "programs.manage";

    public const string CoordinatorsView = "coordinators.view";
    public const string CoordinatorsManage = "coordinators.manage";

    public const string ReportsView = "reports.view";

    /// <summary>The register of everybody the scheme has qualified.</summary>
    public const string ProfessionalsView = "professionals.view";

    /// <summary>The faculty register: who delivered which programme.</summary>
    public const string TrainersView = "trainers.view";
    public const string TrainersManage = "trainers.manage";

    /// <summary>Portal identity: organisation name and logo.</summary>
    public const string SettingsManage = "settings.manage";

    public static readonly IReadOnlyList<string> All =
    [
        MastersView, MastersManage,
        CurriculumView, CurriculumManage,
        FeesView, FeesManage,
        ExamsView, ExamsManage,
        MaterialsView, MaterialsManage,
        RolesView, RolesManage,
        UsersView, UsersManage, UsersStatus,
        AgenciesView, AgenciesManage,
        ApplicationsView, ApplicationsScrutinise,
        ProgramsView, ProgramsCreate, ProgramsManage,
        CoordinatorsView, CoordinatorsManage,
        ReportsView,
        ProfessionalsView,
        TrainersView,
        TrainersManage,
        SettingsManage,
    ];

    /// <summary>
    /// What the top of the system does not do itself.
    ///
    /// Super Admin owns the masters, the roles and the portal, and appoints
    /// the tier below it. Everything here belongs to a tier that answers to
    /// somebody: an operation manager empanels agencies, an agency adds its
    /// coordinators and raises its programs, an admin and its scrutiny
    /// officers read applications. Holding all of them at the top made the
    /// chain of accountability decorative - a record could appear with
    /// nobody below responsible for it, and an approval could be given by
    /// the same account that asked for it.
    ///
    /// Withheld, not removed: every one of these is still in the catalogue
    /// and can be granted to a custom role from the roles screen.
    /// </summary>
    public static readonly IReadOnlyList<string> NotForSuperAdmin =
    [
        AgenciesManage,
        CoordinatorsManage,
        ProgramsCreate,
        ProgramsManage,
        ApplicationsScrutinise,
    ];

    /// <summary>Grouped for the roles screen in the portal.</summary>
    public static readonly IReadOnlyList<(string Group, string[] Keys)> Catalogue =
    [
        ("Masters", [MastersView, MastersManage]),
        ("Curriculum & Assessment",
            [CurriculumView, CurriculumManage, ExamsView, ExamsManage, MaterialsView, MaterialsManage]),
        ("Finance", [FeesView, FeesManage]),
        ("Access control", [RolesView, RolesManage, UsersView, UsersManage, UsersStatus]),
        ("Operations",
        [
            AgenciesView, AgenciesManage, ApplicationsView, ApplicationsScrutinise,
            ProgramsView, ProgramsCreate, ProgramsManage,
            CoordinatorsView, CoordinatorsManage,
        ]),
        /* Its own group rather than buried in Operations: these are the
           read-only registers somebody is given without being given the
           running of the programmes behind them. */
        ("Reports & registers", [ReportsView, ProfessionalsView, TrainersView, TrainersManage]),
        ("Portal settings", [SettingsManage]),
    ];
}
