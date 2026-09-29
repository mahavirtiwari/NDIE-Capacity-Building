using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;
using Ntms.Infrastructure.Storage;

namespace Ntms.Api.Controllers;

[Route("api/curricula")]
public class CurriculaController(CurriculumService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.CurriculumView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<CurriculumDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] int? categoryId,
        [FromQuery] int? subCategoryId,
        [FromQuery] int? programTypeId, [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.ListAsync(
            request, categoryId, subCategoryId, programTypeId, status, ct));

    [HttpGet("all")]
    [HasPermission(Permissions.CurriculumView)]
    public async Task<ActionResult<ApiEnvelope<List<CurriculumDto>>>> All(
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.AllAsync(status, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.CurriculumView)]
    public async Task<ActionResult<ApiEnvelope<CurriculumDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPost]
    [HasPermission(Permissions.CurriculumManage)]
    public async Task<ActionResult<ApiEnvelope<CurriculumDto>>> Create(
        [FromBody] CurriculumUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Curriculum created.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.CurriculumManage)]
    public async Task<ActionResult<ApiEnvelope<CurriculumDto>>> Update(
        int id, [FromBody] CurriculumUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Curriculum updated.");

    /// <summary>Inactive appears as "Blocked" on the curriculum register.</summary>
    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.CurriculumManage)]
    public async Task<ActionResult<ApiEnvelope<CurriculumDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, ct));
}

[Route("api/registration-forms")]
public class RegistrationFormsController(RegistrationFormService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<RegistrationFormDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] int? categoryId,
        [FromQuery] int? subCategoryId, [FromQuery] int? programTypeId,
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.ListAsync(
            request, categoryId, subCategoryId, programTypeId, status, ct));

    [HttpGet("all")]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<List<RegistrationFormDto>>>> All(
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.AllAsync(status, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<RegistrationFormDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    /// <summary>The form the mobile app renders for a program type.</summary>
    [HttpGet("by-program-type/{programTypeId:int}")]
    public async Task<ActionResult<ApiEnvelope<RegistrationFormDto>>> ByProgramType(
        int programTypeId, CancellationToken ct) =>
        Envelope(await service.GetByProgramTypeAsync(programTypeId, ct));

    [HttpPost]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<RegistrationFormDto>>> Create(
        [FromBody] RegistrationFormUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Registration form created.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<RegistrationFormDto>>> Update(
        int id, [FromBody] RegistrationFormUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Registration form saved.");

    /// <summary>Copies a finished form onto another program type.</summary>
    [HttpPost("replicate")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<RegistrationFormDto>>> Replicate(
        [FromBody] ReplicateFormDto dto, CancellationToken ct) =>
        Envelope(await service.ReplicateAsync(dto, ct), "Registration form replicated.");

    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<RegistrationFormDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, ct));
}

[Route("api/fees")]
public class FeesController(FeeService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.FeesView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<FeeStructureDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] int? categoryId,
        [FromQuery] int? subCategoryId, [FromQuery] int? programTypeId,
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.ListAsync(
            request, categoryId, subCategoryId, programTypeId, status, ct));

    [HttpGet("all")]
    [HasPermission(Permissions.FeesView)]
    public async Task<ActionResult<ApiEnvelope<List<FeeStructureDto>>>> All(
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.AllAsync(status, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.FeesView)]
    public async Task<ActionResult<ApiEnvelope<FeeStructureDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    /// <summary>What an applicant would be charged today. Used by the mobile app.</summary>
    [HttpGet("current/{programTypeId:int}")]
    public async Task<ActionResult<ApiEnvelope<FeeStructureDto?>>> Current(
        int programTypeId, CancellationToken ct) =>
        Envelope(await service.CurrentForProgramTypeAsync(programTypeId, ct));

    [HttpPost]
    [HasPermission(Permissions.FeesManage)]
    public async Task<ActionResult<ApiEnvelope<FeeStructureDto>>> Create(
        [FromBody] FeeStructureUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Fee structure created.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.FeesManage)]
    public async Task<ActionResult<ApiEnvelope<FeeStructureDto>>> Update(
        int id, [FromBody] FeeStructureUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Fee structure updated.");

    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.FeesManage)]
    public async Task<ActionResult<ApiEnvelope<FeeStructureDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, ct));
}

[Route("api/exam-papers")]
public class ExamPapersController(ExamPaperService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.ExamsView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<ExamPaperDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] int? categoryId,
        [FromQuery] int? subCategoryId, [FromQuery] int? programTypeId,
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.ListAsync(
            request, categoryId, subCategoryId, programTypeId, status, ct));

    [HttpGet("all")]
    [HasPermission(Permissions.ExamsView)]
    public async Task<ActionResult<ApiEnvelope<List<ExamPaperDto>>>> All(
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.AllAsync(status, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.ExamsView)]
    public async Task<ActionResult<ApiEnvelope<ExamPaperDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPost]
    [HasPermission(Permissions.ExamsManage)]
    public async Task<ActionResult<ApiEnvelope<ExamPaperDto>>> Create(
        [FromBody] ExamPaperUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Exam paper created.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.ExamsManage)]
    public async Task<ActionResult<ApiEnvelope<ExamPaperDto>>> Update(
        int id, [FromBody] ExamPaperUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Exam paper updated.");

    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.ExamsManage)]
    public async Task<ActionResult<ApiEnvelope<ExamPaperDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, ct));
}

[Route("api/materials")]
public class MaterialsController(
    TrainingMaterialService service,
    MaterialTickets tickets) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.MaterialsView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<TrainingMaterialDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] int? programTypeId,
        [FromQuery] string? kind, [FromQuery] string? visibleToRoles,
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.ListAsync(request, programTypeId, kind, visibleToRoles, status, ct));

    /// <summary>Only what the caller's own role is allowed to open.</summary>
    [HttpGet("mine")]
    public async Task<ActionResult<ApiEnvelope<List<TrainingMaterialDto>>>> Mine(
        [FromQuery] int? programTypeId, CancellationToken ct) =>
        Envelope(await service.VisibleToMeAsync(programTypeId, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.MaterialsView)]
    public async Task<ActionResult<ApiEnvelope<TrainingMaterialDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPost]
    [HasPermission(Permissions.MaterialsManage)]
    public async Task<ActionResult<ApiEnvelope<TrainingMaterialDto>>> Create(
        [FromBody] TrainingMaterialUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Training material published.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.MaterialsManage)]
    public async Task<ActionResult<ApiEnvelope<TrainingMaterialDto>>> Update(
        int id, [FromBody] TrainingMaterialUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Training material updated.");

    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.MaterialsManage)]
    public async Task<ActionResult<ApiEnvelope<TrainingMaterialDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, ct));

    /// <summary>
    /// Takes the file itself. Answers with what the publish form should
    /// record about it, so the row is written by the form as usual.
    /// </summary>
    [HttpPost("upload")]
    [HasPermission(Permissions.MaterialsManage)]
    [RequestSizeLimit(512L * 1024 * 1024)]
    public async Task<ActionResult<ApiEnvelope<MaterialFileDto>>> Upload(
        IFormFile file, [FromForm] int programTypeId, CancellationToken ct)
    {
        if (file is null || file.Length == 0) throw new AppException("Choose a file to upload.");

        await using var content = file.OpenReadStream();
        return Envelope(
            await service.UploadAsync(
                content, file.ContentType, file.FileName, file.Length, programTypeId, ct),
            "File uploaded.");
    }

    /// <summary>
    /// The published file, for viewing or for download.
    ///
    /// Not behind MaterialsView: this is what an applicant or a coordinator
    /// opens, and the row's own role list decides. The service enforces it.
    /// </summary>
    [HttpGet("{id:int}/file")]
    public async Task<IActionResult> File(
        int id, [FromQuery] bool download, CancellationToken ct)
    {
        var (content, contentType, fileName, inline) = await service.OpenAsync(id, download, ct);

        /* Inline for anything a browser renders, so the preview shows in
           place; an attachment otherwise, and always when asked for. */
        Response.Headers.ContentDisposition =
            $"{(inline ? "inline" : "attachment")}; filename=\"{Uri.EscapeDataString(fileName)}\"";

        /* Ranges, so a video can be scrubbed rather than downloaded whole. */
        return new FileStreamResult(content, contentType) { EnableRangeProcessing = true };
    }

    /// <summary>
    /// A one-shot address for this file, for handing to something that cannot
    /// send a token — the phone's browser or its PDF viewer.
    ///
    /// The permission is settled here, while there is still a signed-in
    /// caller to settle it against.
    /// </summary>
    [HttpPost("{id:int}/ticket")]
    public async Task<ActionResult<ApiEnvelope<MaterialTicketDto>>> Ticket(
        int id, [FromQuery] bool download, CancellationToken ct)
    {
        await service.CheckAsync(id, download, ct);

        var holder = CurrentUser.UserId?.ToString()
                     ?? CurrentUser.ApplicantId?.ToString()
                     ?? "unknown";

        var (value, seconds) = tickets.Issue(id, holder, download);

        return Envelope(new MaterialTicketDto
        {
            Url = $"{Request.Scheme}://{Request.Host}/api/materials/file/{value}",
            ExpiresInSeconds = seconds,
        });
    }

    /// <summary>
    /// Serves a file against a ticket. Anonymous because the caller is a
    /// viewer with no session; the ticket is what was checked, it names one
    /// file, and it is spent on use.
    /// </summary>
    [HttpGet("file/{ticket}")]
    [AllowAnonymous]
    public async Task<IActionResult> ByTicket(string ticket, CancellationToken ct)
    {
        var redeemed = tickets.Redeem(ticket)
            ?? throw new AppException("That link has expired. Open the material again.", 410);

        var (content, contentType, fileName, inline) =
            await service.ReadAsync(redeemed.MaterialId, redeemed.Download, ct);

        Response.Headers.ContentDisposition =
            $"{(inline ? "inline" : "attachment")}; filename=\"{Uri.EscapeDataString(fileName)}\"";

        return new FileStreamResult(content, contentType) { EnableRangeProcessing = true };
    }
}

/// <summary>
/// The form an applicant fills in to create an account.
///
/// One form, so no paging and no id in the collection route. The public read
/// is anonymous on purpose: the applicant app has to render this before
/// anybody has an account to authenticate with.
/// </summary>
[Route("api/signup-form")]
public class SignupFormController(SignupFormService service) : ApiControllerBase
{
    /// <summary>The default set, which every sub-category without its own uses.</summary>
    [HttpGet]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<List<SignupFieldDto>>>> List(CancellationToken ct) =>
        Envelope(await service.ListAsync(false, ct));

    /// <summary>
    /// The form one sub-category uses, with whether it is its own or the
    /// default it falls back to.
    /// </summary>
    [HttpGet("sub-category/{subCategoryId:int}")]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<SignupFormDto>>> ForSubCategory(
        int subCategoryId, CancellationToken ct) =>
        Envelope(await service.FormAsync(subCategoryId, false, ct));

    /// <summary>
    /// What the applicant app renders. Anonymous on purpose: this is drawn
    /// before anybody has an account to authenticate with, and switched-off
    /// fields are left out because nothing should be asked that is not asked.
    /// </summary>
    [HttpGet("public")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiEnvelope<SignupFormDto>>> Public(
        [FromQuery] int? subCategoryId, CancellationToken ct) =>
        Envelope(await service.FormAsync(subCategoryId, activeOnly: true, ct));

    /// <summary>Gives a sub-category its own form, copied from the default.</summary>
    [HttpPost("sub-category/{subCategoryId:int}")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<SignupFormDto>>> Adopt(
        int subCategoryId, CancellationToken ct) =>
        Envelope(await service.AdoptAsync(subCategoryId, ct),
            "This sub-category now has its own sign-up form.");

    /// <summary>Drops a sub-category's own form, putting it back on the default.</summary>
    [HttpDelete("sub-category/{subCategoryId:int}")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<SignupFormDto>>> Reset(
        int subCategoryId, CancellationToken ct) =>
        Envelope(await service.ResetAsync(subCategoryId, ct),
            "This sub-category is back on the default form.");

    [HttpPost]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<SignupFieldDto>>> Create(
        [FromBody] SignupFieldUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Field added.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<SignupFieldDto>>> Update(
        int id, [FromBody] SignupFieldUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Field updated.");

    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<SignupFieldDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, ct));

    [HttpDelete("{id:int}")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<bool>>> Delete(int id, CancellationToken ct)
    {
        await service.DeleteAsync(id, ct);
        return Envelope(true, "Field removed.");
    }

    [HttpPut("order")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<List<SignupFieldDto>>>> Reorder(
        [FromQuery] int? subCategoryId, [FromBody] ReorderDto dto, CancellationToken ct) =>
        Envelope(await service.ReorderAsync(subCategoryId, dto.Ids, ct), "Order saved.");
}
