using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>
/// The batches an agency can share a link to, readable without signing in.
///
/// This is the only anonymous read surface in the system, so it is deliberately
/// narrow: the batch listing, one batch by its code, and the handful of names
/// the listing's own filters are built from. What it returns is what somebody
/// deciding whether to attend needs, and nothing about who is already enrolled
/// or who to ring.
/// </summary>
[Route("api/public/programmes")]
[AllowAnonymous]
public class PublicCatalogueController(ProgrammeCatalogueService catalogue) : ApiControllerBase
{
    /// <summary>
    /// The public programme listing — every published batch, past and future,
    /// narrowed by state, district, schedule status, track or dates.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<PagedResult<PublicProgrammeDto>>>> List(
        [FromQuery] PublicProgrammeFilterDto filter,
        [FromQuery] PagedRequest request,
        CancellationToken ct) =>
        Envelope(await catalogue.SearchAsync(filter, request, ct));

    /// <summary>Just the batches taking registrations, soonest first.</summary>
    [HttpGet("open")]
    public async Task<ActionResult<ApiEnvelope<List<PublicProgrammeDto>>>> Open(
        [FromQuery] int? programTypeId, [FromQuery] int? stateCode, CancellationToken ct) =>
        Envelope(await catalogue.OpenAsync(programTypeId, stateCode, ct));

    /// <summary>
    /// The names behind the listing's filters.
    ///
    /// Served anonymously because the page that uses them is: without these the
    /// filters would be empty boxes. They are the same lists printed on any
    /// public notice — states, districts and the tracks on offer — and reveal
    /// nothing that is not already on the page they narrow.
    /// </summary>
    [HttpGet("filters")]
    public async Task<ActionResult<ApiEnvelope<PublicFilterOptionsDto>>> Filters(
        CancellationToken ct) =>
        Envelope(await catalogue.FilterOptionsAsync(ct));

    /// <summary>
    /// One batch by its code — the target of the shareable link.
    ///
    /// Keyed on the programme code rather than the database id: the code is
    /// already the batch's public identity, it appears on the paperwork, and a
    /// sequential row id in a public URL invites people to walk it.
    /// </summary>
    [HttpGet("{code}")]
    public async Task<ActionResult<ApiEnvelope<PublicProgrammeDto>>> ByCode(
        string code, CancellationToken ct) =>
        Envelope(await catalogue.ByCodeAsync(code, ct));
}
