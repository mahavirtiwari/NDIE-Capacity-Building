using Microsoft.AspNetCore.Mvc;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>
/// Reports, assembled on request and never stored.
///
/// The portal renders what these return as a printable page and the browser
/// turns it into a PDF on the reader's own machine. Nothing is generated into
/// a file here, and nothing is kept: a stored report is a copy of the record
/// that stops matching it.
/// </summary>
[Route("api/reports")]
public class ReportsController(ReportService service) : ApiControllerBase
{
    /// <summary>The programmes a report can be run for, by programme type.</summary>
    [HttpGet("programmes")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<ReportProgrammeDto>>>> Programmes(
        [FromQuery] PagedRequest request,
        [FromQuery] int? categoryId,
        [FromQuery] int? subCategoryId,
        [FromQuery] int? programTypeId,
        [FromQuery] int? agencyId,
        [FromQuery] int? stateCode,
        [FromQuery] DateOnly? from,
        [FromQuery] DateOnly? to,
        CancellationToken ct) =>
        Envelope(await service.ProgrammesAsync(
            request, categoryId, subCategoryId, programTypeId, agencyId, stateCode, from, to, ct));

    /// <summary>One programme in full: venue, trainers, participants, attendance, monitoring.</summary>
    [HttpGet("programmes/{id:int}")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<ActionResult<ApiEnvelope<ProgrammeReportDto>>> Programme(
        int id, CancellationToken ct) =>
        Envelope(await service.ProgrammeAsync(id, ct));
}
