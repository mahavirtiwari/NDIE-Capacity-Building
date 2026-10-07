using Ntms.Domain.Common;

namespace Ntms.Application.Common;

/// <summary>
/// Who may create whom, who may see whom, and which scope dimensions each tier
/// is allocated on. The delegation chain is:
///
/// <code>
///   Super Admin ──┬─→ Admin ──→ Operation Manager ──→ Implementing Agency ──→ Coordinator
///                 └─→ Ministry of MSME (oversight, creates nothing)
/// </code>
///
/// Creation is strictly one tier down: a Super Admin cannot reach past an Admin
/// to make an Operation Manager. Higher tiers keep full visibility of
/// everything beneath them and may enable or disable it, which is what lets
/// oversight work without letting anyone bypass the chain.
///
/// This lives in one table rather than scattered across controllers so the
/// answer to "can X do this to Y" has exactly one source.
/// </summary>
public static class RoleHierarchy
{
    /// <summary>
    /// Depth in the chain. Lower is more senior. Ministry sits alongside Admin
    /// because the Super Admin appoints it, but it creates nothing.
    /// </summary>
    private static readonly IReadOnlyDictionary<BaseRole, int> Depth =
        new Dictionary<BaseRole, int>
        {
            [BaseRole.SuperAdmin] = 0,
            [BaseRole.Ministry] = 1,
            [BaseRole.Admin] = 1,
            [BaseRole.OperationManager] = 2,
            [BaseRole.AgencyAdmin] = 3,
            [BaseRole.Coordinator] = 4,
            [BaseRole.Applicant] = 5,
        };

    /// <summary>The portal accounts each tier may create, and nothing else.</summary>
    private static readonly IReadOnlyDictionary<BaseRole, BaseRole[]> Creates =
        new Dictionary<BaseRole, BaseRole[]>
        {
            [BaseRole.SuperAdmin] = [BaseRole.Admin, BaseRole.Ministry],
            [BaseRole.Admin] = [BaseRole.OperationManager],
            /* An Operation Manager creates agencies, not users directly; the
               agency's own login is issued with it. */
            [BaseRole.OperationManager] = [BaseRole.AgencyAdmin],
            [BaseRole.AgencyAdmin] = [BaseRole.Coordinator],
            [BaseRole.Ministry] = [],
            [BaseRole.Coordinator] = [],
            [BaseRole.Applicant] = [],
        };

    /// <summary>The scope axes a tier is allocated on when it is created.</summary>
    private static readonly IReadOnlyDictionary<BaseRole, ScopeAxis> Axes =
        new Dictionary<BaseRole, ScopeAxis>
        {
            [BaseRole.SuperAdmin] = ScopeAxis.None,
            [BaseRole.Ministry] = ScopeAxis.None,
            [BaseRole.Admin] = ScopeAxis.Category | ScopeAxis.SubCategory | ScopeAxis.State,
            /* "Empanels Implementing Agencies within allocated program types
               and states" - so those are the two it is allocated on. It held
               categories and sub-categories as well, which let an Admin hand
               a manager a whole category and then separately hand it program
               types from somewhere else inside that category, leaving two
               answers to the question of what the manager covers. The
               program types are the answer; the category a manager works in
               is read off them. */
            [BaseRole.OperationManager] = ScopeAxis.ProgramType | ScopeAxis.State,
            [BaseRole.AgencyAdmin] = ScopeAxis.ProgramType | ScopeAxis.State,
            [BaseRole.Coordinator] = ScopeAxis.ProgramType | ScopeAxis.State | ScopeAxis.District,
            [BaseRole.Applicant] = ScopeAxis.None,
        };

    public static int DepthOf(BaseRole role) => Depth.GetValueOrDefault(role, int.MaxValue);

    public static IReadOnlyList<BaseRole> CreatableBy(BaseRole role) =>
        Creates.GetValueOrDefault(role, []);

    public static bool CanCreate(BaseRole actor, BaseRole target) =>
        CreatableBy(actor).Contains(target);

    /// <summary>
    /// True when the actor outranks the target. Used for listing and for
    /// enabling or disabling an account — the reach that senior tiers keep
    /// even where they cannot create.
    /// </summary>
    public static bool Outranks(BaseRole actor, BaseRole target) =>
        DepthOf(actor) < DepthOf(target);

    public static ScopeAxis AxesFor(BaseRole role) =>
        Axes.GetValueOrDefault(role, ScopeAxis.None);

    /// <summary>
    /// What a tier may never hold, whatever its role record says.
    ///
    /// Super Admin owns the scheme's shape — the masters, the forms, the
    /// portal, and the two tiers it appoints — and does not run the
    /// operation. It does not raise or approve a batch, empanel an agency,
    /// appoint a coordinator or a trainer, or decide a profile. Those
    /// belong to the chain that is accountable for delivering them, and a
    /// decision taken from the top of the system leaves nobody answerable
    /// for it.
    ///
    /// Withheld here rather than merely left out of the seed, because a
    /// permission absent from a seed can be put back by editing a row, and
    /// this is not a default. Nothing is taken from the view permissions:
    /// Super Admin reads all of it.
    /// </summary>
    private static readonly IReadOnlyDictionary<BaseRole, string[]> Withheld =
        new Dictionary<BaseRole, string[]>
        {
            [BaseRole.SuperAdmin] =
            [
                Permissions.ProgramsCreate,
                Permissions.ProgramsManage,
                Permissions.ProgramsApprove,
                Permissions.AgenciesManage,
                Permissions.CoordinatorsManage,
                Permissions.TrainersManage,
                Permissions.ApplicationsScrutinise,
            ],

            /* Empanelling belongs to the Operation Manager, who answers for
               the agencies it takes on and for the batches they raise. An
               Admin appoints those managers and reads everything beneath
               them; it does not take an agency onto the register itself.

               The seeder revokes this from the stock Admin role on every
               start, which was never enough: the key could be ticked back on
               from the Roles screen, and a role named "Admin" that the
               seeder does not recognise never had it revoked at all. Held
               against the tier, it cannot be granted by any route. */
            [BaseRole.Admin] =
            [
                Permissions.AgenciesManage,
                Permissions.CoordinatorsManage,
                Permissions.TrainersManage,
                Permissions.MaterialsManage,
                /* A profile is decided by the Operation Manager whose
                   program types and states put it on their desk. An Admin
                   appoints those managers and reads their queue. */
                Permissions.ApplicationsScrutinise,
                /* And a batch is permitted by that same manager. */
                Permissions.ProgramsApprove,
            ],

            /* A coordinator is appointed by the agency they work for, which
               is the body accountable for what they record on the ground.
               An Operation Manager empanels the agency and reads its
               coordinators; it does not put them there. */
            [BaseRole.OperationManager] =
            [
                Permissions.CoordinatorsManage,
                Permissions.TrainersManage,
                Permissions.MaterialsManage,
            ],

            /* A trainer is put on the record by the coordinator who was in
               the room, as the register's own empty state says. The agency
               appoints the coordinator and reads the faculty; it does not
               enter one itself. Coordinators are unaffected: they register a
               trainer against a batch of their own, which is gated by
               holding that batch rather than by this key. */
            [BaseRole.AgencyAdmin] =
            [
                Permissions.TrainersManage,
                Permissions.MaterialsManage,
                Permissions.ApplicationsScrutinise,
                /* An agency does not permit its own batch. It raises one and
                   runs it; the manager that empanelled it decides whether it
                   may go ahead, which is the whole of what permission means. */
                Permissions.ProgramsApprove,
            ],

            /* Training material is the scheme's own, published once by the
               Super Admin and read everywhere. A tier that could edit it
               would be rewriting the course from the middle of the chain. */
            [BaseRole.Coordinator] =
            [
                Permissions.MaterialsManage,
                Permissions.ApplicationsScrutinise,
                Permissions.ProgramsApprove,
            ],
        };

    /// <summary>
    /// The permissions a role actually confers on this tier: what was
    /// granted, less what the tier may never hold.
    /// </summary>
    /// <summary>What this tier may never hold, whatever a role record says.</summary>
    public static IReadOnlyList<string> WithheldFrom(BaseRole tier) =>
        Withheld.GetValueOrDefault(tier, []);

    public static List<string> Effective(BaseRole? tier, IEnumerable<string> granted)
    {
        if (tier is not { } role || !Withheld.TryGetValue(role, out var barred))
            return [.. granted];

        return [.. granted.Where(p => !barred.Contains(p, StringComparer.OrdinalIgnoreCase))];
    }

    /// <summary>
    /// True for tiers whose reach is limited to an explicit allocation. The
    /// unscoped tiers — Super Admin and Ministry — see the whole estate.
    /// </summary>
    public static bool IsScoped(BaseRole role) => AxesFor(role) != ScopeAxis.None;

    /// <summary>Reader-facing name, used in messages and on the credentials email.</summary>
    public static string DisplayName(BaseRole role) => role switch
    {
        BaseRole.SuperAdmin => "Super Admin",
        BaseRole.Ministry => "Ministry of MSME",
        BaseRole.Admin => "Admin",
        BaseRole.OperationManager => "Operation Manager",
        BaseRole.AgencyAdmin => "Implementing Agency",
        BaseRole.Coordinator => "Coordinator",
        BaseRole.Applicant => "Applicant",
        _ => role.ToString(),
    };
}

/// <summary>The dimensions an allocation can be made on.</summary>
[Flags]
public enum ScopeAxis
{
    None = 0,
    Category = 1,
    SubCategory = 2,
    ProgramType = 4,
    State = 8,
    District = 16,
}
