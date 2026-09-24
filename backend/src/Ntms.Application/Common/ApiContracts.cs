namespace Ntms.Application.Common;

/// <summary>
/// Every response the API returns is wrapped in this envelope, so the client
/// never has to guess whether a payload is data or an error.
/// </summary>
public class ApiEnvelope<T>
{
    public bool Success { get; set; } = true;
    public string? Message { get; set; }
    public T? Data { get; set; }
    public IReadOnlyList<string>? Errors { get; set; }

    public static ApiEnvelope<T> Ok(T data, string? message = null) =>
        new() { Success = true, Data = data, Message = message };

    public static ApiEnvelope<T> Fail(string message, IReadOnlyList<string>? errors = null) =>
        new() { Success = false, Message = message, Errors = errors, Data = default };
}

/// <summary>Standard page of rows plus the total the client needs for paging.</summary>
public class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; set; } = [];
    public int Total { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

/// <summary>
/// Query string common to every list endpoint. Resource specific filters are
/// bound separately by each controller.
/// </summary>
public class PagedRequest
{
    private const int MaxPageSize = 200;
    private int _pageSize = 10;
    private int _page = 1;

    public int Page
    {
        get => _page;
        set => _page = value < 1 ? 1 : value;
    }

    public int PageSize
    {
        get => _pageSize;
        set => _pageSize = value is < 1 or > MaxPageSize ? 10 : value;
    }

    public string? Search { get; set; }
    public string? SortBy { get; set; }
    /// <summary>"asc" or "desc".</summary>
    public string? SortDir { get; set; }

    public bool Descending => string.Equals(SortDir, "desc", StringComparison.OrdinalIgnoreCase);
    public int Skip => (Page - 1) * PageSize;
}

/// <summary>Minimal shape used by every dropdown in the portal.</summary>
public class LookupItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Code { get; set; }
    public int? ParentId { get; set; }
}

/// <summary>Body of the PATCH /{resource}/{id}/status call.</summary>
public class StatusChangeDto
{
    public string Status { get; set; } = "Active";
}

/// <summary>Thrown by services for conditions the API maps to 4xx.</summary>
public class AppException(string message, int statusCode = 400) : Exception(message)
{
    public int StatusCode { get; } = statusCode;

    public static AppException NotFound(string what) => new($"{what} was not found.", 404);
    public static AppException Conflict(string message) => new(message, 409);
    public static AppException Forbidden(string message) => new(message, 403);
}
