using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
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
    CertificateService certificates,
    ILogger<MonitoringService> logger)
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
        string? OsVersion = null,
        /// <summary>Which day's register, on an attendance sheet.</summary>
        DateOnly? AttendanceDay = null);

    /* ------------------------------------------------------------ access */

    /// <summary>
    /// The programme, if this account may read it: the assigned coordinator, or
    /// anyone whose portal scope already covers the programme.
    /// </summary>
    /// <summary>
    /// The statuses at which a programme is the coordinator's to run.
    ///
    /// Permission comes from the operation manager above the agency that
    /// raised it. Before that there is nothing for anybody to record: the
    /// batch may yet be refused or put off, and a hall booked, a trainer
    /// named and twenty participants registered against a programme that
    /// never runs is a record of something that did not happen.
    ///
    /// Rejected and postponed are not here either. A postponed batch comes
    /// back to PermissionAccepted when it is re-permitted, and reappears
    /// then.
    /// </summary>
    private static readonly ProgramStatus[] Permitted =
    [
        ProgramStatus.PermissionAccepted,
        ProgramStatus.CalendarCreated,
        ProgramStatus.Conducted,
        /* A report that was sent back is a programme somebody has to
           work on again. Leaving it out of here meant the coordinator
           was told the batch was "waiting for permission from the
           operation manager" - which it was not - and the correction
           the manager had just asked for could not be made by anybody. */
        ProgramStatus.QCRejected,
    ];

    private async Task<Programme> ForReadAsync(int programmeId, CancellationToken ct)
    {
        var programme = await db.Programmes
            .Include(p => p.ProgramType)
            .Include(p => p.State)
            .Include(p => p.District)
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

        /* Nothing is captured against a programme that has not been
           permitted. The app does not list one, so this is the second lock
           rather than the first - a phone that was holding the screen when
           the batch was put off still cannot write to it. */
        if (!Permitted.Contains(programme.Status))
        {
            throw new AppException(
                "This program is waiting for permission from the operation manager. "
                + "Nothing can be recorded against it yet.");
        }

        /* A rejected submission is not a seal.
 
           Sending a report back and leaving the record locked is a
           request nobody can act on: the coordinator is the only person
           who can correct what is wrong with it, and every write here
           was refused while any submission stood. A report sent back by
           the agency or by the manager reopens the batch, which is the
           whole point of sending it back. */
        var sealedOn = await db.ProgrammeSubmissions.AsNoTracking()
            .Where(s => s.ProgrammeId == programmeId && s.QcStatus != QcStatus.Rejected)
            .Select(s => (DateTime?)s.SubmittedOn)
            .FirstOrDefaultAsync(ct);

        if (sealedOn is not null)
            throw AppException.Conflict(
                $"This program was finally submitted on {IndianTime.Format(sealedOn.Value)} and can no longer be changed.");

        return programme;
    }

    /// <summary>
    /// Whether a report has been handed in and not sent back, which is
    /// what closes the record to writes. The same test
    /// <see cref="ForWriteAsync"/> makes, asked without the refusal.
    /// </summary>
    private Task<bool> IsSealedAsync(int programmeId, CancellationToken ct) =>
        db.ProgrammeSubmissions.AsNoTracking()
            .AnyAsync(s => s.ProgrammeId == programmeId && s.QcStatus != QcStatus.Rejected, ct);

    /* ---------------------------------------------------------- profile */

    /// <summary>
    /// This coordinator's own record, with every code resolved to the
    /// name the person would recognise.
    /// </summary>
    public async Task<CoordinatorProfileDto> MyProfileAsync(CancellationToken ct)
    {
        var userId = currentUser.UserId
            ?? throw AppException.Forbidden("Sign in to see your profile.");

        var me = await db.Users.AsNoTracking()
            .Include(u => u.Role)
            .Include(u => u.Agency)
            .Include(u => u.ReportsToUser)
            .Include(u => u.State)
            .Include(u => u.District)
            .Include(u => u.States).ThenInclude(s => s.State)
            .Include(u => u.Districts).ThenInclude(d => d.District)
            .Include(u => u.Categories).ThenInclude(c => c.Category)
            .Include(u => u.SubCategories).ThenInclude(c => c.SubCategory)
            .Include(u => u.ProgramTypes).ThenInclude(p => p.ProgramType)
            .FirstOrDefaultAsync(u => u.Id == userId, ct)
            ?? throw AppException.NotFound("Account");

        return new CoordinatorProfileDto
        {
            UserCode = me.UserCode,
            FullName = me.FullName,
            Designation = me.Designation,
            Email = me.Email,
            Mobile = me.Mobile,
            RoleName = me.Role?.Name ?? me.BaseRole.ToString(),
            OrganisationName = me.OrganisationName,
            PanLast4 = Last4(me.Pan),
            AadhaarLast4 = Last4(me.Aadhaar),
            City = me.City,
            DistrictName = me.District?.Name,
            StateName = me.State?.Name,
            Pincode = me.Pincode,
            AgencyName = me.Agency?.Name,
            AgencyCode = me.Agency?.Code,
            ReportsToName = me.ReportsToUser?.FullName,
            ReportsToCode = me.ReportsToUser?.UserCode,
            States = [.. me.States.Select(s => s.State?.Name).Where(n => n is not null).Order()!],
            Districts =
                [.. me.Districts.Select(d => d.District?.Name).Where(n => n is not null).Order()!],
            Categories =
                [.. me.Categories.Select(c => c.Category?.Name).Where(n => n is not null).Order()!],
            SubCategories =
                [.. me.SubCategories.Select(c => c.SubCategory?.Name).Where(n => n is not null).Order()!],
            ProgramTypes =
                [.. me.ProgramTypes.Select(p => p.ProgramType?.Name).Where(n => n is not null).Order()!],
        };
    }

    /// <summary>The tail of an identifier, enough to recognise it by.</summary>
    private static string? Last4(string? value)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) || trimmed.Length < 4
            ? null
            : trimmed[^4..];
    }

    /* ----------------------------------------------------------- agency */

    /// <summary>
    /// The implementing agency this coordinator answers to, and how to
    /// reach it.
    ///
    /// Taken from the account first, and from the programmes they have
    /// been given if the account does not say - a coordinator created
    /// before the link was recorded still has an agency, and it is the
    /// one whose batches they are running. Null when neither knows,
    /// which the app shows as "ask the office" rather than as a blank
    /// card.
    /// </summary>
    public async Task<AgencyContactDto?> MyAgencyAsync(CancellationToken ct)
    {
        var userId = currentUser.UserId
            ?? throw AppException.Forbidden("Sign in to see your agency.");

        var agencyId = await db.Users.AsNoTracking()
            .Where(u => u.Id == userId)
            .Select(u => u.AgencyId)
            .FirstOrDefaultAsync(ct);

        agencyId ??= await db.Programmes.AsNoTracking()
            .Where(p => p.CoordinatorId == userId)
            .OrderByDescending(p => p.StartDate)
            .Select(p => (int?)p.AgencyId)
            .FirstOrDefaultAsync(ct);

        if (agencyId is null) return null;

        return await db.Agencies.AsNoTracking()
            .Where(a => a.Id == agencyId)
            .Select(a => new AgencyContactDto
            {
                Name = a.Name,
                ContactPerson = a.ContactPerson,
                Email = a.Email,
                Mobile = a.Mobile,
            })
            .FirstOrDefaultAsync(ct);
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
            .Include(p => p.District)
            .Where(p => p.CoordinatorId == userId && Permitted.Contains(p.Status))
            .OrderByDescending(p => p.StartDate)
            .ToListAsync(ct);

        /* Nullable on purpose: a plain DateTime would make a programme with no
           submission come back as 0001-01-01, which reads as "submitted". */
        var submitted = await db.ProgrammeSubmissions.AsNoTracking()
            .Where(s => rows.Select(p => p.Id).Contains(s.ProgrammeId))
            .ToDictionaryAsync(s => s.ProgrammeId, s => (DateTime?)s.SubmittedOn, ct);

        /* One query for the lot rather than one per row: the app groups
           its list by this and would otherwise ask for every programme's
           whole monitoring record to find out. */
        var ids = rows.Select(p => p.Id).ToList();
        var withVenue = await db.ProgrammeVenues.AsNoTracking()
            .Where(v => ids.Contains(v.ProgrammeId))
            .Select(v => v.ProgrammeId)
            .ToListAsync(ct);
        var registered = withVenue.ToHashSet();

        return
        [
            .. rows.Select(p =>
            {
                var dto = Summarise(p, submitted.GetValueOrDefault(p.Id));
                dto.VenueRegistered = registered.Contains(p.Id);
                return dto;
            }),
        ];
    }

    public async Task<CoordinatorProgrammeDetailDto> GetAsync(int programmeId, CancellationToken ct)
    {
        var programme = await ForReadAsync(programmeId, ct);
        await FillRegisterAsync(programme, ct);

        var venue = await db.ProgrammeVenues.AsNoTracking()
            .FirstOrDefaultAsync(v => v.ProgrammeId == programmeId, ct);
        var trainers = await db.ProgrammeTrainers.AsNoTracking()
            .Include(t => t.Answers)
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
            .Include(x => x.Applicant)
            .Where(x => x.ProgrammeId == programmeId)
            .OrderBy(x => x.Id)
            .ToListAsync(ct);
        var allPhotos = await db.MonitoringPhotos.AsNoTracking()
            .Where(x => x.ProgrammeId == programmeId)
            .OrderBy(x => x.Id)
            .ToListAsync(ct);

        var submission = await db.ProgrammeSubmissions.AsNoTracking()
            .FirstOrDefaultAsync(s => s.ProgrammeId == programmeId, ct);

        var detail = Fill(new CoordinatorProgrammeDetailDto(), programme, submission?.SubmittedOn);
        detail.VenueRegistered = venue is not null;
        detail.Trainers = [.. trainers.Select(t => ToDto(t, allPhotos))];
        detail.Sessions = [.. sessions.Select(s => ToDto(s, allPhotos))];
        detail.Participants = [.. participants.Select(p => ToDto(p, allPhotos))];
        detail.AttendanceSheets =
        [
            .. allPhotos
                .Where(x => x.Kind == MonitoringPhotoKind.AttendanceSheet)
                .Select(ToDto),
        ];

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

        var form = await TrainerFormAsync(ct);
        RequireWhatTheFormAsks(form, dto);

        var trainer = new ProgrammeTrainer
        {
            ProgrammeId = programmeId,
            /* Whose register this trainer joins. The app is where a
               coordinator does this, and it is their own list they are
               adding to. */
            RegisteredByUserId = currentUser.UserId,
            FullName = dto.FullName.Trim(),
            Mobile = dto.Mobile.Trim(),
            Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim().ToLowerInvariant(),
            Designation = dto.Designation?.Trim(),
            Organisation = dto.Organisation?.Trim(),
        };

        Apply(trainer, dto);
        KeepAnswers(trainer, form, dto);

        db.ProgrammeTrainers.Add(trainer);
        await db.SaveChangesAsync(ct);
        return ToDto(trainer);
    }

    public async Task<TrainerDto> UpdateTrainerAsync(
        int trainerId, TrainerUpsertDto dto, CancellationToken ct)
    {
        var trainer = await db.ProgrammeTrainers
                          .Include(t => t.Answers)
                          .FirstOrDefaultAsync(t => t.Id == trainerId, ct)
                      ?? throw AppException.NotFound("Trainer");
        await ForWriteAsync(trainer.ProgrammeId, ct);

        Guard.Check()
            .Required(dto.FullName, "Trainer name")
            .Mobile(dto.Mobile)
            .Email(dto.Email, required: false)
            .Aadhaar(dto.Aadhaar)
            .ThrowIfInvalid();

        var form = await TrainerFormAsync(ct);
        RequireWhatTheFormAsks(form, dto);

        trainer.FullName = dto.FullName.Trim();
        trainer.Mobile = dto.Mobile.Trim();
        trainer.Email = string.IsNullOrWhiteSpace(dto.Email) ? null : dto.Email.Trim().ToLowerInvariant();
        trainer.Designation = dto.Designation?.Trim();
        trainer.Organisation = dto.Organisation?.Trim();

        Apply(trainer, dto);
        KeepAnswers(trainer, form, dto);

        await db.SaveChangesAsync(ct);
        return ToDto(trainer);
    }

    /// <summary>
    /// The trainer form as it stands, switched-on fields only.
    ///
    /// Read on every registration rather than cached: the office changes
    /// this from the portal and a coordinator in the field should be
    /// working to the form as it is now, not as it was when the server
    /// last restarted.
    /// </summary>
    private async Task<List<TrainerField>> TrainerFormAsync(CancellationToken ct) =>
        await db.TrainerFields.AsNoTracking()
            .Where(f => f.Status == RecordStatus.Active)
            .OrderBy(f => f.DisplayOrder).ThenBy(f => f.Id)
            .ToListAsync(ct);

    /// <summary>
    /// Refuses a registration that leaves a required question unanswered.
    ///
    /// The app enforces this too, and this is the copy that counts: the
    /// app holds work offline and drains it later, by which time the form
    /// may have changed, and an older build of it knows nothing about a
    /// question added last week.
    ///
    /// Only the fields that are switched on. A question the office has
    /// turned off is not asked and not missed.
    /// </summary>
    private static void RequireWhatTheFormAsks(
        List<TrainerField> form, TrainerUpsertDto dto)
    {
        var missing = new List<string>();

        foreach (var field in form.Where(f => f.Required))
        {
            var given = field.Key switch
            {
                /* The two the record cannot do without are checked by the
                   guard above; these are the rest of the built-ins. */
                "fullName" => !string.IsNullOrWhiteSpace(dto.FullName),
                "mobile" => !string.IsNullOrWhiteSpace(dto.Mobile),
                "email" => !string.IsNullOrWhiteSpace(dto.Email),
                "qualification" => !string.IsNullOrWhiteSpace(dto.Qualification),
                "qualificationDetails" => !string.IsNullOrWhiteSpace(dto.QualificationDetails),
                "experience" => dto.YearsExperience is not null || dto.ExperienceMonths is not null,
                "aadhaar" => !string.IsNullOrWhiteSpace(dto.Aadhaar),
                /* The photographs are uploaded after the record exists, so
                   they cannot be insisted on here without making it
                   impossible to create one. The app asks for them. */
                "photo" or "idProof" => true,
                _ => dto.Answers.TryGetValue(field.Key, out var value)
                     && !string.IsNullOrWhiteSpace(value),
            };

            if (!given) missing.Add(field.Label);
        }

        if (missing.Count > 0)
        {
            throw new AppException(
                missing.Count == 1
                    ? $"{missing[0]} is required."
                    : "These are required: " + string.Join(", ", missing) + ".");
        }
    }

    /// <summary>
    /// Writes the answers to the questions the form adds.
    ///
    /// The wording is copied onto the answer rather than looked up later:
    /// a field can be relabelled or removed afterwards, and an answer
    /// whose question has gone is no longer evidence of anything.
    /// </summary>
    private static void KeepAnswers(
        ProgrammeTrainer trainer, List<TrainerField> form, TrainerUpsertDto dto)
    {
        var custom = form.Where(f => !f.IsBuiltIn).ToList();
        if (custom.Count == 0 && trainer.Answers.Count == 0) return;

        foreach (var field in custom)
        {
            dto.Answers.TryGetValue(field.Key, out var value);
            var clean = string.IsNullOrWhiteSpace(value) ? null : value.Trim();

            var held = trainer.Answers.FirstOrDefault(a => a.Key == field.Key);

            if (held is null)
            {
                if (clean is null) continue;
                trainer.Answers.Add(new TrainerAnswer
                {
                    Key = field.Key,
                    Label = field.Label,
                    Value = clean,
                });
                continue;
            }

            held.Label = field.Label;
            held.Value = clean;
        }
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

        /* Months are the remainder, not a second count of the same
           thing: eleven is the most that can be left over once the
           years are counted, and anything above it was meant to be a
           year. */
        trainer.ExperienceMonths = dto.ExperienceMonths is { } months
            ? Math.Clamp(months, 0, 11)
            : null;

        trainer.Qualification = string.IsNullOrWhiteSpace(dto.Qualification)
            ? null
            : dto.Qualification.Trim();

        trainer.QualificationDetails = string.IsNullOrWhiteSpace(dto.QualificationDetails)
            ? null
            : dto.QualificationDetails.Trim();

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
    /// The chosen trainer, as a row belonging to this programme.
    ///
    /// A coordinator picks from the agency's faculty, which includes
    /// people registered on other batches. Recording a session against
    /// one copies them onto this programme rather than pointing at
    /// another programme's row: the trainers are held per batch on
    /// purpose, so that correcting one workshop's record cannot rewrite
    /// another's, and a session has to belong to the batch it was
    /// taught on.
    /// </summary>
    private async Task<ProgrammeTrainer> ForThisProgrammeAsync(
        Programme programme, int trainerId, CancellationToken ct)
    {
        var chosen = await db.ProgrammeTrainers
            .Include(t => t.Programme)
            .FirstOrDefaultAsync(t => t.Id == trainerId, ct)
            ?? throw new AppException("Register the trainer before recording a session.");

        if (chosen.ProgrammeId == programme.Id) return chosen;

        if (chosen.Programme?.AgencyId != programme.AgencyId)
            throw AppException.Forbidden("That trainer belongs to another agency.");

        /* Already copied here by an earlier session: the same person,
           found by the number they were registered with. */
        var mine = await db.ProgrammeTrainers
            .FirstOrDefaultAsync(t => t.ProgrammeId == programme.Id && t.Mobile == chosen.Mobile, ct);
        if (mine is not null) return mine;

        var copy = new ProgrammeTrainer
        {
            ProgrammeId = programme.Id,
            RegisteredByUserId = currentUser.UserId,
            FullName = chosen.FullName,
            Mobile = chosen.Mobile,
            Email = chosen.Email,
            Designation = chosen.Designation,
            Organisation = chosen.Organisation,
            Engagement = chosen.Engagement,
            YearsExperience = chosen.YearsExperience,
            ExperienceMonths = chosen.ExperienceMonths,
            Qualification = chosen.Qualification,
            QualificationDetails = chosen.QualificationDetails,
            Aadhaar = chosen.Aadhaar,
        };

        db.ProgrammeTrainers.Add(copy);
        await db.SaveChangesAsync(ct);
        return copy;
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
    /// <summary>
    /// Which curriculum this programme follows.
    ///
    /// A curriculum belongs to a programme type and is that type's
    /// syllabus - its code, its name and its category all come from the
    /// master rather than being retyped. A programme carries its own
    /// <c>CurriculumId</c> so that a batch can be pinned to one, but
    /// nothing ever sets it: there is no curriculum field on the
    /// programme form, because with one syllabus per type there is
    /// nothing for anybody to choose. So every programme in the database
    /// has a null there - which meant the coordinator's session screen
    /// offered an empty list of topics however much curriculum had been
    /// written, and would have refused to record a session even if it
    /// had offered one.
    ///
    /// Resolved from the type when the programme does not name one: the
    /// newest curriculum that had come into effect by the day the batch
    /// started, or failing that the earliest active one, because a batch
    /// scheduled before its syllabus was published still ran against
    /// that syllabus. It is settled by the start date rather than by
    /// today, so publishing a revision does not change what a batch that
    /// has already run is recorded against.
    /// </summary>
    private async Task<int?> CurriculumForAsync(Programme programme, CancellationToken ct)
    {
        if (programme.CurriculumId is not null) return programme.CurriculumId;

        var candidates = await db.Curricula.AsNoTracking()
            .Where(c => c.ProgramTypeId == programme.ProgramTypeId && c.Status == RecordStatus.Active)
            .OrderBy(c => c.EffectiveFrom).ThenBy(c => c.Id)
            .Select(c => new { c.Id, c.EffectiveFrom })
            .ToListAsync(ct);

        if (candidates.Count == 0) return null;

        var inForce = candidates.LastOrDefault(c => c.EffectiveFrom <= programme.StartDate);
        return (inForce ?? candidates[0]).Id;
    }

    public async Task<List<SessionTopicDto>> CurriculumAsync(int programmeId, CancellationToken ct)
    {
        var programme = await ForReadAsync(programmeId, ct);

        var curriculumId = await CurriculumForAsync(programme, ct);
        if (curriculumId is null) return [];

        var sessions = await db.CurriculumSessions.AsNoTracking()
            .Include(s => s.Topics)
            .Where(s => s.CurriculumId == curriculumId && s.Status == RecordStatus.Active)
            /* By day first, because that is the order the app asks in
               and the order the programme runs in. */
            .OrderBy(s => s.Day ?? int.MaxValue).ThenBy(s => s.DisplayOrder).ThenBy(s => s.Id)
            .ToListAsync(ct);

        return
        [
            .. sessions.Select(s => new SessionTopicDto
            {
                SessionId = s.Id,
                SessionName = s.SessionName,
                Day = s.Day,
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

    /// <summary>
    /// The faculty this coordinator may record against: everybody any
    /// coordinator of the same agency has registered.
    ///
    /// De-duplicated by mobile number, which is how the same person
    /// registered on three batches is one person here. The row already
    /// on this programme wins where there is one, so recording a
    /// session against them changes nothing.
    /// </summary>
    public async Task<List<TrainerOptionDto>> TrainerOptionsAsync(
        int programmeId, CancellationToken ct)
    {
        var programme = await ForReadAsync(programmeId, ct);

        var rows = await db.ProgrammeTrainers.AsNoTracking()
            .Where(t => t.Programme!.AgencyId == programme.AgencyId)
            .OrderBy(t => t.FullName)
            .Select(t => new
            {
                t.Id,
                t.FullName,
                t.Mobile,
                t.Qualification,
                OnThisProgramme = t.ProgrammeId == programmeId,
            })
            .ToListAsync(ct);

        return
        [
            .. rows
                .GroupBy(t => t.Mobile)
                .Select(g => g.OrderByDescending(t => t.OnThisProgramme).First())
                .OrderBy(t => t.FullName)
                .Select(t => new TrainerOptionDto
                {
                    Id = t.Id,
                    FullName = t.FullName,
                    Mobile = t.Mobile,
                    Qualification = t.Qualification,
                    OnThisProgramme = t.OnThisProgramme,
                }),
        ];
    }

    public async Task<MonitoringSessionDto> AddSessionAsync(
        int programmeId, MonitoringSessionUpsertDto dto, CancellationToken ct)
    {
        var programme = await ForWriteAsync(programmeId, ct);

        var trainer = await ForThisProgrammeAsync(programme, dto.TrainerId, ct);

        /* The topic has to belong to this programme's own curriculum, or the
           record would claim content the workshop never had on its syllabus. */
        var topic = await db.CurriculumTopics.AsNoTracking()
            .Include(t => t.Session)
            .FirstOrDefaultAsync(t => t.Id == dto.CurriculumTopicId, ct)
            ?? throw AppException.NotFound("Sub-topic");

        if (topic.SessionId != dto.CurriculumSessionId)
            throw new AppException("That sub-topic does not belong to the chosen topic.");

        /* The same curriculum the screen was offered, or a coordinator
           would be refused a topic this very service had just handed
           them. */
        if (topic.Session?.CurriculumId != await CurriculumForAsync(programme, ct))
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

    /// <summary>
    /// Puts everybody enrolled on the batch onto the coordinator's register.
    ///
    /// The register used to hold only the people who walked in on the day,
    /// which meant a batch of forty who had applied online and been given
    /// places showed the coordinator an empty list: no attendance to take,
    /// no photographs to capture, and a report that said nobody came. The
    /// register is the batch.
    ///
    /// So a row is written here for each enrolment that has not got one,
    /// copying the name, number and category off the account rather than
    /// asking anybody to retype them. It is the same row registration at
    /// the door creates, and everything downstream — attendance,
    /// photographs, the report — already hangs off it.
    ///
    /// Done on reading the programme because that is what the app does
    /// first and does often, and it is idempotent: a second pass finds
    /// nothing to add. Nothing is ever removed. Somebody struck off the
    /// enrolment list after the register was taken still attended, and a
    /// day's attendance that quietly loses a row is worse than a row
    /// nobody needed.
    /// </summary>
    private async Task FillRegisterAsync(Programme programme, CancellationToken ct)
    {
        /* Nothing is written into a sealed record. A report handed in and
           waiting on the office does not change under the office. */
        if (await IsSealedAsync(programme.Id, ct)) return;

        var enrolled = await db.ProgrammeParticipants.AsNoTracking()
            .Where(p => p.ProgrammeId == programme.Id)
            .Select(p => new
            {
                p.ApplicantId,
                p.Applicant!.FullName,
                p.Applicant!.Mobile,
                p.Applicant!.Email,
                p.Applicant!.Gender,
                p.Applicant!.SocialCategory,
            })
            .ToListAsync(ct);

        if (enrolled.Count == 0) return;

        var register = await db.OnSpotParticipants.AsNoTracking()
            .Where(x => x.ProgrammeId == programme.Id)
            .Select(x => new { x.ApplicantId, x.Mobile })
            .ToListAsync(ct);

        var held = register.Where(x => x.ApplicantId.HasValue)
            .Select(x => x.ApplicantId!.Value).ToHashSet();
        var numbers = register.Select(x => x.Mobile).ToHashSet();

        var added = false;

        foreach (var person in enrolled)
        {
            if (held.Contains(person.ApplicantId)) continue;

            /* The register holds one row per mobile number, and a row
               typed in by hand at the door may already carry this one.
               Left alone rather than written twice: the person is on the
               register either way, which is what matters here. */
            if (string.IsNullOrWhiteSpace(person.Mobile) || !numbers.Add(person.Mobile)) continue;

            db.OnSpotParticipants.Add(new OnSpotParticipant
            {
                ProgrammeId = programme.Id,
                ApplicantId = person.ApplicantId,
                FullName = person.FullName,
                Mobile = person.Mobile,
                Email = person.Email,
                EnterpriseName = string.Empty,
                UdyamNumber = "NA",
                Gender = person.Gender,
                SocialCategory = person.SocialCategory,
            });

            held.Add(person.ApplicantId);
            added = true;
        }

        if (added) await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// Enrols somebody who has already applied, at the door, on the day
    /// the programme starts.
    ///
    /// The coordinator gives the applicant ID and the e-mail on it, and
    /// both have to agree: the ID alone would let a queue of people be
    /// added by guessing codes, and the e-mail alone is not an identity
    /// here - it is editable profile data and two accounts can carry
    /// the same one.
    ///
    /// Only on the first day. Registration at the door is for the
    /// person standing in it, and a batch that started on Monday
    /// accepting walk-ins on Thursday is a batch whose register says
    /// somebody attended four days they did not.
    ///
    /// Two rows result, and both are wanted. The programme enrolment is
    /// the scheme's record that this person is on this batch - the same
    /// row an applicant who registered online would have. The register
    /// row is the coordinator's, and is what attendance, photographs
    /// and the report are hung off.
    /// </summary>
    public async Task<OnSpotParticipantDto> RegisterApplicantAsync(
        int programmeId, OnSpotApplicantDto dto, CancellationToken ct)
    {
        var programme = await ForWriteAsync(programmeId, ct);

        var today = DateOnly.FromDateTime(IndianTime.From(DateTime.UtcNow));
        if (today != programme.StartDate)
        {
            throw new AppException(
                today < programme.StartDate
                    ? $"This program starts on {programme.StartDate:dd MMM yyyy}. "
                      + "Registration at the door opens on the first day."
                    : "Registration at the door closed after the first day, "
                      + $"{programme.StartDate:dd MMM yyyy}.");
        }

        var code = (dto.ApplicantCode ?? string.Empty).Trim().ToUpperInvariant();
        var email = (dto.Email ?? string.Empty).Trim();

        Guard.Check()
            .Required(code, "Applicant ID")
            .Email(email, required: true)
            .ThrowIfInvalid();

        var applicant = await db.Applicants
            .FirstOrDefaultAsync(a => a.ApplicantCode == code, ct);

        /* One refusal for both halves. Saying which of the two was
           wrong would turn this into a way of finding out whether an
           applicant ID exists. */
        if (applicant is null || !string.Equals(applicant.Email, email, StringComparison.OrdinalIgnoreCase))
            throw new AppException("No applicant matches that ID and e-mail address.");

        var already = await db.OnSpotParticipants
            .Include(x => x.Days)
            .FirstOrDefaultAsync(x => x.ProgrammeId == programmeId && x.ApplicantId == applicant.Id, ct);

        if (already is not null)
            throw AppException.Conflict($"{applicant.FullName} is already on this register.");

        /* The register holds one row per mobile number per programme, and
           the rows typed in by hand before this screen existed may already
           hold this one. Caught here so it reads as a refusal rather than
           arriving as a database error. */
        var sameNumber = await db.OnSpotParticipants.AnyAsync(
            x => x.ProgrammeId == programmeId && x.Mobile == applicant.Mobile, ct);

        if (sameNumber)
        {
            throw AppException.Conflict(
                "Somebody is already registered on this program with the mobile number "
                + "on this application. Ask the office to check the register.");
        }

        /* The scheme's own record that this person is on this batch,
           where there is not one already - somebody who registered
           online and then turned up is enrolled twice otherwise. */
        var enrolled = await db.ProgrammeParticipants
            .AnyAsync(x => x.ProgrammeId == programmeId && x.ApplicantId == applicant.Id, ct);

        if (!enrolled)
        {
            db.ProgrammeParticipants.Add(new ProgrammeParticipant
            {
                ProgrammeId = programmeId,
                ApplicantId = applicant.Id,
                EnrolledOn = today,
            });
        }

        var person = new OnSpotParticipant
        {
            ProgrammeId = programmeId,
            ApplicantId = applicant.Id,
            FullName = applicant.FullName,
            Mobile = applicant.Mobile,
            Email = applicant.Email,
            /* Not asked for at the door any more. The scheme holds what
               it holds about this person, and a coordinator guessing at
               an enterprise name in a corridor is worse than a blank. */
            EnterpriseName = string.Empty,
            UdyamNumber = "NA",
            Gender = applicant.Gender,
            SocialCategory = applicant.SocialCategory,
        };

        db.OnSpotParticipants.Add(person);
        await db.SaveChangesAsync(ct);

        return ToDto(person, []);
    }

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

        /*
         * A register is taken in the room, on the day.
         *
         * Not before: a day marked in advance is a guess about who will
         * turn up. Not after: a day marked from the office on Friday is
         * somebody remembering Tuesday. Both produce a document that
         * says it is evidence of attendance and is not, which is the
         * one thing this record exists to be.
         *
         * Today is India's today. The server runs on UTC and a workshop
         * in Delhi finishing at half past five in the evening is already
         * tomorrow by the clock the machine keeps.
         */
        var today = DateOnly.FromDateTime(IndianTime.From(DateTime.UtcNow));
        var wrongDay = marks.Select(m => m.Day).Distinct().Where(d => d != today).ToList();
        if (wrongDay.Count > 0)
        {
            throw new AppException(
                wrongDay.Any(d => d > today)
                    ? "Attendance cannot be marked before the day it is for."
                    : "Attendance for "
                      + string.Join(", ", wrongDay.Select(d => d.ToString("dd MMM yyyy")))
                      + " can no longer be marked. A register is taken on the day.");
        }

        var wanted = marks.Select(m => m.ParticipantId).Distinct().ToList();
        var people = await db.OnSpotParticipants
            .Include(x => x.Days)
            .Where(x => x.ProgrammeId == programmeId && wanted.Contains(x.Id))
            .ToListAsync(ct);

        if (people.Count != wanted.Count)
            throw new AppException("Some of those participants are not registered on this workshop.");

        /*
         * Once each, and not again.
         *
         * A mark that can be reopened is a mark that can be corrected
         * after somebody has asked a question about it. The coordinator
         * ticks who is absent and saves, and that is that person's
         * answer for the day; a genuine mistake is the office's to fix,
         * where it leaves a trail.
         *
         * Per person rather than per day, because the register grows:
         * somebody enrolled at eleven, or who walked in at the door
         * after the ten o'clock register was taken, is on the list the
         * app sends next time. Refusing the whole call because most of
         * that list is already marked would leave the newcomer unmarked
         * for ever - and the batch unable to be submitted, because it
         * cannot be closed with anybody unmarked.
         */
        var taken = people
            .Where(x => x.Days.Any(d => d.Day == today))
            .Select(x => x.Id)
            .ToHashSet();

        if (taken.Count == people.Count)
        {
            throw AppException.Conflict(
                "Attendance for today has already been submitted and cannot be changed.");
        }

        var now = DateTime.UtcNow;
        var who = currentUser.DisplayName;

        /* Only the people who have not been marked today. Everybody else
           was dealt with above, and their mark stands. */
        var written = marks.Where(m => !taken.Contains(m.ParticipantId)).ToList();

        foreach (var mark in written)
        {
            var person = people.First(x => x.Id == mark.ParticipantId);

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
        return written.Count;
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
            AttendanceDay = capture.AttendanceDay,
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

            case MonitoringPhotoKind.TrainerPhoto:
            case MonitoringPhotoKind.TrainerIdProof:
            {
                var trainer = await db.ProgrammeTrainers
                    .FirstOrDefaultAsync(t => t.Id == ownerId && t.ProgrammeId == programmeId, ct)
                    ?? throw AppException.NotFound("Trainer");
                photo.TrainerId = trainer.Id;

                /* One of each per trainer: a retake replaces rather than
                   stacks, so the register shows one face and one
                   document. */
                var previous = await db.MonitoringPhotos
                    .Where(x => x.TrainerId == trainer.Id && x.Kind == kind)
                    .ToListAsync(ct);
                db.MonitoringPhotos.RemoveRange(previous);
                break;
            }

            case MonitoringPhotoKind.AttendanceSheet:
            {
                /* The same rule as the register it photographs: taken
                   in the room on the day, and taken once. A sheet
                   photographed on Friday for Tuesday is somebody
                   tidying up afterwards, which is the one thing this
                   document must not be. */
                var today = DateOnly.FromDateTime(IndianTime.From(DateTime.UtcNow));
                var day = capture.AttendanceDay ?? today;

                if (day != today)
                {
                    throw new AppException(
                        day > today
                            ? "A register cannot be photographed before the day it is for."
                            : $"The sheet for {day:dd MMM yyyy} can no longer be added. "
                              + "It is photographed on the day.");
                }

                var alreadyHeld = await db.MonitoringPhotos
                    .AnyAsync(
                        x => x.ProgrammeId == programmeId
                             && x.Kind == MonitoringPhotoKind.AttendanceSheet
                             && x.AttendanceDay == day,
                        ct);

                if (alreadyHeld)
                {
                    throw AppException.Conflict(
                        "Today's signed sheet has already been submitted and cannot be changed.");
                }

                photo.AttendanceDay = day;
                break;
            }

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

        /* One row per programme, reused when a report comes back.
 
           A rejected submission reopens the record so the coordinator
           can correct it, and what they then hand in is the same
           submission put right rather than a second one - the table
           holds one per programme and the index says so. Resubmitting
           clears the decision with it, because the report the manager
           turned down is not the report being handed in now. */
        var submission = await db.ProgrammeSubmissions
            .FirstOrDefaultAsync(x => x.ProgrammeId == programmeId, ct);

        var resubmitted = submission is not null;
        submission ??= new ProgrammeSubmission { ProgrammeId = programmeId };

        submission.SubmittedByUserId = currentUser.UserId!.Value;
        submission.SubmittedOn = DateTime.UtcNow;
        submission.TrainerCount = trainers.Count;
        submission.SessionCount = sessions.Count;
        submission.ParticipantCount = participants.Count;
        submission.PresentCount = participants.Count(p => p.IsPresent == true);
        submission.PhotoCount = allPhotos.Count;
        submission.Remarks = dto.Remarks?.Trim();

        /* To the agency first. The manager sees it when the agency
           forwards it. */
        submission.QcStatus = QcStatus.AwaitingAgency;
        submission.QcByUserId = null;
        submission.QcByUserName = null;
        submission.QcOn = null;
        submission.QcRemarks = null;
        submission.ForwardedByUserId = null;
        submission.ForwardedByUserName = null;
        submission.ForwardedOn = null;
        submission.ForwardRemarks = null;

        if (!resubmitted) db.ProgrammeSubmissions.Add(submission);

        /* Registration closes, because the day has been and gone. The
           batch is not marked conducted here: that is the manager's to
           say once the report has been forwarded and accepted, and a
           programme that reads as conducted while its report is still
           being argued over says the wrong thing on every screen. A
           batch sent back is no longer conducted either. */
        var programme = await db.Programmes.FirstOrDefaultAsync(p => p.Id == programmeId, ct);
        if (programme is not null)
        {
            programme.RegistrationsOpen = false;
            if (programme.Status == ProgramStatus.QCRejected)
                programme.Status = ProgramStatus.CalendarCreated;
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

        /* Conducted, so anybody already marked has earned whatever the
           programme type awards. This is where a batch is actually closed
           — the portal's own status change is the rarer path — so it is
           where the certificates fall due and go out.

           Guarded: the submission is the coordinator's and is saved. A
           certificate run that cannot finish must not report their work
           as failed, and the Certificates tab issues what is left. */
        try
        {
            await certificates.IssueDueAsync(programmeId, ct);
        }
        catch (Exception caught)
        {
            logger.LogError(
                caught,
                "Program {Programme} was submitted but its certificates could not be issued.",
                programmeId);
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

    private static CoordinatorProgrammeDto Summarise(Programme p, DateTime? submittedOn) =>
        Fill(new CoordinatorProgrammeDto(), p, submittedOn);

    /// <summary>
    /// Everything the summary says about a programme, written onto
    /// whichever shape is being built.
    ///
    /// The detail used to copy these across field by field, which meant
    /// every addition to the summary had to be remembered in a second
    /// place - and the first two that were not, the mode and the
    /// district, reached the venue screen as "Not recorded" while the
    /// list beside it showed them correctly. One filler, so there is
    /// nowhere left to forget.
    /// </summary>
    private static T Fill<T>(T dto, Programme p, DateTime? submittedOn)
        where T : CoordinatorProgrammeDto
    {
        dto.Id = p.Id;
        dto.ProgrammeId = p.ProgrammeId;
        dto.ProgrammeName = p.ProgrammeName;
        dto.ProgramTypeName = p.ProgramType?.Name;
        dto.ParticipantPhotoRequired = p.ProgramType?.ParticipantPhotoRequired ?? false;
        dto.OnSpotRegistrationAllowed = p.ProgramType?.OnSpotRegistrationAllowed ?? true;
        dto.Venue = p.Venue;
        dto.City = p.City;
        dto.State = p.State?.Name;
        dto.District = p.District?.Name;
        dto.Pincode = p.Pincode;
        dto.StartDate = p.StartDate;
        dto.EndDate = p.EndDate;
        dto.Status = p.Status.ToString();
        dto.IsSubmitted = submittedOn is not null;
        dto.SubmittedOn = submittedOn;
        dto.Mode = p.Mode.ToString();
        dto.MeetingPlatform = p.MeetingPlatform;
        dto.MeetingLink = p.MeetingLink;
        dto.DailyStartTime = p.StartTime;
        dto.DailyEndTime = p.EndTime;
        return dto;
    }

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
        ExperienceMonths = t.ExperienceMonths,
        Qualification = t.Qualification,
        QualificationDetails = t.QualificationDetails,
        /* The last four and no more. Aadhaar is deliberately absent from
           what goes back: the app sends it once and never needs it
           again, and a faculty list that returns everybody's is a list
           that leaks it to every caller. */
        Aadhaar = null,
        AadhaarLast4 = t.Aadhaar is { Length: >= 4 } whole ? whole[^4..] : null,
        Answers =
        [
            .. t.Answers
                .OrderBy(a => a.Id)
                .Select(a => new TrainerAnswerDto
                {
                    Key = a.Key,
                    Label = a.Label,
                    Value = a.Value,
                }),
        ],
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

    /// <summary>
    /// A trainer with their two photographs attached.
    ///
    /// The overload exists because only the detail call has the
    /// programme's photographs in hand; the register that comes back
    /// from adding one has no photographs yet by definition.
    /// </summary>
    private static TrainerDto ToDto(ProgrammeTrainer t, List<MonitoringPhoto> photos)
    {
        var dto = ToDto(t);
        dto.Photo = photos
            .Where(p => p.TrainerId == t.Id && p.Kind == MonitoringPhotoKind.TrainerPhoto)
            .Select(ToDto)
            .FirstOrDefault();
        dto.IdProof = photos
            .Where(p => p.TrainerId == t.Id && p.Kind == MonitoringPhotoKind.TrainerIdProof)
            .Select(ToDto)
            .FirstOrDefault();
        return dto;
    }

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
        ApplicantCode = x.Applicant?.ApplicantCode,
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
        AttendanceDay = p.AttendanceDay,
        SyncedOn = p.SyncedOn == default ? null : p.SyncedOn,
        DevicePlatform = p.DevicePlatform,
        DeviceModel = p.DeviceModel,
        Stamped = p.Stamped,
        Url = $"coordinator/photos/{p.Id}",
    };
}
