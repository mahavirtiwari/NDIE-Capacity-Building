using Microsoft.AspNetCore.Mvc;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
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
