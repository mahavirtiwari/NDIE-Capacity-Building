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
/// narrow: two routes, both returning <see cref="PublicProgrammeDto"/>, which
/// carries what somebody deciding whether to attend needs and nothing about
/// who is already enrolled or who to ring.
/// </summary>
[Route("api/public/programmes")]
[AllowAnonymous]
public class PublicCatalogueController(ProgrammeCatalogueService catalogue) : ApiControllerBase
{
    /// <summary>Everything currently open, soonest first.</summary>
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<List<PublicProgrammeDto>>>> Open(
        [FromQuery] int? programTypeId, [FromQuery] int? stateCode, CancellationToken ct) =>
        Envelope(await catalogue.OpenAsync(programTypeId, stateCode, ct));

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
