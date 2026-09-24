using Ntms.Domain.Common;

namespace Ntms.Domain.Entities;

/*
  What the coordinator records on the ground during an awareness workshop,
  captured from the coordinator mobile app.

  This is evidence, not administration: a venue that was geo-tagged where the
  workshop actually happened, photographs taken at the time, the people who
  walked in, who was present and what they thought of it. Once the coordinator
  makes the final submission the whole set is sealed — see
  <see cref="ProgrammeSubmission"/>.
*/

/// <summary>
/// The venue as the coordinator found it, fixed to a point on the map.
///
/// One per programme. The latitude and longitude come from the device at the
/// venue, which is the point of geo-tagging: an address typed from an office
/// proves nothing about where the workshop was held.
/// </summary>
public class ProgrammeVenue : AuditableEntity
{
    public int ProgrammeId { get; set; }
    public Programme? Programme { get; set; }

    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? Landmark { get; set; }

    /* Nullable as a pair: a device that could not get a fix records neither,
       rather than a plausible-looking half reading. */
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    /// <summary>Metres of uncertainty the device reported with the fix.</summary>
    public decimal? AccuracyMetres { get; set; }
    public DateTime? GeoTaggedOn { get; set; }

    public ICollection<MonitoringPhoto> Photos { get; set; } = [];
}

/// <summary>
/// A trainer taking the workshop, registered by the coordinator on the day.
///
/// Held against the programme rather than as a shared master: the coordinator
/// records who actually turned up to deliver it, which is not always who was
/// planned, and correcting one workshop's record must not rewrite another's.
/// </summary>
public class ProgrammeTrainer : AuditableEntity
{
    public int ProgrammeId { get; set; }
    public Programme? Programme { get; set; }

    public string FullName { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Designation { get; set; }
    public string? Organisation { get; set; }
}

/// <summary>
/// One topic delivered, with the photograph taken while it was being delivered.
///
/// The topic and sub-topic point at the curriculum, so a session cannot claim
/// content the programme's curriculum does not contain.
/// </summary>
public class MonitoringSession : AuditableEntity
{
    public int ProgrammeId { get; set; }
    public Programme? Programme { get; set; }

    public int TrainerId { get; set; }
    public ProgrammeTrainer? Trainer { get; set; }

    /// <summary>The curriculum session, shown to the coordinator as "Topic".</summary>
    public int CurriculumSessionId { get; set; }
    public CurriculumSession? CurriculumSession { get; set; }

    /// <summary>The curriculum topic under it, shown as "Sub-topic".</summary>
    public int CurriculumTopicId { get; set; }
    public CurriculumTopic? CurriculumTopic { get; set; }

    public DateTime ConductedOn { get; set; } = DateTime.UtcNow;
    public string? Comments { get; set; }

    public ICollection<MonitoringPhoto> Photos { get; set; } = [];
}

/// <summary>
/// Somebody who walked in on the day and was registered on the spot.
///
/// Awareness workshops are open events, so most attendees never went through
/// an application. Their attendance and feedback hang off this row rather than
/// off <see cref="ProgrammeParticipant"/>, which represents an enrolled
/// candidate with an application behind them.
/// </summary>
public class OnSpotParticipant : AuditableEntity
{
    public int ProgrammeId { get; set; }
    public Programme? Programme { get; set; }

    public string FullName { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string EnterpriseName { get; set; } = string.Empty;
    public string? Designation { get; set; }

    /// <summary>
    /// The enterprise's Udyam registration number, or the literal "NA".
    ///
    /// "NA" is a real answer here, not a blank: an attendee from an
    /// unregistered enterprise is exactly who these workshops are for, and the
    /// scheme reports on how many of them came.
    /// </summary>
    public string UdyamNumber { get; set; } = string.Empty;

    public Gender? Gender { get; set; }
    public SocialCategory? SocialCategory { get; set; }

    public int? StateCode { get; set; }
    public LgdState? State { get; set; }
    public int? DistrictCode { get; set; }
    public LgdDistrict? District { get; set; }

    /* Attendance is ticked on a separate screen after registration, so an
       unmarked row means "not yet taken", not "absent". */
    public bool? IsPresent { get; set; }
    public DateTime? AttendanceMarkedOn { get; set; }

    /// <summary>1 to 5, optional — feedback is never compulsory.</summary>
    public int? FeedbackRating { get; set; }
    public string? FeedbackComments { get; set; }
    public DateTime? FeedbackOn { get; set; }

    public ICollection<MonitoringPhoto> Photos { get; set; } = [];
}

/// <summary>
/// A photograph on disk, with its metadata in the database.
///
/// The image bytes live on a file share because there are many of them and they
/// are large; the row records where, what it shows and — where the device knew
/// — the point it was taken from. One table for every kind of photograph keeps
/// the storage and validation rules in one place, and <see cref="Kind"/> plus
/// the nullable owner keys say what each one belongs to.
/// </summary>
public class MonitoringPhoto : AuditableEntity
{
    public int ProgrammeId { get; set; }
    public Programme? Programme { get; set; }

    public MonitoringPhotoKind Kind { get; set; }

    /* Exactly one of these is set, according to Kind. */
    public int? VenueId { get; set; }
    public ProgrammeVenue? Venue { get; set; }
    public int? SessionId { get; set; }
    public MonitoringSession? Session { get; set; }
    public int? ParticipantId { get; set; }
    public OnSpotParticipant? Participant { get; set; }

    /// <summary>Path under the monitoring storage root, using forward slashes.</summary>
    public string RelativePath { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }

    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public DateTime CapturedOn { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// The coordinator's final submission, which seals the programme's record.
///
/// The manual is explicit that nothing may be edited afterwards, so every
/// monitoring write checks for this row first. It is deliberately a row of its
/// own rather than a flag on the programme: it records who sealed it and when,
/// and the counts as they stood at that moment, so a later disagreement about
/// the numbers can be settled without recomputing them.
/// </summary>
public class ProgrammeSubmission : AuditableEntity
{
    public int ProgrammeId { get; set; }
    public Programme? Programme { get; set; }

    public int SubmittedByUserId { get; set; }
    public PortalUser? SubmittedBy { get; set; }
    public DateTime SubmittedOn { get; set; } = DateTime.UtcNow;

    public int TrainerCount { get; set; }
    public int SessionCount { get; set; }
    public int ParticipantCount { get; set; }
    public int PresentCount { get; set; }
    public int PhotoCount { get; set; }

    public string? Remarks { get; set; }
}
