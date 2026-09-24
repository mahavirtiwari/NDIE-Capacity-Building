using Microsoft.EntityFrameworkCore;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Identity;

/// <summary>The slice of the estate an account was allocated, one list per axis.</summary>
public sealed record UserScope(
    IReadOnlyList<int> CategoryIds,
    IReadOnlyList<int> SubCategoryIds,
    IReadOnlyList<int> ProgramTypeIds,
    IReadOnlyList<int> StateCodes,
    IReadOnlyList<int> DistrictCodes)
{
    public static readonly UserScope Empty = new([], [], [], [], []);
}

/// <summary>
/// Reads an account's allocation from the database.
///
/// It used to travel on the access token, one claim per allocated id. That is
/// the obvious design until you see the size of a real allocation: a coordinator
/// holding every district of every state carries some seven hundred and sixty
/// of them, and the token reached seven kilobytes — past the eight-kilobyte
/// header limit most proxies apply by default, and close enough to it that a
/// slightly larger allocation would have taken the whole login down behind a
/// gateway rather than in a way anyone could debug.
///
/// So the token now carries only who you are and what you may do, both small
/// and both stable. The allocation is looked up per request, which also means a
/// scope that is narrowed takes effect on the next request rather than whenever
/// the holder's token happens to expire.
/// </summary>
public class UserScopeProvider(NtmsDbContext db)
{
    /// <summary>
    /// The five lists in one round trip.
    ///
    /// Split rather than joined: allocations multiply against each other, and
    /// joining them is what made the user list take five seconds before.
    /// </summary>
    public async Task<UserScope> LoadAsync(int userId, CancellationToken ct)
    {
        var user = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => new
            {
                Categories = u.Categories.Select(x => x.CategoryId).ToList(),
                SubCategories = u.SubCategories.Select(x => x.SubCategoryId).ToList(),
                ProgramTypes = u.ProgramTypes.Select(x => x.ProgramTypeId).ToList(),
                States = u.States.Select(x => x.StateCode).ToList(),
                Districts = u.Districts.Select(x => x.DistrictCode).ToList(),
            })
            .AsSplitQuery()
            .FirstOrDefaultAsync(ct);

        /* A missing user is an empty allocation, not a full one. The account was
           deleted or disabled between the token being issued and this request,
           and an empty allocation grants nothing. */
        return user is null
            ? UserScope.Empty
            : new UserScope(
                user.Categories, user.SubCategories, user.ProgramTypes,
                user.States, user.Districts);
    }
}
