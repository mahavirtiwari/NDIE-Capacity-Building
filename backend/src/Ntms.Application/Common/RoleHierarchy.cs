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
            [BaseRole.OperationManager] =
                ScopeAxis.Category | ScopeAxis.SubCategory | ScopeAxis.ProgramType | ScopeAxis.State,
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
