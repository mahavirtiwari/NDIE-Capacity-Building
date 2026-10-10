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
    MonitoringPhotoStore photos,
    Microsoft.Extensions.Logging.ILogger<MonitoringService> logger)
{
    /// <summary>
    /// What the coordinator's handset knew when it took the photograph.
    ///
    /// All optional. A field visit happens where the signal does not, so
    /// a missing fix is ordinary rather than exceptional, and no part of
    /// this is worth refusing a photograph over.
    /// </summary>
    public sealed record Capture(
        DateTime? CapturedOn = null,
        decimal? Latitude = null,
        decimal? Longitude = null,
        string? Platform = null,
        string? Model = null,
        string? OsVersion = null);

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
            ?? throw AppException.NotFound("Program");

        if (programme.CoordinatorId == currentUser.UserId) return programme;

        if (currentUser.HasPermission(Permissions.ProgramsView))
        {
            var visible = await db.Programmes.AsNoTracking()
                .WithinScope(currentUser)
                .AnyAsync(p => p.Id == programmeId, ct);
            if (visible) return programme;
        }

        throw AppException.Forbidden("This program is not assigned to you.");
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
            ?? throw AppException.NotFound("Program");

        if (programme.CoordinatorId != currentUser.UserId)
            throw AppException.Forbidden("This program is not assigned to you.");

        var sealedOn = await db.ProgrammeSubmissions.AsNoTracking()
            .Where(s => s.ProgrammeId == programmeId)
            .Select(s => (DateTime?)s.SubmittedOn)
            .FirstOrDefaultAsync(ct);

        if (sealedOn is not null)
            throw AppException.Conflict(
                $"This program was finally submitted on {IndianTime.Format(sealedOn.Value)} and can no longer be changed.");

        return programme;
    }

    /* ------------------------------------------------------- programmes */

    /// <summary>The workshops assigned to the signed-in coordinator.</summary>
    public async Task<List<CoordinatorProgrammeDto>> MyProgrammesAsync(CancellationToken ct)
    {
        var userId = currentUser.UserId
            ?? throw AppException.Forbidden("Sign in to see your programs.");

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
            .Include(x => x.Days)
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
            .Aadhaar(dto.Aadhaar)
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

        Apply(trainer, dto);
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
            .Aadhaar(dto.Aadhaar)
            .ThrowIfInvalid();

        trainer.FullName = dto.FullName.Trim();
        trainer.Mobile = dto.Mobile.Trim();
        trainer.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim().ToLowerInvariant();
        trainer.Designation = dto.Designation?.Trim();
        trainer.Organisation = dto.Organisation?.Trim();

        Apply(trainer, dto);

        await db.SaveChangesAsync(ct);
        return ToDto(trainer);
    }

    /// <summary>
    /// The fields the faculty record gained, set the same way on both
    /// paths so a trainer edited cannot end up shaped differently from
    /// one registered.
    ///
    /// Experience is clamped rather than refused: a slip of the thumb on
    /// a phone keypad should not reject the whole form, and no trainer
    /// has eighty years of it.
    /// </summary>
    private static void Apply(ProgrammeTrainer trainer, TrainerUpsertDto dto)
    {
        trainer.Engagement =
            Enum.TryParse<TrainerEngagement>(dto.Engagement, ignoreCase: true, out var how)
                ? how
                : null;

        trainer.YearsExperience = dto.YearsExperience is { } years
            ? Math.Clamp(years, 0, 70)
            : null;

        trainer.Qualification = string.IsNullOrWhiteSpace(dto.Qualification)
            ? null
            : dto.Qualification.Trim();

        /* Only where one was sent. Nothing hands the stored number back
           to a screen, so a blank field means "unchanged" rather than
           "remove it" — read the other way round, every correction to a
           trainer's telephone number would quietly erase their Aadhaar.

           Clearing one is therefore not something these forms can do,
           which is the right trade: it is a correction nobody has asked
           for, against a mistake that would be silent. */
        if (!string.IsNullOrWhiteSpace(dto.Aadhaar))
            trainer.Aadhaar = dto.Aadhaar.Trim();
    }

    /// <summary>
    /// The qualifications a trainer may be recorded against.
    ///
    /// From the masters, so the faculty register does not accumulate
    /// "Post Graduate", "PG" and "Post-graduate" as three answers to the
    /// same question. Served here rather than from the masters endpoint
    /// because a coordinator holds no masters key and should not need
    /// one to fill in a form.
    ///
    /// Active only: a qualification that has been retired is not offered
    /// again, though records already carrying it keep reading.
    /// </summary>
    public async Task<List<string>> QualificationsAsync(CancellationToken ct) =>
        await db.Qualifications.AsNoTracking()
            .Where(q => q.Status == RecordStatus.Active)
            .OrderByDescending(q => q.Rank).ThenBy(q => q.Label)
            .Select(q => q.Label)
            .ToListAsync(ct);

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
            throw new AppException("That topic is not part of this program's curriculum.");

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
    /// <summary>
    /// Marks the register for one or more days.
    ///
    /// Sent as a list because attendance is a single pass down a row of
    /// chairs, often with no signal: a request per tick would strand it
    /// half done. A mark that already exists for that person on that day
    /// is corrected rather than added again, so a second pass fixes the
    /// first instead of recording them twice.
    ///
    /// Days outside the programme's own dates are refused. A register
    /// for a day the programme did not run is not a correction anybody
    /// meant to make.
    /// </summary>
    public async Task<int> MarkAttendanceAsync(
        int programmeId, List<OnSpotAttendanceMarkDto> marks, CancellationToken ct)
    {
        var programme = await ForWriteAsync(programmeId, ct);
        if (marks.Count == 0) return 0;

        var days = DaysOf(programme);
        var offDays = marks.Select(m => m.Day).Distinct().Where(d => !days.Contains(d)).ToList();
        if (offDays.Count > 0)
        {
            throw new AppException(
                "The programme did not run on "
                + string.Join(", ", offDays.Select(d => d.ToString("dd MMM yyyy")))
                + ".");
        }

        var wanted = marks.Select(m => m.ParticipantId).Distinct().ToList();
        var people = await db.OnSpotParticipants
            .Include(x => x.Days)
            .Where(x => x.ProgrammeId == programmeId && wanted.Contains(x.Id))
            .ToListAsync(ct);

        if (people.Count != wanted.Count)
            throw new AppException("Some of those participants are not registered on this workshop.");

        var now = DateTime.UtcNow;
        var who = currentUser.DisplayName;

        foreach (var mark in marks)
        {
            var person = people.First(x => x.Id == mark.ParticipantId);
            var existing = person.Days.FirstOrDefault(d => d.Day == mark.Day);

            if (existing is null)
            {
                person.Days.Add(new OnSpotAttendance
                {
                    ParticipantId = person.Id,
                    ProgrammeId = programmeId,
                    Day = mark.Day,
                    IsPresent = mark.IsPresent,
                    MarkedOn = now,
                    MarkedBy = who,
                });
            }
            else
            {
                existing.IsPresent = mark.IsPresent;
                existing.MarkedOn = now;
                existing.MarkedBy = who;
            }
        }

        /* The roll-up the rest of the system reads. Present on any day
           counts as having attended — the alternative, requiring every
           day, would mark somebody who missed an afternoon as never
           having come. */
        foreach (var person in people)
        {
            person.IsPresent = person.Days.Any(d => d.IsPresent);
            person.AttendanceMarkedOn = now;
        }

        await db.SaveChangesAsync(ct);
        return marks.Count;
    }

    /// <summary>
    /// Every day the programme runs, first to last.
    ///
    /// Derived from its dates rather than stored: the register has a
    /// column per day and the dates are what say how many. A programme
    /// with no end date is one day long, which is what a one-day
    /// programme looks like in the data.
    /// </summary>
    private static List<DateOnly> DaysOf(Programme programme)
    {
        var start = programme.StartDate;
        var end = programme.EndDate >= start ? programme.EndDate : start;

        /* Capped. A pair of dates mistyped by a century should not turn
           into a register with forty thousand columns in it. */
        var days = new List<DateOnly>();
        for (var day = start; day <= end && days.Count < 60; day = day.AddDays(1))
            days.Add(day);

        return days;
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
        Capture capture,
        CancellationToken ct)
    {
        await ForWriteAsync(programmeId, ct);

        var now = DateTime.UtcNow;

        /* The handset's clock, but only if it is plausible. A phone with
           the date wrong would otherwise stamp a site visit with a time
           that makes the evidence look altered. Twenty-four hours is wide
           enough for a photograph queued overnight out of signal and
           narrow enough to catch a clock that is simply wrong. */
        var capturedOn = capture.CapturedOn is { } said
                         && Math.Abs((now - said).TotalHours) <= 24
            ? said
            : now;

        var photo = new MonitoringPhoto
        {
            ProgrammeId = programmeId,
            Kind = kind,
            Latitude = capture.Latitude,
            Longitude = capture.Longitude,
            CapturedOn = capturedOn,
            SyncedOn = now,
            DevicePlatform = Trimmed(capture.Platform, 40),
            DeviceModel = Trimmed(capture.Model, 120),
            DeviceOsVersion = Trimmed(capture.OsVersion, 40),
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

        /* Read whole before it is written, because the stamp is drawn
           into the pixels and that needs the image rather than a stream
           being poured into a file. These are capped well below what is
           worth worrying about holding in memory. */
        using var buffer = new MemoryStream();
        await content.CopyToAsync(buffer, ct);
        var bytes = buffer.ToArray();

        var stamp = PhotoStamp.Apply(
            bytes, photo.CapturedOn, photo.Latitude, photo.Longitude, logger);

        photo.Stamped = stamp.Stamped;

        await using var toStore = new MemoryStream(stamp.Content);
        var stored = await photos.SaveAsync(
            toStore,
            /* The type the stamp produced where it worked, and whatever
               arrived where it did not — a PNG stored unmarked is still a
               PNG and must not be recorded as a JPEG. */
            stamp.Stamped ? stamp.ContentType : contentType,
            stamp.Content.Length,
            programmeId,
            kind.ToString(),
            ct);

        photo.RelativePath = stored.RelativePath;
        photo.FileName = stored.FileName;
        photo.ContentType = stored.ContentType;
        photo.SizeBytes = stored.SizeBytes;

        db.MonitoringPhotos.Add(photo);
        await db.SaveChangesAsync(ct);

        return ToDto(photo);
    }

    /// <summary>Trimmed to what the column holds, or null if there is nothing.</summary>
    private static string? Trimmed(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var clean = value.Trim();
        return clean.Length <= max ? clean : clean[..max];
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
            /* Closing the programme is what forwards it. There is no
               second act of sending, so nothing can sit conducted and
               unsent while everybody assumes somebody else posted it. */
            QcStatus = QcStatus.Pending,
        };

        db.ProgrammeSubmissions.Add(submission);

        /* The batch is conducted because the coordinator who ran it says
           so and has handed in the evidence. It used to be moved by hand
           from the portal afterwards, which meant the register disagreed
           with the record for as long as nobody got round to it. */
        var programme = await db.Programmes.FirstOrDefaultAsync(p => p.Id == programmeId, ct);
        if (programme is not null && programme.Status != ProgramStatus.Conducted)
        {
            programme.Status = ProgramStatus.Conducted;
            programme.RegistrationsOpen = false;
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            /* The unique index caught a second submission that slipped past the
               check above — two taps on a slow connection. Report it as the
               conflict it is rather than a server error. */
            throw AppException.Conflict("This program has already been submitted.");
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
        Engagement = t.Engagement?.ToString(),
        YearsExperience = t.YearsExperience,
        Qualification = t.Qualification,
        /* The last four and no more. Aadhaar is deliberately absent from
           what goes back: the app sends it once and never needs it
           again, and a faculty list that returns everybody's is a list
           that leaks it to every caller. */
        Aadhaar = null,
        AadhaarLast4 = t.Aadhaar is { Length: >= 4 } whole ? whole[^4..] : null,
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
        Days =
        [
            .. x.Days
                .OrderBy(d => d.Day)
                .Select(d => new OnSpotAttendanceDayDto
                {
                    Day = d.Day,
                    IsPresent = d.IsPresent,
                    MarkedOn = d.MarkedOn,
                }),
        ],
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
        SyncedOn = p.SyncedOn == default ? null : p.SyncedOn,
        DevicePlatform = p.DevicePlatform,
        DeviceModel = p.DeviceModel,
        Stamped = p.Stamped,
        Url = $"coordinator/photos/{p.Id}",
    };
}
