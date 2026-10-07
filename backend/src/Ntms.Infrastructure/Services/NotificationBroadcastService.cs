using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Mapping;
using Ntms.Infrastructure.Notifications;
using Ntms.Infrastructure.Persistence;

namespace Ntms.Infrastructure.Services;

/// <summary>
/// What the scheme says to the handsets.
///
/// Two ways in. Somebody writes one on the Notifications screen and sends
/// it; or something happens — a programme opens, a track is added — and
/// the code that did it raises one. Both end in the same place: a row that
/// says what was said and to whom, and a push to every handset that
/// matches.
///
/// A notification is never sent twice. The send is the act; the row keeps
/// what came of it.
/// </summary>
public class NotificationBroadcastService(
    NtmsDbContext db,
    ICurrentUser currentUser,
    IPushSender push,
    ILogger<NotificationBroadcastService> logger)
{
    /* ---------------------------------------------------- the handsets */

    /// <summary>
    /// A handset saying hello.
    ///
    /// Keyed on the token: the same phone signing in as somebody else moves
    /// to that account rather than keeping two claims on it, which is how
    /// a shared handset would otherwise send one person's notifications to
    /// another.
    /// </summary>
    public async Task RegisterDeviceAsync(PushDeviceDto dto, CancellationToken ct)
    {
        var token = dto.Token?.Trim();
        if (string.IsNullOrWhiteSpace(token))
            throw new AppException("A handset has to say which token to reach it on.");

        var device = await db.PushDevices.FirstOrDefaultAsync(d => d.Token == token, ct);
        if (device is null)
        {
            device = new PushDevice { Token = token };
            db.PushDevices.Add(device);
        }

        device.Platform = Clamp(dto.Platform, 20, "android");
        device.App = Clamp(dto.App, 20, "applicant");
        device.ApplicantId = currentUser.ApplicantId;
        device.UserId = currentUser.ApplicantId is null ? currentUser.UserId : null;
        device.LastSeenOn = DateTime.UtcNow;
        device.IsActive = true;

        await db.SaveChangesAsync(ct);
    }

    /// <summary>Signing out: the handset stops being this person's.</summary>
    public async Task RetireDeviceAsync(string token, CancellationToken ct)
    {
        var device = await db.PushDevices.FirstOrDefaultAsync(d => d.Token == token, ct);
        if (device is null) return;

        device.IsActive = false;
        await db.SaveChangesAsync(ct);
    }

    /* ------------------------------------------------------ the register */

    public async Task<PagedResult<NotificationDto>> ListAsync(
        PagedRequest request, CancellationToken ct)
    {
        var query = db.Notifications.AsNoTracking()
            .Include(n => n.SubCategory)
            .Include(n => n.State)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Search))
        {
            var term = request.Search.Trim();
            query = query.Where(n => n.Title.Contains(term) || n.Body.Contains(term));
        }

        /* Newest first: a log is read from the top. */
        query = query.OrderByDescending(n => n.CreatedOn);

        var total = await query.CountAsync(ct);
        var rows = await query
            .Skip((request.Page - 1) * request.PageSize)
            .Take(request.PageSize)
            .ToListAsync(ct);

        return new PagedResult<NotificationDto>
        {
            Items = [.. rows.Select(ToDto)],
            Total = total,
            Page = request.Page,
            PageSize = request.PageSize,
        };
    }

    public async Task<NotificationDto> CreateAsync(
        NotificationUpsertDto dto, CancellationToken ct)
    {
        var title = dto.Title?.Trim();
        var body = dto.Body?.Trim();

        Guard.Check()
            .Required(title, "Title")
            .Required(body, "Message")
            .ThrowIfInvalid();

        var audience = EnumMaps.ParseEnum(dto.Audience, NotificationAudience.Everyone);

        var entity = new Notification
        {
            Title = title!,
            Body = body!,
            Audience = audience,
            /* A track only narrows an audience of applicants; on anything
               else it would read as a filter that does nothing. */
            SubCategoryId = audience is NotificationAudience.Everyone or NotificationAudience.Applicants
                ? dto.SubCategoryId
                : null,
            StateCode = dto.StateCode,
            LinkPath = string.IsNullOrWhiteSpace(dto.LinkPath) ? null : dto.LinkPath.Trim(),
            Kind = "Custom",
            Status = NotificationStatus.Draft,
        };

        db.Notifications.Add(entity);
        await db.SaveChangesAsync(ct);

        if (dto.SendNow) await SendAsync(entity.Id, ct);

        return await GetAsync(entity.Id, ct);
    }

    public async Task<NotificationDto> GetAsync(int id, CancellationToken ct)
    {
        var entity = await db.Notifications.AsNoTracking()
                         .Include(n => n.SubCategory)
                         .Include(n => n.State)
                         .FirstOrDefaultAsync(n => n.Id == id, ct)
                     ?? throw AppException.NotFound("Notification");
        return ToDto(entity);
    }

    /// <summary>
    /// Sends one, once.
    ///
    /// Resending would be a second notice to everybody who already had the
    /// first, which is not what the button on a sent row would mean to the
    /// person pressing it.
    /// </summary>
    public async Task<NotificationDto> SendAsync(int id, CancellationToken ct)
    {
        var entity = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id, ct)
                     ?? throw AppException.NotFound("Notification");

        if (entity.Status == NotificationStatus.Sent)
            throw new AppException("That notification has already gone out.");

        var devices = await HandsetsFor(entity).ToListAsync(ct);
        var messages = devices
            .Select(d => new PushMessage(d.Token, entity.Title, entity.Body, entity.LinkPath))
            .ToList();

        var outcome = await push.SendAsync(messages, ct);

        /* Retired where the push service says the app is gone. Keeping a
           dead token only fills the next log with the same failure. */
        if (outcome.DeadTokens.Count > 0)
        {
            var dead = await db.PushDevices
                .Where(d => outcome.DeadTokens.Contains(d.Token))
                .ToListAsync(ct);
            foreach (var device in dead) device.IsActive = false;
        }

        entity.Handsets = messages.Count;
        entity.Delivered = outcome.Delivered;
        entity.Failed = outcome.Failed;
        entity.Note = outcome.Note;
        entity.SentOn = DateTime.UtcNow;
        /* Sent is about the notice, not the handsets: it is on everybody's
           list in the app whether or not a push reached them, and a scheme
           with nobody signed in yet has still said the thing. */
        entity.Status = outcome.Failed > 0 && outcome.Delivered == 0 && messages.Count > 0
            ? NotificationStatus.Failed
            : NotificationStatus.Sent;

        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Notification {Id} sent to {Count} handset(s): {Delivered} accepted, {Failed} refused",
            entity.Id, messages.Count, outcome.Delivered, outcome.Failed);

        return await GetAsync(entity.Id, ct);
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var entity = await db.Notifications.FirstOrDefaultAsync(n => n.Id == id, ct)
                     ?? throw AppException.NotFound("Notification");

        if (entity.Status == NotificationStatus.Sent)
            throw new AppException("A notification that has gone out cannot be unsent.");

        db.Notifications.Remove(entity);
        await db.SaveChangesAsync(ct);
    }

    /* ------------------------------------------------ raised by the system */

    /// <summary>
    /// Raised by something that happened rather than by somebody writing it.
    ///
    /// Never throws into the caller: a programme is not left unsaved
    /// because the push service was unreachable. The row is written either
    /// way, so the notice is on the list in the app even when the push
    /// failed.
    /// </summary>
    public async Task RaiseAsync(
        string kind,
        string title,
        string body,
        NotificationAudience audience,
        int? subCategoryId = null,
        int? stateCode = null,
        string? linkPath = null,
        CancellationToken ct = default)
    {
        try
        {
            var entity = new Notification
            {
                Title = title.Trim(),
                Body = body.Trim(),
                Audience = audience,
                SubCategoryId = subCategoryId,
                StateCode = stateCode,
                LinkPath = linkPath,
                Kind = kind,
                Status = NotificationStatus.Draft,
            };
            db.Notifications.Add(entity);
            await db.SaveChangesAsync(ct);
            await SendAsync(entity.Id, ct);
        }
        catch (Exception caught)
        {
            logger.LogWarning(caught, "Could not raise the {Kind} notification", kind);
        }
    }

    /* --------------------------------------------------- read on a handset */

    /// <summary>
    /// What the person holding this handset should see, newest first.
    ///
    /// Matched on the audience rather than read from a per-person table: a
    /// notice to every applicant is one row, and whether it is this
    /// applicant's is a question about who they are.
    /// </summary>
    public async Task<MyNotificationsDto> MineAsync(int take, CancellationToken ct)
    {
        var applicantId = currentUser.ApplicantId;
        var userId = applicantId is null ? currentUser.UserId : null;
        if (applicantId is null && userId is null) return new MyNotificationsDto();

        var mine = await Addressed(applicantId, userId)
            .OrderByDescending(n => n.SentOn)
            .Take(Math.Clamp(take, 1, 100))
            .Select(n => new
            {
                n.Id,
                n.Title,
                n.Body,
                n.LinkPath,
                n.Kind,
                n.SentOn,
                Read = n.Reads.Any(r =>
                    (applicantId != null && r.ApplicantId == applicantId)
                    || (userId != null && r.UserId == userId)),
            })
            .ToListAsync(ct);

        return new MyNotificationsDto
        {
            Items =
            [
                .. mine.Select(n => new MyNotificationDto
                {
                    Id = n.Id,
                    Title = n.Title,
                    Body = n.Body,
                    LinkPath = n.LinkPath,
                    Kind = n.Kind,
                    SentOn = n.SentOn ?? DateTime.UtcNow,
                    IsRead = n.Read,
                }),
            ],
            Unread = mine.Count(n => !n.Read),
        };
    }

    public async Task MarkReadAsync(int id, CancellationToken ct)
    {
        var applicantId = currentUser.ApplicantId;
        var userId = applicantId is null ? currentUser.UserId : null;
        if (applicantId is null && userId is null) return;

        var already = await db.NotificationReads.AnyAsync(
            r => r.NotificationId == id
                 && r.ApplicantId == applicantId
                 && r.UserId == userId, ct);
        if (already) return;

        db.NotificationReads.Add(new NotificationRead
        {
            NotificationId = id,
            ApplicantId = applicantId,
            UserId = userId,
        });
        await db.SaveChangesAsync(ct);
    }

    /* ----------------------------------------------------------- the rules */

    /// <summary>The sent notices addressed to this reader.</summary>
    private IQueryable<Notification> Addressed(int? applicantId, int? userId)
    {
        var query = db.Notifications.AsNoTracking().Where(n => n.SentOn != null);

        if (applicantId is not null)
        {
            return query.Where(n =>
                n.Audience == NotificationAudience.Everyone
                || n.Audience == NotificationAudience.Applicants);
        }

        return query.Where(n =>
            n.Audience == NotificationAudience.Everyone
            || n.Audience == NotificationAudience.PortalUsers
            || (n.Audience == NotificationAudience.Coordinators
                && db.Users.Any(u => u.Id == userId && u.BaseRole == BaseRole.Coordinator))
            || (n.Audience == NotificationAudience.ImplementingAgencies
                && db.Users.Any(u => u.Id == userId && u.BaseRole == BaseRole.AgencyAdmin))
            || (n.Audience == NotificationAudience.OperationManagers
                && db.Users.Any(u => u.Id == userId && u.BaseRole == BaseRole.OperationManager)));
    }

    /// <summary>The live handsets a notice is addressed to.</summary>
    private IQueryable<PushDevice> HandsetsFor(Notification notice)
    {
        var devices = db.PushDevices.AsNoTracking().Where(d => d.IsActive);

        devices = notice.Audience switch
        {
            NotificationAudience.Applicants => devices.Where(d => d.ApplicantId != null),
            NotificationAudience.PortalUsers => devices.Where(d => d.UserId != null),
            NotificationAudience.Coordinators => devices.Where(d =>
                d.UserId != null
                && db.Users.Any(u => u.Id == d.UserId && u.BaseRole == BaseRole.Coordinator)),
            NotificationAudience.ImplementingAgencies => devices.Where(d =>
                d.UserId != null
                && db.Users.Any(u => u.Id == d.UserId && u.BaseRole == BaseRole.AgencyAdmin)),
            NotificationAudience.OperationManagers => devices.Where(d =>
                d.UserId != null
                && db.Users.Any(u => u.Id == d.UserId && u.BaseRole == BaseRole.OperationManager)),
            _ => devices,
        };

        /* A state narrows the staff by where they sit and the applicants by
           where they said they are; an applicant with no state on file is
           not excluded, because that is a gap in their record rather than
           an answer. */
        if (notice.StateCode is { } state)
        {
            devices = devices.Where(d =>
                d.UserId == null
                || db.Users.Any(u => u.Id == d.UserId && u.StateCode == state));
        }

        return devices;
    }

    private static string Clamp(string? value, int max, string fallback)
    {
        var text = (value ?? string.Empty).Trim();
        if (text.Length == 0) return fallback;
        return text.Length <= max ? text : text[..max];
    }

    private static NotificationDto ToDto(Notification e) => new()
    {
        Id = e.Id,
        Title = e.Title,
        Body = e.Body,
        Audience = e.Audience.ToString(),
        AudienceLabel = AudienceLabel(e.Audience),
        SubCategoryId = e.SubCategoryId,
        SubCategoryName = e.SubCategory?.Name,
        StateCode = e.StateCode,
        State = e.State?.Name,
        LinkPath = e.LinkPath,
        Kind = e.Kind,
        Status = e.Status.ToString(),
        SentOn = e.SentOn,
        Handsets = e.Handsets,
        Delivered = e.Delivered,
        Failed = e.Failed,
        Note = e.Note,
        CreatedBy = e.CreatedBy,
        CreatedOn = e.CreatedOn,
        ModifiedBy = e.ModifiedBy,
        ModifiedOn = e.ModifiedOn,
    };

    public static string AudienceLabel(NotificationAudience audience) => audience switch
    {
        NotificationAudience.Everyone => "Everyone with the app",
        NotificationAudience.Applicants => "Applicants",
        NotificationAudience.Coordinators => "Coordinators",
        NotificationAudience.ImplementingAgencies => "Implementing agencies",
        NotificationAudience.OperationManagers => "Operation managers",
        NotificationAudience.PortalUsers => "Portal accounts",
        _ => audience.ToString(),
    };
}
