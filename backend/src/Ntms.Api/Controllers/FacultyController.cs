using Microsoft.AspNetCore.Mvc;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>
/// The faculty register.
///
/// Trainers reach the record two ways: a coordinator registers whoever turned
/// up, from the app, on the day; and an administrator adds or corrects one
/// here. Both write the same rows against the same programme — this is the
/// portal's door to them, not a second store.
/// </summary>
[Route("api/trainers")]
public class FacultyController(FacultyService service) : ApiControllerBase
{
    [HttpGet]
    [HasPermission(Permissions.TrainersView)]
    public async Task<ActionResult<ApiEnvelope<PagedResult<FacultyDto>>>> List(
        [FromQuery] PagedRequest request,
        [FromQuery] int? categoryId,
        [FromQuery] int? subCategoryId,
        [FromQuery] int? programTypeId,
        [FromQuery] int? agencyId,
        [FromQuery] int? stateCode,
        [FromQuery] int? programmeId,
        CancellationToken ct) =>
        Envelope(await service.ListAsync(
            request, categoryId, subCategoryId, programTypeId, agencyId, stateCode, programmeId, ct));

    [HttpPost("programmes/{programmeId:int}")]
    [HasPermission(Permissions.TrainersManage)]
    public async Task<ActionResult<ApiEnvelope<FacultyDto>>> Add(
        int programmeId, [FromBody] TrainerUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.AddAsync(programmeId, dto, ct), "Trainer added.");

    [HttpPut("{trainerId:int}")]
    [HasPermission(Permissions.TrainersManage)]
    public async Task<ActionResult<ApiEnvelope<FacultyDto>>> Update(
        int trainerId, [FromBody] TrainerUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateAsync(trainerId, dto, ct), "Trainer updated.");
}
