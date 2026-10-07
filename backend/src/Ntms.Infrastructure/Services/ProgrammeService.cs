using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

public class ProgrammeService(
    NtmsDbContext db,
    ICodeGenerator codes,
    ICurrentUser currentUser,
    DelegationGuard delegation,
    INotificationService notifications,
    NotificationBroadcastService broadcasts)
{
    /* Scoped at the source, so no read path can forget it. */
    private IQueryable<Programme> Base => db.Programmes.AsNoTracking()
        /* Through to the programme type: the curriculum's code lives there now. */
        .Include(p => p.Curriculum)!.ThenInclude(c => c!.ProgramType)
        .Include(p => p.Category)
        .Include(p => p.SubCategory)
        .Include(p => p.ProgramType)
        .Include(p => p.Agency)
        .Include(p => p.Coordinator)
        .Include(p => p.OperationManager)
        .Include(p => p.ExamPaper)
        .Include(p => p.State)
        .Include(p => p.Sessions)
        .Include(p => p.Participants).ThenInclude(x => x.Applicant)
        .Include(p => p.Participants).ThenInclude(x => x.Application)
        .WithinScope(currentUser);

    public async Task<PagedResult<ProgrammeDto>> ListAsync(
        PagedRequest request, string? state, DateOnly? startDate, DateOnly? endDate,
        string? mode, int? agencyId, string? status, CancellationToken ct)
    {
        var programMode = EnumMaps.ParseEnumOrNull<ProgramMode>(mode);
        var programStatus = EnumMaps.ParseEnumOrNull<ProgramStatus>(status);

        var query = Base
            .WhereIf(!string.IsNullOrWhiteSpace(state), p => p.State!.Name == state!.ToUpperInvariant())
            .WhereIf(startDate.HasValue, p => p.StartDate >= startDate)
            .WhereIf(endDate.HasValue, p => p.EndDate <= endDate)
            .WhereIf(programMode.HasValue, p => p.Mode == programMode)
            .WhereIf(agencyId.HasValue, p => p.AgencyId == agencyId)
            .WhereIf(programStatus.HasValue, p => p.Status == programStatus)
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                p => p.ProgrammeId.Contains(request.Search!)
                     || p.ProgrammeName.Contains(request.Search!)
                     || p.Agency!.Name.Contains(request.Search!))
            .ApplySort(request, db.Model.FindEntityType(typeof(Programme))!, p => p.StartDate);

        return await query.ToPagedResultAsync(request, p => p.ToDto(), ct);
    }

    public async Task<List<ProgrammeDto>> AllAsync(string? status, CancellationToken ct)
    {
        var programStatus = EnumMaps.ParseEnumOrNull<ProgramStatus>(status);
        var rows = await Base
            .WhereIf(programStatus.HasValue, p => p.Status == programStatus)
            .OrderByDescending(p => p.StartDate).ToListAsync(ct);
        return [.. rows.Select(p => p.ToDto())];
    }

    public async Task<ProgrammeDto> GetAsync(int id, CancellationToken ct) =>
        (await Base.FirstOrDefaultAsync(p => p.Id == id, ct)
         ?? throw AppException.NotFound("Program")).ToDto();

    public async Task<ProgrammeDto> CreateAsync(ProgrammeUpsertDto dto, CancellationToken ct)
    {
        var programType = await db.ProgramTypes.FirstOrDefaultAsync(p => p.Id == dto.ProgramTypeId, ct)
                          ?? throw AppException.NotFound("Program type");

        var coordinator = await db.Users.FirstOrDefaultAsync(u => u.Id == dto.CoordinatorId, ct)
                          ?? throw AppException.NotFound("Coordinator");

        /* An agency login creates for its own agency and no other. Taking the
           id from the request would let one agency file a batch against
           another, which the empanelment check below would not catch because
           it validates the agency that was named, not the one asking. */
        var agencyId = currentUser.Tier == BaseRole.AgencyAdmin && currentUser.AgencyId is { } own
            ? own
            : dto.AgencyId;

        var agency = await db.Agencies.Include(a => a.ProgramTypes).Include(a => a.States)
                         .FirstOrDefaultAsync(a => a.Id == agencyId, ct)
                     ?? throw AppException.NotFound("Implementing agency");

        /* An agency may only run the tracks it is empanelled for. */
        if (agency.ProgramTypes.Count > 0 &&
            agency.ProgramTypes.All(pt => pt.ProgramTypeId != dto.ProgramTypeId))
        {
            throw new AppException($"{agency.Name} is not empanelled for this program type.");
        }

        await EnsureMayRunThereAsync(agency, dto.StateCode, ct);

        Validate(dto, DateOnly.FromDateTime(DateTime.UtcNow.Date));

        /* The floor belongs to the program type and the ceiling to the
           agency, so a batch cannot be raised for fewer than the type is
           worth running for. */
        if (programType.MinParticipants > 0 && dto.MaxParticipants < programType.MinParticipants)
        {
            throw new AppException(
                $"{programType.Name} runs for at least {programType.MinParticipants} "
                + $"candidates, so a batch cannot be opened for {dto.MaxParticipants}.");
        }

        var mode = EnumMaps.ParseEnum(dto.Mode, ProgramMode.Physical);
        var entity = new Programme
        {
            ProgrammeId = await codes.NextProgrammeIdAsync(ct),
            ProgrammeName = string.IsNullOrWhiteSpace(dto.ProgrammeName)
                ? $"{programType.DurationDays}-Day {programType.Name} Training Program"
                : dto.ProgrammeName.Trim(),
            CurriculumId = dto.CurriculumId,
            CategoryId = programType.CategoryId,
            SubCategoryId = programType.SubCategoryId,
            ProgramTypeId = programType.Id,
            AgencyId = agency.Id,
            CoordinatorId = coordinator.Id,
            OperationManagerId = dto.OperationManagerId ?? coordinator.ReportsToUserId,
            Mode = mode,
            /* A hybrid batch has a room and a link, so it keeps both. Only
               a purely virtual one has no venue to record, and only a
               purely physical one has nothing to join. */
            Venue = mode == ProgramMode.Virtual ? "Virtual" : (dto.Venue ?? string.Empty).Trim(),
            City = mode == ProgramMode.Virtual ? null : dto.City,
            Pincode = mode == ProgramMode.Virtual ? null : dto.Pincode?.Trim(),
            StateCode = dto.StateCode,
            DistrictCode = dto.DistrictCode,
            MeetingPlatform = mode == ProgramMode.Physical ? null : dto.MeetingPlatform,
            MeetingLink = mode == ProgramMode.Physical ? null : dto.MeetingLink,
            StartDate = dto.StartDate,
            EndDate = dto.EndDate,
            StartTime = ParseTime(dto.StartTime, new TimeOnly(10, 0)),
            EndTime = ParseTime(dto.EndTime, new TimeOnly(17, 0)),
            MaxParticipants = dto.MaxParticipants,
            ParticipantCount = 0,
            RegistrationsOpen = false,
            Status = ProgramStatus.New,
            Comments = dto.Comments,
        };

        db.Programmes.Add(entity);
        await db.SaveChangesAsync(ct);

        /* The batch is on the manager's register the moment it is raised,
           and they are told so rather than having to notice. Nothing else
           moves until they permit it. */
        entity.Agency = agency;
        await TellTheManagerAsync(entity, async (manager, agencyName) =>
            await notifications.SendProgrammeRaisedAsync(
                entity, agencyName, manager.Email, manager.FullName, ct));
        return await GetAsync(entity.Id, ct);
    }

    public async Task<ProgrammeDto> UpdateAsync(int id, ProgrammeUpsertDto dto, CancellationToken ct)
    {
        var entity = await db.Programmes.FirstOrDefaultAsync(p => p.Id == id, ct)
                     ?? throw AppException.NotFound("Program");

        if (entity.Status is ProgramStatus.Conducted or ProgramStatus.PermissionRejected)
            throw new AppException($"A {entity.Status} program can no longer be edited.");

        Validate(dto, dto.StartDate == entity.StartDate
            ? null
            : DateOnly.FromDateTime(DateTime.UtcNow.Date));

        /* The same boundary on the way in as on the way out. Editing a batch
           into a state the caller does not hold is the same hole as creating
           one there. */
        if (dto.StateCode != entity.StateCode)
        {
            var agency = await db.Agencies.Include(a => a.States)
                             .FirstOrDefaultAsync(a => a.Id == entity.AgencyId, ct)
                         ?? throw AppException.NotFound("Implementing agency");

            await EnsureMayRunThereAsync(agency, dto.StateCode, ct);
        }

        var mode = EnumMaps.ParseEnum(dto.Mode, entity.Mode);

        entity.CurriculumId = dto.CurriculumId ?? entity.CurriculumId;
        entity.CoordinatorId = dto.CoordinatorId;
        entity.OperationManagerId = dto.OperationManagerId ?? entity.OperationManagerId;
        entity.Mode = mode;
        entity.Venue = mode == ProgramMode.Virtual ? "Virtual" : (dto.Venue ?? entity.Venue).Trim();
        entity.City = mode == ProgramMode.Virtual ? null : dto.City;
        entity.Pincode = mode == ProgramMode.Virtual ? null : dto.Pincode?.Trim();
        entity.StateCode = dto.StateCode;
        entity.DistrictCode = dto.DistrictCode;
        entity.MeetingPlatform = mode == ProgramMode.Physical ? null : dto.MeetingPlatform;
        entity.MeetingLink = mode == ProgramMode.Physical ? null : dto.MeetingLink;
        entity.StartDate = dto.StartDate;
        entity.EndDate = dto.EndDate;
        entity.StartTime = ParseTime(dto.StartTime, entity.StartTime);
        entity.EndTime = ParseTime(dto.EndTime, entity.EndTime);
        entity.MaxParticipants = dto.MaxParticipants;
        entity.Comments = dto.Comments ?? entity.Comments;

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Moves the batch along the register's workflow. Only the transitions the
    /// live process allows are accepted.
    /// </summary>
    public async Task<ProgrammeDto> ChangeStatusAsync(int id, ProgrammeStatusDto dto, CancellationToken ct)
    {
        var entity = await db.Programmes.FirstOrDefaultAsync(p => p.Id == id, ct)
                     ?? throw AppException.NotFound("Program");

        var target = EnumMaps.ParseEnum(dto.Status, entity.Status);
        var allowed = entity.Status switch
        {
            ProgramStatus.New =>
                new[] { ProgramStatus.PermissionAccepted, ProgramStatus.PermissionRejected, ProgramStatus.Postponed },
            ProgramStatus.PermissionAccepted =>
                [ProgramStatus.CalendarCreated, ProgramStatus.Postponed, ProgramStatus.QCRejected],
            ProgramStatus.CalendarCreated =>
                [ProgramStatus.Conducted, ProgramStatus.Postponed, ProgramStatus.QCRejected],
            ProgramStatus.Postponed =>
                [ProgramStatus.PermissionAccepted, ProgramStatus.CalendarCreated],
            _ => [],
        };

        if (!allowed.Contains(target))
            throw new AppException($"A {entity.Status} program cannot move to {target}.");

        /* Permission to run a batch is granted by the tier above the agency, not
           by the agency that proposed it. Without this an agency login — which
           holds programs.manage so it can create — could accept its own
           programme and open registrations on it. */
        if (target is ProgramStatus.PermissionAccepted or ProgramStatus.PermissionRejected
            && currentUser.Tier == BaseRole.AgencyAdmin)
        {
            throw AppException.Forbidden(
                "An implementing agency cannot approve its own program. "
                + "The operation manager accepts or rejects it.");
        }

        entity.Status = target;
        entity.Comments = dto.Comments ?? entity.Comments;
        if (target == ProgramStatus.PermissionAccepted) entity.RegistrationsOpen = true;
        if (target is ProgramStatus.Postponed or ProgramStatus.QCRejected) entity.RegistrationsOpen = false;

        /* Granted, so the request is answered and stops asking. */
        if (target == ProgramStatus.Postponed)
        {
            entity.PostponementRequestedOn = null;
            entity.PostponementRequestedByUserId = null;
        }
        CloseIfFull(entity);

        await db.SaveChangesAsync(ct);

        /* Permitted means open, and a batch nobody is told about fills up
           with whoever happened to look. Narrowed to the track it belongs
           to and the state it runs in, because that is who can sit it. */
        if (target == ProgramStatus.PermissionAccepted && entity.RegistrationsOpen)
        {
            await broadcasts.RaiseAsync(
                "ProgrammeOpened",
                "A new programme is open",
                $"{entity.ProgrammeName} starts on "
                + $"{entity.StartDate:dd MMM yyyy}. Registration is open now.",
                NotificationAudience.Applicants,
                subCategoryId: entity.SubCategoryId,
                stateCode: entity.StateCode,
                linkPath: "/programs",
                ct: ct);
        }
        return await GetAsync(id, ct);
    }

    /// <summary>
    /// The agency asks for a batch to be put off, and says why.
    ///
    /// The batch does not move. The agency running it knows the hall has
    /// flooded; the Operation Manager that permitted it decides whether it
    /// is put off. So the reason is recorded against the batch, the manager
    /// is told, and the request sits on the row until it is granted or the
    /// batch runs anyway.
    /// </summary>
    public async Task<ProgrammeDto> RequestPostponementAsync(
        int id, PostponementRequestDto dto, CancellationToken ct)
    {
        var entity = await db.Programmes
                         .Include(p => p.Agency)
                         .FirstOrDefaultAsync(p => p.Id == id, ct)
                     ?? throw AppException.NotFound("Program");

        if (entity.Status is ProgramStatus.Conducted or ProgramStatus.Postponed
            or ProgramStatus.PermissionRejected or ProgramStatus.QCRejected)
        {
            throw new AppException(
                $"A {EnumMaps.ToApi(entity.Status)} batch is not waiting to be put off.");
        }

        var reason = dto.Reason?.Trim();
        if (string.IsNullOrWhiteSpace(reason))
            throw new AppException("Say why the batch should be put off.");

        entity.PostponementReason = reason;
        entity.PostponementRequestedOn = DateTime.UtcNow;
        entity.PostponementRequestedByUserId = currentUser.UserId;
        await db.SaveChangesAsync(ct);

        await TellTheManagerAsync(entity, async (manager, agencyName) =>
            await notifications.SendPostponementRequestedAsync(
                entity, agencyName, reason, manager.Email, manager.FullName, ct));

        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Finds the Operation Manager answerable for a batch and tells them.
    ///
    /// The manager on the batch where one is recorded, and otherwise the one
    /// that empanelled the agency — which is the same person in all but the
    /// batches raised before agencies had an owner. Silence where there is
    /// nobody to tell: a batch with no manager behind it is a gap in the
    /// chain, not a reason to fail the thing the agency just did.
    /// </summary>
    private async Task TellTheManagerAsync(
        Programme programme, Func<PortalUser, string, Task> tell)
    {
        /* Both are asked for, and both are checked. OperationManagerId is
           filled from the coordinator's reporting line where the raiser did
           not name one, and a coordinator reports to the agency that
           appointed it — so taking it on trust sent the agency a message
           about its own batch. Whoever is found has to actually be an
           Operation Manager. */
        var candidates = new[] { programme.OperationManagerId, programme.Agency?.OwnerUserId }
            .OfType<int>()
            .Distinct()
            .ToList();
        if (candidates.Count == 0) return;

        var manager = await db.Users.AsNoTracking()
            .Where(u => candidates.Contains(u.Id)
                        && u.BaseRole == BaseRole.OperationManager
                        && u.Status == RecordStatus.Active)
            .FirstOrDefaultAsync();

        if (manager is null || string.IsNullOrWhiteSpace(manager.Email)) return;

        await tell(manager, programme.Agency?.Name ?? "An implementing agency");
    }

    /// <summary>
    /// Opens a batch for registration again, for a stated number of places.
    ///
    /// Closing by hand is gone. A batch closes itself the moment it fills,
    /// which is what the cap is for, and a button that did the same thing
    /// only invited somebody to close one early by accident.
    ///
    /// Reopening stops the day before the batch starts. Somebody enrolling
    /// the night before has no time to be told where to turn up, and the
    /// register behind the batch — the trainers, the papers, the venue — is
    /// settled by then. The cap is given again rather than carried over,
    /// because reopening is a decision about how many more may come and the
    /// old number was the answer to a question already asked.
    /// </summary>
    public async Task<ProgrammeDto> ReopenRegistrationsAsync(
        int id, ReopenRegistrationsDto dto, CancellationToken ct)
    {
        var entity = await db.Programmes.FirstOrDefaultAsync(p => p.Id == id, ct)
                     ?? throw AppException.NotFound("Program");

        if (entity.Status is ProgramStatus.Conducted or ProgramStatus.PermissionRejected
            or ProgramStatus.QCRejected or ProgramStatus.Postponed)
        {
            throw new AppException(
                $"A {EnumMaps.ToApi(entity.Status)} batch does not take registrations.");
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var closesOn = entity.StartDate.AddDays(-1);
        if (today >= closesOn)
        {
            throw new AppException(
                "Registration closes the day before the batch starts. "
                + $"{entity.ProgrammeId} starts on {entity.StartDate:dd MMM yyyy}.");
        }

        if (dto.MaxParticipants <= 0)
            throw new AppException("Say how many places the batch is opening for.");

        if (dto.MaxParticipants < entity.ParticipantCount)
        {
            throw new AppException(
                $"{entity.ParticipantCount} are already enrolled, so the batch cannot "
                + $"be opened for {dto.MaxParticipants}.");
        }

        entity.MaxParticipants = dto.MaxParticipants;
        entity.RegistrationsOpen = true;

        /* Unless it is already full at the new number, in which case it was
           never reopened at all. */
        CloseIfFull(entity);

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<ProgrammeDto> SetExamTimeAsync(int id, SetExamTimeDto dto, CancellationToken ct)
    {
        var entity = await db.Programmes.FirstOrDefaultAsync(p => p.Id == id, ct)
                     ?? throw AppException.NotFound("Program");

        if (dto.ExamDateTime.Date < entity.StartDate.ToDateTime(TimeOnly.MinValue).Date)
            throw new AppException("The exam cannot be scheduled before the batch starts.");

        if (dto.ExamPaperId is { } paperId)
        {
            /* The paper has to belong to this batch's programme type, or the
               candidates would sit somebody else's examination. */
            var belongs = await db.ExamPapers.AsNoTracking()
                .AnyAsync(e => e.Id == paperId && e.ProgramTypeId == entity.ProgramTypeId, ct);
            if (!belongs)
                throw new AppException("That paper belongs to a different program type.");
        }

        entity.ExamPaperId = dto.ExamPaperId;
        entity.ExamDateTime = dto.ExamDateTime;
        entity.RegistrationsOpen = false;
        if (entity.Status == ProgramStatus.PermissionAccepted)
            entity.Status = ProgramStatus.CalendarCreated;

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<ProgrammeDto> AddSessionAsync(
        int id, ProgrammeSessionDto dto, CancellationToken ct)
    {
        var entity = await db.Programmes.Include(p => p.Sessions)
                         .FirstOrDefaultAsync(p => p.Id == id, ct)
                     ?? throw AppException.NotFound("Program");

        if (string.IsNullOrWhiteSpace(dto.Title))
            throw new AppException("A session needs a title.");

        entity.Sessions.Add(new ProgrammeSession
        {
            SessionCode = dto.SessionCode,
            Title = dto.Title.Trim(),
            SessionDate = dto.SessionDate == default ? entity.StartDate : dto.SessionDate,
            StartTime = ParseTime(dto.StartTime, new TimeOnly(10, 0)),
            EndTime = ParseTime(dto.EndTime, new TimeOnly(17, 0)),
            FacultyName = dto.FacultyName,
        });

        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Records who attended a session and recomputes every participant's
    /// attendance percentage from the sessions held so far.
    /// </summary>
    public async Task<ProgrammeDto> MarkAttendanceAsync(
        int id, int sessionId, MarkAttendanceDto dto, CancellationToken ct)
    {
        var entity = await db.Programmes
            .Include(p => p.Sessions).ThenInclude(s => s.Attendance)
            .Include(p => p.Participants)
            .FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw AppException.NotFound("Program");

        var session = entity.Sessions.FirstOrDefault(s => s.Id == sessionId)
                      ?? throw AppException.NotFound("Session");

        if (session.IsAttendanceLocked)
            throw new AppException("Attendance for this session has already been locked.");

        var validIds = entity.Participants.Select(p => p.Id).ToHashSet();
        db.AttendanceRecords.RemoveRange(session.Attendance);
        session.Attendance.Clear();

        foreach (var mark in dto.Marks.Where(m => validIds.Contains(m.ParticipantId)))
        {
            session.Attendance.Add(new AttendanceRecord
            {
                ParticipantId = mark.ParticipantId,
                Present = mark.Present,
            });
        }

        session.PresentCount = dto.Marks.Count(m => m.Present && validIds.Contains(m.ParticipantId));
        session.IsAttendanceLocked = true;

        await db.SaveChangesAsync(ct);
        await RecomputeAttendanceAsync(id, ct);
        return await GetAsync(id, ct);
    }

    /// <summary>Enrols approved applicants into the batch.</summary>
    public async Task<ProgrammeDto> EnrolAsync(int id, EnrolDto dto, CancellationToken ct)
    {
        var entity = await db.Programmes.Include(p => p.Participants)
                         .FirstOrDefaultAsync(p => p.Id == id, ct)
                     ?? throw AppException.NotFound("Program");

        if (!entity.RegistrationsOpen)
            throw new AppException("Registrations for this batch are closed.");

        var applications = await db.Applications
            .Where(a => dto.ApplicationIds.Contains(a.Id))
            .ToListAsync(ct);

        foreach (var application in applications)
        {
            if (application.Status != ApplicationStatus.Approved)
                throw new AppException($"{application.ApplicationNo} is not approved yet.");
            if (application.ProgramTypeId != entity.ProgramTypeId)
                throw new AppException($"{application.ApplicationNo} is for a different program type.");
            if (entity.Participants.Any(p => p.ApplicantId == application.ApplicantId))
                continue;

            if (entity.Participants.Count >= entity.MaxParticipants)
                throw new AppException("The batch is full.");

            entity.Participants.Add(new ProgrammeParticipant
            {
                ApplicantId = application.ApplicantId,
                ApplicationId = application.Id,
                EnrolledOn = DateOnly.FromDateTime(DateTime.UtcNow),
                Result = ParticipantResult.Pending,
            });
            application.Status = ApplicationStatus.Enrolled;
        }

        entity.ParticipantCount = entity.Participants.Count;
        CloseIfFull(entity);
        await db.SaveChangesAsync(ct);

        /* Tell the people who were just enrolled where and when to turn up. */
        var enrolledIds = entity.Participants.Select(p => p.ApplicantId).ToList();
        var applicants = await db.Applicants
            .Where(a => enrolledIds.Contains(a.Id))
            .ToListAsync(ct);
        foreach (var applicant in applicants)
        {
            await notifications.SendProgrammeScheduleAsync(
                entity, applicant.Email, applicant.FullName, ct);
        }

        return await GetAsync(id, ct);
    }

    /// <summary>
    /// Shuts registration once the batch is full.
    ///
    /// In one place so every route in — enrolment from the portal, an applicant
    /// registering from the phone, a cap lowered on an edit — closes the same
    /// way. Reopening is deliberate: raising the cap does not reopen a batch by
    /// itself, because whoever raised it may have meant to add one named person
    /// rather than invite the public back in.
    /// </summary>
    private static void CloseIfFull(Programme programme)
    {
        if (programme.MaxParticipants > 0 && programme.ParticipantCount >= programme.MaxParticipants)
        {
            programme.RegistrationsOpen = false;
        }
    }

    private async Task RecomputeAttendanceAsync(int programmeId, CancellationToken ct)
    {
        var programme = await db.Programmes
            .Include(p => p.Sessions).ThenInclude(s => s.Attendance)
            .Include(p => p.Participants)
            .FirstAsync(p => p.Id == programmeId, ct);

        var held = programme.Sessions.Count(s => s.IsAttendanceLocked);
        if (held == 0) return;

        foreach (var participant in programme.Participants)
        {
            var present = programme.Sessions
                .Where(s => s.IsAttendanceLocked)
                .SelectMany(s => s.Attendance)
                .Count(a => a.ParticipantId == participant.Id && a.Present);

            participant.AttendancePercent = Math.Round(present * 100m / held, 2);
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// A batch may only be raised where both the agency and the caller may
    /// work.
    ///
    /// Allocation bounded what could be read and nothing at all about what
    /// could be written, so somebody allocated Delhi could raise a batch in
    /// Haryana — and then not see it, because the same allocation filtered it
    /// straight back out. A record its own author cannot find is worse than a
    /// refusal.
    /// </summary>
    private async Task EnsureMayRunThereAsync(
        ImplementingAgency agency, int stateCode, CancellationToken ct)
    {
        /* Where the agency's empanelment names states at all. The ones
           empanelled before states were recorded name none, and refusing
           those would shut every batch they have. */
        if (agency.States.Count > 0 && agency.States.All(s => s.StateCode != stateCode))
        {
            var where = await db.States.AsNoTracking()
                .Where(x => x.Code == stateCode).Select(x => x.Name).FirstOrDefaultAsync(ct);
            throw new AppException(
                $"{agency.Name} is not empanelled in {where ?? "that state"}.");
        }

        /* And the caller's own reach. Whole master for an unscoped caller,
           their allocation for everybody else — and empty for a scoped
           account allocated nothing, which refuses, as it should. */
        var permitted = await delegation.PermittedAsync(ScopeAxis.State, ct);
        if (!permitted.Contains(stateCode))
        {
            var where = await db.States.AsNoTracking()
                .Where(x => x.Code == stateCode).Select(x => x.Name).FirstOrDefaultAsync(ct);
            throw AppException.Forbidden(
                $"You are not allocated to work in {where ?? "that state"}.");
        }
    }

    /// <summary>
    /// Checks a batch over, refusing a start date before <paramref name="notBefore"/>.
    ///
    /// A batch is raised to be run, so its date is ahead of today. The floor
    /// is left off where the date is not being moved: a batch already under
    /// way still has to be editable for its venue or its coordinator.
    /// </summary>
    private static void Validate(ProgrammeUpsertDto dto, DateOnly? notBefore)
    {
        if (notBefore is { } floor && dto.StartDate < floor)
            throw new AppException("A batch cannot start on a date that has passed.");
        if (dto.EndDate < dto.StartDate)
            throw new AppException("The end date cannot be before the start date.");
        if (ParseTime(dto.EndTime, new TimeOnly(17, 0))
            <= ParseTime(dto.StartTime, new TimeOnly(10, 0)))
        {
            throw new AppException("The day has to end after it starts.");
        }
        if (dto.MaxParticipants <= 0)
            throw new AppException("Seat capacity must be at least one.");

        /* A physical or hybrid batch needs a venue: somebody turning up at
           the door needs an address. */
        var mode = EnumMaps.ParseEnum(dto.Mode, ProgramMode.Physical);

        if (mode != ProgramMode.Virtual && string.IsNullOrWhiteSpace(dto.Venue))
        {
            throw new AppException("A physical batch needs a venue.");
        }

        /* A room somebody has to find needs the whole address. An empty
           pincode passes Formats, which composes with a required check
           rather than standing in for one, so it is asked for here. */
        if (mode != ProgramMode.Virtual)
        {
            if (string.IsNullOrWhiteSpace(dto.Pincode))
                throw new AppException("A physical batch needs the venue's pincode.");
            if (!Formats.IsPincode(dto.Pincode))
                throw new AppException("The pincode must be 6 digits and cannot start with 0.");
        }

        /* Nothing is asked about the platform: the joining link says which
           one it is, and the column stays for the batches that recorded one.
           The link itself is the batch, for anybody not in the room. */
        if (mode != ProgramMode.Physical && string.IsNullOrWhiteSpace(dto.MeetingLink))
        {
            throw new AppException(mode == ProgramMode.Hybrid
                ? "A hybrid batch needs a meeting link as well as a venue."
                : "A virtual batch needs a meeting link.");
        }
    }

    private static TimeOnly ParseTime(string? value, TimeOnly fallback) =>
        TimeOnly.TryParse(value, out var parsed) ? parsed : fallback;
}
