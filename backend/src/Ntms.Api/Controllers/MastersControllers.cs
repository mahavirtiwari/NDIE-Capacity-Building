using Microsoft.AspNetCore.Mvc;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

[Route("api/categories")]
public class CategoriesController(CategoryService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<CategoryDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.ListAsync(request, status, ct));

    [HttpGet("all")]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<List<CategoryDto>>>> All(
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.AllAsync(status, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<CategoryDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPost]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<CategoryDto>>> Create(
        [FromBody] CategoryUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Category created.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<CategoryDto>>> Update(
        int id, [FromBody] CategoryUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Category updated.");

    /// <summary>Masters are enabled or disabled, never deleted.</summary>
    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<CategoryDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, ct), $"Category {dto.Status.ToLowerInvariant()}.");
}

[Route("api/sub-categories")]
public class SubCategoriesController(SubCategoryService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<SubCategoryDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] int? categoryId,
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.ListAsync(request, categoryId, status, ct));

    [HttpGet("all")]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<List<SubCategoryDto>>>> All(
        [FromQuery] int? categoryId, [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.AllAsync(categoryId, status, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<SubCategoryDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPost]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<SubCategoryDto>>> Create(
        [FromBody] SubCategoryUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Sub-category created.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<SubCategoryDto>>> Update(
        int id, [FromBody] SubCategoryUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Sub-category updated.");

    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<SubCategoryDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, ct));
}

[Route("api/program-types")]
public class ProgramTypesController(ProgramTypeService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<ProgramTypeDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] int? categoryId,
        [FromQuery] int? subCategoryId, [FromQuery] string? deliveryMode,
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.ListAsync(request, categoryId, subCategoryId, deliveryMode, status, ct));

    [HttpGet("all")]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<List<ProgramTypeDto>>>> All(
        [FromQuery] int? categoryId, [FromQuery] int? subCategoryId,
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.AllAsync(categoryId, subCategoryId, status, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<ProgramTypeDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPost]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<ProgramTypeDto>>> Create(
        [FromBody] ProgramTypeUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Program type created.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<ProgramTypeDto>>> Update(
        int id, [FromBody] ProgramTypeUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Program type updated.");

    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<ProgramTypeDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, ct));

    /* --------------------------------------------- certificate templates */

    /// <summary>
    /// Uploads the artwork one kind of certificate is produced from. Replaces
    /// whatever is in that slot.
    /// </summary>
    [HttpPost("{id:int}/certificate-templates/{kind}")]
    [HasPermission(Permissions.MastersManage)]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<ActionResult<ApiEnvelope<ProgramTypeDto>>> UploadTemplate(
        int id, CertificateKind kind, IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0) throw new AppException("Attach a template file.");

        await using var stream = file.OpenReadStream();
        var result = await service.UploadTemplateAsync(
            id, kind, stream, file.ContentType, file.Length, file.FileName, ct);

        return Envelope(result, "Template uploaded.");
    }

    /// <summary>
    /// Serves a stored template back. Not cached by shared proxies: who may
    /// read it depends on the caller, not on the URL.
    /// </summary>
    [HttpGet("{id:int}/certificate-templates/{kind}")]
    [HasPermission(Permissions.MastersView)]
    public async Task<IActionResult> DownloadTemplate(
        int id, CertificateKind kind, CancellationToken ct)
    {
        var (content, contentType, fileName) = await service.OpenTemplateAsync(id, kind, ct);
        Response.Headers.CacheControl = "private, max-age=300";
        return File(content, contentType, fileName);
    }

    [HttpDelete("{id:int}/certificate-templates/{kind}")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<ProgramTypeDto>>> RemoveTemplate(
        int id, CertificateKind kind, CancellationToken ct) =>
        Envelope(await service.RemoveTemplateAsync(id, kind, ct), "Template removed.");
}

/// <summary>
/// What trainers mark candidates on in the viva or practical, per programme
/// type. Its own resource rather than a list hung off the program type, because
/// it is maintained on its own screen and read on its own by the trainer's app.
/// </summary>
[Route("api/evaluation-skills")]
public class EvaluationSkillsController(EvaluationSkillService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<List<EvaluationSkillDto>>>> List(
        [FromQuery] int? programTypeId, [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.ListAsync(programTypeId, status, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.MastersView)]
    public async Task<ActionResult<ApiEnvelope<EvaluationSkillDto>>> Get(
        int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPost]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<EvaluationSkillDto>>> Create(
        [FromBody] EvaluationSkillUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Skill added.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<EvaluationSkillDto>>> Update(
        int id, [FromBody] EvaluationSkillUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Skill updated.");

    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.MastersManage)]
    public async Task<ActionResult<ApiEnvelope<EvaluationSkillDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, ct));
}

[Route("api/agencies")]
public class AgenciesController(AgencyService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.AgenciesView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<AgencyDto>>>> List(
        [FromQuery] PagedRequest request, [FromQuery] string? agencyType,
        [FromQuery] int? categoryId, [FromQuery] int? subCategoryId,
        [FromQuery] int? programTypeId, [FromQuery] string? state,
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.ListAsync(
            request, agencyType, categoryId, subCategoryId, programTypeId, state, status, ct));

    [HttpGet("all")]
    [HasPermission(Permissions.AgenciesView)]
    public async Task<ActionResult<ApiEnvelope<List<AgencyDto>>>> All(
        [FromQuery] string? status, CancellationToken ct) =>
        Envelope(await service.AllAsync(status, ct));

    [HttpGet("{id:int}")]
    [HasPermission(Permissions.AgenciesView)]
    public async Task<ActionResult<ApiEnvelope<AgencyDto>>> Get(int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    [HttpPost]
    [HasPermission(Permissions.AgenciesManage)]
    public async Task<ActionResult<ApiEnvelope<AgencyDto>>> Create(
        [FromBody] AgencyUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.CreateAsync(dto, ct), "Implementing agency created.");

    [HttpPut("{id:int}")]
    [HasPermission(Permissions.AgenciesManage)]
    public async Task<ActionResult<ApiEnvelope<AgencyDto>>> Update(
        int id, [FromBody] AgencyUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(id, dto, ct), "Implementing agency updated.");

    [HttpPatch("{id:int}/status")]
    [HasPermission(Permissions.AgenciesManage)]
    public async Task<ActionResult<ApiEnvelope<AgencyDto>>> SetStatus(
        int id, [FromBody] StatusChangeDto dto, CancellationToken ct) =>
        Envelope(await service.SetStatusAsync(id, dto.Status, ct));
}
