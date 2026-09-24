using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Ntms.Application.Common;

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
