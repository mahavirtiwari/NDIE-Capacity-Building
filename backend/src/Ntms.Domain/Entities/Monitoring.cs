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

    /// <summary>Full time or part time, where the coordinator said.</summary>
    public TrainerEngagement? Engagement { get; set; }

    /// <summary>Years in the field, as declared. Null where not asked.</summary>
    public int? YearsExperience { get; set; }

    /// <summary>
    /// The highest qualification, as its label rather than a key.
    ///
    /// The same choice the programme types make: a qualification renamed
    /// or retired in the masters leaves this record saying what it said
    /// at the time, instead of being silently emptied or made to read as
    /// something nobody entered.
    /// </summary>
    public string? Qualification { get; set; }

    /// <summary>
    /// The trainer's Aadhaar, where it was collected.
    ///
    /// Held because the scheme identifies its faculty by it, and shown
    /// as the last four digits everywhere it is displayed — including in
    /// the programme report, which is a document that gets mailed around
    /// and filed. The whole number is not printed anywhere.
    /// </summary>
    public string? Aadhaar { get; set; }
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

    /// <summary>
    /// Whether this person attended the programme at all.
    ///
    /// A roll-up of <see cref="Days"/>, kept on the row because most of
    /// the system asks the simple question: the submission counts who
    /// came, the feedback screen asks who may give it, the dashboard
    /// counts heads. True where they were present on any day.
    ///
    /// Still the only answer for a one-day programme, and for every
    /// programme recorded before attendance was taken per day.
    /// </summary>
    public bool? IsPresent { get; set; }
    public DateTime? AttendanceMarkedOn { get; set; }

    /// <summary>
    /// The register, a row per day of the programme.
    ///
    /// A five-day programme is five separate questions — somebody who
    /// came on Monday and not on Thursday did not attend the programme
    /// the way a single tick claims — and the report has to show which
    /// days each person was there.
    /// </summary>
    public ICollection<OnSpotAttendance> Days { get; set; } = [];

    /// <summary>1 to 5, optional — feedback is never compulsory.</summary>
    public int? FeedbackRating { get; set; }
    public string? FeedbackComments { get; set; }
    public DateTime? FeedbackOn { get; set; }

    public ICollection<MonitoringPhoto> Photos { get; set; } = [];
}

/// <summary>
/// One person, on one day of a programme.
///
/// Keyed on the day rather than on a session: attendance is taken at the
/// door in the morning, and tying it to a curriculum session would mean
/// a coordinator ticking the same row four times because the day had
/// four sessions in it.
///
/// A missing row is "not taken", which is a different thing from a row
/// saying absent. The register has to be able to say that nobody marked
/// Thursday, or an unmarked day reads as a day everybody missed.
/// </summary>
public class OnSpotAttendance
{
    public int Id { get; set; }

    public int ParticipantId { get; set; }
    public OnSpotParticipant? Participant { get; set; }

    /// <summary>
    /// Carried as well as reached through the participant.
    ///
    /// The report and the register both read a whole programme's
    /// attendance at once, and going through the participants to do it
    /// is a join this saves on every one of those reads.
    /// </summary>
    public int ProgrammeId { get; set; }
    public Programme? Programme { get; set; }

    /// <summary>The day of the programme, not the day it was recorded.</summary>
    public DateOnly Day { get; set; }

    public bool IsPresent { get; set; }

    public DateTime MarkedOn { get; set; } = DateTime.UtcNow;
    public string? MarkedBy { get; set; }
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

    /// <summary>
    /// When the shutter went, as the coordinator's handset had it.
    ///
    /// Was the moment the server received the file, which is a different
    /// thing on a field visit: the app queues photographs taken out of
    /// signal and sends them when it next has a connection, so the two
    /// can be hours apart. The time drawn into the picture has to be the
    /// first of those or it is not evidence of when anybody was there.
    /// </summary>
    public DateTime CapturedOn { get; set; } = DateTime.UtcNow;

    /// <summary>When it reached the server. The other end of that gap.</summary>
    public DateTime SyncedOn { get; set; } = DateTime.UtcNow;

    /* What took it, as the handset reports itself. */
    public string? DevicePlatform { get; set; }
    public string? DeviceModel { get; set; }
    public string? DeviceOsVersion { get; set; }

    /// <summary>
    /// Whether the time and position were drawn into the image.
    ///
    /// False for everything taken before this existed, and for a frame
    /// the drawing could not read — which is stored as it arrived rather
    /// than thrown away, because the photograph is the evidence and the
    /// stamp is a convenience.
    /// </summary>
    public bool Stamped { get; set; }
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

    /// <summary>What the coordinator wanted to say when closing it.</summary>
    public string? Remarks { get; set; }

    /* ------------------------------------------------------------ QC */

    /// <summary>
    /// Where this report stands with the Operation Manager.
    ///
    /// Pending the moment the coordinator closes the programme: closing
    /// it is what forwards the report, so there is no separate act of
    /// sending and nothing can be conducted but unsent.
    /// </summary>
    public QcStatus QcStatus { get; set; } = QcStatus.Pending;

    public int? QcByUserId { get; set; }
    public PortalUser? QcBy { get; set; }

    /// <summary>
    /// Named as well as keyed, like a scrutiny decision.
    ///
    /// The account that did the QC may be closed years before anybody
    /// reads the report again, and "approved by (deleted user)" is not a
    /// record of who approved it.
    /// </summary>
    public string? QcByUserName { get; set; }

    public DateTime? QcOn { get; set; }

    /// <summary>
    /// The manager's note. Required on a rejection — the agency is being
    /// told its report is not good enough and has to know what to fix.
    /// </summary>
    public string? QcRemarks { get; set; }

    /* The report itself is not kept. It is built from this record when
       somebody asks for it, the way a certificate is: the monitoring
       record is sealed at submission and cannot drift, so a stored copy
       would be a second thing to keep, back up and account for, and it
       would answer no question the record cannot. */
}
