using Microsoft.EntityFrameworkCore;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// Quality control on a conducted programme.
///
/// The coordinator closes the programme from the app, which seals the
/// monitoring record and puts it in front of the Operation Manager. The
/// manager reads what was actually done — the venue and its photographs,
/// the trainers, every session, the attendance, the people who came — and
/// either accepts it or sends it back saying why.
///
/// Three queues, as the scheme's own portal has them: pending, approved
/// and rejected. Everyone who may see programmes may read all three; only
/// the key decides, which is the whole point of a quality check being
/// somebody other than the people who ran the thing.
/// </summary>
public class QcService(NtmsDbContext db, ICurrentUser currentUser)
{
    /// <summary>
    /// The submissions this account may read at all.
    ///
    /// Scoped like the programmes register itself, so an agency sees the
    /// batches it ran and a manager the ones in their allocation. The QC
    /// screens are read-only for everyone except the manager holding the
    /// key, and the scope is what makes "read-only" mean "read-only on
    /// the things that are yours".
    /// </summary>
    private IQueryable<ProgrammeSubmission> Visible() =>
        db.ProgrammeSubmissions.AsNoTracking()
            .Include(s => s.Programme)!.ThenInclude(p => p!.Agency)
            .Include(s => s.Programme)!.ThenInclude(p => p!.ProgramType)
            .Include(s => s.Programme)!.ThenInclude(p => p!.State)
            .Include(s => s.SubmittedBy)
            .Where(s => db.Programmes.WithinScope(currentUser)
                .Any(p => p.Id == s.ProgrammeId));

    /// <summary>
    /// One of the three queues, newest submission first.
    ///
    /// Filtered by programme type and agency, which are the two the live
    /// portal offers and the two a manager actually narrows by.
    /// </summary>
    public async Task<PagedResult<QcProgrammeDto>> QueueAsync(
        PagedRequest request,
        QcStatus status,
        int? programTypeId,
        int? agencyId,
        CancellationToken ct)
    {
        var search = request.Search?.Trim();

        var query = Visible()
            .Where(s => s.QcStatus == status)
            .WhereIf(programTypeId.HasValue, s => s.Programme!.ProgramTypeId == programTypeId)
            .WhereIf(agencyId.HasValue, s => s.Programme!.AgencyId == agencyId)
            .WhereIf(!string.IsNullOrWhiteSpace(search),
                s => s.Programme!.ProgrammeId.Contains(search!)
                     || s.Programme!.ProgrammeName.Contains(search!)
                     || s.Programme!.Agency!.Name.Contains(search!))
            .OrderByDescending(s => s.SubmittedOn);

        return await query.ToPagedResultAsync(request, Map, ct);
    }

    /// <summary>How many sit in each queue, for the tab counts.</summary>
    public async Task<QcCountsDto> CountsAsync(
        int? programTypeId, int? agencyId, CancellationToken ct)
    {
        var query = Visible()
            .WhereIf(programTypeId.HasValue, s => s.Programme!.ProgramTypeId == programTypeId)
            .WhereIf(agencyId.HasValue, s => s.Programme!.AgencyId == agencyId);

        return new QcCountsDto
        {
            AwaitingAgency =
                await query.CountAsync(s => s.QcStatus == QcStatus.AwaitingAgency, ct),
            Pending = await query.CountAsync(s => s.QcStatus == QcStatus.Pending, ct),
            Approved = await query.CountAsync(s => s.QcStatus == QcStatus.Approved, ct),
            Rejected = await query.CountAsync(s => s.QcStatus == QcStatus.Rejected, ct),
        };
    }

    /// <summary>One submission, by the programme it belongs to.</summary>
    public async Task<QcProgrammeDto> GetAsync(int programmeId, CancellationToken ct) =>
        Map(await Visible().FirstOrDefaultAsync(s => s.ProgrammeId == programmeId, ct)
            ?? throw AppException.NotFound("Submitted programme"));

    /// <summary>
    /// Accepts the report.
    ///
    /// The batch stays Conducted — it was conducted either way — and what
    /// changes is that the report becomes readable from Reports. Remarks
    /// are optional here; a manager who is satisfied has nothing to add.
    /// </summary>
    public async Task<QcProgrammeDto> ApproveAsync(
        int programmeId, string? remarks, CancellationToken ct)
    {
        var submission = await DecidableAsync(programmeId, ct);

        submission.QcStatus = QcStatus.Approved;
        submission.QcByUserId = currentUser.UserId;
        submission.QcByUserName = currentUser.DisplayName;
        submission.QcOn = DateTime.UtcNow;
        submission.QcRemarks = Trimmed(remarks);

        /* The batch is conducted at this point and not before. It was
           left on whatever status it was raised with, so a programme
           that had run, been written up and been passed still read as
           scheduled on every screen that shows the register. */
        var programme = await db.Programmes.FirstOrDefaultAsync(p => p.Id == programmeId, ct);
        if (programme is not null) programme.Status = ProgramStatus.Conducted;

        await db.SaveChangesAsync(ct);
        return await GetAsync(programmeId, ct);
    }

    /// <summary>
    /// Sends the report back.
    ///
    /// A reason is required: the agency is being told what it handed in
    /// is not good enough, and a refusal without a reason is one the
    /// agency cannot act on. The batch is marked QC rejected so the
    /// register says so too.
    /// </summary>
    public async Task<QcProgrammeDto> RejectAsync(
        int programmeId, string? remarks, CancellationToken ct)
    {
        var reason = Trimmed(remarks)
                     ?? throw new AppException("Say why the report is being sent back.");

        var submission = await DecidableAsync(programmeId, ct);

        submission.QcStatus = QcStatus.Rejected;
        submission.QcByUserId = currentUser.UserId;
        submission.QcByUserName = currentUser.DisplayName;
        submission.QcOn = DateTime.UtcNow;
        submission.QcRemarks = reason;

        var programme = await db.Programmes.FirstOrDefaultAsync(p => p.Id == programmeId, ct);
        if (programme is not null) programme.Status = ProgramStatus.QCRejected;

        /* The seal comes off with the rejection.

           Sending a report back and leaving the record locked is a
           request nobody can act on: the coordinator is the only person
           who can correct what is wrong with it and the app refuses
           every write while a submission stands. Rejected submissions
           no longer count as sealed, so the batch reopens, is corrected
           and is submitted again - which is the whole point of sending
           it back. */

        await db.SaveChangesAsync(ct);
        return await GetAsync(programmeId, ct);
    }

    /// <summary>
    /// The agency passes its coordinator's report to the manager.
    ///
    /// The agency is answerable for what its coordinator handed in, so
    /// nothing reaches the scheme's manager until somebody there has
    /// read it. Forwarding says only that: it is not an approval, and
    /// the manager still decides.
    /// </summary>
    public async Task<QcProgrammeDto> ForwardAsync(
        int programmeId, string? remarks, CancellationToken ct)
    {
        var submission = await ForwardableAsync(programmeId, ct);

        submission.QcStatus = QcStatus.Pending;
        submission.ForwardedByUserId = currentUser.UserId;
        submission.ForwardedByUserName = currentUser.DisplayName;
        submission.ForwardedOn = DateTime.UtcNow;
        submission.ForwardRemarks = Trimmed(remarks);

        await db.SaveChangesAsync(ct);
        return await GetAsync(programmeId, ct);
    }

    /// <summary>
    /// The agency sends its coordinator's report back without
    /// forwarding it.
    ///
    /// The same ending as a rejection by the manager, and for the same
    /// reason: the record reopens so the coordinator can correct it.
    /// Catching a bad report here rather than after the manager has
    /// read it is the point of the agency being in the middle.
    /// </summary>
    public async Task<QcProgrammeDto> SendBackAsync(
        int programmeId, string? remarks, CancellationToken ct)
    {
        var reason = Trimmed(remarks)
                     ?? throw new AppException("Say why the report is being sent back.");

        var submission = await ForwardableAsync(programmeId, ct);

        submission.QcStatus = QcStatus.Rejected;
        submission.QcByUserId = currentUser.UserId;
        submission.QcByUserName = currentUser.DisplayName;
        submission.QcOn = DateTime.UtcNow;
        submission.QcRemarks = reason;

        var programme = await db.Programmes.FirstOrDefaultAsync(p => p.Id == programmeId, ct);
        if (programme is not null) programme.Status = ProgramStatus.QCRejected;

        await db.SaveChangesAsync(ct);
        return await GetAsync(programmeId, ct);
    }

    /// <summary>
    /// The submission this agency may forward, or a refusal.
    ///
    /// Scope rather than a quality-control permission: this is the
    /// agency reading its own coordinator's work, which is not the
    /// manager's check and does not need the manager's key.
    /// </summary>
    private async Task<ProgrammeSubmission> ForwardableAsync(int programmeId, CancellationToken ct)
    {
        var inScope = await db.Programmes.AsNoTracking()
            .WithinScope(currentUser)
            .AnyAsync(p => p.Id == programmeId, ct);

        if (!inScope)
            throw AppException.Forbidden("This program is outside your allocation.");

        var submission = await db.ProgrammeSubmissions
            .FirstOrDefaultAsync(s => s.ProgrammeId == programmeId, ct)
            ?? throw AppException.NotFound("Submitted programme");

        if (submission.QcStatus != QcStatus.AwaitingAgency)
        {
            throw new AppException(submission.QcStatus switch
            {
                QcStatus.Pending =>
                    "This report has already been forwarded"
                    + (submission.ForwardedByUserName is { } who ? $" by {who}." : "."),
                QcStatus.Approved =>
                    "This report has already been accepted"
                    + (submission.QcByUserName is { } who ? $" by {who}." : "."),
                _ =>
                    "This report has already been sent back"
                    + (submission.QcByUserName is { } who ? $" by {who}." : "."),
            });
        }

        return submission;
    }

    /// <summary>
    /// The submission this account is about to decide, or a refusal.
    ///
    /// Three separate refusals, because "no" on its own leaves the reader
    /// guessing which of them it was: the key, the scope, and whether
    /// somebody has already decided it.
    /// </summary>
    private async Task<ProgrammeSubmission> DecidableAsync(int programmeId, CancellationToken ct)
    {
        if (!currentUser.HasPermission(Permissions.ProgramsQc))
            throw AppException.Forbidden("Quality control is the Operation Manager's.");

        var inScope = await db.Programmes.AsNoTracking()
            .WithinScope(currentUser)
            .AnyAsync(p => p.Id == programmeId, ct);

        if (!inScope)
            throw AppException.Forbidden("This program is outside your allocation.");

        var submission = await db.ProgrammeSubmissions
            .FirstOrDefaultAsync(s => s.ProgrammeId == programmeId, ct)
            ?? throw AppException.NotFound("Submitted programme");

        if (submission.QcStatus == QcStatus.AwaitingAgency)
        {
            /* Not a decision that has been taken, which is what the
               sentence below says: it is a report the agency has not
               handed over yet, and telling a manager it "has already
               been awaitingagency" explains nothing and reads as a
               fault in the software. */
            throw new AppException(
                "The implementing agency has not forwarded this report yet.");
        }

        if (submission.QcStatus != QcStatus.Pending)
        {
            throw new AppException(
                $"This report has already been {submission.QcStatus.ToString().ToLowerInvariant()}"
                + (submission.QcByUserName is { } who ? $" by {who}." : "."));
        }

        return submission;
    }

    /// <summary>
    /// The report for one programme, built from the sealed record.
    ///
    /// Readable once QC has accepted it, and by the manager doing the QC
    /// before that — reading the report is how the check is made, so
    /// withholding it until after the decision would be the wrong way
    /// round. Everyone else waits for the approval.
    /// </summary>
    public async Task<Reporting.ProgrammeReportRenderer.Rendered> ReportAsync(
        int programmeId,
        Storage.MonitoringPhotoStore photos,
        CancellationToken ct)
    {
        var submission = await Visible()
            .FirstOrDefaultAsync(s => s.ProgrammeId == programmeId, ct)
            ?? throw AppException.NotFound("Submitted programme");

        if (submission.QcStatus != QcStatus.Approved
            && !currentUser.HasPermission(Permissions.ProgramsQc))
        {
            throw AppException.Forbidden(
                "This report is still with quality control.");
        }

        var programme = await db.Programmes.AsNoTracking()
            .Include(p => p.Agency)
            .Include(p => p.ProgramType)
            .Include(p => p.State)
            .FirstAsync(p => p.Id == programmeId, ct);

        var venue = await db.ProgrammeVenues.AsNoTracking()
            .FirstOrDefaultAsync(v => v.ProgrammeId == programmeId, ct);

        var trainers = await db.ProgrammeTrainers.AsNoTracking()
            .Where(t => t.ProgrammeId == programmeId).OrderBy(t => t.Id).ToListAsync(ct);

        var sessions = await db.MonitoringSessions.AsNoTracking()
            .Include(x => x.Trainer)
            .Include(x => x.CurriculumSession)
            .Include(x => x.CurriculumTopic)
            .Where(x => x.ProgrammeId == programmeId).OrderBy(x => x.Id).ToListAsync(ct);

        /* With the register, which the report prints a column of per
           day of the programme. */
        var participants = await db.OnSpotParticipants.AsNoTracking()
            .Include(x => x.Days)
            .Where(x => x.ProgrammeId == programmeId).OrderBy(x => x.Id).ToListAsync(ct);

        var shots = await db.MonitoringPhotos.AsNoTracking()
            .Where(x => x.ProgrammeId == programmeId).OrderBy(x => x.Id).ToListAsync(ct);

        var coordinator = submission.SubmittedBy?.FullName
                          ?? await db.Users.AsNoTracking()
                              .Where(u => u.Id == programme.CoordinatorId)
                              .Select(u => u.FullName)
                              .FirstOrDefaultAsync(ct);

        return Reporting.ProgrammeReportRenderer.Render(new Reporting.ProgrammeReportRenderer.Source(
            programme,
            submission,
            venue,
            trainers,
            sessions,
            participants,
            shots,
            coordinator,
            /* One photograph that will not open must not cost the whole
               report. The renderer counts what it could not embed and
               says so on the page. */
            shot =>
            {
                try
                {
                    using var stream = photos.Open(shot.RelativePath);
                    using var buffer = new MemoryStream();
                    stream.CopyTo(buffer);
                    return buffer.ToArray();
                }
                catch (Exception)
                {
                    return null;
                }
            }));
    }

    private static string? Trimmed(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static QcProgrammeDto Map(ProgrammeSubmission s) => new()
    {
        ProgrammeId = s.ProgrammeId,
        ProgrammeCode = s.Programme?.ProgrammeId ?? string.Empty,
        ProgrammeName = s.Programme?.ProgrammeName ?? string.Empty,
        ProgramTypeId = s.Programme?.ProgramTypeId ?? 0,
        ProgramTypeName = s.Programme?.ProgramType?.Name,
        AgencyId = s.Programme?.AgencyId,
        AgencyName = s.Programme?.Agency?.Name,
        Venue = s.Programme?.Venue,
        Mode = s.Programme?.Mode.ToString(),
        State = s.Programme?.State?.Name,
        StartDate = s.Programme?.StartDate,
        EndDate = s.Programme?.EndDate,

        SubmittedOn = s.SubmittedOn,
        SubmittedBy = s.SubmittedBy?.FullName,
        TrainerCount = s.TrainerCount,
        SessionCount = s.SessionCount,
        ParticipantCount = s.ParticipantCount,
        PresentCount = s.PresentCount,
        PhotoCount = s.PhotoCount,
        Remarks = s.Remarks,

        QcStatus = s.QcStatus.ToString(),
        QcOn = s.QcOn,
        QcBy = s.QcByUserName,
        QcRemarks = s.QcRemarks,
    };
}
