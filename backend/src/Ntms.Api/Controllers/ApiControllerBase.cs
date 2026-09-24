using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Application.Common;
using Ntms.Infrastructure.Identity;

namespace Ntms.Api.Controllers;

/// <summary>
/// Shared plumbing: every action answers with the same envelope, and every
/// controller is authenticated unless it opts out.
/// </summary>
[ApiController]
[Authorize]
[Route("api/[controller]")]
[Produces("application/json")]
public abstract class ApiControllerBase : ControllerBase
{
    private ICurrentUser? _currentUser;

    protected ICurrentUser CurrentUser =>
        _currentUser ??= HttpContext.RequestServices.GetRequiredService<ICurrentUser>();

    protected int CurrentUserId =>
        CurrentUser.UserId ?? throw new AppException("Not signed in.", 401);

    protected static ActionResult<ApiEnvelope<T>> Envelope<T>(T data, string? message = null) =>
        new OkObjectResult(ApiEnvelope<T>.Ok(data, message));
}
