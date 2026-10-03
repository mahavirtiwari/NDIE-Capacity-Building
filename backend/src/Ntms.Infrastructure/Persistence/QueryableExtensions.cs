using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Ntms.Application.Common;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;

namespace Ntms.Infrastructure.Persistence;

public static class QueryableExtensions
{
    /// <summary>
    /// Applies the sort the client asked for, falling back to a stable default.
    /// Unknown property names are ignored rather than throwing, so a stale
    /// bookmark cannot break a screen.
    /// </summary>
    public static IQueryable<T> ApplySort<T>(
        this IQueryable<T> query,
        PagedRequest request,
        IEntityType entityType,
        Expression<Func<T, object?>> fallback)
    {
        if (string.IsNullOrWhiteSpace(request.SortBy))
        {
            return request.Descending
                ? query.OrderByDescending(fallback)
                : query.OrderBy(fallback);
        }

        var property = entityType.GetProperties()
            .FirstOrDefault(p => string.Equals(p.Name, request.SortBy, StringComparison.OrdinalIgnoreCase));

        if (property is null)
        {
            return request.Descending
                ? query.OrderByDescending(fallback)
                : query.OrderBy(fallback);
        }

        var parameter = Expression.Parameter(typeof(T), "e");
        var body = Expression.Call(
            typeof(EF), nameof(EF.Property), [typeof(object)],
            parameter, Expression.Constant(property.Name));
        var selector = Expression.Lambda<Func<T, object>>(body, parameter);

        return request.Descending ? query.OrderByDescending(selector) : query.OrderBy(selector);
    }

    /// <summary>Runs the count and the page in one place.</summary>
    public static async Task<PagedResult<TDto>> ToPagedResultAsync<TEntity, TDto>(
        this IQueryable<TEntity> query,
        PagedRequest request,
        Func<TEntity, TDto> map,
        CancellationToken ct = default)
    {
        var total = await query.CountAsync(ct);
        var rows = await query.Skip(request.Skip).Take(request.PageSize).ToListAsync(ct);

        return new PagedResult<TDto>
        {
            Items = [.. rows.Select(map)],
            Total = total,
            Page = request.Page,
            PageSize = request.PageSize,
        };
    }

    /// <summary>`where` applied only when the value is present.</summary>
    public static IQueryable<T> WhereIf<T>(
        this IQueryable<T> query,
        bool condition,
        Expression<Func<T, bool>> predicate) =>
        condition ? query.Where(predicate) : query;
}

/// <summary>
/// What an applicant is allowed to see of the programmes register.
///
/// One definition, because three screens ask the same question and a fourth
/// will: the public catalogue, the batches an applicant can join, and which
/// tracks are worth offering them in the app. Written out once so they cannot
/// drift into disagreeing about what "open" means.
/// </summary>
public static class ProgrammeVisibility
{
    /// <summary>
    /// Permission has been given by the operation manager.
    ///
    /// A batch is raised by an implementing agency and sits at New until the
    /// tier above accepts it — an agency cannot accept its own. So these two
    /// states, and only these, mean somebody with the authority to say yes
    /// has said it. Rejected and postponed are the no; conducted is over.
    /// </summary>
    public static readonly ProgramStatus[] Approved =
    [
        ProgramStatus.PermissionAccepted,
        ProgramStatus.CalendarCreated,
    ];

    /// <summary>
    /// Approved, still taking people, and not already under way.
    ///
    /// Registration closing is separate from the status: a batch fills up, or
    /// is held back, without being rejected.
    /// </summary>
    public static IQueryable<Programme> OpenForRegistration(
        this IQueryable<Programme> query, DateOnly today) =>
        query.Where(p => Approved.Contains(p.Status)
                         && p.RegistrationsOpen
                         && p.StartDate >= today);
}
