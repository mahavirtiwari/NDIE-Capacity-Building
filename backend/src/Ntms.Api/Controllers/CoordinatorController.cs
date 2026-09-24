using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Infrastructure.Services;

namespace Ntms.Api.Controllers;

/// <summary>
/// The coordinator mobile app: what was recorded at an awareness workshop.
///
/// Authorisation is not done here. Every method goes through
/// <see cref="MonitoringService"/>, which decides for itself whether this
/// account may read or change the programme in question and refuses writes
/// after final submission — so a route added later cannot skip the check by
/// forgetting an attribute.
/// </summary>
[Route("api/coordinator")]
[Authorize]
public class CoordinatorController(MonitoringService service) : ApiControllerBase
{
    /* ------------------------------------------------------- programmes */

    /// <summary>The workshops assigned to the signed-in coordinator.</summary>
    [HttpGet("programmes")]
    public async Task<ActionResult<ApiEnvelope<List<CoordinatorProgrammeDto>>>> MyProgrammes(
        CancellationToken ct) =>
        Envelope(await service.MyProgrammesAsync(ct));

    /// <summary>One workshop with everything captured against it so far.</summary>
    [HttpGet("programmes/{id:int}")]
    public async Task<ActionResult<ApiEnvelope<CoordinatorProgrammeDetailDto>>> Get(
        int id, CancellationToken ct) =>
        Envelope(await service.GetAsync(id, ct));

    /// <summary>The curriculum, as the topic and sub-topic dropdowns.</summary>
    [HttpGet("programmes/{id:int}/curriculum")]
    public async Task<ActionResult<ApiEnvelope<List<SessionTopicDto>>>> Curriculum(
        int id, CancellationToken ct) =>
        Envelope(await service.CurriculumAsync(id, ct));

    /* ------------------------------------------------------------ venue */

    [HttpPut("programmes/{id:int}/venue")]
    public async Task<ActionResult<ApiEnvelope<VenueDto>>> SaveVenue(
        int id, [FromBody] VenueUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.SaveVenueAsync(id, dto, ct));

    /// <summary>The exterior or interior shot; a retake replaces the last one.</summary>
    [HttpPost("programmes/{id:int}/venue/photo")]
    [RequestSizeLimit(16 * 1024 * 1024)]
    public async Task<ActionResult<ApiEnvelope<MonitoringPhotoDto>>> VenuePhoto(
        int id,
        [FromQuery] string slot,
        IFormFile file,
        [FromQuery] decimal? latitude,
        [FromQuery] decimal? longitude,
        CancellationToken ct)
    {
        var kind = slot?.ToLowerInvariant() switch
        {
            "exterior" => MonitoringPhotoKind.VenueExterior,
            "interior" => MonitoringPhotoKind.VenueInterior,
            _ => throw new AppException("Photo slot must be 'exterior' or 'interior'."),
        };

        return Envelope(await Upload(id, kind, null, file, latitude, longitude, ct));
    }

    /* --------------------------------------------------------- trainers */

    [HttpPost("programmes/{id:int}/trainers")]
    public async Task<ActionResult<ApiEnvelope<TrainerDto>>> AddTrainer(
        int id, [FromBody] TrainerUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.AddTrainerAsync(id, dto, ct));

    [HttpPut("trainers/{trainerId:int}")]
    public async Task<ActionResult<ApiEnvelope<TrainerDto>>> UpdateTrainer(
        int trainerId, [FromBody] TrainerUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.UpdateTrainerAsync(trainerId, dto, ct));

    /* --------------------------------------------------------- sessions */

    [HttpPost("programmes/{id:int}/sessions")]
    public async Task<ActionResult<ApiEnvelope<MonitoringSessionDto>>> AddSession(
        int id, [FromBody] MonitoringSessionUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.AddSessionAsync(id, dto, ct));

    [HttpPost("programmes/{id:int}/sessions/{sessionId:int}/photo")]
    [RequestSizeLimit(16 * 1024 * 1024)]
    public async Task<ActionResult<ApiEnvelope<MonitoringPhotoDto>>> SessionPhoto(
        int id, int sessionId, IFormFile file,
        [FromQuery] decimal? latitude, [FromQuery] decimal? longitude,
        CancellationToken ct) =>
        Envelope(await Upload(id, MonitoringPhotoKind.Session, sessionId, file, latitude, longitude, ct));

    /* ----------------------------------------------------- participants */

    /// <summary>On-spot registration. Every field is required; Udyam may be "NA".</summary>
    [HttpPost("programmes/{id:int}/participants")]
    public async Task<ActionResult<ApiEnvelope<OnSpotParticipantDto>>> AddParticipant(
        int id, [FromBody] OnSpotParticipantUpsertDto dto, CancellationToken ct) =>
        Envelope(await service.AddParticipantAsync(id, dto, ct));

    [HttpPost("programmes/{id:int}/participants/{participantId:int}/photo")]
    [RequestSizeLimit(16 * 1024 * 1024)]
    public async Task<ActionResult<ApiEnvelope<MonitoringPhotoDto>>> ParticipantPhoto(
        int id, int participantId, IFormFile file,
        [FromQuery] decimal? latitude, [FromQuery] decimal? longitude,
        CancellationToken ct) =>
        Envelope(await Upload(
            id, MonitoringPhotoKind.Participant, participantId, file, latitude, longitude, ct));

    /// <summary>The register, sent as one list so a whole pass lands together.</summary>
    [HttpPut("programmes/{id:int}/attendance")]
    public async Task<ActionResult<ApiEnvelope<int>>> MarkAttendance(
        int id, [FromBody] List<OnSpotAttendanceMarkDto> marks, CancellationToken ct) =>
        Envelope(await service.MarkAttendanceAsync(id, marks, ct));

    /// <summary>Photographs of the signed sheets; several are expected.</summary>
    [HttpPost("programmes/{id:int}/attendance/photo")]
    [RequestSizeLimit(16 * 1024 * 1024)]
    public async Task<ActionResult<ApiEnvelope<MonitoringPhotoDto>>> AttendancePhoto(
        int id, IFormFile file,
        [FromQuery] decimal? latitude, [FromQuery] decimal? longitude,
        CancellationToken ct) =>
        Envelope(await Upload(
            id, MonitoringPhotoKind.AttendanceSheet, null, file, latitude, longitude, ct));

    [HttpPut("participants/{participantId:int}/feedback")]
    public async Task<ActionResult<ApiEnvelope<OnSpotParticipantDto>>> Feedback(
        int participantId, [FromBody] OnSpotFeedbackDto dto, CancellationToken ct) =>
        Envelope(await service.SaveFeedbackAsync(participantId, dto, ct));

    /* ----------------------------------------------------------- photos */

    /// <summary>
    /// Serves a stored photograph. Not cached by shared proxies: who may see it
    /// depends on the caller, not on the URL.
    /// </summary>
    [HttpGet("photos/{photoId:int}")]
    public async Task<IActionResult> Photo(int photoId, CancellationToken ct)
    {
        var (content, contentType, fileName) = await service.OpenPhotoAsync(photoId, ct);
        Response.Headers.CacheControl = "private, max-age=3600";
        return File(content, contentType, fileName);
    }

    /* ------------------------------------------------------- submission */

    /// <summary>
    /// Seals the workshop's record. Nothing may be changed through the API
    /// afterwards, by this coordinator or anyone else.
    /// </summary>
    [HttpPost("programmes/{id:int}/submit")]
    public async Task<ActionResult<ApiEnvelope<ProgrammeSubmissionDto>>> Submit(
        int id, [FromBody] SubmitProgrammeDto dto, CancellationToken ct) =>
        Envelope(await service.SubmitAsync(id, dto, ct));

    /* ---------------------------------------------------------- helpers */

    private async Task<MonitoringPhotoDto> Upload(
        int programmeId, MonitoringPhotoKind kind, int? ownerId, IFormFile? file,
        decimal? latitude, decimal? longitude, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            throw new AppException("Attach a photo.");

        await using var stream = file.OpenReadStream();
        return await service.AddPhotoAsync(
            programmeId, kind, ownerId, stream, file.ContentType, file.Length,
            latitude, longitude, ct);
    }
}
