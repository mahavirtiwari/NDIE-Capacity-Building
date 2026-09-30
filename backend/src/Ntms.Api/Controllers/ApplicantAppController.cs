using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>Sign-in for the mobile applicant app.</summary>
[Route("api/auth/applicant")]
public class ApplicantAuthController(ApplicantAuthService service) : ApiControllerBase
{
    /// <summary>Signs in with the generated applicant ID, never the e-mail.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<ApplicantLoginResponseDto>>> Login(
        [FromBody] ApplicantLoginRequestDto request, CancellationToken ct) =>
        Envelope(await service.LoginAsync(request, ct));

    /// <summary>
    /// Asks for a reset code by applicant ID or by e-mail.
    ///
    /// Anonymous, and deliberately uninformative: the reply is the same
    /// whether or not the account exists, so this cannot be used to discover
    /// which applicant IDs are real.
    /// </summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<ApplicantForgotPasswordResultDto>>> ForgotPassword(
        [FromBody] ApplicantForgotPasswordDto dto, CancellationToken ct)
    {
        var result = await service.ForgotPasswordAsync(dto, ct);
        return Envelope(result, result.Message);
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<bool>>> ResetPassword(
        [FromBody] ApplicantResetPasswordDto dto, CancellationToken ct)
    {
        await service.ResetPasswordAsync(dto, ct);
        return Envelope(true, "Password reset. Sign in with your new password.");
    }
}

/// <summary>
/// Everything the signed-in applicant can see about themselves. Scoped by the
/// applicant id on the token, so one applicant can never read another's data.
/// </summary>
[Route("api/me")]
[Authorize(Roles = "Applicant")]
public class ApplicantAppController(
    ApplicantAuthService service,
    ApplicationService applications,
    ProfileFormService forms,
    FeeService fees,
    TrainingMaterialService materials,
    ProgrammeCatalogueService catalogue,
    ExamSittingService exams,
    PaymentService payments,
    InvoiceService invoices,
    ProfileSubmissionService profile) : ApiControllerBase
{
    private int ApplicantId =>
        CurrentUser.ApplicantId
        ?? throw new AppException("This endpoint is for the applicant app.", 403);

    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<ApplicantDto>>> Me(CancellationToken ct) =>
        Envelope(await service.MeAsync(ApplicantId, ct));

    /// <summary>
    /// The batches open to this applicant, with whether they are already on
    /// each. Distinct from <c>programs</c>, which lists the tracks on offer:
    /// this lists the actual dated batches they can join.
    /// </summary>
    [HttpGet("batches")]
    public async Task<ActionResult<ApiEnvelope<List<ApplicantBatchDto>>>> Batches(
        CancellationToken ct) =>
        Envelope(await catalogue.ForApplicantAsync(ApplicantId, ct));

    [HttpPut]
    public async Task<ActionResult<ApiEnvelope<ApplicantDto>>> UpdateProfile(
        [FromBody] ApplicantProfileUpdateDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateProfileAsync(ApplicantId, dto, ct), "Profile updated.");

    [HttpPost("change-password")]
    public async Task<ActionResult<ApiEnvelope<bool>>> ChangePassword(
        [FromBody] ChangePasswordDto dto, CancellationToken ct)
    {
        await service.ChangePasswordAsync(ApplicantId, dto, ct);
        return Envelope(true, "Password updated.");
    }

    /// <summary>The programmes this applicant may apply for.</summary>
    [HttpGet("programs")]
    public async Task<ActionResult<ApiEnvelope<List<ApplicantProgramDto>>>> Programs(
        CancellationToken ct) =>
        Envelope(await service.AvailableProgramsAsync(ApplicantId, ct));

    /// <summary>
    /// The profile form behind one programme.
    ///
    /// Still addressed by program type, because that is what the applicant
    /// tapped; the form itself belongs to the discipline the program sits
    /// in, and the server resolves it. Keeping the route means an older app
    /// carries on working.
    /// </summary>
    [HttpGet("programs/{programTypeId:int}/form")]
    public async Task<ActionResult<ApiEnvelope<ProfileFormDto>>> Form(
        int programTypeId, CancellationToken ct) =>
        Envelope(await forms.GetByProgramTypeAsync(programTypeId, ct));

    /* ------------------------------------------------------- profile ----
       The gate. Everything under "programs" stays shut until the profile
       form has been read and accepted, so the app asks about this first. */

    /// <summary>
    /// Where this applicant stands with the profile form: what they sent,
    /// what scrutiny said, how many tries are left, and whether the
    /// discipline is shut to them for the moment.
    /// </summary>
    [HttpGet("profile-submission")]
    public async Task<ActionResult<ApiEnvelope<ProfileStandingDto>>> ProfileStanding(
        CancellationToken ct) =>
        Envelope(await profile.StandingAsync(ApplicantId, ct));

    /// <summary>The profile form this applicant fills, for their sub-category.</summary>
    [HttpGet("profile-form")]
    public async Task<ActionResult<ApiEnvelope<ProfileFormDto>>> MyProfileForm(
        CancellationToken ct)
    {
        var standing = await profile.StandingAsync(ApplicantId, ct);
        return Envelope(await forms.GetBySubCategoryAsync(standing.SubCategoryId, ct));
    }

    /// <summary>Sends the profile for scrutiny, as a fresh attempt.</summary>
    [HttpPost("profile-submission")]
    public async Task<ActionResult<ApiEnvelope<ProfileStandingDto>>> SubmitProfile(
        [FromBody] ProfileSubmitDto dto, CancellationToken ct) =>
        Envelope(
            await profile.SubmitAsync(ApplicantId, dto.Responses, ct),
            "Your profile has been sent for scrutiny.");

    /// <summary>The fee payable for one programme today.</summary>
    [HttpGet("programs/{programTypeId:int}/fee")]
    public async Task<ActionResult<ApiEnvelope<FeeStructureDto?>>> Fee(
        int programTypeId, CancellationToken ct) =>
        Envelope(await fees.CurrentForProgramTypeAsync(programTypeId, ct));

    [HttpGet("applications")]
    public async Task<ActionResult<ApiEnvelope<List<ApplicationDto>>>> Applications(
        CancellationToken ct) =>
        Envelope(await service.MyApplicationsAsync(ApplicantId, ct));

    /// <summary>Submits an application on behalf of the signed-in applicant.</summary>
    [HttpPost("applications")]
    public async Task<ActionResult<ApiEnvelope<ApplicationDto>>> Submit(
        [FromBody] ApplicationSubmitDto dto, CancellationToken ct)
    {
        /* The applicant id always comes from the token, never from the body. */
        dto.ApplicantId = ApplicantId;
        return Envelope(await applications.SubmitAsync(dto, ct), "Application submitted.");
    }

    /* --------------------------------------------------------- payments */

    /// <summary>
    /// What is payable on one application, broken down, and whether it can be
    /// paid right now. Answers either way: a screen has to be able to say why
    /// the button is not there.
    /// </summary>
    [HttpGet("applications/{id:int}/payment")]
    public async Task<ActionResult<ApiEnvelope<PaymentSummaryDto>>> PaymentSummary(
        int id, CancellationToken ct) =>
        Envelope(await payments.SummaryAsync(ApplicantId, id, ct));

    /// <summary>
    /// Opens an attempt and hands back the address to open in the browser.
    /// The app sends the payer out to it rather than hosting the gateway
    /// inside itself, so they get a real address bar to check.
    /// </summary>
    [HttpPost("applications/{id:int}/payment")]
    public async Task<ActionResult<ApiEnvelope<PaymentInitiationDto>>> StartPayment(
        int id, CancellationToken ct) =>
        Envelope(
            await payments.InitiateAsync(
                ApplicantId, id, $"{Request.Scheme}://{Request.Host}", ct),
            "Opening the payment page.");

    /// <summary>Every attempt this applicant has made, newest first.</summary>
    [HttpGet("payments")]
    public async Task<ActionResult<ApiEnvelope<List<PaymentTransactionDto>>>> Payments(
        CancellationToken ct)
    {
        var rows = await payments.HistoryAsync(ApplicantId, ct);

        /* Asked once for the whole list rather than per row: whether
           invoicing is switched on is a property of the deployment. */
        var offered = await invoices.OfferedAsync(ct);
        foreach (var row in rows) row.InvoiceOffered = offered;

        return Envelope(rows);
    }

    /// <summary>
    /// The applicant's copy of the invoice for one payment.
    ///
    /// The document belongs to the ERP, which raises it and sends it to
    /// them; this hands over the copy so they can open it without going
    /// looking through their e-mail. Refusals carry a reason they can read:
    /// not paid, not raised yet, or the ERP unreachable.
    /// </summary>
    [HttpGet("payments/{orderId}/invoice")]
    public async Task<IActionResult> Invoice(string orderId, CancellationToken ct)
    {
        var invoice = await invoices.ForPaymentAsync(ApplicantId, orderId, ct);

        /* Named on the way out, so what lands in the applicant's downloads
           says what it is rather than repeating the route. */
        if (!string.IsNullOrWhiteSpace(invoice.Number))
        {
            Response.Headers.Append("X-Invoice-Number", invoice.Number);
        }

        return File(invoice.Content, invoice.ContentType, invoice.FileName);
    }

    /// <summary>
    /// Where one attempt got to. Polled by the app when it comes back to the
    /// foreground, because the gateway answers to the browser and not to it.
    /// </summary>
    [HttpGet("payments/{orderId}")]
    public async Task<ActionResult<ApiEnvelope<PaymentTransactionDto>>> Payment(
        string orderId, CancellationToken ct) =>
        Envelope(await payments.StatusAsync(ApplicantId, orderId, ct));

    /// <summary>Batches the applicant is enrolled in, with attendance and result.</summary>
    [HttpGet("enrolments")]
    public async Task<ActionResult<ApiEnvelope<List<ApplicantEnrolmentDto>>>> Enrolments(
        CancellationToken ct) =>
        Envelope(await service.MyEnrolmentsAsync(ApplicantId, ct));

    /// <summary>Training material published for the Applicant role.</summary>
    [HttpGet("materials")]
    public async Task<ActionResult<ApiEnvelope<List<TrainingMaterialDto>>>> Materials(
        [FromQuery] int? programTypeId, CancellationToken ct) =>
        Envelope(await materials.VisibleToMeAsync(programTypeId, ct));

    /* ---------------------------------------------------- written paper ----
       Sitting the paper online. Every route is scoped to the applicant on the
       token inside the service, so none of them can be pointed at somebody
       else's sitting by changing a number in the address. */

    /// <summary>Whether this enrolment's paper can be sat, and what is done so far.</summary>
    [HttpGet("enrolments/{participantId:int}/exam")]
    public async Task<ActionResult<ApiEnvelope<ExamAvailabilityDto>>> Exam(
        int participantId, CancellationToken ct) =>
        Envelope(await exams.AvailabilityAsync(ApplicantId, participantId, ct));

    /// <summary>Opens a sitting — the clock starts here — and serves the paper.</summary>
    [HttpPost("enrolments/{participantId:int}/exam/start")]
    public async Task<ActionResult<ApiEnvelope<ExamSittingDto>>> StartExam(
        int participantId, CancellationToken ct) =>
        Envelope(await exams.StartAsync(ApplicantId, participantId, ct));

    /// <summary>The paper as it stands, for an app that was closed mid-sitting.</summary>
    [HttpGet("exam/{attemptId:int}")]
    public async Task<ActionResult<ApiEnvelope<ExamSittingDto>>> Sitting(
        int attemptId, CancellationToken ct) =>
        Envelope(await exams.ResumeAsync(ApplicantId, attemptId, ct));

    /// <summary>Answers as they are given, so nothing rides on the submit.</summary>
    [HttpPut("exam/{attemptId:int}/answers")]
    public async Task<ActionResult<ApiEnvelope<int>>> Answer(
        int attemptId, [FromBody] ExamAnswerBatchDto dto, CancellationToken ct) =>
        Envelope(await exams.AnswerAsync(ApplicantId, attemptId, dto, ct));

    [HttpPost("exam/{attemptId:int}/submit")]
    public async Task<ActionResult<ApiEnvelope<ExamResultDto>>> SubmitExam(
        int attemptId, CancellationToken ct) =>
        Envelope(await exams.SubmitAsync(ApplicantId, attemptId, ct), "Paper submitted.");
}
