using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Mapping;
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
    ProfileSubmissionService profile,
    BatchRegistrationService registration,
    ProfileAttachmentService photos,
    FeedbackService feedback) : ApiControllerBase
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

    /// <summary>
    /// Takes a seat on a batch.
    ///
    /// Answers one of two ways: registered, where there is no fee and the
    /// seat is theirs; or payment required, with the application to pay
    /// against. The app routes on that rather than deciding for itself
    /// whether money is owed.
    /// </summary>
    [HttpPost("batches/{programmeId:int}/register")]
    public async Task<ActionResult<ApiEnvelope<BatchRegistrationService.Outcome>>> RegisterForBatch(
        int programmeId, CancellationToken ct)
    {
        var outcome = await registration.RegisterAsync(ApplicantId, programmeId, ct);
        return Envelope(outcome, outcome.Message);
    }

    [HttpPut]
    public async Task<ActionResult<ApiEnvelope<ApplicantDto>>> UpdateProfile(
        [FromBody] ApplicantProfileUpdateDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateProfileAsync(ApplicantId, dto, ct), "Profile updated.");

    /* ------------------------------------------------------ e-mail change
       Asked for, proven, then done. Every one of these is scoped to the
       applicant on the token, so none of them can move somebody else's
       address by changing a number. */

    [HttpPost("email-change")]
    public async Task<ActionResult<ApiEnvelope<ApplicantDto>>> RequestEmailChange(
        [FromBody] EmailChangeRequestDto dto, CancellationToken ct) =>
        Envelope(
            await service.RequestEmailChangeAsync(ApplicantId, dto.Email, ct),
            "A verification code has been sent to the new address.");

    [HttpPost("email-change/resend")]
    public async Task<ActionResult<ApiEnvelope<ApplicantDto>>> ResendEmailChange(
        CancellationToken ct) =>
        Envelope(await service.ResendEmailChangeAsync(ApplicantId, ct), "Code sent again.");

    [HttpPost("email-change/verify")]
    public async Task<ActionResult<ApiEnvelope<ApplicantDto>>> ConfirmEmailChange(
        [FromBody] EmailChangeConfirmDto dto, CancellationToken ct) =>
        Envelope(
            await service.ConfirmEmailChangeAsync(ApplicantId, dto.Code, ct),
            "Your email address has been changed.");

    [HttpDelete("email-change")]
    public async Task<ActionResult<ApiEnvelope<ApplicantDto>>> CancelEmailChange(
        CancellationToken ct) =>
        Envelope(await service.CancelEmailChangeAsync(ApplicantId, ct), "Change cancelled.");

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
       The gate. Everything under "programs" stays shut until a profile
       form has been read and accepted, so the app asks about this first.

       Keyed by sub-category throughout, because one account may hold a
       profile in each category it has entered - one per category, never
       two. Which disciplines are still open to this applicant is what
       "profile-choices" answers. */

    /// <summary>Every profile this applicant holds, and where each stands.</summary>
    [HttpGet("profile-submissions")]
    public async Task<ActionResult<ApiEnvelope<List<ProfileStandingDto>>>> MyProfiles(
        CancellationToken ct) =>
        Envelope(await profile.MineAsync(ApplicantId, ct));

    /// <summary>
    /// The sub-categories this applicant may still start a profile in.
    ///
    /// A category they are already in is left out entirely rather than
    /// shown and refused: the rule is one sub-category per category, and a
    /// list that offers what cannot be chosen is a list that wastes a tap.
    /// </summary>
    [HttpGet("profile-choices")]
    public async Task<ActionResult<ApiEnvelope<List<ProfileChoiceDto>>>> ProfileChoices(
        CancellationToken ct) =>
        Envelope(await profile.ChoicesAsync(ApplicantId, ct));

    /// <summary>
    /// Where this applicant stands with one discipline's profile form: what
    /// they sent, what scrutiny said, how many tries are left, and whether
    /// the discipline is shut to them for the moment.
    /// </summary>
    [HttpGet("profile-submission/{subCategoryId:int}")]
    public async Task<ActionResult<ApiEnvelope<ProfileStandingDto>>> ProfileStanding(
        int subCategoryId, CancellationToken ct) =>
        Envelope(await profile.StandingAsync(ApplicantId, subCategoryId, ct));

    /// <summary>
    /// The profile form for one sub-category, or nothing where none has
    /// been published.
    ///
    /// Null rather than a 404, because an applicant can legitimately hold
    /// an accepted profile in a discipline that has no form on it today:
    /// the profiles carried over from the old per-application scrutiny
    /// were written for whatever their applications were under, and a
    /// form was never published for every one of those. The screen reads
    /// the standing for what it shows and only needs the form to fill one
    /// in, so an absent form is an answer rather than a failure.
    /// </summary>
    [HttpGet("profile-form/{subCategoryId:int}")]
    public async Task<ActionResult<ApiEnvelope<ProfileFormDto?>>> MyProfileForm(
        int subCategoryId, CancellationToken ct) =>
        Envelope((await forms.ActiveForAsync(subCategoryId, ct))?.ToDto());

    /// <summary>
    /// The answers from a profile this applicant already holds, to start
    /// another one from.
    ///
    /// Somebody entering a second category has already typed their
    /// qualifications and their experience once. Nothing is submitted by
    /// this: the answers are handed to the form, and the applicant reads
    /// every one of them and sends it themselves.
    /// </summary>
    [HttpGet("profile-form/{subCategoryId:int}/from/{fromSubCategoryId:int}")]
    public async Task<ActionResult<ApiEnvelope<Dictionary<string, object?>>>> FetchProfile(
        int subCategoryId, int fromSubCategoryId, CancellationToken ct) =>
        Envelope(await profile.FetchAsync(ApplicantId, fromSubCategoryId, ct));

    /* --------------------------------------------------- pictures ----
       A field of the profile form can ask for photographs rather than a
       file, because a phone is what the applicant has. They go up one at
       a time, carrying what the handset knew when the shutter went, and
       come back one at a time as the pictures they are. */

    [HttpGet("profile-photos/{subCategoryId:int}/{fieldKey}")]
    public async Task<ActionResult<ApiEnvelope<ProfileAttachmentService.Standing>>> Photos(
        int subCategoryId, string fieldKey, CancellationToken ct) =>
        Envelope(await photos.StandingAsync(ApplicantId, subCategoryId, fieldKey, ct));

    /// <summary>
    /// Adds one picture, with what the phone knew about it.
    ///
    /// The position and the handset come as form fields beside the file
    /// rather than in a body of their own, because a multipart upload is
    /// what a phone can send in one go without holding the image in
    /// memory twice. All of them are optional: a refused location
    /// permission must not cost somebody their photograph.
    /// </summary>
    [HttpPost("profile-photos/{subCategoryId:int}/{fieldKey}")]
    [RequestSizeLimit(8_388_608)]
    public async Task<ActionResult<ApiEnvelope<ProfileAttachmentService.Standing>>> AddPhoto(
        int subCategoryId,
        string fieldKey,
        IFormFile picture,
        CancellationToken ct,
        [FromForm] DateTime? capturedOn = null,
        [FromForm] decimal? latitude = null,
        [FromForm] decimal? longitude = null,
        [FromForm] string? platform = null,
        [FromForm] string? model = null,
        [FromForm] string? osVersion = null)
    {
        if (picture is null || picture.Length == 0)
            throw new AppException("Take a picture to add.");

        using var buffer = new MemoryStream();
        await picture.CopyToAsync(buffer, ct);

        var capture = new ProfileAttachmentService.Capture(
            capturedOn, latitude, longitude, platform, model, osVersion);

        return Envelope(await photos.AddAsync(
            ApplicantId, subCategoryId, fieldKey, buffer.ToArray(), picture.ContentType,
            capture, ct));
    }

    [HttpDelete("profile-photos/{subCategoryId:int}/{fieldKey}/{displayOrder:int}")]
    public async Task<ActionResult<ApiEnvelope<ProfileAttachmentService.Standing>>> RemovePhoto(
        int subCategoryId, string fieldKey, int displayOrder, CancellationToken ct) =>
        Envelope(await photos.RemoveAsync(ApplicantId, subCategoryId, fieldKey, displayOrder, ct));

    /// <summary>One picture, for the thumbnail beside the field.</summary>
    [HttpGet("profile-photos/{subCategoryId:int}/{fieldKey}/{displayOrder:int}")]
    public async Task<IActionResult> Photo(
        int subCategoryId, string fieldKey, int displayOrder, CancellationToken ct)
    {
        var (content, type) = await photos.OneAsync(
            ApplicantId, subCategoryId, fieldKey, displayOrder, ct);
        return File(content, type);
    }

    /// <summary>
    /// Every picture for the field, as a list, in the order taken.
    ///
    /// Where the merged PDF used to be. The app draws the thumbnails from
    /// this and fetches each image by its position.
    /// </summary>
    [HttpGet("profile-photos/{subCategoryId:int}/{fieldKey}/all")]
    public async Task<ActionResult<ApiEnvelope<IReadOnlyList<ProfileAttachmentService.Shot>>>>
        PhotoList(int subCategoryId, string fieldKey, CancellationToken ct) =>
        Envelope(await photos.ShotsAsync(ApplicantId, subCategoryId, fieldKey, ct));

    /* ------------------------------------------------------ files ----
       A file field used to record only the name of what the applicant
       chose and throw the document away. It keeps it now. */

    [HttpGet("profile-files/{subCategoryId:int}/{fieldKey}")]
    public async Task<ActionResult<ApiEnvelope<ProfileAttachmentService.FileStanding>>> ProfileFile(
        int subCategoryId, string fieldKey, CancellationToken ct) =>
        Envelope(await photos.FileStandingAsync(ApplicantId, subCategoryId, fieldKey, ct));

    /// <summary>Attaches a file, replacing whatever the field held.</summary>
    [HttpPost("profile-files/{subCategoryId:int}/{fieldKey}")]
    [RequestSizeLimit(68_157_440)]
    public async Task<ActionResult<ApiEnvelope<ProfileAttachmentService.FileStanding>>> SetProfileFile(
        int subCategoryId, string fieldKey, IFormFile document, CancellationToken ct)
    {
        if (document is null || document.Length == 0)
            throw new AppException("Choose a file to attach.");

        using var buffer = new MemoryStream();
        await document.CopyToAsync(buffer, ct);

        return Envelope(
            await photos.SetFileAsync(
                ApplicantId, subCategoryId, fieldKey, buffer.ToArray(),
                document.FileName, document.ContentType, ct),
            "File attached.");
    }

    /// <summary>The file back, as it arrived.</summary>
    [HttpGet("profile-files/{subCategoryId:int}/{fieldKey}/download")]
    public async Task<IActionResult> DownloadProfileFile(
        int subCategoryId, string fieldKey, CancellationToken ct)
    {
        var (content, type, name) = await photos.FileAsync(
            ApplicantId, subCategoryId, fieldKey, ct);
        return File(content, type, name);
    }

    /// <summary>
    /// Keeps what has been filled in so far, without sending it.
    ///
    /// Called as the applicant moves between sections and as they leave
    /// the screen, so signing out no longer throws the form away. The
    /// response is the standing, so the app sees the same shape it would
    /// after a submission and does not need a second code path.
    /// </summary>
    [HttpPut("profile-draft")]
    public async Task<ActionResult<ApiEnvelope<ProfileStandingDto>>> SaveProfileDraft(
        [FromBody] ProfileSubmitDto dto, CancellationToken ct) =>
        Envelope(await profile.SaveDraftAsync(
            ApplicantId, dto.SubCategoryId, dto.Responses, ct));

    /// <summary>Sends the profile for scrutiny, as a fresh attempt.</summary>
    [HttpPost("profile-submission")]
    public async Task<ActionResult<ApiEnvelope<ProfileStandingDto>>> SubmitProfile(
        [FromBody] ProfileSubmitDto dto, CancellationToken ct)
    {
        var standing = await profile.SubmitAsync(
            ApplicantId, dto.SubCategoryId, dto.Responses, ct);

        /* The message has to match what actually happened: a form that is
           not scrutinised is accepted on the spot, and telling that
           applicant to wait for an outcome would be a lie. */
        return Envelope(standing, standing.Cleared
            ? "Your profile is complete. The programs open to you are ready."
            : "Your profile has been sent for scrutiny.");
    }

    /* ------------------------------------------------------ feedback ----
       Asked once a batch has been conducted, and answered anonymously:
       what is written is stored against the batch with no applicant on
       it, and the fact that this participant answered is stored
       separately with no answers on it. */

    /// <summary>Batches that are over and are waiting on their feedback.</summary>
    [HttpGet("feedback")]
    public async Task<ActionResult<ApiEnvelope<List<FeedbackInvitationDto>>>> Feedback(
        CancellationToken ct) =>
        Envelope(await feedback.MineAsync(ApplicantId, ct));

    /// <summary>The questions for one of them.</summary>
    [HttpGet("feedback/{participantId:int}")]
    public async Task<ActionResult<ApiEnvelope<FeedbackFormDto>>> FeedbackForm(
        int participantId, CancellationToken ct) =>
        Envelope(await feedback.FormForAsync(ApplicantId, participantId, ct));

    /// <summary>
    /// Sends the answers. Nothing comes back but the acknowledgement:
    /// there is no route to read them again, because they are not kept
    /// against the person who wrote them.
    /// </summary>
    [HttpPost("feedback/{participantId:int}")]
    public async Task<ActionResult<ApiEnvelope<bool>>> SubmitFeedback(
        int participantId, [FromBody] FeedbackSubmitDto dto, CancellationToken ct)
    {
        await feedback.SubmitAsync(ApplicantId, participantId, dto.Answers, ct);
        return Envelope(true, "Thank you - your feedback has been recorded anonymously.");
    }

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

    /// <summary>
    /// Opens a sitting — the clock starts here — and serves the paper.
    ///
    /// A photograph taken at the desk comes with it, as multipart, and is
    /// required: the service refuses to open a paper without one. It is
    /// kept against the sitting beside the one on their profile, so whoever
    /// reviews the result can see who was actually there. Nothing compares
    /// them automatically.
    /// </summary>
    [HttpPost("enrolments/{participantId:int}/exam/start")]
    [RequestSizeLimit(4_194_304)]
    public async Task<ActionResult<ApiEnvelope<ExamSittingDto>>> StartExam(
        int participantId, IFormFile? selfie, CancellationToken ct)
    {
        byte[]? bytes = null;
        string? type = null;

        if (selfie is { Length: > 0 })
        {
            if (!selfie.ContentType?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) ?? true)
                throw new AppException("The photograph must be an image.");

            using var buffer = new MemoryStream();
            await selfie.CopyToAsync(buffer, ct);
            bytes = buffer.ToArray();
            type = selfie.ContentType;
        }

        return Envelope(await exams.StartAsync(ApplicantId, participantId, bytes, type, ct));
    }

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

    /// <summary>
    /// Closes a sitting because the app was left while it was open.
    ///
    /// The candidate starts again from the first question. Reported by the
    /// app because it is the only thing that can see the screen go away.
    /// </summary>
    [HttpPost("exam/{attemptId:int}/abandon")]
    public async Task<ActionResult<ApiEnvelope<bool>>> AbandonExam(
        int attemptId, CancellationToken ct)
    {
        await exams.AbandonAsync(ApplicantId, attemptId, ct);
        return Envelope(true, "The paper was closed because the app was left.");
    }

    [HttpPost("exam/{attemptId:int}/submit")]
    public async Task<ActionResult<ApiEnvelope<ExamResultDto>>> SubmitExam(
        int attemptId, CancellationToken ct) =>
        Envelope(await exams.SubmitAsync(ApplicantId, attemptId, ct), "Paper submitted.");
}
