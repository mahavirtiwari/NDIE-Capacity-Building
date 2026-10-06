using Microsoft.EntityFrameworkCore;
using Ntms.Infrastructure.Identity;

namespace Ntms.Infrastructure.Persistence;

/// <summary>
/// Which categories, sub-categories and program types an account may see.
///
/// An allocation names one or two axes and the rest follow from it. An Admin
/// given categories can see the sub-categories inside them; an agency given
/// program types can see the category those sit in. So this derives in both
/// directions, which is what makes it different from what may be
/// <i>allocated</i>: you can pass down a sub-category of a category you hold,
/// but holding a program type inside a category has never let you hand out
/// the category itself.
///
/// <b>Null means no narrowing at all</b> — Super Admin, the Ministry, and the
/// anonymous reads the applicant app makes before anybody signs in. An empty
/// list, by contrast, means the account holds nothing on that axis and so
/// sees nothing; the two are not interchangeable.
///
/// This lived as private methods on the lookup service, which is why the
/// dropdowns were narrowed correctly while the master list screens behind
/// them showed the whole estate. The derivation is the same for both, so it
/// belongs somewhere both can reach.
/// </summary>
public class MasterVisibility(NtmsDbContext db, ICurrentUser currentUser)
{
    public async Task<List<int>?> CategoriesAsync(CancellationToken ct)
    {
        if (!currentUser.IsMasterScoped) return null;

        if (currentUser.ScopeCategoryIds.Count > 0) return [.. currentUser.ScopeCategoryIds];

        if (currentUser.ScopeSubCategoryIds.Count > 0)
        {
            var subs = currentUser.ScopeSubCategoryIds;
            return await db.SubCategories.AsNoTracking()
                .Where(s => subs.Contains(s.Id))
                .Select(s => s.CategoryId).Distinct().ToListAsync(ct);
        }

        var types = currentUser.ScopeProgramTypeIds;
        if (types.Count == 0) return [];

        return await db.ProgramTypes.AsNoTracking()
            .Where(p => types.Contains(p.Id))
            .Select(p => p.CategoryId).Distinct().ToListAsync(ct);
    }

    public async Task<List<int>?> SubCategoriesAsync(CancellationToken ct)
    {
        if (!currentUser.IsMasterScoped) return null;

        if (currentUser.ScopeSubCategoryIds.Count > 0) return [.. currentUser.ScopeSubCategoryIds];

        if (currentUser.ScopeCategoryIds.Count > 0)
        {
            var categories = currentUser.ScopeCategoryIds;
            return await db.SubCategories.AsNoTracking()
                .Where(s => categories.Contains(s.CategoryId))
                .Select(s => s.Id).ToListAsync(ct);
        }

        var types = currentUser.ScopeProgramTypeIds;
        if (types.Count == 0) return [];

        return await db.ProgramTypes.AsNoTracking()
            .Where(p => types.Contains(p.Id))
            .Select(p => p.SubCategoryId).Distinct().ToListAsync(ct);
    }

    public async Task<List<int>?> ProgramTypesAsync(CancellationToken ct)
    {
        if (!currentUser.IsMasterScoped) return null;

        if (currentUser.ScopeProgramTypeIds.Count > 0) return [.. currentUser.ScopeProgramTypeIds];

        if (currentUser.ScopeSubCategoryIds.Count > 0)
        {
            var subs = currentUser.ScopeSubCategoryIds;
            return await db.ProgramTypes.AsNoTracking()
                .Where(p => subs.Contains(p.SubCategoryId))
                .Select(p => p.Id).ToListAsync(ct);
        }

        var categories = currentUser.ScopeCategoryIds;
        if (categories.Count == 0) return [];

        return await db.ProgramTypes.AsNoTracking()
            .Where(p => categories.Contains(p.CategoryId))
            .Select(p => p.Id).ToListAsync(ct);
    }

    public async Task<List<int>?> StatesAsync(CancellationToken ct)
    {
        if (!currentUser.IsMasterScoped) return null;

        if (currentUser.ScopeStateCodes.Count > 0) return [.. currentUser.ScopeStateCodes];

        var districts = currentUser.ScopeDistrictCodes;
        if (districts.Count == 0) return [];

        return await db.Districts.AsNoTracking()
            .Where(d => districts.Contains(d.Code))
            .Select(d => d.StateCode).Distinct().ToListAsync(ct);
    }

    public async Task<List<int>?> DistrictsAsync(CancellationToken ct)
    {
        if (!currentUser.IsMasterScoped) return null;

        if (currentUser.ScopeDistrictCodes.Count > 0) return [.. currentUser.ScopeDistrictCodes];

        var states = currentUser.ScopeStateCodes;
        if (states.Count == 0) return [];

        return await db.Districts.AsNoTracking()
            .Where(d => states.Contains(d.StateCode))
            .Select(d => d.Code).ToListAsync(ct);
    }
}
