using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Persistence;
using Ntms.Infrastructure.Storage;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Everything the coordinator mobile app records at an awareness workshop.
///
/// Two rules run through the whole class and are enforced in one place each:
///
/// <list type="bullet">
/// <item>A coordinator may only touch programmes they are assigned to. Reads
/// are opened up to anyone who can already see the programme in the portal, so
/// the evidence is visible up the chain without letting them alter it.</item>
/// <item>Once a programme is finally submitted nothing may change. Every write
/// goes through <see cref="ForWriteAsync"/>, which refuses after submission —
/// so a new write cannot be added later that forgets to check.</item>
/// </list>
/// </summary>
public class MonitoringService(
    NtmsDbContext db,
    ICurrentUser currentUser,
    MonitoringPhotoStore photos)
{
    /* ------------------------------------------------------------ access */

    /// <summary>
    /// The programme, if this account may read it: the assigned coordinator, or
    /// anyone whose portal scope already covers the programme.
    /// </summary>
    private async Task<Programme> ForReadAsync(int programmeId, CancellationToken ct)
    {
        var programme = await db.Programmes
            .Include(p => p.ProgramType)
            .Include(p => p.State)
            .FirstOrDefaultAsync(p => p.Id == programmeId, ct)
            ?? throw AppException.NotFound("Programme");

        if (programme.CoordinatorId == currentUser.UserId) return programme;

        if (currentUser.HasPermission(Permissions.ProgramsView))
        {
            var visible = await db.Programmes.AsNoTracking()
                .WithinScope(currentUser)
                .AnyAsync(p => p.Id == programmeId, ct);
            if (visible) return programme;
        }

        throw AppException.Forbidden("This programme is not assigned to you.");
    }

    /// <summary>
    /// The programme, if this account may still change its monitoring record.
    ///
    /// Only the assigned coordinator, and only before final submission. The
    /// submission check lives here rather than at each call site because
    /// "sealed" has to mean sealed against writes nobody has thought of yet.
    /// </summary>
    private async Task<Programme> ForWriteAsync(int programmeId, CancellationToken ct)
    {
        var programme = await db.Programmes
            .FirstOrDefaultAsync(p => p.Id == programmeId, ct)
            ?? throw AppException.NotFound("Programme");

        if (programme.CoordinatorId != currentUser.UserId)
            throw AppException.Forbidden("This programme is not assigned to you.");

        var sealedOn = await db.ProgrammeSubmissions.AsNoTracking()
            .Where(s => s.ProgrammeId == programmeId)
            .Select(s => (DateTime?)s.SubmittedOn)
            .FirstOrDefaultAsync(ct);

        if (sealedOn is not null)
            throw AppException.Conflict(
                $"This programme was finally submitted on {IndianTime.Format(sealedOn.Value)} and can no longer be changed.");

        return programme;
    }

    /* ------------------------------------------------------- programmes */

    /// <summary>The workshops assigned to the signed-in coordinator.</summary>
    public async Task<List<CoordinatorProgrammeDto>> MyProgrammesAsync(CancellationToken ct)
    {
        var userId = currentUser.UserId
            ?? throw AppException.Forbidden("Sign in to see your programmes.");

        var rows = await db.Programmes.AsNoTracking()
            .Include(p => p.ProgramType)
            .Include(p => p.State)
            .Where(p => p.CoordinatorId == userId)
            .OrderByDescending(p => p.StartDate)
            .ToListAsync(ct);

        /* Nullable on purpose: a plain DateTime would make a programme with no
           submission come back as 0001-01-01, which reads as "submitted". */
        var submitted = await db.ProgrammeSubmissions.AsNoTracking()
            .Where(s => rows.Select(p => p.Id).Contains(s.ProgrammeId))
            .ToDictionaryAsync(s => s.ProgrammeId, s => (DateTime?)s.SubmittedOn, ct);

        return [.. rows.Select(p => Summarise(p, submitted.GetValueOrDefault(p.Id)))];
    }

    public async Task<CoordinatorProgrammeDetailDto> GetAsync(int programmeId, CancellationToken ct)
    {
        var programme = await ForReadAsync(programmeId, ct);

        var venue = await db.ProgrammeVenues.AsNoTracking()
            .FirstOrDefaultAsync(v => v.ProgrammeId == programmeId, ct);
        var trainers = await db.ProgrammeTrainers.AsNoTracking()
            .Where(t => t.ProgrammeId == programmeId)
            .OrderBy(t => t.Id)
            .ToListAsync(ct);
        var sessions = await db.MonitoringSessions.AsNoTracking()
            .Include(s => s.Trainer)
            .Include(s => s.CurriculumSession)
            .Include(s => s.CurriculumTopic)
            .Where(s => s.ProgrammeId == programmeId)
            .OrderBy(s => s.Id)
            .ToListAsync(ct);
        var participants = await db.OnSpotParticipants.AsNoTracking()
            .Where(x => x.ProgrammeId == programmeId)
            .OrderBy(x => x.Id)
            .ToListAsync(ct);
        var allPhotos = await db.MonitoringPhotos.AsNoTracking()
            .Where(x => x.ProgrammeId == programmeId)
            .OrderBy(x => x.Id)
            .ToListAsync(ct);

        var submission = await db.ProgrammeSubmissions.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ProgrammeId == programmeId, ct);

        var dto = Summarise(programme, submission?.SubmittedOn);
        var detail = new CoordinatorProgrammeDetailDto
        {
            Id = dto.Id,
            ProgrammeId = dto.ProgrammeId,
            ProgrammeName = dto.ProgrammeName,
            ProgramTypeName = dto.ProgramTypeName,
            Venue = dto.Venue,
            City = dto.City,
            State = dto.State,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            Status = dto.Status,
            IsSubmitted = dto.IsSubmitted,
            SubmittedOn = dto.SubmittedOn,
            Trainers = [.. trainers.Select(ToDto)],
            Sessions = [.. sessions.Select(s => ToDto(s, allPhotos))],
            Participants = [.. participants.Select(p => ToDto(p, allPhotos))],
            AttendanceSheets =
            [
                .. allPhotos
                    .Where(x => x.Kind == MonitoringPhotoKind.AttendanceSheet)
                    .Select(ToDto),
            ],
        };

        if (venue is not null) detail.Venue2 = ToDto(venue, allPhotos);
        detail.Progress = Progress(venue, trainers, sessions, participants, allPhotos);
        return detail;
    }

    /* ------------------------------------------------------------ venue */

    public async Task<VenueDto> SaveVenueAsync(int programmeId, VenueUpsertDto dto, CancellationToken ct)
    {
        await ForWriteAsync(programmeId, ct);

        Guard.Check()
            .Required(dto.Name, "Venue name")
            .Required(dto.Address, "Address")
            /* A single coordinate is meaningless, so both or neither. */
            .When(dto.Latitude.HasValue != dto.Longitude.HasValue,
                "Latitude and longitude must be captured together.")
            .When(dto.Latitude is < -90 or > 90, "Latitude must be between -90 and 90.")
            .When(dto.Longitude is < -180 or > 180, "Longitude must be between -180 and 180.")
            .ThrowIfInvalid();

        var venue = await db.ProgrammeVenues
            .FirstOrDefaultAsync(v => v.ProgrammeId == programmeId, ct);

        if (venue is null)
        {
            venue = new ProgrammeVenue { ProgrammeId = programmeId };
            db.ProgrammeVenues.Add(venue);
        }

        venue.Name = dto.Name.Trim();
        venue.Address = dto.Address.Trim();
        venue.Landmark = dto.Landmark?.Trim();

        /* A fresh fix replaces the old one and restamps the time; a save with
           no fix leaves whatever was captured at the venue alone, so editing
           the address indoors cannot erase the geo-tag. */
        if (dto.Latitude.HasValue)
        {
            venue.Latitude = dto.Latitude;
            venue.Longitude = dto.Longitude;
            venue.AccuracyMetres = dto.AccuracyMetres;
            venue.GeoTaggedOn = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);

        var all = await ProgrammePhotosAsync(programmeId, ct);
        return ToDto(venue, all);
    }

    /* ---------------------------------------------------------- trainers */

    public async Task<TrainerDto> AddTrainerAsync(
        int programmeId, TrainerUpsertDto dto, CancellationToken ct)
    {
        await ForWriteAsync(programmeId, ct);

        Guard.Check()
            .Required(dto.FullName, "Trainer name")
            .Mobile(dto.Mobile)
            .Email(dto.Email, required: false)
            .ThrowIfInvalid();

        var trainer = new ProgrammeTrainer
        {
            ProgrammeId = programmeId,
            FullName = dto.FullName.Trim(),
            Mobile = dto.Mobile.Trim(),
            Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim().ToLowerInvariant(),
            Designation = dto.Designation?.Trim(),
            Organisation = dto.Organisation?.Trim(),
        };

        db.ProgrammeTrainers.Add(trainer);
        await db.SaveChangesAsync(ct);
        return ToDto(trainer);
    }

    public async Task<TrainerDto> UpdateTrainerAsync(
        int trainerId, TrainerUpsertDto dto, CancellationToken ct)
    {
        var trainer = await db.ProgrammeTrainers.FirstOrDefaultAsync(t => t.Id == trainerId, ct)
                      ?? throw AppException.NotFound("Trainer");
        await ForWriteAsync(trainer.ProgrammeId, ct);

        Guard.Check()
            .Required(dto.FullName, "Trainer name")
            .Mobile(dto.Mobile)
            .Email(dto.Email, required: false)
            .ThrowIfInvalid();

        trainer.FullName = dto.FullName.Trim();
        trainer.Mobile = dto.Mobile.Trim();
        trainer.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim().ToLowerInvariant();
        trainer.Designation = dto.Designation?.Trim();
        trainer.Organisation = dto.Organisation?.Trim();

        await db.SaveChangesAsync(ct);
        return ToDto(trainer);
    }

    /* ---------------------------------------------------------- sessions */

    /// <summary>
    /// The programme's curriculum as topic → sub-topic, for the two dropdowns.
    /// Disabled sessions and topics are left out: they are not on the syllabus
    /// any more, so nothing new should be recorded against them.
    /// </summary>
    public async Task<List<SessionTopicDto>> CurriculumAsync(int programmeId, CancellationToken ct)
    {
        var programme = await ForReadAsync(programmeId, ct);

        if (programme.CurriculumId is null) return [];

        var sessions = await db.CurriculumSessions.AsNoTracking()
            .Include(s => s.Topics)
            .Where(s => s.CurriculumId == programme.CurriculumId && s.Status == RecordStatus.Active)
            .OrderBy(s => s.DisplayOrder).ThenBy(s => s.Id)
            .ToListAsync(ct);

        return
        [
            .. sessions.Select(s => new SessionTopicDto
            {
                SessionId = s.Id,
                SessionName = s.SessionName,
                SubTopics =
                [
                    .. s.Topics
                        .Where(t => t.Status == RecordStatus.Active)
                        .OrderBy(t => t.DisplayOrder).ThenBy(t => t.Id)
                        .Select(t => new SessionSubTopicDto { TopicId = t.Id, TopicName = t.TopicName }),
                ],
            }),
        ];
    }

    public async Task<MonitoringSessionDto> AddSessionAsync(
        int programmeId, MonitoringSessionUpsertDto dto, CancellationToken ct)
    {
        var programme = await ForWriteAsync(programmeId, ct);

        var trainer = await db.ProgrammeTrainers
            .FirstOrDefaultAsync(t => t.Id == dto.TrainerId && t.ProgrammeId == programmeId, ct)
            ?? throw new AppException("Register the trainer before recording a session.");

        /* The topic has to belong to this programme's own curriculum, or the
           record would claim content the workshop never had on its syllabus. */
        var topic = await db.CurriculumTopics.AsNoTracking()
            .Include(t => t.Session)
            .FirstOrDefaultAsync(t => t.Id == dto.CurriculumTopicId, ct)
            ?? throw AppException.NotFound("Sub-topic");

        if (topic.SessionId != dto.CurriculumSessionId)
            throw new AppException("That sub-topic does not belong to the chosen topic.");

        if (topic.Session?.CurriculumId != programme.CurriculumId)
            throw new AppException("That topic is not part of this programme's curriculum.");

        var session = new MonitoringSession
        {
            ProgrammeId = programmeId,
            TrainerId = trainer.Id,
            CurriculumSessionId = dto.CurriculumSessionId,
            CurriculumTopicId = dto.CurriculumTopicId,
            ConductedOn = DateTime.UtcNow,
            Comments = dto.Comments?.Trim(),
        };

        db.MonitoringSessions.Add(session);
        await db.SaveChangesAsync(ct);

        return await LoadSessionAsync(session.Id, ct);
    }

    /* ------------------------------------------------------ participants */

    public async Task<OnSpotParticipantDto> AddParticipantAsync(
        int programmeId, OnSpotParticipantUpsertDto dto, CancellationToken ct)
    {
        await ForWriteAsync(programmeId, ct);

        var udyam = (dto.UdyamNumber ?? string.Empty).Trim().ToUpperInvariant();

        /* Every field on this screen is mandatory. "NA" is an accepted answer
           for the Udyam number — an attendee from an unregistered enterprise is
           who these workshops are aimed at — but leaving it blank is not, so
           an unanswered question is never mistaken for an unregistered one. */
        Guard.Check()
            .Required(dto.FullName, "Full name")
            .Mobile(dto.Mobile)
            .Email(dto.Email)
            .Required(dto.EnterpriseName, "Enterprise name")
            .Required(udyam, "Udyam number")
            .When(string.IsNullOrWhiteSpace(dto.Gender), "Select a gender.")
            .When(string.IsNullOrWhiteSpace(dto.SocialCategory), "Select a social category.")
            .ThrowIfInvalid();

        var mobile = dto.Mobile.Trim();
        if (await db.OnSpotParticipants
                .AnyAsync(x => x.ProgrammeId == programmeId && x.Mobile == mobile, ct))
        {
            throw AppException.Conflict("Someone is already registered on this workshop with that mobile number.");
        }

        var participant = new OnSpotParticipant
        {
            ProgrammeId = programmeId,
            FullName = dto.FullName.Trim(),
            Mobile = mobile,
            Email = dto.Email.Trim().ToLowerInvariant(),
            EnterpriseName = dto.EnterpriseName.Trim(),
            Designation = dto.Designation?.Trim(),
            UdyamNumber = udyam,
            Gender = EnumMaps.ParseDeclared<Gender>(dto.Gender),
            SocialCategory = EnumMaps.ParseDeclared<SocialCategory>(dto.SocialCategory),
            StateCode = dto.StateCode,
            DistrictCode = dto.DistrictCode,
        };

        db.OnSpotParticipants.Add(participant);
        await db.SaveChangesAsync(ct);

        return ToDto(participant, []);
    }

    /// <summary>
    /// Ticks the register. Sent as a whole list rather than one row at a time,
    /// because attendance is taken in one pass on a device that may be offline
    /// between passes.
    /// </summary>
    public async Task<int> MarkAttendanceAsync(
        int programmeId, List<OnSpotAttendanceMarkDto> marks, CancellationToken ct)
    {
        await ForWriteAsync(programmeId, ct);

        var byId = marks.ToDictionary(m => m.ParticipantId, m => m.IsPresent);
        var rows = await db.OnSpotParticipants
            .Where(x => x.ProgrammeId == programmeId && byId.Keys.Contains(x.Id))
            .ToListAsync(ct);

        if (rows.Count != byId.Count)
            throw new AppException("Some of those participants are not registered on this workshop.");

        var now = DateTime.UtcNow;
        foreach (var row in rows)
        {
            row.IsPresent = byId[row.Id];
            row.AttendanceMarkedOn = now;
        }

        await db.SaveChangesAsync(ct);
        return rows.Count;
    }

    public async Task<OnSpotParticipantDto> SaveFeedbackAsync(
        int participantId, OnSpotFeedbackDto dto, CancellationToken ct)
    {
        var participant = await db.OnSpotParticipants
            .FirstOrDefaultAsync(x => x.Id == participantId, ct)
            ?? throw AppException.NotFound("Participant");

        await ForWriteAsync(participant.ProgrammeId, ct);

        Guard.Check()
            .When(dto.Rating is < 1 or > 5, "Rating must be between 1 and 5.")
            .ThrowIfInvalid();

        participant.FeedbackRating = dto.Rating;
        participant.FeedbackComments = dto.Comments?.Trim();
        participant.FeedbackOn = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        var all = await ProgrammePhotosAsync(participant.ProgrammeId, ct);
        return ToDto(participant, all);
    }

    /* ----------------------------------------------------------- photos */

    /// <summary>
    /// Stores one photograph against the programme and whatever it documents.
    ///
    /// The file is written first and the row second: a row pointing at a file
    /// that was never written would be a broken record, whereas a file with no
    /// row is merely an orphan nobody reads.
    /// </summary>
    public async Task<MonitoringPhotoDto> AddPhotoAsync(
        int programmeId,
        MonitoringPhotoKind kind,
        int? ownerId,
        Stream content,
        string? contentType,
        long length,
        decimal? latitude,
        decimal? longitude,
        CancellationToken ct)
    {
        await ForWriteAsync(programmeId, ct);

        var photo = new MonitoringPhoto
        {
            ProgrammeId = programmeId,
            Kind = kind,
            Latitude = latitude,
            Longitude = longitude,
            CapturedOn = DateTime.UtcNow,
        };

        switch (kind)
        {
            case MonitoringPhotoKind.VenueExterior:
            case MonitoringPhotoKind.VenueInterior:
            {
                var venue = await db.ProgrammeVenues
                    .FirstOrDefaultAsync(v => v.ProgrammeId == programmeId, ct)
                    ?? throw new AppException("Register the venue before adding its photos.");
                photo.VenueId = venue.Id;

                /* One exterior and one interior shot. A retake replaces the
                   previous one rather than piling up, so the record shows the
                   venue once. */
                var previous = await db.MonitoringPhotos
                    .Where(x => x.VenueId == venue.Id && x.Kind == kind)
                    .ToListAsync(ct);
                db.MonitoringPhotos.RemoveRange(previous);
                break;
            }

            case MonitoringPhotoKind.Session:
            {
                var session = await db.MonitoringSessions
                    .FirstOrDefaultAsync(s => s.Id == ownerId && s.ProgrammeId == programmeId, ct)
                    ?? throw AppException.NotFound("Session");
                photo.SessionId = session.Id;

                var previous = await db.MonitoringPhotos
                    .Where(x => x.SessionId == session.Id)
                    .ToListAsync(ct);
                db.MonitoringPhotos.RemoveRange(previous);
                break;
            }

            case MonitoringPhotoKind.Participant:
            {
                var participant = await db.OnSpotParticipants
                    .FirstOrDefaultAsync(x => x.Id == ownerId && x.ProgrammeId == programmeId, ct)
                    ?? throw AppException.NotFound("Participant");
                photo.ParticipantId = participant.Id;

                var previous = await db.MonitoringPhotos
                    .Where(x => x.ParticipantId == participant.Id)
                    .ToListAsync(ct);
                db.MonitoringPhotos.RemoveRange(previous);
                break;
            }

            case MonitoringPhotoKind.AttendanceSheet:
                /* Signed sheets run to several pages, so these accumulate. */
                break;

            default:
                throw new AppException("Unknown photo type.");
        }

        var stored = await photos.SaveAsync(content, contentType, length, programmeId, kind.ToString(), ct);

        photo.RelativePath = stored.RelativePath;
        photo.FileName = stored.FileName;
        photo.ContentType = stored.ContentType;
        photo.SizeBytes = stored.SizeBytes;

        db.MonitoringPhotos.Add(photo);
        await db.SaveChangesAsync(ct);

        return ToDto(photo);
    }

    /// <summary>Opens a stored photograph, for an account allowed to see it.</summary>
    public async Task<(Stream Content, string ContentType, string FileName)> OpenPhotoAsync(
        int photoId, CancellationToken ct)
    {
        var photo = await db.MonitoringPhotos.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == photoId, ct)
            ?? throw AppException.NotFound("Photo");

        await ForReadAsync(photo.ProgrammeId, ct);

        return (photos.Open(photo.RelativePath), photo.ContentType, photo.FileName);
    }

    /* ------------------------------------------------------- submission */

    /// <summary>
    /// Seals the programme's monitoring record.
    ///
    /// The counts are frozen into the row as they stand, so the submission is a
    /// statement of what was handed in rather than a pointer at data that might
    /// later be read differently.
    /// </summary>
    public async Task<ProgrammeSubmissionDto> SubmitAsync(
        int programmeId, SubmitProgrammeDto dto, CancellationToken ct)
    {
        await ForWriteAsync(programmeId, ct);

        var venue = await db.ProgrammeVenues.AsNoTracking()
            .FirstOrDefaultAsync(v => v.ProgrammeId == programmeId, ct);
        var trainers = await db.ProgrammeTrainers.AsNoTracking()
            .Where(t => t.ProgrammeId == programmeId).ToListAsync(ct);
        var sessions = await db.MonitoringSessions.AsNoTracking()
            .Where(s => s.ProgrammeId == programmeId).ToListAsync(ct);
        var participants = await db.OnSpotParticipants.AsNoTracking()
            .Where(x => x.ProgrammeId == programmeId).ToListAsync(ct);
        var allPhotos = await ProgrammePhotosAsync(programmeId, ct);

        var progress = Progress(venue, trainers, sessions, participants, allPhotos);
        if (progress.Blockers.Count > 0)
            throw new AppException(
                "This workshop is not ready to submit: " + string.Join(" ", progress.Blockers));

        var submission = new ProgrammeSubmission
        {
            ProgrammeId = programmeId,
            SubmittedByUserId = currentUser.UserId!.Value,
            SubmittedOn = DateTime.UtcNow,
            TrainerCount = trainers.Count,
            SessionCount = sessions.Count,
            ParticipantCount = participants.Count,
            PresentCount = participants.Count(p => p.IsPresent == true),
            PhotoCount = allPhotos.Count,
            Remarks = dto.Remarks?.Trim(),
        };

        db.ProgrammeSubmissions.Add(submission);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            /* The unique index caught a second submission that slipped past the
               check above — two taps on a slow connection. Report it as the
               conflict it is rather than a server error. */
            throw AppException.Conflict("This programme has already been submitted.");
        }

        return new ProgrammeSubmissionDto
        {
            ProgrammeId = programmeId,
            SubmittedOn = submission.SubmittedOn,
            SubmittedBy = currentUser.DisplayName,
            TrainerCount = submission.TrainerCount,
            SessionCount = submission.SessionCount,
            ParticipantCount = submission.ParticipantCount,
            PresentCount = submission.PresentCount,
            PhotoCount = submission.PhotoCount,
            Remarks = submission.Remarks,
        };
    }

    /* ---------------------------------------------------------- helpers */

    private Task<List<MonitoringPhoto>> ProgrammePhotosAsync(int programmeId, CancellationToken ct) =>
        db.MonitoringPhotos.AsNoTracking()
            .Where(x => x.ProgrammeId == programmeId)
            .OrderBy(x => x.Id)
            .ToListAsync(ct);

    private async Task<MonitoringSessionDto> LoadSessionAsync(int sessionId, CancellationToken ct)
    {
        var session = await db.MonitoringSessions.AsNoTracking()
            .Include(s => s.Trainer)
            .Include(s => s.CurriculumSession)
            .Include(s => s.CurriculumTopic)
            .FirstAsync(s => s.Id == sessionId, ct);

        var all = await ProgrammePhotosAsync(session.ProgrammeId, ct);
        return ToDto(session, all);
    }

    /// <summary>
    /// What is captured and what is missing.
    ///
    /// The blockers are the submission rules in one list, so the app can grey
    /// out the button for the same reasons the server would refuse — the
    /// coordinator learns what is missing before the long press, not after.
    /// </summary>
    private static MonitoringProgressDto Progress(
        ProgrammeVenue? venue,
        List<ProgrammeTrainer> trainers,
        List<MonitoringSession> sessions,
        List<OnSpotParticipant> participants,
        List<MonitoringPhoto> photos)
    {
        var exterior = photos.Any(p => p.Kind == MonitoringPhotoKind.VenueExterior);
        var interior = photos.Any(p => p.Kind == MonitoringPhotoKind.VenueInterior);
        var sheets = photos.Count(p => p.Kind == MonitoringPhotoKind.AttendanceSheet);
        var marked = participants.Count(p => p.IsPresent is not null);

        var progress = new MonitoringProgressDto
        {
            VenueRegistered = venue is not null,
            VenueGeoTagged = venue?.Latitude is not null,
            VenueExteriorPhoto = exterior,
            VenueInteriorPhoto = interior,
            TrainerCount = trainers.Count,
            SessionCount = sessions.Count,
            ParticipantCount = participants.Count,
            AttendanceMarkedCount = marked,
            PresentCount = participants.Count(p => p.IsPresent == true),
            AttendanceSheetCount = sheets,
            FeedbackCount = participants.Count(p => p.FeedbackRating is not null),
            PhotoCount = photos.Count,
        };

        if (venue is null) progress.Blockers.Add("Register the venue.");
        else if (venue.Latitude is null) progress.Blockers.Add("Geo-tag the venue.");

        if (!exterior) progress.Blockers.Add("Add the venue exterior photo.");
        if (!interior) progress.Blockers.Add("Add the venue interior photo.");
        if (trainers.Count == 0) progress.Blockers.Add("Register at least one trainer.");
        if (sessions.Count == 0) progress.Blockers.Add("Record at least one session.");
        if (participants.Count == 0) progress.Blockers.Add("Register at least one participant.");
        else if (marked < participants.Count)
            progress.Blockers.Add($"Mark attendance for all {participants.Count} participants.");
        if (sheets == 0) progress.Blockers.Add("Add a photo of the signed attendance sheet.");

        return progress;
    }

    private static CoordinatorProgrammeDto Summarise(Programme p, DateTime? submittedOn) => new()
    {
        Id = p.Id,
        ProgrammeId = p.ProgrammeId,
        ProgrammeName = p.ProgrammeName,
        ProgramTypeName = p.ProgramType?.Name,
        Venue = p.Venue,
        City = p.City,
        State = p.State?.Name,
        StartDate = p.StartDate,
        EndDate = p.EndDate,
        Status = p.Status.ToString(),
        IsSubmitted = submittedOn is not null,
        SubmittedOn = submittedOn,
    };

    private static TrainerDto ToDto(ProgrammeTrainer t) => new()
    {
        Id = t.Id,
        FullName = t.FullName,
        Mobile = t.Mobile,
        Email = t.Email,
        Designation = t.Designation,
        Organisation = t.Organisation,
    };

    private static VenueDto ToDto(ProgrammeVenue v, List<MonitoringPhoto> photos) => new()
    {
        Id = v.Id,
        Name = v.Name,
        Address = v.Address,
        Landmark = v.Landmark,
        Latitude = v.Latitude,
        Longitude = v.Longitude,
        AccuracyMetres = v.AccuracyMetres,
        GeoTaggedOn = v.GeoTaggedOn,
        ExteriorPhoto = photos
            .Where(p => p.Kind == MonitoringPhotoKind.VenueExterior)
            .Select(ToDto).FirstOrDefault(),
        InteriorPhoto = photos
            .Where(p => p.Kind == MonitoringPhotoKind.VenueInterior)
            .Select(ToDto).FirstOrDefault(),
    };

    private static MonitoringSessionDto ToDto(MonitoringSession s, List<MonitoringPhoto> photos) => new()
    {
        Id = s.Id,
        TrainerId = s.TrainerId,
        TrainerName = s.Trainer?.FullName,
        CurriculumSessionId = s.CurriculumSessionId,
        TopicName = s.CurriculumSession?.SessionName,
        CurriculumTopicId = s.CurriculumTopicId,
        SubTopicName = s.CurriculumTopic?.TopicName,
        ConductedOn = s.ConductedOn,
        Comments = s.Comments,
        Photo = photos.Where(p => p.SessionId == s.Id).Select(ToDto).FirstOrDefault(),
    };

    private static OnSpotParticipantDto ToDto(OnSpotParticipant x, List<MonitoringPhoto> photos) => new()
    {
        Id = x.Id,
        FullName = x.FullName,
        Mobile = x.Mobile,
        Email = x.Email,
        EnterpriseName = x.EnterpriseName,
        Designation = x.Designation,
        UdyamNumber = x.UdyamNumber,
        Gender = x.Gender?.ToString(),
        SocialCategory = x.SocialCategory?.ToString(),
        StateCode = x.StateCode,
        DistrictCode = x.DistrictCode,
        IsPresent = x.IsPresent,
        AttendanceMarkedOn = x.AttendanceMarkedOn,
        FeedbackRating = x.FeedbackRating,
        FeedbackComments = x.FeedbackComments,
        Photo = photos.Where(p => p.ParticipantId == x.Id).Select(ToDto).FirstOrDefault(),
    };

    private static MonitoringPhotoDto ToDto(MonitoringPhoto p) => new()
    {
        Id = p.Id,
        Kind = p.Kind.ToString(),
        FileName = p.FileName,
        ContentType = p.ContentType,
        SizeBytes = p.SizeBytes,
        Latitude = p.Latitude,
        Longitude = p.Longitude,
        CapturedOn = p.CapturedOn,
        Url = $"coordinator/photos/{p.Id}",
    };
}
