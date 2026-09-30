using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

[Route("api/roles")]
public class RolesController(RoleService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.RolesView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<AdminRoleDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] string? baseRole,
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.ListAsync(request, baseRole, status, ct));

    [HttpGet("all")]
    [HasPermission(Permissions.RolesView)]
    public async Task<ActionResult<ApiEnvelope<List<AdminRoleDto>>>> All(
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.AllAsync(status, ct));

    /// <summary>The permission catalogue the roles screen renders.</summary>
    [HttpGet("permissions")]
    [HasPermission(Permissions.RolesView)]
    public ActionResult<ApiEnvelope<IReadOnlyList<PermissionGroupDto>>> Catalogue() =>
        Envelope(service.Catalogue());

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.RolesView)]
    public async Task<ActionResult<ApiEnvelope<AdminRoleDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPost]
    [HasPermission(Permissions.RolesManage)]
    public async Task<ActionResult<ApiEnvelope<AdminRoleDto>>> Create(
        [FromBody] AdminRoleUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Role created.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.RolesManage)]
    public async Task<ActionResult<ApiEnvelope<AdminRoleDto>>> Update(
        int id, [FromBody] AdminRoleUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Role updated.");

    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.RolesManage)]
    public async Task<ActionResult<ApiEnvelope<AdminRoleDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, ct));
}

[Route("api/users")]
public class UsersController(UserService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.UsersView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<PortalUserDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] string? baseRole, [FromQuery] int? roleId,
        [FromQuery] int? agencyId, [FromQuery] string? state, [FromQuery] string? status,
        CancellationToken ct) =>
        Envelope(await service.ListAsync(request, baseRole, roleId, agencyId, state, status, ct));

    [HttpGet("all")]
    [HasPermission(Permissions.UsersView)]
    public async Task<ActionResult<ApiEnvelope<List<PortalUserDto>>>> All(
        [FromQuery] string? baseRole, [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.AllAsync(baseRole, status, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.UsersView)]
    public async Task<ActionResult<ApiEnvelope<PortalUserDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    /// <summary>
    /// Creates the account and returns the generated user ID with a one-time
    /// password. The caller must pass these to the user out of band.
    /// </summary>
    [HttpPost]
    [HasPermission(Permissions.UsersManage)]
    public async Task<ActionResult<ApiEnvelope<GeneratedCredentialsDto>>> Create(
        [FromBody] PortalUserUpsertDto dto, CancellationToken ct)
    {
        var (_, credentials) = await service.CreateAsync(dto, ct);
        return Envelope(credentials, "User created. Share the credentials securely.");
    }

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.UsersManage)]
    public async Task<ActionResult<ApiEnvelope<PortalUserDto>>> Update(
        int id, [FromBody] PortalUserUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "User updated.");

    /// <summary>
    /// Enable or disable. Separate from UsersManage so a tier that oversees
    /// accounts it cannot create — an Operation Manager over its coordinators —
    /// can still switch one off. The tier check itself lives in the service.
    /// </summary>
    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.UsersStatus)]
    public async Task<ActionResult<ApiEnvelope<PortalUserDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, dto.Reason, ct));

    /// <summary>
    /// Why this account was switched on or off, every time it happened, with
    /// the login it belongs to. Read by whoever may already see the account.
    /// </summary>
    [HttpGet("{id:int}/history")]
    [HasPermission(Permissions.UsersView)]
    public async Task<ActionResult<ApiEnvelope<UserHistoryDto>>> History(
        int id, CancellationToken ct) =>
        Envelope(await service.HistoryAsync(id, ct));

    [HttpPost("{id:int}/reset-password")]
    [HasPermission(Permissions.UsersManage)]
    public async Task<ActionResult<ApiEnvelope<GeneratedCredentialsDto>>> ResetPassword(
        int id, CancellationToken ct) =>
        Envelope(await service.ResetPasswordAsync(id, ct), "Sign-in details sent to the account's e-mail address.");
}

[Route("api/applicants")]
public class ApplicantsController(ApplicantService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.ApplicationsView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<ApplicantDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] int? categoryId, [FromQuery] string? state,
        [FromQuery] string? standing, [FromQuery] bool? isBlocked,
        [FromQuery] DateTime? registeredFrom, [FromQuery] DateTime? registeredTo,
        CancellationToken ct) =>
        Envelope(await service.ListAsync(
            request, categoryId, state, standing, isBlocked, registeredFrom, registeredTo, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.ApplicationsView)]
    public async Task<ActionResult<ApiEnvelope<ApplicantDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    /// <summary>Basic sign-up from the mobile app.</summary>
    [HttpPost("sign-up")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<ApplicantDto>>> SignUp(
        [FromBody] ApplicantSignUpDto dto, CancellationToken ct) =>
        Envelope(await service.SignUpAsync(dto, ct), "Registered. Verify your email to continue.");

    [HttpPatch("{id:int}/blocked")]
    [HasPermission(Permissions.ApplicationsScrutinise)]
    public async Task<ActionResult<ApiEnvelope<ApplicantDto>>> SetBlocked(
        int id, [FromBody] BlockApplicantDto dto, CancellationToken ct) =>
        Envelope(
            await service.SetBlockedAsync(id, dto.IsBlocked, dto.BlockReasonId, dto.Remarks, ct),
            dto.IsBlocked ? "Account blocked." : "Account unblocked.");

    /// <summary>Every time this account was blocked or let back in.</summary>
    [HttpGet("{id:int}/history")]
    [HasPermission(Permissions.ApplicationsView)]
    public async Task<ActionResult<ApiEnvelope<ApplicantHistoryDto>>> History(
        int id, CancellationToken ct) =>
        Envelope(await service.HistoryAsync(id, ct));

    /// <summary>
    /// Everything the filters match, flattened for a spreadsheet: the whole
    /// sign-up form, where they stand, and the dates behind it.
    /// </summary>
    [HttpGet("export")]
    [HasPermission(Permissions.ApplicationsView)]
    public async Task<ActionResult<ApiEnvelope<List<ApplicantExportRowDto>>>> Export(
        [FromQuery] int? categoryId, [FromQuery] string? state, [FromQuery] string? standing,
        [FromQuery] bool? isBlocked, [FromQuery] DateTime? registeredFrom,
        [FromQuery] DateTime? registeredTo, [FromQuery] string? search,
        CancellationToken ct) =>
        Envelope(await service.ExportAsync(
            categoryId, state, standing, isBlocked, registeredFrom, registeredTo, search, ct));
}

[Route("api/applications")]
public class ApplicationsController(ApplicationService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.ApplicationsView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<ApplicationDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] string? status, [FromQuery] int? categoryId,
        [FromQuery] int? programTypeId, [FromQuery] string? state, CancellationToken ct) =>
        Envelope(await service.ListAsync(request, status, categoryId, programTypeId, state, ct));

    [HttpGet("all")]
    [HasPermission(Permissions.ApplicationsView)]
    public async Task<ActionResult<ApiEnvelope<List<ApplicationDto>>>> All(
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.AllAsync(status, ct));

    /// <summary>
    /// The counters above the queue. Takes the same filters as the list, so
    /// what the tiles say and what the table shows are answers to one
    /// question.
    /// </summary>
    [HttpGet("counts")]
    [HasPermission(Permissions.ApplicationsView)]
    public async Task<ActionResult<ApiEnvelope<ApplicationCountsDto>>> Counts(
        [FromQuery] string? status, [FromQuery] int? categoryId,
        [FromQuery] int? programTypeId, [FromQuery] string? state,
        [FromQuery] string? search, CancellationToken ct) =>
        Envelope(await service.CountsAsync(status, categoryId, programTypeId, state, search, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.ApplicationsView)]
    public async Task<ActionResult<ApiEnvelope<ApplicationDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPost("{id:int}/scrutiny")]
    [HasPermission(Permissions.ApplicationsScrutinise)]
    public async Task<ActionResult<ApiEnvelope<ApplicationDto>>> Decide(
        int id, [FromBody] ScrutinyDecisionDto dto, CancellationToken ct) =>
        Envelope(await service.DecideAsync(id, dto, ct), "Decision recorded.");


    [HttpPatch("{id:int}/assign")]
    [HasPermission(Permissions.ApplicationsScrutinise)]
    public async Task<ActionResult<ApiEnvelope<ApplicationDto>>> Assign(
        int id, [FromBody] AssignApplicationDto dto, CancellationToken ct) =>
        Envelope(await service.AssignAsync(id, dto.UserId, ct), "Application reassigned.");

    [HttpPatch("{id:int}/documents/{documentId:int}")]
    [HasPermission(Permissions.ApplicationsScrutinise)]
    public async Task<ActionResult<ApiEnvelope<ApplicationDto>>> VerifyDocument(
        int id, int documentId, [FromBody] VerifyDocumentDto dto, CancellationToken ct) =>
        Envelope(await service.VerifyDocumentAsync(id, documentId, dto, ct));
}

[Route("api/programs")]
public class ProgramsController(ProgrammeService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<ProgrammeDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] string? state,
        [FromQuery] DateOnly? startDate, [FromQuery] DateOnly? endDate,
        [FromQuery] string? mode, [FromQuery] int? agencyId, [FromQuery] string? status,
        CancellationToken ct) =>
        Envelope(await service.ListAsync(request, state, startDate, endDate, mode, agencyId, status, ct));

    [HttpGet("all")]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<ActionResult<ApiEnvelope<List<ProgrammeDto>>>> All(
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.AllAsync(status, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<ActionResult<ApiEnvelope<ProgrammeDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPost]
    [HasPermission(Permissions.ProgramsManage)]
    public async Task<ActionResult<ApiEnvelope<ProgrammeDto>>> Create(
        [FromBody] ProgrammeUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Program submitted for permission.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.ProgramsManage)]
    public async Task<ActionResult<ApiEnvelope<ProgrammeDto>>> Update(
        int id, [FromBody] ProgrammeUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Program updated.");

    /// <summary>Moves the batch along the register's workflow.</summary>
    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.ProgramsManage)]
    public async Task<ActionResult<ApiEnvelope<ProgrammeDto>>> SetStatus(
        int id, [FromBody] ProgrammeStatusDto dto, CancellationToken ct) =>
        Envelope(await service.ChangeStatusAsync(id, dto, ct));

    [HttpPost("{id:int}/close-registrations")]
    [HasPermission(Permissions.ProgramsManage)]
    public async Task<ActionResult<ApiEnvelope<ProgrammeDto>>> CloseRegistrations(
        int id, CancellationToken ct) =>
        Envelope(await service.CloseRegistrationsAsync(id, ct), "Registrations closed.");

    [HttpPost("{id:int}/exam-time")]
    [HasPermission(Permissions.ProgramsManage)]
    public async Task<ActionResult<ApiEnvelope<ProgrammeDto>>> SetExamTime(
        int id, [FromBody] SetExamTimeDto dto, CancellationToken ct) =>
        Envelope(await service.SetExamTimeAsync(id, dto, ct), "Exam time set.");

    [HttpPost("{id:int}/sessions")]
    [HasPermission(Permissions.ProgramsManage)]
    public async Task<ActionResult<ApiEnvelope<ProgrammeDto>>> AddSession(
        int id, [FromBody] ProgrammeSessionDto dto, CancellationToken ct) =>
        Envelope(await service.AddSessionAsync(id, dto, ct), "Session added.");

    [HttpPost("{id:int}/sessions/{sessionId:int}/attendance")]
    [HasPermission(Permissions.ProgramsManage)]
    public async Task<ActionResult<ApiEnvelope<ProgrammeDto>>> MarkAttendance(
        int id, int sessionId, [FromBody] MarkAttendanceDto dto, CancellationToken ct) =>
        Envelope(await service.MarkAttendanceAsync(id, sessionId, dto, ct), "Attendance saved.");

    [HttpPost("{id:int}/enrol")]
    [HasPermission(Permissions.ProgramsManage)]
    public async Task<ActionResult<ApiEnvelope<ProgrammeDto>>> Enrol(
        int id, [FromBody] EnrolDto dto, CancellationToken ct) =>
        Envelope(await service.EnrolAsync(id, dto, ct), "Applicants enrolled.");
}

/// <summary>
/// The trainer's marksheet, from the portal.
///
/// The same sheet the coordinator's app writes to, under the route the portal
/// already uses for a programme. Who may mark is decided inside
/// <see cref="MarksheetService"/>, which also lets the assigned coordinator in
/// — so the attribute here is the floor, not the whole rule.
/// </summary>
[Route("api/programs/{id:int}/marksheet")]
public class ProgrammeMarksheetController(MarksheetService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<ActionResult<ApiEnvelope<MarksheetDto>>> Get(
        int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPut]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<ActionResult<ApiEnvelope<MarksheetDto>>> Save(
        int id, [FromBody] MarksheetSaveDto dto, CancellationToken ct) =>
        Envelope(await service.SaveAsync(id, dto, ct), "Marks saved.");
}

/// <summary>
/// What a candidate actually answered on the paper they sat.
///
/// Read only. A mark is disputed with the sitting behind it, and nothing here
/// can change one: a wrong answer key is corrected on the paper and the sitting
/// retaken, not edited afterwards.
/// </summary>
[Route("api/programs/{id:int}/exam-attempts")]
public class ProgrammeExamAttemptsController(ExamReviewService service) : ApiControllerBase
{
    /// <summary>Every sitting one candidate has had on this programme.</summary>
    [HttpGet]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<ActionResult<ApiEnvelope<List<ExamAttemptSummaryDto>>>> List(
        int id, [FromQuery] int participantId, CancellationToken ct) =>
        Envelope(await service.ListAsync(id, participantId, ct));

    /// <summary>
    /// One sitting in full. The right answers are included only for an account
    /// that may already read the paper.
    /// </summary>
    [HttpGet("{attemptId:int}")]
    [HasPermission(Permissions.ProgramsView)]
    public async Task<ActionResult<ApiEnvelope<ExamAttemptReviewDto>>> Get(
        int id, int attemptId, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, attemptId, ct));
}

[Route("api/lookups")]
public class LookupsController(LookupService service) : ApiControllerBase
{
    /// <summary>
    /// Anonymous: the applicant app has to offer these on the sign-up screen,
    /// before anyone has a token. They are public scheme masters, like LGD.
    /// </summary>
    [HttpGet("categories")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<List<LookupItemDto>>>> Categories(CancellationToken ct) =>
        Envelope(await service.CategoriesAsync(ct));

    [HttpGet("sub-categories")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<List<LookupItemDto>>>> SubCategories(
        [FromQuery] int? categoryId, CancellationToken ct) =>
        Envelope(await service.SubCategoriesAsync(categoryId, ct));

    [HttpGet("program-types")]
    public async Task<ActionResult<ApiEnvelope<List<LookupItemDto>>>> ProgramTypes(
        [FromQuery] int? categoryId, [FromQuery] int? subCategoryId, CancellationToken ct) =>
        Envelope(await service.ProgramTypesAsync(categoryId, subCategoryId, ct));

    [HttpGet("agencies")]
    public async Task<ActionResult<ApiEnvelope<List<LookupItemDto>>>> Agencies(CancellationToken ct) =>
        Envelope(await service.AgenciesAsync(ct));

    [HttpGet("coordinators")]
    public async Task<ActionResult<ApiEnvelope<List<LookupItemDto>>>> Coordinators(
        [FromQuery] int? agencyId, CancellationToken ct) =>
        Envelope(await service.CoordinatorsAsync(agencyId, ct));

    [HttpGet("operation-managers")]
    public async Task<ActionResult<ApiEnvelope<List<LookupItemDto>>>> OperationManagers(
        CancellationToken ct) =>
        Envelope(await service.OperationManagersAsync(ct));

    [HttpGet("roles")]
    public async Task<ActionResult<ApiEnvelope<List<LookupItemDto>>>> Roles(CancellationToken ct) =>
        Envelope(await service.RolesAsync(ct));

    /// <summary>
    /// Educational qualification levels for the programme-type form, lowest
    /// first. Anonymous alongside the other masters the sign-up flow needs.
    /// </summary>
    [HttpGet("qualifications")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<List<LookupItemDto>>>> Qualifications(
        CancellationToken ct) =>
        Envelope(await service.QualificationsAsync(ct));

    /// <summary>LGD state master; the id is the LGD state code.</summary>
    [HttpGet("states")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<List<LookupItemDto>>>> States(CancellationToken ct) =>
        Envelope(await service.StatesAsync(ct));

    /// <summary>LGD district master for one state.</summary>
    [HttpGet("districts")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<List<LookupItemDto>>>> Districts(
        [FromQuery] int? stateCode, [FromQuery] string? state, CancellationToken ct) =>
        Envelope(await service.DistrictsAsync(stateCode, state, ct));
}

[Route("api/dashboard")]
public class DashboardController(DashboardService service) : ApiControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiEnvelope<DashboardDto>>> Get(
        [FromQuery] DashboardFilterDto filter, CancellationToken ct) =>
        Envelope(await service.LoadAsync(filter, ct));

    /// <summary>
    /// Programme reach by state, for the dashboard map. Every state is
    /// returned, including those with no activity.
    /// </summary>
    [HttpGet("state-coverage")]
    [HasPermission(Permissions.ReportsView)]
    public async Task<ActionResult<ApiEnvelope<StateCoverageResultDto>>> StateCoverage(
        [FromQuery] DashboardFilterDto filter, CancellationToken ct) =>
        Envelope(await service.StateCoverageAsync(filter, ct));
}

/// <summary>
/// Everybody the scheme has qualified. Read only — a qualification is recorded
/// on the marksheet and evidenced by a certificate, and neither is changed
/// from here.
/// </summary>
[Route("api/qualified-professionals")]
public class QualifiedProfessionalsController(QualifiedProfessionalService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.ProfessionalsView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<QualifiedProfessionalDto>>>> List(
        [FromQuery] PagedRequest request,
        [FromQuery] int? categoryId,
        [FromQuery] int? subCategoryId,
        [FromQuery] int? programTypeId,
        [FromQuery] int? stateCode,
        [FromQuery] string? standing,
        [FromQuery] DateTime? qualifiedFrom,
        [FromQuery] DateTime? qualifiedTo,
        CancellationToken ct) =>
        Envelope(await service.ListAsync(
            request, categoryId, subCategoryId, programTypeId, stateCode, standing,
            qualifiedFrom, qualifiedTo, ct));
}

/// <summary>
/// The profile queue: applicants waiting to be let into their discipline.
///
/// Read before anything else about them, because nothing else exists yet —
/// an applicant has no applications until their profile has been accepted.
/// It carries the same permission as application scrutiny, since it is the
/// same job done earlier.
/// </summary>
[Route("api/profile-submissions")]
public class ProfileSubmissionsController(ProfileSubmissionService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.ApplicationsView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<ProfileSubmissionDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] string? status,
        [FromQuery] int? subCategoryId, CancellationToken ct) =>
        Envelope(await service.QueueAsync(request, status, subCategoryId, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.ApplicationsView)]
    public async Task<ActionResult<ApiEnvelope<ProfileSubmissionDto>>> Get(
        int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPost("{id:int}/approve")]
    [HasPermission(Permissions.ApplicationsScrutinise)]
    public async Task<ActionResult<ApiEnvelope<ProfileSubmissionDto>>> Approve(
        int id, [FromBody] ProfileDecisionDto dto, CancellationToken ct) =>
        Envelope(
            await service.ApproveAsync(id, dto.Remarks, Who, Role, ct),
            "Profile accepted. The programs under this sub-category are now open to them.");

    [HttpPost("{id:int}/reject")]
    [HasPermission(Permissions.ApplicationsScrutinise)]
    public async Task<ActionResult<ApiEnvelope<ProfileSubmissionDto>>> Reject(
        int id, [FromBody] ProfileDecisionDto dto, CancellationToken ct)
    {
        if (dto.RejectionReasonId is not { } reasonId)
            throw new AppException("Choose a reason for the rejection.");

        return Envelope(
            await service.RejectAsync(id, reasonId, dto.Remarks, Who, Role, ct),
            "Profile turned down. The applicant can correct it and send it again.");
    }

    /* Named on the event so the history reads without a join, and so it
       still reads after the account that made the decision is gone. */
    private string Who => CurrentUser.DisplayName ?? "Unknown";
    private string Role => CurrentUser.RoleName ?? "Unknown";
}
