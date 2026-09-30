using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Reports, read straight off the record.
///
/// Nothing here is stored. A report is a view of the programme as it stands
/// when it is asked for, and a rendered copy kept on disk is a second version
/// of the truth — it goes stale the moment a mark is corrected or a
/// certificate revoked, and whoever holds it has no way of knowing. The
/// portal renders what this returns and the browser prints it; the file that
/// results belongs to whoever asked for it, not to us.
///
/// Read only, and scoped like every other estate-wide list: an Operation
/// Manager reports on their allocation and nobody else's.
/// </summary>
public class ReportService(NtmsDbContext db, ICurrentUser currentUser)
{
    /// <summary>
    /// The programmes a report can be run for, newest first.
    ///
    /// Filtered by programme type, because that is how the scheme is reported
    /// on: "how did the assessor training go" is a question about a type, not
    /// about one batch.
    /// </summary>
    public async Task<PagedResult<ReportProgrammeDto>> ProgrammesAsync(
        PagedRequest request,
        int? categoryId,
        int? subCategoryId,
        int? programTypeId,
        int? agencyId,
        int? stateCode,
        DateOnly? from,
        DateOnly? to,
        CancellationToken ct)
    {
        /* Included because Project reads the names off them. Without this the
           register renders a column of blanks: the entity loads, the things
           hanging off it do not, and nothing complains. */
        var query = db.Programmes.AsNoTracking()
            .Include(p => p.Agency)
            .Include(p => p.Category)
            .Include(p => p.SubCategory)
            .Include(p => p.ProgramType)
            .Include(p => p.State)
            .Include(p => p.District)
            .WithinScope(currentUser)
            .WhereIf(categoryId.HasValue, p => p.CategoryId == categoryId)
            .WhereIf(subCategoryId.HasValue, p => p.SubCategoryId == subCategoryId)
            .WhereIf(programTypeId.HasValue, p => p.ProgramTypeId == programTypeId)
            .WhereIf(agencyId.HasValue, p => p.AgencyId == agencyId)
            .WhereIf(stateCode.HasValue, p => p.StateCode == stateCode)
            /* Overlap, not containment: a programme running across the end of
               the range is part of that range's activity. */
            .WhereIf(from.HasValue, p => p.EndDate >= from!.Value)
            .WhereIf(to.HasValue, p => p.StartDate <= to!.Value)
            .WhereIf(!string.IsNullOrWhiteSpace(request.Search),
                p => p.ProgrammeId.Contains(request.Search!)
                     || p.ProgrammeName.Contains(request.Search!)
                     || p.Venue.Contains(request.Search!));

        query = (request.SortBy?.ToLowerInvariant()) switch
        {
            "code" => request.SortDir == "desc"
                ? query.OrderByDescending(p => p.ProgrammeId)
                : query.OrderBy(p => p.ProgrammeId),
            "agency" => request.SortDir == "desc"
                ? query.OrderByDescending(p => p.Agency!.Name)
                : query.OrderBy(p => p.Agency!.Name),
            "participantcount" => request.SortDir == "desc"
                ? query.OrderByDescending(p => p.ParticipantCount)
                : query.OrderBy(p => p.ParticipantCount),
            /* Newest first: a register that only grows is read from the end. */
            _ => request.SortDir == "asc"
                ? query.OrderBy(p => p.StartDate).ThenBy(p => p.Id)
                : query.OrderByDescending(p => p.StartDate).ThenByDescending(p => p.Id),
        };

        return await query.ToPagedResultAsync(request, Project, ct);
    }

    /// <summary>One programme in full, ready to be rendered and printed.</summary>
    public async Task<ProgrammeReportDto> ProgrammeAsync(int programmeId, CancellationToken ct)
    {
        /* Through the scope filter, so a programme outside the caller's
           allocation is not found rather than refused — the same answer they
           would get if it did not exist, which is what they are entitled to
           know about it. */
        var programme = await db.Programmes.AsNoTracking()
            .WithinScope(currentUser)
            .Include(p => p.Agency)
            .Include(p => p.Category)
            .Include(p => p.SubCategory)
            .Include(p => p.ProgramType)
            .Include(p => p.State)
            .Include(p => p.District)
            .Include(p => p.Coordinator)
            .FirstOrDefaultAsync(p => p.Id == programmeId, ct)
            ?? throw AppException.NotFound("Program");

        var branding = await db.Branding.AsNoTracking().FirstOrDefaultAsync(ct);

        var venue = await db.ProgrammeVenues.AsNoTracking()
            .Where(v => v.ProgrammeId == programmeId)
            .Select(v => new ReportVenueDto
            {
                Name = v.Name,
                Address = v.Address,
                Landmark = v.Landmark,
                Latitude = v.Latitude,
                Longitude = v.Longitude,
                GeoTaggedOn = v.GeoTaggedOn,
            })
            .FirstOrDefaultAsync(ct);

        var trainers = await db.ProgrammeTrainers.AsNoTracking()
            .Where(t => t.ProgrammeId == programmeId)
            .OrderBy(t => t.FullName)
            .Select(t => new ReportTrainerDto
            {
                FullName = t.FullName,
                Designation = t.Designation,
                Organisation = t.Organisation,
                Mobile = t.Mobile,
                Email = t.Email,
            })
            .ToListAsync(ct);

        var participants = await db.ProgrammeParticipants.AsNoTracking()
            .Where(p => p.ProgrammeId == programmeId)
            .OrderBy(p => p.Applicant!.FullName)
            .Select(p => new ReportParticipantDto
            {
                ApplicantCode = p.Applicant!.ApplicantCode,
                FullName = p.Applicant!.FullName,
                Gender = p.Applicant!.Gender == null ? null : p.Applicant!.Gender.ToString(),
                Mobile = p.Applicant!.Mobile,
                Email = p.Applicant!.Email,
                AttendancePercent = p.AttendancePercent,
                WrittenMarks = p.WrittenMarks,
                VivaMarks = p.VivaMarks,
                ExamScore = p.ExamScore,
                Result = p.Result.ToString(),
                CertificateNumber = p.CertificateNo,
                FeedbackRating = p.FeedbackRating,
            })
            .ToListAsync(ct);

        Number(participants, (row, n) => row.SerialNo = n);

        var sessions = await db.ProgrammeSessions.AsNoTracking()
            .Where(s => s.ProgrammeId == programmeId)
            .OrderBy(s => s.SessionDate).ThenBy(s => s.StartTime)
            .Select(s => new ReportSessionDto
            {
                SessionCode = s.SessionCode,
                Title = s.Title,
                SessionDate = s.SessionDate,
                StartTime = s.StartTime.ToString("HH:mm"),
                EndTime = s.EndTime.ToString("HH:mm"),
                FacultyName = s.FacultyName,
                PresentCount = s.PresentCount,
                MarkedCount = s.Attendance.Count,
            })
            .ToListAsync(ct);

        Number(sessions, (row, n) => row.SerialNo = n);

        var monitoring = await db.MonitoringSessions.AsNoTracking()
            .Where(m => m.ProgrammeId == programmeId)
            .OrderBy(m => m.ConductedOn)
            .Select(m => new ReportMonitoringDto
            {
                ConductedOn = m.ConductedOn,
                TrainerName = m.Trainer!.FullName,
                Topic = m.CurriculumSession!.SessionName,
                SubTopic = m.CurriculumTopic!.TopicName,
                Comments = m.Comments,
                PhotoCount = m.Photos.Count,
            })
            .ToListAsync(ct);

        Number(monitoring, (row, n) => row.SerialNo = n);

        var rated = participants.Where(p => p.FeedbackRating.HasValue).ToList();

        return new ProgrammeReportDto
        {
            OrganisationName = branding?.OrganisationName ?? "Capacity Building Management System",
            GeneratedOn = DateTime.UtcNow,
            GeneratedBy = currentUser.DisplayName ?? string.Empty,

            Programme = Project(programme),
            Venue = venue,
            CoordinatorName = programme.Coordinator?.FullName,
            CoordinatorEmail = programme.Coordinator?.Email,
            CoordinatorMobile = programme.Coordinator?.Mobile,

            Trainers = trainers,
            Participants = participants,
            Sessions = sessions,
            Monitoring = monitoring,

            Totals = new ReportTotalsDto
            {
                Enrolled = participants.Count,
                Passed = participants.Count(p => p.Result == nameof(ParticipantResult.Pass)),
                Failed = participants.Count(p => p.Result == nameof(ParticipantResult.Fail)),
                Pending = participants.Count(p => p.Result == nameof(ParticipantResult.Pending)),
                Certified = participants.Count(p => !string.IsNullOrWhiteSpace(p.CertificateNumber)),

                AverageAttendance = participants.Count == 0
                    ? 0m
                    : Rounding.Half(participants.Average(p => p.AttendancePercent)),

                /* Null rather than zero where nobody rated it: no feedback and
                   feedback of nought are different findings. */
                AverageFeedback = rated.Count == 0
                    ? null
                    : Rounding.Half((decimal) rated.Average(p => p.FeedbackRating!.Value)),

                SessionsHeld = sessions.Count,
                MonitoringSessions = monitoring.Count,
            },
        };
    }

    /// <summary>Serial numbers are the reader's, so they are added at the end.</summary>
    private static void Number<T>(List<T> rows, Action<T, int> set)
    {
        for (var index = 0; index < rows.Count; index++) set(rows[index], index + 1);
    }

    private static ReportProgrammeDto Project(Domain.Entities.Programme p) => new()
    {
        Id = p.Id,
        ProgrammeCode = p.ProgrammeId,
        ProgrammeName = p.ProgrammeName,
        AgencyName = p.Agency?.Name,
        ProgramTypeId = p.ProgramTypeId,
        ProgramTypeName = p.ProgramType?.Name,
        CategoryName = p.Category?.Name,
        SubCategoryName = p.SubCategory?.Name,
        Mode = p.Mode.ToString(),
        Venue = p.Venue,
        StateName = p.State?.Name,
        DistrictName = p.District?.Name,
        StartDate = p.StartDate,
        EndDate = p.EndDate,
        ParticipantCount = p.ParticipantCount,
        Status = p.Status.ToString(),
    };
}
