using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Infrastructure.Services;
using Ntms.Infrastructure.Storage;

namespace Ntms.Api.Controllers;

/// <summary>
/// Quality control on conducted programmes.
///
/// Three queues and a decision. Reading them needs only the programmes
/// key, because the office at large has a legitimate interest in knowing
/// what has been checked and what is waiting; deciding needs programs.qc,
/// which the Operation Manager holds and nobody else does. The service
/// enforces that as well, so a route added later without the attribute
/// does not quietly open the decision to everybody.
/// </summary>
[ApiController]
[Route("api/qc")]
[Authorize]
public class QcController(QcService service) : ApiControllerBase
{
    /// <summary>
    /// One of the three queues.
    /// </summary>
    /// <param name="status">Pending, Approved or Rejected.</param>
    [HttpGet("programmes")]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<QcProgrammeDto>>>> Queue(
        [FromQuery] PagedRequest request,
        CancellationToken ct,
        [FromQuery] string status = "Pending",
        [FromQuery] int? programTypeId = null,
        [FromQuery] int? agencyId = null) =>
        Envelope(await service.QueueAsync(
            request, Parse(status), programTypeId, agencyId, ct));

    /// <summary>How many sit in each queue, for the tabs.</summary>
    [HttpGet("counts")]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<ActionResult<ApiEnvelope<QcCountsDto>>> Counts(
        CancellationToken ct,
        [FromQuery] int? programTypeId = null,
        [FromQuery] int? agencyId = null) =>
        Envelope(await service.CountsAsync(programTypeId, agencyId, ct));

    /// <summary>One submitted programme.</summary>
    [HttpGet("programmes/{programmeId:int}")]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<ActionResult<ApiEnvelope<QcProgrammeDto>>> Get(
        int programmeId, CancellationToken ct) =>
        Envelope(await service.GetAsync(programmeId, ct));

    [HttpPost("programmes/{programmeId:int}/approve")]
    [HasPermission(Permissions.ProgramsQc)]
    public async Task<ActionResult<ApiEnvelope<QcProgrammeDto>>> Approve(
        int programmeId, [FromBody] QcDecisionDto dto, CancellationToken ct) =>
        Envelope(
            await service.ApproveAsync(programmeId, dto.Remarks, ct),
            "Quality check passed. The report is now in Reports.");

    [HttpPost("programmes/{programmeId:int}/reject")]
    [HasPermission(Permissions.ProgramsQc)]
    public async Task<ActionResult<ApiEnvelope<QcProgrammeDto>>> Reject(
        int programmeId, [FromBody] QcDecisionDto dto, CancellationToken ct) =>
        Envelope(
            await service.RejectAsync(programmeId, dto.Remarks, ct),
            "Report sent back. The batch is marked QC rejected.");

    /// <summary>
    /// The programme's report, as a page.
    ///
    /// HTML rather than a stored PDF: it is built from the sealed record
    /// each time, so there is nothing kept that could fall out of step
    /// with it, and a browser prints it to PDF with the reader's own
    /// paper size and margins. <c>?download=true</c> sends it as a file
    /// instead of showing it.
    /// </summary>
    [HttpGet("programmes/{programmeId:int}/report")]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<IActionResult> Report(
        int programmeId,
        [FromServices] MonitoringPhotoStore photos,
        CancellationToken ct,
        [FromQuery] bool download = false)
    {
        var rendered = await service.ReportAsync(programmeId, photos, ct);

        Response.Headers.ContentDisposition =
            $"{(download ? "attachment" : "inline")}; "
            + $"filename=\"{Uri.EscapeDataString(rendered.FileName)}\"";

        /* The document embeds its own photographs and loads nothing from
           anywhere, so it is safe to render — and told not to go looking
           if a later edit ever changes that. */
        Response.Headers["X-Content-Type-Options"] = "nosniff";

        return Content(rendered.Html, "text/html; charset=utf-8");
    }

    private static QcStatus Parse(string status) =>
        Enum.TryParse<QcStatus>(status, ignoreCase: true, out var parsed)
            ? parsed
            : throw new AppException("Status must be Pending, Approved or Rejected.");
}
