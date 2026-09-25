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
    RegistrationFormService forms,
    FeeService fees,
    TrainingMaterialService materials,
    ProgrammeCatalogueService catalogue,
    ExamSittingService exams) : ApiControllerBase
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

    /// <summary>The registration form for one programme.</summary>
    [HttpGet("programs/{programTypeId:int}/form")]
    public async Task<ActionResult<ApiEnvelope<RegistrationFormDto>>> Form(
        int programTypeId, CancellationToken ct) =>
        Envelope(await forms.GetByProgramTypeAsync(programTypeId, ct));

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
