using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

[Route("api/system")]
public class SystemSettingsController(SystemSettingService service) : ApiControllerBase
{
    /// <summary>
    /// Whether the site is closed, and what to say about it.
    ///
    /// Anonymous on purpose: the sign-in screen has to be able to explain why
    /// it will not let anybody in, and it has no token to ask with. Nothing
    /// beyond the notice itself is returned.
    /// </summary>
    [HttpGet("maintenance")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<MaintenanceStatusDto>>> Maintenance(
        CancellationToken ct) =>
        Envelope(await service.StatusAsync(ct));

    [HttpGet("settings")]
    [HasPermission(Permissions.SettingsManage)]
    public async Task<ActionResult<ApiEnvelope<SystemSettingsDto>>> Get(CancellationToken ct) =>
        Envelope(await service.GetAsync(ct));

    [HttpGet("settings/gateways")]
    [HasPermission(Permissions.SettingsManage)]
    public ActionResult<ApiEnvelope<IReadOnlyList<string>>> Gateways() =>
        Envelope(SystemSettingService.Gateways);

    [HttpPut("settings")]
    [HasPermission(Permissions.SettingsManage)]
    public async Task<ActionResult<ApiEnvelope<SystemSettingsDto>>> Update(
        [FromBody] SystemSettingsUpdateDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(dto, ct), "System settings saved.");
}
