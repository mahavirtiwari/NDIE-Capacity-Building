using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>
/// The portal's own sign-in. Not the applicant app's, which has its own
/// controller and its own account table: an applicant reaching
/// <c>me</c> or <c>contact</c> here would be acting on whichever portal
/// account shares its row number.
/// </summary>
[Route("api/auth")]
public class AuthController(AuthService auth) : ApiControllerBase
{
    /// <summary>Signs in with the system generated user ID, never the e-mail.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<LoginResponseDto>>> Login(
        [FromBody] LoginRequestDto request, CancellationToken ct) =>
        Envelope(await auth.LoginAsync(request, ct));

    [HttpPost("refresh")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<LoginResponseDto>>> Refresh(
        [FromBody] RefreshRequestDto request, CancellationToken ct) =>
        Envelope(await auth.RefreshAsync(request, ct));

    /// <summary>
    /// Starts a self-service password reset. Anonymous, and deliberately
    /// uninformative about whether the user ID exists.
    /// </summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<ForgotPasswordResultDto>>> ForgotPassword(
        [FromBody] ForgotPasswordDto dto, CancellationToken ct)
    {
        var result = await auth.ForgotPasswordAsync(dto, ct);
        return Envelope(result, result.Message);
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<bool>>> ResetPassword(
        [FromBody] ResetPasswordDto dto, CancellationToken ct)
    {
        await auth.ResetPasswordAsync(dto, ct);
        return Envelope(true, "Password reset. Sign in with your new password.");
    }

    [HttpPost("logout")]
    public async Task<ActionResult<ApiEnvelope<bool>>> Logout(
        [FromBody] RefreshRequestDto request, CancellationToken ct)
    {
        await auth.LogoutAsync(request.RefreshToken, ct);
        return Envelope(true, "Signed out.");
    }

    [HttpGet("me")]
    public async Task<ActionResult<ApiEnvelope<AuthUserDto>>> Me(CancellationToken ct) =>
        Envelope(await auth.MeAsync(CurrentUserId, ct));

    [HttpPost("change-password")]
    public async Task<ActionResult<ApiEnvelope<bool>>> ChangePassword(
        [FromBody] ChangePasswordDto dto, CancellationToken ct)
    {
        await auth.ChangePasswordAsync(CurrentUserId, dto, ct);
        return Envelope(true, "Password updated. Please sign in again.");
    }

    /// <summary>
    /// Updates the caller's own contact details. The user ID is untouched — an
    /// e-mail change never affects how the account signs in.
    /// </summary>
    [HttpPut("contact")]
    public async Task<ActionResult<ApiEnvelope<AuthUserDto>>> UpdateContact(
        [FromBody] UpdateContactDto dto, CancellationToken ct) =>
        Envelope(await auth.UpdateContactAsync(CurrentUserId, dto, ct), "Contact details updated.");
}
