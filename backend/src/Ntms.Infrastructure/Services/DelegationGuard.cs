using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Domain.Common;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Enforces the delegation chain on the way in: who may create which tier, and
/// what they are allowed to hand down.
///
/// The rule that matters is containment — <b>nobody can grant what they do not
/// hold</b>. An Operation Manager allocated two states cannot empanel an agency
/// in a third, however the request is constructed. Checked on the server
/// because the alternative is trusting a form.
/// </summary>
public class DelegationGuard(ICurrentUser user, NtmsDbContext db)
{
    /// <summary>The caller's tier; absent only on an unauthenticated request.</summary>
    private BaseRole Tier =>
        user.Tier ?? throw new AppException("Your account tier could not be determined.", 403);

    /// <summary>
    /// Refuses a create that reaches past the caller's own tier. Super Admin
    /// creates Admins and the Ministry account; an Admin creates Operation
    /// Managers; an agency creates Coordinators. Nothing skips a rung.
    /// </summary>
    public void EnsureCanCreate(BaseRole target)
    {
        if (RoleHierarchy.CanCreate(Tier, target)) return;

        var allowed = RoleHierarchy.CreatableBy(Tier);
        var list = allowed.Count == 0
            ? "no accounts"
            : string.Join(" and ", allowed.Select(RoleHierarchy.DisplayName));

        throw new AppException(
            $"A {RoleHierarchy.DisplayName(Tier)} can create {list}. " +
            $"Creating a {RoleHierarchy.DisplayName(target)} is not permitted.", 403);
    }

    /// <summary>
    /// Restoring access to an account, which any tier above it may do.
    ///
    /// Editing a profile stays with the tier that created it, and that is
    /// right — but a password reset is the one action that must never be
    /// unavailable to everybody. An agency's portal user is created as a side
    /// effect of empanelment rather than by a tier that can edit it, so under
    /// the editing rule nobody could reset it: not the Super Admin, who cannot
    /// create an Implementing Agency, and not the agency itself, which cannot
    /// sign in. With mail switched off the account was simply lost.
    ///
    /// Outranks is the same test that already governs enabling and disabling —
    /// the oversight a senior tier keeps without taking over the profile.
    /// </summary>
    public void EnsureCanRestoreAccess(BaseRole target)
    {
        if (RoleHierarchy.CanCreate(Tier, target) || RoleHierarchy.Outranks(Tier, target)) return;

        throw new AppException(
            $"A {RoleHierarchy.DisplayName(Tier)} cannot reset the password of a " +
            $"{RoleHierarchy.DisplayName(target)} account.", 403);
    }

    /// <summary>
    /// Editing a record that belongs to a tier below: allowed for the tier that
    /// may edit that tier, and for whoever actually created the record.
    ///
    /// An implementing agency is an Implementing Agency account plus what it is
    /// empanelled for, so editing one is editing that account — and by the
    /// rule everywhere else, that sits with the Operation Manager who appoints
    /// them, not with the Super Admin above. The exception is the obvious one:
    /// somebody may always edit what they themselves added, or setting a record
    /// up and then being unable to correct it would be the result.
    /// </summary>
    public bool CanEditRecord(BaseRole target, string? createdBy)
    {
        /* The tier that appoints this one edits it, as everywhere else. */
        if (RoleHierarchy.CanCreate(Tier, target)) return true;

        /*
         * Otherwise, whoever added it. The audit column holds a display name
         * rather than a user code, and a display name is set by an
         * administrator and need not be unique — so on its own it is not an
         * identity worth deciding access on. It is only consulted for a caller
         * who already outranks the record's tier, which means the worst a
         * duplicated name can do is let one senior account edit what another
         * senior account added. A Coordinator named "System Administrator"
         * gets nothing.
         */
        if (!RoleHierarchy.Outranks(Tier, target)) return false;

        return !string.IsNullOrWhiteSpace(createdBy) &&
               string.Equals(createdBy, user.DisplayName, StringComparison.OrdinalIgnoreCase);
    }

    public void EnsureCanEditRecord(BaseRole target, string? createdBy, string what)
    {
        if (CanEditRecord(target, createdBy)) return;

        throw AppException.Forbidden(
            $"A {RoleHierarchy.DisplayName(Tier)} can view this {what} and enable or disable it, " +
            $"but it is edited by the tier that appointed it — or by whoever added it.");
    }

    /// <summary>
    /// Refuses a change to an account of a tier this caller is not responsible
    /// for creating.
    ///
    /// Editing an account and creating one are the same authority: whoever may
    /// set somebody's details and allocation in the first place is the tier
    /// that answers for them. A Super Admin may therefore edit an Admin or a
    /// Ministry account, but not an Operation Manager — that is the Admin's
    /// responsibility, and reaching past them would leave the Admin accountable
    /// for an allocation somebody else changed.
    ///
    /// Oversight of the tiers further down is kept, but as
    /// <see cref="EnsureOutranks"/> allows: look, enable, disable.
    /// </summary>
    public void EnsureCanEdit(BaseRole target, string action)
    {
        if (RoleHierarchy.CanCreate(Tier, target)) return;

        var allowed = RoleHierarchy.CreatableBy(Tier);
        var list = allowed.Count == 0
            ? "no accounts"
            : string.Join(" and ", allowed.Select(RoleHierarchy.DisplayName)) + " accounts";

        throw new AppException(
            $"A {RoleHierarchy.DisplayName(Tier)} may {action} {list}. " +
            $"A {RoleHierarchy.DisplayName(target)} account can be viewed, enabled or " +
            "disabled from here, but is edited by the tier that created it.", 403);
    }

    /// <summary>
    /// Refuses a status change on an account that is not strictly below the
    /// caller. Senior tiers keep this reach even where they cannot create,
    /// which is how oversight works without bypassing the chain.
    /// </summary>
    public void EnsureOutranks(BaseRole target, string action = "change")
    {
        if (RoleHierarchy.Outranks(Tier, target)) return;

        throw new AppException(
            $"A {RoleHierarchy.DisplayName(Tier)} cannot {action} " +
            $"a {RoleHierarchy.DisplayName(target)} account.", 403);
    }

    /// <summary>
    /// Narrows a requested allocation to what the caller actually holds, and
    /// refuses anything outside it.
    ///
    /// <paramref name="requested"/> empty means the caller made no selection.
    /// For an axis that applies to the target tier that is an error, because an
    /// empty allocation now grants nothing and is almost never intended —
    /// "select all" is how full reach is asked for.
    /// </summary>
    public async Task<List<int>> ResolveAsync(
        ScopeAxis axis, BaseRole target, IEnumerable<int> requested, CancellationToken ct)
    {
        if (!RoleHierarchy.AxesFor(target).HasFlag(axis)) return [];

        return await NarrowAsync(
            axis, requested,
            $"Select at least one {Label(axis)} for this {RoleHierarchy.DisplayName(target)}, " +
            "or use Select all.",
            ct);
    }

    /// <summary>
    /// The same narrowing, for a selection that is not an allocation to a tier.
    /// An agency's empanelment is the case: it records categories and
    /// sub-categories although the Implementing Agency tier is itself allocated
    /// only on program types and states, so <see cref="ResolveAsync"/> would
    /// return nothing for those axes and the selection would go through
    /// unchecked. The rule the screen states — you can allocate only what your
    /// own account holds — has to hold on every axis, not just the ones that
    /// happen to be allocation axes for the target tier.
    /// </summary>
    public Task<List<int>> ResolveForRecordAsync(
        ScopeAxis axis, string what, IEnumerable<int> requested, CancellationToken ct) =>
        NarrowAsync(axis, requested, $"Select at least one {Label(axis)} for this {what}.", ct);

    private async Task<List<int>> NarrowAsync(
        ScopeAxis axis, IEnumerable<int> requested, string emptyMessage, CancellationToken ct)
    {
        var wanted = requested.Distinct().Where(id => id > 0).ToList();
        if (wanted.Count == 0) throw new AppException(emptyMessage);

        var permitted = await PermittedAsync(axis, ct);

        var outside = wanted.Except(permitted).ToList();
        if (outside.Count > 0)
        {
            throw new AppException(
                $"You can only allocate {Plural(axis)} from your own allocation. " +
                $"{outside.Count} of the {wanted.Count} selected are outside it.", 403);
        }

        return wanted;
    }

    /// <summary>
    /// Everything the caller may hand down on an axis. For an unscoped caller
    /// that is the whole master list; for a scoped one it is their allocation.
    /// This is also what "select all" resolves to, so selecting all can never
    /// widen the chain.
    /// </summary>
    public async Task<List<int>> PermittedAsync(ScopeAxis axis, CancellationToken ct)
    {
        if (!user.IsMasterScoped) return await WholeMasterAsync(axis, ct);

        /* An axis the caller was allocated on directly is authoritative. */
        var own = Own(axis);
        if (own.Count > 0) return [.. own];

        /*
         * Otherwise the axis is finer than the one this tier was allocated on,
         * and what may be handed down is derived from the slice the caller
         * does hold. An Admin is allocated categories and sub-categories but no
         * program types, yet it appoints Operation Managers, who are allocated
         * on program types — so it may pass down exactly the program types that
         * sit inside its own sub-categories, and nothing else.
         *
         * Deriving rather than storing keeps the boundary honest: adding a
         * program type to a sub-category an Admin holds extends that Admin's
         * reach automatically, and adding one elsewhere never does.
         */
        return axis switch
        {
            ScopeAxis.SubCategory => await WithinCategoriesAsync(ct),
            ScopeAxis.ProgramType => await ProgramTypesInScopeAsync(ct),
            ScopeAxis.District => await PermittedDistrictsAsync(ct),
            /* Category and State have nothing above them to derive from, so an
               empty allocation there really does mean nothing. */
            _ => [],
        };
    }

    private IReadOnlyList<int> Own(ScopeAxis axis) => axis switch
    {
        ScopeAxis.Category => user.ScopeCategoryIds,
        ScopeAxis.SubCategory => user.ScopeSubCategoryIds,
        ScopeAxis.ProgramType => user.ScopeProgramTypeIds,
        ScopeAxis.State => user.ScopeStateCodes,
        ScopeAxis.District => user.ScopeDistrictCodes,
        _ => [],
    };

    private async Task<List<int>> WithinCategoriesAsync(CancellationToken ct)
    {
        var categories = user.ScopeCategoryIds;
        if (categories.Count == 0) return [];
        return await db.SubCategories
            .Where(s => categories.Contains(s.CategoryId))
            .Select(s => s.Id).ToListAsync(ct);
    }

    /// <summary>
    /// Program types inside the caller's sub-categories, falling back to its
    /// categories when it holds no sub-categories of its own.
    /// </summary>
    private async Task<List<int>> ProgramTypesInScopeAsync(CancellationToken ct)
    {
        var subCategories = user.ScopeSubCategoryIds;
        if (subCategories.Count > 0)
        {
            return await db.ProgramTypes
                .Where(p => subCategories.Contains(p.SubCategoryId))
                .Select(p => p.Id).ToListAsync(ct);
        }

        var categories = user.ScopeCategoryIds;
        if (categories.Count == 0) return [];
        return await db.ProgramTypes
            .Where(p => categories.Contains(p.CategoryId))
            .Select(p => p.Id).ToListAsync(ct);
    }

    private async Task<List<int>> WholeMasterAsync(ScopeAxis axis, CancellationToken ct) =>
        axis switch
        {
            ScopeAxis.Category =>
                await db.Categories.Where(c => c.Status == RecordStatus.Active)
                    .Select(c => c.Id).ToListAsync(ct),
            ScopeAxis.SubCategory =>
                await db.SubCategories.Where(c => c.Status == RecordStatus.Active)
                    .Select(c => c.Id).ToListAsync(ct),
            ScopeAxis.ProgramType =>
                await db.ProgramTypes.Where(c => c.Status == RecordStatus.Active)
                    .Select(c => c.Id).ToListAsync(ct),
            ScopeAxis.State => await db.States.Select(s => s.Code).ToListAsync(ct),
            ScopeAxis.District => await db.Districts.Select(d => d.Code).ToListAsync(ct),
            _ => [],
        };

    /// <summary>
    /// Districts the caller may hand down, limited to the states they hold.
    /// A coordinator's districts must sit inside the agency's states, so the
    /// two axes cannot drift apart.
    /// </summary>
    public async Task<List<int>> PermittedDistrictsAsync(CancellationToken ct)
    {
        if (!user.IsMasterScoped) return await WholeMasterAsync(ScopeAxis.District, ct);

        var states = user.ScopeStateCodes;
        if (states.Count == 0) return [];

        return await db.Districts
            .Where(d => states.Contains(d.StateCode))
            .Select(d => d.Code)
            .ToListAsync(ct);
    }

    private static string Label(ScopeAxis axis) => axis switch
    {
        ScopeAxis.Category => "category",
        ScopeAxis.SubCategory => "sub-category",
        ScopeAxis.ProgramType => "program type",
        ScopeAxis.State => "state",
        _ => "district",
    };

    private static string Plural(ScopeAxis axis) => axis switch
    {
        ScopeAxis.Category => "categories",
        ScopeAxis.SubCategory => "sub-categories",
        ScopeAxis.ProgramType => "program types",
        ScopeAxis.State => "states",
        _ => "districts",
    };
}
