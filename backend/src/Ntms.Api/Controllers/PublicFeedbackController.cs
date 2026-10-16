using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>
/// The feedback form behind the link in the e-mail.
///
/// Anonymous on purpose. The ask reaches somebody who has finished a
/// course and has no reason to be signed in to anything — and requiring a
/// sign-in to answer an anonymous form would be the surest way of making
/// people believe it is not anonymous.
///
/// The token in the address is what is checked. It stands for one place on
/// one batch, answers one form once, and expires. Nothing here says who
/// holds it, and nothing written from here records that either.
/// </summary>
[Route("api/public/feedback")]
[AllowAnonymous]
public class PublicFeedbackController(FeedbackService service) : ApiControllerBase
{
    /// <summary>The batch being asked about, and the form to answer.</summary>
    [HttpGet("{token}")]
    public async Task<ActionResult<ApiEnvelope<FeedbackLinkDto>>> Open(
        string token, CancellationToken ct) =>
        Envelope(await service.ByTokenAsync(token, ct));

    /// <summary>The answers.</summary>
    [HttpPost("{token}")]
    public async Task<ActionResult<ApiEnvelope<bool>>> Submit(
        string token, [FromBody] FeedbackSubmitDto dto, CancellationToken ct)
    {
        await service.SubmitByTokenAsync(token, dto.Answers, ct);
        return Envelope(true, "Thank you — your feedback has been recorded anonymously.");
    }
}
