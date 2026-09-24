using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>
/// Email verification for applicant sign-up. Anonymous by design — the caller
/// has no account yet.
/// </summary>
[Route("api/otp")]
[AllowAnonymous]
public class OtpController(OtpService otp) : ApiControllerBase
{
    public class SendOtpDto
    {
        public string Email { get; set; } = string.Empty;
        public string? Name { get; set; }
    }

    [HttpPost("send")]
    public async Task<ActionResult<ApiEnvelope<bool>>> Send(
        [FromBody] SendOtpDto dto, CancellationToken ct)
    {
        await otp.SendEmailOtpAsync(dto.Email, dto.Name ?? "Applicant", ct);
        return Envelope(true, "A verification code has been sent to your email.");
    }

    [HttpPost("verify")]
    public async Task<ActionResult<ApiEnvelope<bool>>> Verify(
        [FromBody] VerifyOtpDto dto, CancellationToken ct)
    {
        await otp.VerifyEmailOtpAsync(dto.Email, dto.Code, ct);
        return Envelope(true, "Email verified.");
    }
}
