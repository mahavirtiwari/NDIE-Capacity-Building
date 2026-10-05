using Ntms.Domain.Entities;
using Ntms.Infrastructure.Identity;

namespace Ntms.Infrastructure.Persistence;

/// <summary>
/// Narrows a query to the slice of the estate the signed-in account was
/// allocated. Applied at the base query of each service so no read path can
/// forget it — enforcing it here rather than in the UI is what makes it a
/// boundary rather than a convention.
///
/// Super Admin and the Ministry are unscoped and pass through untouched.
/// Everyone else is confined to their allocation, and an <b>empty</b>
/// allocation on an axis that applies to their tier grants nothing on that
/// axis. That is deliberate: an allocation form left half-finished must not
/// silently hand over the whole estate, which is why "select all" exists — it
/// records full reach as an explicit, auditable choice.
///
/// An axis that does not apply to a tier places no restriction. A coordinator
/// is allocated program types, states and districts but never categories, so
/// their category list is legitimately empty and is not treated as a denial.
/// </summary>
public static class MasterScopeExtensions
{
    /// <summary>
    /// Builds the predicate pieces once. <c>Applies</c> says whether the tier
    /// is allocated on this axis at all; when it is, the allocation is
    /// authoritative even if empty.
    /// </summary>
    private static bool Denies(ICurrentUser user, ScopeAxisKind axis) =>
        user.Tier is { } tier
        && Application.Common.RoleHierarchy.AxesFor(tier).HasFlag(Translate(axis))
        && Values(user, axis).Count == 0;

    private static Application.Common.ScopeAxis Translate(ScopeAxisKind axis) => axis switch
    {
        ScopeAxisKind.Category => Application.Common.ScopeAxis.Category,
        ScopeAxisKind.SubCategory => Application.Common.ScopeAxis.SubCategory,
        ScopeAxisKind.ProgramType => Application.Common.ScopeAxis.ProgramType,
        ScopeAxisKind.State => Application.Common.ScopeAxis.State,
        _ => Application.Common.ScopeAxis.District,
    };

    private static IReadOnlyList<int> Values(ICurrentUser user, ScopeAxisKind axis) => axis switch
    {
        ScopeAxisKind.Category => user.ScopeCategoryIds,
        ScopeAxisKind.SubCategory => user.ScopeSubCategoryIds,
        ScopeAxisKind.ProgramType => user.ScopeProgramTypeIds,
        ScopeAxisKind.State => user.ScopeStateCodes,
        _ => user.ScopeDistrictCodes,
    };

    private enum ScopeAxisKind { Category, SubCategory, ProgramType, State, District }

    public static IQueryable<TrainingApplication> WithinScope(
        this IQueryable<TrainingApplication> query, ICurrentUser user)
    {
        if (!user.IsMasterScoped) return query;

        /* A tier allocated on an axis with nothing selected sees nothing at
           all, so the whole query collapses rather than widening. */
        if (Denies(user, ScopeAxisKind.Category) || Denies(user, ScopeAxisKind.SubCategory)
            || Denies(user, ScopeAxisKind.ProgramType) || Denies(user, ScopeAxisKind.State))
        {
            return query.Where(_ => false);
        }

        var categories = user.ScopeCategoryIds;
        var subCategories = user.ScopeSubCategoryIds;
        var programTypes = user.ScopeProgramTypeIds;
        var states = user.ScopeStateCodes;
        var districts = user.ScopeDistrictCodes;

        if (categories.Count > 0) query = query.Where(a => categories.Contains(a.CategoryId));
        if (subCategories.Count > 0) query = query.Where(a => subCategories.Contains(a.SubCategoryId));
        if (programTypes.Count > 0) query = query.Where(a => programTypes.Contains(a.ProgramTypeId));
        if (states.Count > 0)
            query = query.Where(a => a.StateCode != null && states.Contains(a.StateCode.Value));
        if (districts.Count > 0)
            query = query.Where(a => a.DistrictCode != null && districts.Contains(a.DistrictCode.Value));

        return query;
    }

    public static IQueryable<Programme> WithinScope(
        this IQueryable<Programme> query, ICurrentUser user)
    {
        if (!user.IsMasterScoped) return query;

        if (Denies(user, ScopeAxisKind.Category) || Denies(user, ScopeAxisKind.SubCategory)
            || Denies(user, ScopeAxisKind.ProgramType) || Denies(user, ScopeAxisKind.State))
        {
            return query.Where(_ => false);
        }

        var categories = user.ScopeCategoryIds;
        var subCategories = user.ScopeSubCategoryIds;
        var programTypes = user.ScopeProgramTypeIds;
        var states = user.ScopeStateCodes;

        if (categories.Count > 0) query = query.Where(p => categories.Contains(p.CategoryId));
        if (subCategories.Count > 0) query = query.Where(p => subCategories.Contains(p.SubCategoryId));
        if (programTypes.Count > 0) query = query.Where(p => programTypes.Contains(p.ProgramTypeId));
        if (states.Count > 0) query = query.Where(p => states.Contains(p.StateCode));

        /* An agency login only ever sees its own programmes, whatever else its
           allocation might permit.
 
           Closed, not open. This used to apply only when the login carried an
           agency, so one that did not — a login issued before the agency was
           attached, or attached by hand — skipped the rule entirely and read
           every batch its program types and states touched, which is every
           other agency working the same patch. The agency register next door
           has always failed closed in that case; this now matches it. */
        if (user.Tier == Domain.Common.BaseRole.AgencyAdmin)
        {
            return user.AgencyId is { } agencyId
                ? query.Where(p => p.AgencyId == agencyId)
                : query.Where(_ => false);
        }

        /* Above the agency, the chain rather than the overlap.
 
           An Operation Manager sees the batches of the agencies it
           empanelled, and the Admin above sees those of the managers it
           appointed. Allocation alone put two managers whose program types
           overlap into each other's work: both hold Assessor - Silver in
           Delhi, so both read every batch either one's agencies raise.
 
           Agencies empanelled before the owner was recorded have none, and
           stay visible from the allocation alone — they belong to nobody to
           hide them from. */
        var self = user.UserId ?? 0;

        if (user.Tier == Domain.Common.BaseRole.OperationManager)
        {
            query = query.Where(p =>
                p.Agency!.OwnerUserId == null || p.Agency.OwnerUserId == self);
        }
        else if (user.Tier == Domain.Common.BaseRole.Admin)
        {
            query = query.Where(p =>
                p.Agency!.OwnerUserId == null
                || p.Agency.OwnerUserId == self
                || p.Agency.OwnerUser!.ReportsToUserId == self);
        }

        return query;
    }

    public static IQueryable<Applicant> WithinScope(
        this IQueryable<Applicant> query, ICurrentUser user)
    {
        if (!user.IsMasterScoped) return query;

        if (Denies(user, ScopeAxisKind.Category) || Denies(user, ScopeAxisKind.SubCategory)
            || Denies(user, ScopeAxisKind.State))
        {
            return query.Where(_ => false);
        }

        var categories = user.ScopeCategoryIds;
        var subCategories = user.ScopeSubCategoryIds;
        var states = user.ScopeStateCodes;
        var districts = user.ScopeDistrictCodes;

        /* Which disciplines an applicant is in comes from the profiles they
           hold, not from the columns on the account.

           Those columns record the first discipline they entered and are
           kept for the reports that group by one, but an account may now
           hold a profile in each category — reading the column would hide
           somebody from the officer who scrutinises their second profile.
           Anybody who has started no profile at all is in no category and
           is correctly outside a scope that names any. */
        if (categories.Count > 0)
            query = query.Where(a => a.ProfileSubmissions.Any(s => categories.Contains(s.CategoryId)));
        if (subCategories.Count > 0)
            query = query.Where(
                a => a.ProfileSubmissions.Any(s => subCategories.Contains(s.SubCategoryId)));
        if (states.Count > 0)
            query = query.Where(a => a.StateCode != null && states.Contains(a.StateCode.Value));
        if (districts.Count > 0)
            query = query.Where(a => a.DistrictCode != null && districts.Contains(a.DistrictCode.Value));

        return query;
    }

    /// <summary>
    /// Portal accounts an account may see.
    ///
    /// Five roles now hold <c>users.view</c>, so without this an Implementing
    /// Agency could list every account in the system — including the Super
    /// Admin's contact details. Visibility follows the same chain as creation:
    /// you see what is beneath you, plus yourself.
    ///
    /// Super Admin and the Ministry are the exceptions, both by design. The
    /// Ministry sees everything and can change none of it.
    /// </summary>
    public static IQueryable<PortalUser> VisibleTo(
        this IQueryable<PortalUser> query, ICurrentUser user)
    {
        if (user.Tier is not { } tier) return query.Where(_ => false);

        if (tier is Domain.Common.BaseRole.SuperAdmin or Domain.Common.BaseRole.Ministry)
        {
            return query;
        }

        var self = user.UserId ?? 0;

        /* The accounts beneath this one in the delegation chain, not every
           account of a junior tier.

           Being senior to a tier is not the same as being answerable for a
           particular account of it: two Admins each create their own Operation
           Managers, and neither has business reading the other's. The chain is
           recorded on the account when it is created — whoever created it is
           who it reports to — so "mine" is the subtree rooted at me.

           Written out four deep rather than recursively because the chain is
           four deep: Admin, Operation Manager, Implementing Agency,
           Coordinator. A fixed set of left joins stays in SQL, where a
           recursive walk would mean loading the table and doing it here. If a
           tier is ever added, add a line.

           An account with no creator recorded — everything that predates the
           chain being kept — is not in anybody's subtree and is visible to the
           Super Admin and the Ministry alone, who see everything. That is the
           safe direction for an account nobody can be shown to own. */
        query = query.Where(u =>
            u.Id == self
            || u.ReportsToUserId == self
            || u.ReportsToUser!.ReportsToUserId == self
            || u.ReportsToUser!.ReportsToUser!.ReportsToUserId == self
            || u.ReportsToUser!.ReportsToUser!.ReportsToUser!.ReportsToUserId == self);

        /* An agency login sees only its own people, whatever the chain says. */
        if (tier == Domain.Common.BaseRole.AgencyAdmin)
        {
            query = user.AgencyId is { } agencyId
                ? query.Where(u => u.AgencyId == agencyId || u.Id == self)
                : query.Where(u => u.Id == self);
        }

        return query;
    }

    /// <summary>
    /// Agencies an account may see. An Operation Manager sees the ones inside
    /// its allocation; an agency login sees only itself.
    /// </summary>
    public static IQueryable<ImplementingAgency> WithinScope(
        this IQueryable<ImplementingAgency> query, ICurrentUser user)
    {
        if (!user.IsMasterScoped) return query;

        if (user.Tier == Domain.Common.BaseRole.AgencyAdmin)
        {
            return user.AgencyId is { } own
                ? query.Where(a => a.Id == own)
                : query.Where(_ => false);
        }

        if (Denies(user, ScopeAxisKind.ProgramType) || Denies(user, ScopeAxisKind.State))
        {
            return query.Where(_ => false);
        }

        var programTypes = user.ScopeProgramTypeIds;
        var states = user.ScopeStateCodes;

        /*
         * An agency is empanelled for program types and states, so those are
         * the only axes it is matched on. Category and sub-category are not
         * used here even when the manager holds them: a program type already
         * belongs to exactly one sub-category and category, so filtering on it
         * is both sufficient and stricter. Filtering on category as well would
         * hide an agency that simply has no category rows of its own.
         *
         * Matched on the agency's allocation, not its registered office: one
         * headquartered in Delhi and empanelled for Bihar belongs to the
         * manager who holds Bihar.
         */
        if (programTypes.Count > 0)
            query = query.Where(a => a.ProgramTypes.Any(p => programTypes.Contains(p.ProgramTypeId)));
        if (states.Count > 0)
            query = query.Where(a => a.States.Any(s => states.Contains(s.StateCode)));

        return query;
    }
}
