namespace Ntms.Application.Contracts;

/*
  Contracts for the coordinator mobile app, which records what happened at an
  awareness workshop. Every one of these is scoped to a programme the signed-in
  coordinator is assigned to, and every write is refused once the programme has
  been finally submitted.
*/

/// <summary>A workshop as it appears in the coordinator's list.</summary>
/// <summary>
/// A coordinator's own record, as the implementing agency filled it in.
///
/// The app used to show four lines of it - ID, e-mail, mobile, role -
/// which is not enough for the person whose record it is to tell
/// whether the office has it right. Everything the creation form asks
/// for is here, with the codes resolved: a coordinator reads district
/// names, not LGD numbers.
///
/// PAN and Aadhaar are reduced to their last four digits. They are on
/// the screen so somebody can see which document the office holds, not
/// so a phone left on a table can be read for identifiers.
/// </summary>
public class CoordinatorProfileDto
{
    public string UserCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Designation { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string RoleName { get; set; } = string.Empty;
    public string? OrganisationName { get; set; }

    public string? PanLast4 { get; set; }
    public string? AadhaarLast4 { get; set; }

    /// <summary>Where the person sits, as against where they work.</summary>
    public string? City { get; set; }
    public string? DistrictName { get; set; }
    public string? StateName { get; set; }
    public string? Pincode { get; set; }

    public string? AgencyName { get; set; }
    public string? AgencyCode { get; set; }
    public string? ReportsToName { get; set; }
    public string? ReportsToCode { get; set; }

    /// <summary>The territory allocated to them, in names.</summary>
    public List<string> States { get; set; } = [];
    public List<string> Districts { get; set; } = [];

    public List<string> Categories { get; set; } = [];
    public List<string> SubCategories { get; set; } = [];
    public List<string> ProgramTypes { get; set; } = [];
}

/// <summary>
/// Who to ring about a programme.
///
/// The app's support screen told a coordinator that their implementing
/// agency was the first place to ask and then gave them the scheme's
/// own address, which is the one place that cannot answer a question
/// about a venue. This is the agency that appointed them.
/// </summary>
public class AgencyContactDto
{
    public string Name { get; set; } = string.Empty;
    public string? ContactPerson { get; set; }
    public string? Email { get; set; }
    public string? Mobile { get; set; }
}

public class CoordinatorProgrammeDto
{
    /// <summary>
    /// Whether the coordinator has registered the venue.
    ///
    /// On the summary because the app's own list is grouped by it: a
    /// programme whose dates have started but whose venue has not been
    /// recorded has not begun as far as the person holding the phone is
    /// concerned, and finding that out used to mean fetching every
    /// programme's full monitoring record one at a time.
    /// </summary>
    public bool VenueRegistered { get; set; }

    public int Id { get; set; }
    public string ProgrammeId { get; set; } = string.Empty;
    public string ProgrammeName { get; set; } = string.Empty;
    public string? ProgramTypeName { get; set; }

    /// <summary>
    /// Whether this batch's type wants a photograph of each
    /// participant. The app shows or hides that step accordingly.
    /// </summary>
    public bool ParticipantPhotoRequired { get; set; }

    /// <summary>Whether people may be registered at the door on this batch.</summary>
    public bool OnSpotRegistrationAllowed { get; set; } = true;

    public string Venue { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? State { get; set; }
    /// <summary>The LGD district, named: the venue screen shows it back.</summary>
    public string? District { get; set; }
    public string? Pincode { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Status { get; set; } = string.Empty;

    /// <summary>True once finally submitted; the app then shows it read only.</summary>
    public bool IsSubmitted { get; set; }
    public DateTime? SubmittedOn { get; set; }

    /// <summary>Physical, Virtual or Hybrid. Decides what an address means.</summary>
    public string Mode { get; set; } = string.Empty;
    public string? MeetingPlatform { get; set; }
    public string? MeetingLink { get; set; }

    /// <summary>
    /// The hours the batch runs each day, as the programme was raised.
    ///
    /// Its own, not the syllabus's: the sessions keep separate times,
    /// and what a coordinator needs is when to be at the hall.
    /// </summary>
    public TimeOnly? DailyStartTime { get; set; }
    public TimeOnly? DailyEndTime { get; set; }
}

/// <summary>
/// What has and has not been captured, so the app can show progress without
/// pulling every record down first.
/// </summary>
public class MonitoringProgressDto
{
    public bool VenueRegistered { get; set; }
    public bool VenueGeoTagged { get; set; }
    public bool VenueExteriorPhoto { get; set; }
    public bool VenueInteriorPhoto { get; set; }
    public int TrainerCount { get; set; }
    public int SessionCount { get; set; }
    public int ParticipantCount { get; set; }
    public int AttendanceMarkedCount { get; set; }
    public int PresentCount { get; set; }
    public int AttendanceSheetCount { get; set; }
    public int FeedbackCount { get; set; }
    public int PhotoCount { get; set; }

    /// <summary>What still blocks final submission; empty means ready.</summary>
    public List<string> Blockers { get; set; } = [];
}

public class CoordinatorProgrammeDetailDto : CoordinatorProgrammeDto
{
    public MonitoringProgressDto Progress { get; set; } = new();
    public VenueDto? Venue2 { get; set; }
    public List<TrainerDto> Trainers { get; set; } = [];
    public List<MonitoringSessionDto> Sessions { get; set; } = [];
    public List<OnSpotParticipantDto> Participants { get; set; } = [];
    public List<MonitoringPhotoDto> AttendanceSheets { get; set; } = [];
}

/* ------------------------------------------------------------------ venue */

public class VenueUpsertDto
{
    public string Name { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string? Landmark { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public decimal? AccuracyMetres { get; set; }
}

public class VenueDto : VenueUpsertDto
{
    public int Id { get; set; }
    public DateTime? GeoTaggedOn { get; set; }
    public MonitoringPhotoDto? ExteriorPhoto { get; set; }
    public MonitoringPhotoDto? InteriorPhoto { get; set; }
}

/* ---------------------------------------------------------------- trainer */

public class TrainerUpsertDto
{
    public string FullName { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Designation { get; set; }
    public string? Organisation { get; set; }

    /// <summary>"FullTime" or "PartTime".</summary>
    public string? Engagement { get; set; }

    /// <summary>Time in the field, as two numbers rather than one.</summary>
    public int? YearsExperience { get; set; }
    public int? ExperienceMonths { get; set; }

    /// <summary>The label from the qualifications master, not its key.</summary>
    public string? Qualification { get; set; }

    /// <summary>What it was in: subject, institution, year, as given.</summary>
    public string? QualificationDetails { get; set; }

    /// <summary>Twelve digits. Sent whole, never sent back whole.</summary>
    public string? Aadhaar { get; set; }
}

public class TrainerDto : TrainerUpsertDto
{
    public int Id { get; set; }

    /// <summary>
    /// The last four digits, which is all any screen or report shows.
    ///
    /// The whole number goes up when a trainer is registered and is not
    /// returned by anything: a register of faculty that hands back
    /// everybody's Aadhaar to every caller is a register that leaks it.
    /// </summary>
    public string? AadhaarLast4 { get; set; }

    /// <summary>The trainer photographed on the day, if one was taken.</summary>
    public MonitoringPhotoDto? Photo { get; set; }

    /// <summary>Their identity document, photographed.</summary>
    public MonitoringPhotoDto? IdProof { get; set; }
}

/* ---------------------------------------------------------------- session */

/// <summary>The curriculum, flattened into the two dropdowns the app shows.</summary>
public class SessionTopicDto
{
    public int SessionId { get; set; }
    public string SessionName { get; set; } = string.Empty;

    /// <summary>
    /// Which day of the programme this session belongs to.
    ///
    /// The app asks for the day first and narrows by it, because a
    /// five-day syllabus is forty sessions in one list otherwise and a
    /// coordinator on day three is looking at ten of them.
    /// </summary>
    public int? Day { get; set; }

    public List<SessionSubTopicDto> SubTopics { get; set; } = [];
}

/// <summary>
/// A trainer the coordinator may record a session against.
///
/// The agency's faculty, not this batch's: a trainer registered by one
/// coordinator on Monday is the same person teaching another batch on
/// Thursday, and asking the second coordinator to key in the name,
/// mobile, qualification and two photographs again produces a second
/// record of one person and a register nobody can count.
/// </summary>
public class TrainerOptionDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string? Qualification { get; set; }

    /// <summary>
    /// Whether this trainer is already on this programme. The ones that
    /// are not are copied onto it when a session is recorded against
    /// them, so the batch's own record stays complete.
    /// </summary>
    public bool OnThisProgramme { get; set; }
}

public class SessionSubTopicDto
{
    public int TopicId { get; set; }
    public string TopicName { get; set; } = string.Empty;
}

public class MonitoringSessionUpsertDto
{
    public int TrainerId { get; set; }
    public int CurriculumSessionId { get; set; }
    public int CurriculumTopicId { get; set; }
    public string? Comments { get; set; }
}

public class MonitoringSessionDto
{
    public int Id { get; set; }
    public int TrainerId { get; set; }
    public string? TrainerName { get; set; }
    public int CurriculumSessionId { get; set; }
    public string? TopicName { get; set; }
    public int CurriculumTopicId { get; set; }
    public string? SubTopicName { get; set; }
    public DateTime ConductedOn { get; set; }
    public string? Comments { get; set; }
    public MonitoringPhotoDto? Photo { get; set; }
}

/* ------------------------------------------------------------ participant */

public class OnSpotParticipantUpsertDto
{
    public string FullName { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string EnterpriseName { get; set; } = string.Empty;
    public string? Designation { get; set; }
    /// <summary>The Udyam registration number, or "NA".</summary>
    public string UdyamNumber { get; set; } = string.Empty;
    public string? Gender { get; set; }
    public string? SocialCategory { get; set; }
    public int? StateCode { get; set; }
    public int? DistrictCode { get; set; }
}

public class OnSpotParticipantDto : OnSpotParticipantUpsertDto
{
    public int Id { get; set; }

    /// <summary>Present on any day. The roll-up, not the register.</summary>
    public bool? IsPresent { get; set; }
    public DateTime? AttendanceMarkedOn { get; set; }

    /// <summary>
    /// The days this person was marked on, present or absent.
    ///
    /// A day with no entry has not been taken, which the app shows as
    /// untouched rather than as an absence.
    /// </summary>
    public List<OnSpotAttendanceDayDto> Days { get; set; } = [];
    public int? FeedbackRating { get; set; }
    public string? FeedbackComments { get; set; }
    public MonitoringPhotoDto? Photo { get; set; }
}

public class OnSpotAttendanceMarkDto
{
    public int ParticipantId { get; set; }

    /// <summary>
    /// Which day of the programme this mark is for.
    ///
    /// Required. A five-day programme is five registers, and a mark
    /// without a day could only be written to one of them by guessing.
    /// </summary>
    public DateOnly Day { get; set; }

    public bool IsPresent { get; set; }
}

/// <summary>One person's mark on one day, read back.</summary>
public class OnSpotAttendanceDayDto
{
    public DateOnly Day { get; set; }
    public bool IsPresent { get; set; }
    public DateTime MarkedOn { get; set; }
}

public class OnSpotFeedbackDto
{
    /// <summary>1 to 5.</summary>
    public int Rating { get; set; }
    public string? Comments { get; set; }
}

/* ------------------------------------------------------------------ photo */

public class MonitoringPhotoDto
{
    public int Id { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public DateTime CapturedOn { get; set; }

    /// <summary>
    /// When it reached the server, and off what.
    ///
    /// Recorded at upload and shown beside the picture, because the gap
    /// between taking a photograph and handing it in is the thing anybody
    /// checking a record wants to see — a batch of session photographs all
    /// synced days later off one handset reads differently from the same
    /// photographs synced as the sessions happened.
    /// </summary>
    public DateTime? SyncedOn { get; set; }
    public string? DevicePlatform { get; set; }
    public string? DeviceModel { get; set; }

    /// <summary>Whether the time and place were burnt into the image.</summary>
    public bool Stamped { get; set; }

    /// <summary>Relative API path the app fetches the image from.</summary>
    public string Url { get; set; } = string.Empty;
}

/* ------------------------------------------------------------- submission */

public class SubmitProgrammeDto
{
    public string? Remarks { get; set; }
}

public class ProgrammeSubmissionDto
{
    public int ProgrammeId { get; set; }
    public DateTime SubmittedOn { get; set; }
    public string? SubmittedBy { get; set; }
    public int TrainerCount { get; set; }
    public int SessionCount { get; set; }
    public int ParticipantCount { get; set; }
    public int PresentCount { get; set; }
    public int PhotoCount { get; set; }
    public string? Remarks { get; set; }
}

/// <summary>
/// A trainer as the faculty register shows them: who they are, and which
/// programme they delivered. One row per delivery, because that is how the
/// record is kept — somebody who took three workshops appears three times,
/// and each row is the programme's own record of who turned up.
/// </summary>
public class FacultyDto : TrainerDto
{
    public int ProgrammeId { get; set; }
    public string? ProgrammeCode { get; set; }
    public string? ProgrammeName { get; set; }
    public string? ProgramTypeName { get; set; }
    public string? AgencyName { get; set; }
    public string? StateName { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
}

/* ------------------------------------------------------- quality control */

/// <summary>
/// A conducted programme as the QC queues show it.
///
/// The programme's own identity, what the coordinator handed in, and
/// where the manager has got to with it — enough to fill a row of any of
/// the three queues and the sheet that opens from it, without a second
/// call per programme.
/// </summary>
public class QcProgrammeDto
{
    public int ProgrammeId { get; set; }
    public string ProgrammeCode { get; set; } = string.Empty;
    public string ProgrammeName { get; set; } = string.Empty;
    public int ProgramTypeId { get; set; }
    public string? ProgramTypeName { get; set; }
    public int? AgencyId { get; set; }
    public string? AgencyName { get; set; }
    public string? Venue { get; set; }
    public string? Mode { get; set; }
    public string? State { get; set; }
    public DateOnly? StartDate { get; set; }
    public DateOnly? EndDate { get; set; }

    /* What was handed in. */
    public DateTime SubmittedOn { get; set; }
    public string? SubmittedBy { get; set; }
    public int TrainerCount { get; set; }
    public int SessionCount { get; set; }
    public int ParticipantCount { get; set; }
    public int PresentCount { get; set; }
    public int PhotoCount { get; set; }
    public string? Remarks { get; set; }

    /* Where the manager has got to. */
    public string QcStatus { get; set; } = "Pending";
    public DateTime? QcOn { get; set; }
    public string? QcBy { get; set; }
    public string? QcRemarks { get; set; }
}

/// <summary>How many sit in each QC queue, for the tab counts.</summary>
public class QcCountsDto
{
    public int Pending { get; set; }
    public int Approved { get; set; }
    public int Rejected { get; set; }
}

/// <summary>The manager's decision on a report.</summary>
public class QcDecisionDto
{
    /// <summary>Required on a rejection, optional on an approval.</summary>
    public string? Remarks { get; set; }
}
