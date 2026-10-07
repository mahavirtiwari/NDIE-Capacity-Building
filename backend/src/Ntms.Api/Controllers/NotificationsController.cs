using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>
/// What the scheme has said to the handsets, and the sending of something
/// new. The log is open to anybody who may read it; sending has a key of
/// its own, because a notice to every applicant in the country is not a
/// thing to hand out with a read permission.
/// </summary>
[Route("api/notifications")]
public class NotificationsController(NotificationBroadcastService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.NotificationsView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<NotificationDto>>>> List(
        [FromQuery] PagedRequest request, CancellationToken ct) =>
        Envelope(await service.ListAsync(request, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.NotificationsView)]
    public async Task<ActionResult<ApiEnvelope<NotificationDto>>> Get(
        int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    /// <summary>Writes one and, unless told otherwise, sends it there and then.</summary>
    [HttpPost]
    [HasPermission(Permissions.NotificationsSend)]
    public async Task<ActionResult<ApiEnvelope<NotificationDto>>> Create(
        [FromBody] NotificationUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Notification sent.");

    [HttpPost("{id:int}/send")]
    [HasPermission(Permissions.NotificationsSend)]
    public async Task<ActionResult<ApiEnvelope<NotificationDto>>> Send(
        int id, CancellationToken ct) =>
        Envelope(await service.SendAsync(id, ct), "Notification sent.");

    [HttpDelete("{id:int}")]
    [HasPermission(Permissions.NotificationsSend)]
    public async Task<ActionResult<ApiEnvelope<bool>>> Delete(int id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Envelope(true, "Draft removed.");
    }
}

/// <summary>
/// The handset's own end of it: saying where it can be reached, reading
/// what it has been sent, and saying it has been read.
///
/// Open to any signed-in account, applicant or staff, because both apps
/// come through here and the answer is scoped to whoever is asking.
/// </summary>
[Route("api/my-notifications")]
[Authorize]
public class MyNotificationsController(NotificationBroadcastService service) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<MyNotificationsDto>>> Mine(
        [FromQuery] int take = 50, CancellationToken ct = default) =>
        Envelope(await service.MineAsync(take, ct));

    [HttpPost("{id:int}/read")]
    public async Task<ActionResult<ApiEnvelope<bool>>> Read(int id, CancellationToken ct)
    {
        await service.MarkReadAsync(id, ct);
        return Envelope(true);
    }

    /// <summary>This handset, and the token the push service knows it by.</summary>
    [HttpPost("devices")]
    public async Task<ActionResult<ApiEnvelope<bool>>> Register(
        [FromBody] PushDeviceDto dto, CancellationToken ct)
    {
        await service.RegisterDeviceAsync(dto, ct);
        return Envelope(true);
    }

    /// <summary>Signing out: stop sending this account's notices here.</summary>
    [HttpDelete("devices/{token}")]
    public async Task<ActionResult<ApiEnvelope<bool>>> Retire(string token, CancellationToken ct)
    {
        await service.RetireDeviceAsync(token, ct);
        return Envelope(true);
    }
}
