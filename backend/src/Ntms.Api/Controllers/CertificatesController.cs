using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Infrastructure.Certificates;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>
/// Awarding certificates and producing the documents.
///
/// Issuing is a programme operation, so it sits behind the programme
/// permissions rather than the masters ones — the people who run a batch are
/// the people who certify it.
/// </summary>
[Route("api/certificates")]
[Authorize]
public class CertificatesController(CertificateService service) : ApiControllerBase
{
    /// <summary>Everyone on a programme and what they are owed.</summary>
    [HttpGet("programme/{programmeId:int}")]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<ActionResult<ApiEnvelope<ProgrammeCertificateSummaryDto>>> ProgrammeSummary(
        int programmeId, CancellationToken ct) =>
        Envelope(await service.ProgrammeSummaryAsync(programmeId, ct));

    [HttpPost("participants/{participantId:int}")]
    [HasPermission(Permissions.ProgramsManage)]
    public async Task<ActionResult<ApiEnvelope<CertificateDto>>> Issue(
        int participantId, CancellationToken ct) =>
        Envelope(await service.IssueAsync(participantId, ct), "Certificate issued.");

    /// <summary>Issues to everyone eligible who does not already hold one.</summary>
    [HttpPost("programme/{programmeId:int}")]
    [HasPermission(Permissions.ProgramsManage)]
    public async Task<ActionResult<ApiEnvelope<ProgrammeCertificateSummaryDto>>> IssueProgramme(
        int programmeId, CancellationToken ct) =>
        Envelope(await service.IssueProgrammeAsync(programmeId, ct), "Certificates issued.");

    [HttpPost("{id:int}/revoke")]
    [HasPermission(Permissions.ProgramsManage)]
    public async Task<ActionResult<ApiEnvelope<CertificateDto>>> Revoke(
        int id, [FromBody] RevokeCertificateDto dto, CancellationToken ct) =>
        Envelope(await service.RevokeAsync(id, dto.Reason, ct), "Certificate revoked.");

    /// <summary>
    /// E-mails the holder their certificate details and where to verify it.
    /// The same message that goes out when one is issued.
    /// </summary>
    [HttpPost("{id:int}/resend")]
    [HasPermission(Permissions.ProgramsManage)]
    public async Task<ActionResult<ApiEnvelope<string>>> Resend(int id, CancellationToken ct)
    {
        var sentTo = await service.ResendAsync(
            id, $"{Request.Scheme}://{Request.Host}", ct);
        return Envelope(sentTo, $"Certificate sent to {sentTo}.");
    }

    /* --------------------------------------------------------- documents */

    /// <summary>The printable certificate, as a self-contained HTML page.</summary>
    [HttpGet("{id:int}/document")]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<IActionResult> Document(int id, CancellationToken ct) =>
        Page(await service.RenderAsync(id, ct));

    /// <summary>Every live certificate on a programme, one per page.</summary>
    [HttpGet("programme/{programmeId:int}/document")]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<IActionResult> ProgrammeDocument(int programmeId, CancellationToken ct) =>
        Page(await service.RenderProgrammeAsync(programmeId, ct));

    /// <summary>A specimen, so artwork can be checked before anyone is certified.</summary>
    [HttpGet("preview/{programTypeId:int}/{kind}")]
    [HasPermission(Permissions.MastersView)]
    public async Task<IActionResult> Preview(
        int programTypeId, CertificateKind kind, CancellationToken ct) =>
        Page(await service.PreviewAsync(programTypeId, kind, ct));

    /* ------------------------------------------------------------ verify */

    /// <summary>
    /// Confirms a certificate number.
    ///
    /// Open to any signed-in account rather than to programme managers alone:
    /// checking whether a document is genuine is the one thing everybody needs
    /// to be able to do, and the answer reveals nothing that is not already
    /// printed on the certificate in the asker's hand.
    /// </summary>
    [HttpGet("verify")]
    public async Task<ActionResult<ApiEnvelope<CertificateVerificationDto>>> Verify(
        [FromQuery] string number, CancellationToken ct) =>
        Envelope(await service.VerifyAsync(number, ct));

    /* ---------------------------------------------------------- helpers */

    /// <summary>
    /// Serves a rendered document inline, so it opens in a tab ready to print
    /// rather than landing in the downloads folder.
    /// </summary>
    private IActionResult Page(CertificateRenderer.Rendered rendered)
    {
        Response.Headers.ContentDisposition = $"inline; filename=\"{rendered.FileName}\"";
        Response.Headers.CacheControl = "no-store";
        return Content(rendered.Html, "text/html", Encoding.UTF8);
    }
}
