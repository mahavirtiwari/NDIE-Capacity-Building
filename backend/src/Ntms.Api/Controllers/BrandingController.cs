using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>
/// Portal identity. Reading is anonymous so the sign-in screen and the mobile
/// app can brand themselves before anyone has a token; changing it needs the
/// settings permission, which only Super Admin holds by default.
/// </summary>
[Route("api/branding")]
public class BrandingController(BrandingService service) : ApiControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<BrandingDto>>> Get(CancellationToken ct) =>
        Envelope(await service.GetAsync(ct));

    /// <summary>The logo bitmap itself. Cached hard and busted by the version.</summary>
    [HttpGet("logo")]
    [AllowAnonymous]
    public Task<IActionResult> Logo(CancellationToken ct) =>
        SendLogo(BrandingService.LogoSlot.Primary, ct);

    /// <summary>The same mark drawn for a dark ground, where one was uploaded.</summary>
    [HttpGet("reversed-logo")]
    [AllowAnonymous]
    public Task<IActionResult> ReversedLogo(CancellationToken ct) =>
        SendLogo(BrandingService.LogoSlot.Reversed, ct);

    /// <summary>The accrediting or partner body's mark, e.g. QCI beside NDIE.</summary>
    [HttpGet("partner-logo")]
    [AllowAnonymous]
    public Task<IActionResult> PartnerLogo(CancellationToken ct) =>
        SendLogo(BrandingService.LogoSlot.Partner, ct);

    private async Task<IActionResult> SendLogo(BrandingService.LogoSlot slot, CancellationToken ct)
    {
        var logo = await service.GetLogoAsync(slot, ct);
        if (logo is null) return NotFound();

        Response.Headers.CacheControl = "public, max-age=31536000, immutable";
        return File(logo.Value.Content, logo.Value.ContentType);
    }

    [HttpPut]
    [HasPermission(Permissions.SettingsManage)]
    public async Task<ActionResult<ApiEnvelope<BrandingDto>>> Update(
        [FromBody] BrandingUpdateDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(dto, ct), "Branding updated.");

    [HttpPost("logo")]
    [HasPermission(Permissions.SettingsManage)]
    [RequestSizeLimit(1_048_576)]
    public Task<ActionResult<ApiEnvelope<BrandingDto>>> UploadLogo(
        IFormFile file, CancellationToken ct) =>
        Upload(file, BrandingService.LogoSlot.Primary, ct);

    [HttpPost("reversed-logo")]
    [HasPermission(Permissions.SettingsManage)]
    [RequestSizeLimit(1_048_576)]
    public Task<ActionResult<ApiEnvelope<BrandingDto>>> UploadReversedLogo(
        IFormFile file, CancellationToken ct) =>
        Upload(file, BrandingService.LogoSlot.Reversed, ct);

    [HttpPost("partner-logo")]
    [HasPermission(Permissions.SettingsManage)]
    [RequestSizeLimit(1_048_576)]
    public Task<ActionResult<ApiEnvelope<BrandingDto>>> UploadPartnerLogo(
        IFormFile file, CancellationToken ct) =>
        Upload(file, BrandingService.LogoSlot.Partner, ct);

    private async Task<ActionResult<ApiEnvelope<BrandingDto>>> Upload(
        IFormFile file, BrandingService.LogoSlot slot, CancellationToken ct)
    {
        if (file is null) throw new AppException("Choose a logo file to upload.");

        await using var stream = file.OpenReadStream();
        var result = await service.SetLogoAsync(
            stream, file.FileName, file.ContentType, file.Length, slot, ct);

        return Envelope(result, "Logo updated.");
    }

    [HttpDelete("logo")]
    [HasPermission(Permissions.SettingsManage)]
    public async Task<ActionResult<ApiEnvelope<BrandingDto>>> RemoveLogo(CancellationToken ct) =>
        Envelope(
            await service.RemoveLogoAsync(BrandingService.LogoSlot.Primary, ct), "Logo removed.");

    [HttpDelete("reversed-logo")]
    [HasPermission(Permissions.SettingsManage)]
    public async Task<ActionResult<ApiEnvelope<BrandingDto>>> RemoveReversedLogo(
        CancellationToken ct) =>
        Envelope(
            await service.RemoveLogoAsync(BrandingService.LogoSlot.Reversed, ct), "Logo removed.");

    [HttpDelete("partner-logo")]
    [HasPermission(Permissions.SettingsManage)]
    public async Task<ActionResult<ApiEnvelope<BrandingDto>>> RemovePartnerLogo(
        CancellationToken ct) =>
        Envelope(
            await service.RemoveLogoAsync(BrandingService.LogoSlot.Partner, ct), "Logo removed.");
}

/// <summary>
/// The wording on screens that are not driven by data.
///
/// The map is anonymous for the same reason branding is: it words the sign-in
/// page, which is read before anybody has an account. Editing is Super Admin.
/// </summary>
[Route("api/site-text")]
public class SiteTextController(SiteTextService service) : ApiControllerBase
{
    [HttpGet("map")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<Dictionary<string, string>>>> Map(
        CancellationToken ct) =>
        Envelope(await service.MapAsync(ct));

    [HttpGet]
    [HasPermission(Permissions.SettingsManage)]
    public async Task<ActionResult<ApiEnvelope<List<SiteTextDto>>>> List(CancellationToken ct) =>
        Envelope(await service.ListAsync(ct));

    [HttpPut("{key}")]
    [HasPermission(Permissions.SettingsManage)]
    public async Task<ActionResult<ApiEnvelope<SiteTextDto>>> Set(
        string key, [FromBody] SiteTextUpdateDto dto, CancellationToken ct) =>
        Envelope(await service.SetAsync(key, dto.Value, ct), "Wording saved.");

    [HttpPost("restore")]
    [HasPermission(Permissions.SettingsManage)]
    public async Task<ActionResult<ApiEnvelope<List<SiteTextDto>>>> RestoreAll(
        CancellationToken ct) =>
        Envelope(await service.RestoreAllAsync(ct), "Every string is back to the original wording.");
}
