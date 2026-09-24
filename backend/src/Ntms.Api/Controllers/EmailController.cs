using Microsoft.AspNetCore.Mvc;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>
/// Outgoing mail: the sender account, the SMTP connection, and the wording of
/// every transactional message. All of it is Super Admin territory, so the
/// whole controller sits behind the settings permission.
/// </summary>
[Route("api/email")]
[HasPermission(Permissions.SettingsManage)]
public class EmailController(EmailAdminService service) : ApiControllerBase
{
    [HttpGet("settings")]
    public async Task<ActionResult<ApiEnvelope<EmailSettingsDto>>> Settings(CancellationToken ct) =>
        Envelope(await service.GetSettingsAsync(ct));

    [HttpPut("settings")]
    public async Task<ActionResult<ApiEnvelope<EmailSettingsDto>>> UpdateSettings(
        [FromBody] EmailSettingsUpdateDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateSettingsAsync(dto, ct), "Email settings saved.");

    /// <summary>Proves the settings by sending a real message.</summary>
    [HttpPost("settings/test")]
    public async Task<ActionResult<ApiEnvelope<bool>>> SendTest(
        [FromBody] SendTestEmailDto dto, CancellationToken ct)
    {
        await service.SendTestAsync(dto.To, ct);
        return Envelope(true, $"Test message sent to {dto.To}.");
    }

    /// <summary>Recent delivery attempts, so a missing message can be traced.</summary>
    [HttpGet("log")]
    public async Task<ActionResult<ApiEnvelope<List<EmailLogDto>>>> Log(
        [FromQuery] int take = 50, CancellationToken ct = default) =>
        Envelope(await service.RecentLogAsync(take, ct));

    [HttpGet("templates")]
    public async Task<ActionResult<ApiEnvelope<List<EmailTemplateDto>>>> Templates(
        CancellationToken ct) =>
        Envelope(await service.ListTemplatesAsync(ct));

    [HttpGet("templates/{key}")]
    public async Task<ActionResult<ApiEnvelope<EmailTemplateDto>>> Template(
        string key, CancellationToken ct) =>
        Envelope(await service.GetTemplateAsync(key, ct));

    [HttpPut("templates/{key}")]
    public async Task<ActionResult<ApiEnvelope<EmailTemplateDto>>> UpdateTemplate(
        string key, [FromBody] EmailTemplateUpdateDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateTemplateAsync(key, dto, ct), "Template saved.");

    [HttpPost("templates/{key}/reset")]
    public async Task<ActionResult<ApiEnvelope<EmailTemplateDto>>> ResetTemplate(
        string key, CancellationToken ct) =>
        Envelope(await service.ResetTemplateAsync(key, ct), "Template restored to the original.");

    /// <summary>Renders a draft with sample values, without sending it.</summary>
    [HttpPost("templates/{key}/preview")]
    public async Task<ActionResult<ApiEnvelope<EmailPreviewDto>>> Preview(
        string key, [FromBody] EmailTemplateUpdateDto? draft, CancellationToken ct) =>
        Envelope(await service.PreviewAsync(key, draft, ct));
}
