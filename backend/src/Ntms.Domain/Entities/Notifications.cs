using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/// <summary>Who a notification is addressed to.</summary>
public enum NotificationAudience
{
    /// <summary>Everybody with the app, applicant or staff.</summary>
    Everyone = 0,
    Applicants = 1,
    Coordinators = 2,
    ImplementingAgencies = 3,
    OperationManagers = 4,
    /// <summary>Every portal account, whatever its tier.</summary>
    PortalUsers = 5,
}

public enum NotificationStatus
{
    Draft = 0,
    Sent = 1,
    Failed = 2,
}

/// <summary>
/// A handset the scheme can reach, and who is signed in on it.
///
/// Keyed on the push token, because that is what identifies the handset to
/// the push service; a phone that is signed out of and into again by
/// somebody else moves to the new account rather than carrying the old
/// one's notifications.
/// </summary>
public class PushDevice : AuditableEntity
{
    public string Token { get; set; } = string.Empty;
    /// <summary>android, ios or web.</summary>
    public string Platform { get; set; } = string.Empty;
    /// <summary>applicant or coordinator — which app this handset is running.</summary>
    public string App { get; set; } = string.Empty;

    public int? ApplicantId { get; set; }
    public Applicant? Applicant { get; set; }
    public int? UserId { get; set; }
    public PortalUser? User { get; set; }

    public DateTime LastSeenOn { get; set; } = DateTime.UtcNow;
    /// <summary>Turned off when the push service says the token is dead.</summary>
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// Something the scheme has to say, and who it was said to.
///
/// One row per message rather than one per recipient: a notice to every
/// applicant is one thing that happened, and writing a row per person
/// would turn each broadcast into tens of thousands of rows nobody reads.
/// Who it reaches is decided by the audience when it is read, and what has
/// been read is kept in <see cref="NotificationRead"/>, which only gains a
/// row when somebody actually opens one.
/// </summary>
public class Notification : AuditableEntity
{
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;

    public NotificationAudience Audience { get; set; } = NotificationAudience.Everyone;

    /// <summary>Narrows an applicant audience to one track, where set.</summary>
    public int? SubCategoryId { get; set; }
    public SubCategory? SubCategory { get; set; }

    /// <summary>Narrows any audience to one state, where set.</summary>
    public int? StateCode { get; set; }
    public LgdState? State { get; set; }

    /// <summary>
    /// Where tapping it should land, as a path inside the app — "/programs",
    /// "/profile-form". Empty opens the notification list itself.
    /// </summary>
    public string? LinkPath { get; set; }

    /// <summary>
    /// Why this exists: Custom for one somebody wrote, or the name of the
    /// event that raised it — ProgrammeOpened, CategoryAdded. Kept so the
    /// automatic ones can be told apart from the announcements.
    /// </summary>
    public string Kind { get; set; } = "Custom";

    public NotificationStatus Status { get; set; } = NotificationStatus.Draft;
    public DateTime? SentOn { get; set; }

    /// <summary>What the push service was asked to deliver, and how it went.</summary>
    public int Handsets { get; set; }
    public int Delivered { get; set; }
    public int Failed { get; set; }
    /// <summary>The first thing that went wrong, where anything did.</summary>
    public string? Note { get; set; }

    public ICollection<NotificationRead> Reads { get; set; } = [];
}

/// <summary>That one person has read one notification.</summary>
public class NotificationRead
{
    public int Id { get; set; }
    public int NotificationId { get; set; }
    public Notification? Notification { get; set; }
    public int? ApplicantId { get; set; }
    public int? UserId { get; set; }
    public DateTime ReadOn { get; set; } = DateTime.UtcNow;
}
