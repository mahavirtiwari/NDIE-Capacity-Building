using System.Text.Json;
using System.Text.Json.Serialization;

namespace Ntms.Application.Contracts;

/* ------------------------------------------------------------- applicants */

public class ApplicantDto : AuditDto
{
    public int Id { get; set; }
    public string ApplicantCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Pan { get; set; } = string.Empty;
    /// <summary>Self-declared; null where the applicant predates the question.</summary>
    public string? Gender { get; set; }
    public string? SocialCategory { get; set; }
    /// <summary>
    /// The first discipline they entered, and null until they start one.
    /// What is actually open to them is the profiles they hold.
    /// </summary>
    public int? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public int? SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }
    public bool EmailVerified { get; set; }
    public bool MobileVerified { get; set; }
    public string KycStatus { get; set; } = "Pending";

    /// <summary>
    /// Where this person stands, read from their applications rather than
    /// held on the account: Registered until they apply, then whatever
    /// scrutiny has made of it.
    ///
    /// One of Registered, ApplicationReceived, Approved, Rejected. Somebody
    /// with applications in more than one category gets the furthest one:
    /// having been approved somewhere is the more useful fact about them.
    /// </summary>
    public string Standing { get; set; } = "Registered";
    public int? StateCode { get; set; }
    public string? State { get; set; }
    public int? DistrictCode { get; set; }
    public string? District { get; set; }
    public string? City { get; set; }
    public DateTime RegisteredOn { get; set; }
    public DateTime? LastLoginOn { get; set; }
    public bool IsBlocked { get; set; }

    /// <summary>
    /// What was answered to the custom questions on the sign-up form, worded
    /// as they were asked. Empty where the form asked nothing extra.
    /// </summary>
    public List<ApplicantAnswerDto> Answers { get; set; } = [];
}

public class ApplicantAnswerDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string? Value { get; set; }
}

public class BlockApplicantDto
{
    public bool IsBlocked { get; set; }

/// <summary>
    /// Which of the configured reasons applies — one from the block list or
    /// one from the unblock list, depending on the direction. Required either
    /// way, so both halves of the history give grounds.
    /// </summary>
    public int? BlockReasonId { get; set; }

    public string? Remarks { get; set; }
}

/// <summary>One time an account was blocked or let back in.</summary>
public class ApplicantStatusEventDto
{
    public int Id { get; set; }
    public bool Blocked { get; set; }
    public string? ReasonLabel { get; set; }
    public string? Remarks { get; set; }
    public string ByUserName { get; set; } = string.Empty;
    public string ByUserCode { get; set; } = string.Empty;
    public DateTime On { get; set; }
}

/// <summary>
/// One thing that happened to somebody or something, whatever part of
/// the system it happened in.
///
/// Flattened on purpose, and shared by the applicant, the portal user
/// and the implementing agency. Whoever is asking "what happened to
/// this" wants one list in order, not six screens each holding a sixth
/// of the answer - and the three histories should read the same way.
/// </summary>
public class TimelineEventDto
{
    public DateTime On { get; set; }

    /// <summary>
    /// Which part of the system this came from: Account, Profile,
    /// Application, Payment, Programme, Certificate. The screen groups and
    /// colours by it; it is not free text.
    /// </summary>
    public string Area { get; set; } = string.Empty;

    /// <summary>What happened, in a few words.</summary>
    public string Title { get; set; } = string.Empty;

    /// <summary>The detail worth reading: a reason, an amount, a remark.</summary>
    public string? Detail { get; set; }

    /// <summary>
    /// What it happened to - an application number, a programme, a
    /// sub-category - so a long history stays readable.
    /// </summary>
    public string? Reference { get; set; }

    /// <summary>Who did it. Absent where the system did it.</summary>
    public string? By { get; set; }
}

/// <summary>
/// What the history popup shows: who the account belongs to, where it stands
/// now, and everything that has happened to them.
/// </summary>
public class ApplicantHistoryDto
{
    public int ApplicantId { get; set; }
    public string ApplicantCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public bool IsBlocked { get; set; }
    public DateTime? BlockedOn { get; set; }
    public string? BlockReasonLabel { get; set; }
    public DateTime RegisteredOn { get; set; }
    public DateTime? LastLoginOn { get; set; }

    /// <summary>Blocking and unblocking, kept separate for the access panel.</summary>
    public List<ApplicantStatusEventDto> Events { get; set; } = [];

    /// <summary>Everything that has happened, oldest first.</summary>
    public List<TimelineEventDto> Timeline { get; set; } = [];
}

/// <summary>
/// One row of the applicants export: everything the sign-up form collected,
/// where the person stands, and the dates behind that.
///
/// A shape of its own rather than the list DTO, because an export is read in
/// a spreadsheet rather than on a screen - it wants every answer flattened
/// out, and it does not want paging.
/// </summary>
public class ApplicantExportRowDto
{
    public string ApplicantCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Pan { get; set; } = string.Empty;
    public string? Gender { get; set; }
    public string? SocialCategory { get; set; }
    public string? Category { get; set; }
    public string? SubCategory { get; set; }
    public string? State { get; set; }
    public string? District { get; set; }
    public string? City { get; set; }

    public bool EmailVerified { get; set; }
    public bool MobileVerified { get; set; }

    /// <summary>Registered, Application received, Approved or Rejected.</summary>
    public string Standing { get; set; } = "Registered";

    public DateTime RegisteredOn { get; set; }
    public DateTime? FirstAppliedOn { get; set; }
    public DateTime? ApprovedOn { get; set; }
    public DateTime? RejectedOn { get; set; }

    /// <summary>The reason on the most recent rejection, if any.</summary>
    public string? RejectionReason { get; set; }

    public string Access { get; set; } = "Active";
    public DateTime? BlockedOn { get; set; }
    public string? BlockReason { get; set; }

    public DateTime? LastLoginOn { get; set; }

    /// <summary>
    /// Answers to the custom sign-up questions, keyed by the question as it
    /// was asked. Turned into columns by the export.
    /// </summary>
    public Dictionary<string, string?> Answers { get; set; } = [];
}

/// <summary>Basic sign-up from the mobile app, before OTP verification.</summary>
public class ApplicantSignUpDto
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Pan { get; set; } = string.Empty;
    public string? Gender { get; set; }
    public string? SocialCategory { get; set; }

    /// <summary>
    /// Answers to whatever else the sign-up form asks, keyed by field key.
    /// The built-in questions keep their own properties above, because they
    /// land in columns rather than in answer rows.
    /// </summary>
    public Dictionary<string, string?> Answers { get; set; } = [];
}

public class VerifyOtpDto
{
    public string Email { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}

/* ----------------------------------------------------------- applications */

public class ApplicationDocumentDto
{
    public int Id { get; set; }
    public string FieldKey { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public long FileSizeKb { get; set; }
    public DateTime UploadedOn { get; set; }
    public bool Verified { get; set; }
    public string? Remarks { get; set; }
}

public class ScrutinyEventDto
{
    public int Id { get; set; }
    public string Action { get; set; } = string.Empty;
    public string ByUserName { get; set; } = string.Empty;
    public string ByRole { get; set; } = string.Empty;
    public DateTime On { get; set; }
    public string? Remarks { get; set; }
    /// <summary>The chosen reason, on a rejection.</summary>
    public string? RejectionReasonLabel { get; set; }
}

public class ApplicationDto : AuditDto
{
    public int Id { get; set; }
    public string ApplicationNo { get; set; } = string.Empty;
    public int ApplicantId { get; set; }
    public string ApplicantName { get; set; } = string.Empty;
    public string ApplicantEmail { get; set; } = string.Empty;
    public string ApplicantMobile { get; set; } = string.Empty;
    public string Pan { get; set; } = string.Empty;
    public int CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public int SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }
    public int ProgramTypeId { get; set; }
    public string? ProgramTypeName { get; set; }
    public string Status { get; set; } = "Draft";
    public DateTime? SubmittedOn { get; set; }
    public int? AssignedToUserId { get; set; }
    public string? AssignedToName { get; set; }
    public string PaymentStatus { get; set; } = "NotApplicable";
    public decimal FeeAmount { get; set; }
    public decimal TdsPercent { get; set; }
    public string? Tan { get; set; }
    public string? DeductorName { get; set; }
    public decimal? Score { get; set; }

    /// <summary>Why it was turned down, worded as it was at the time.</summary>
    public string? RejectionReasonLabel { get; set; }
    public int? StateCode { get; set; }
    public string? State { get; set; }
    public string? City { get; set; }
    /// <summary>Answers keyed by registration field key.</summary>
    public JsonElement Responses { get; set; }
    public List<ApplicationDocumentDto> Documents { get; set; } = [];
    public List<ScrutinyEventDto> History { get; set; } = [];

    /// <summary>
    /// Every attempt to pay the fee, newest first. Filled on the detail read
    /// only: a page of applications does not show them, and the reference a
    /// bank asks for is only ever wanted one application at a time.
    /// </summary>
    public List<PaymentTransactionDto> Payments { get; set; } = [];
}

/// <summary>Submitted by the mobile app against the program type's form.</summary>
public class ApplicationSubmitDto
{
    /// <summary>
    /// Filled from the bearer token by the controller, never from the request
    /// body — otherwise one applicant could submit as another.
    /// </summary>
    [JsonIgnore]
    public int ApplicantId { get; set; }
    public int ProgramTypeId { get; set; }
    public Dictionary<string, JsonElement> Responses { get; set; } = [];
    public decimal TdsPercent { get; set; }
    public string? Tan { get; set; }
    public string? DeductorName { get; set; }
}

public class ScrutinyDecisionDto
{
    public int ApplicationId { get; set; }
    /// <summary>Approve, Reject or Clarification.</summary>
    public string Decision { get; set; } = string.Empty;
    public string Remarks { get; set; } = string.Empty;
    public List<int>? DocumentIdsVerified { get; set; }

    /// <summary>
    /// Which of the configured reasons applies. Required on a rejection and
    /// ignored otherwise: a rejection is counted and reported on, so it is
    /// chosen from the list rather than typed.
    /// </summary>
    public int? RejectionReasonId { get; set; }
}

/// <summary>How many applications sit at each status, under the filters asked for.</summary>
public class ApplicationCountsDto
{
    public int Submitted { get; set; }
    public int UnderScrutiny { get; set; }
    public int Clarification { get; set; }
    public int Approved { get; set; }
    public int Enrolled { get; set; }
    public int Rejected { get; set; }

    /// <summary>Everything the filters match, whatever its status.</summary>
    public int Total { get; set; }
}

public class AssignApplicationDto
{
    public int UserId { get; set; }
}

public class VerifyDocumentDto
{
    public bool Verified { get; set; }
    public string? Remarks { get; set; }
}

/* ------------------------------------------------------------- programmes */

public class ProgrammeSessionDto
{
    public int Id { get; set; }
    public string? SessionCode { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateOnly SessionDate { get; set; }
    public string StartTime { get; set; } = "10:00";
    public string EndTime { get; set; } = "17:00";
    public string? FacultyName { get; set; }
    public int PresentCount { get; set; }
    public bool IsAttendanceLocked { get; set; }
}

public class ProgrammeParticipantDto
{
    public int Id { get; set; }
    public int ApplicantId { get; set; }
    public string ApplicationNo { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public DateOnly EnrolledOn { get; set; }
    public decimal AttendancePercent { get; set; }
    public decimal? ExamScore { get; set; }
    public string Result { get; set; } = "Pending";
    public string? CertificateNo { get; set; }
    public int? FeedbackRating { get; set; }
}

public class ProgrammeDto : AuditDto
{
    public int Id { get; set; }
    public string ProgrammeId { get; set; } = string.Empty;
    public string ProgrammeName { get; set; } = string.Empty;
    public int? CurriculumId { get; set; }
    public string? ProgrammeCode { get; set; }
    public int CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public int SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }
    public int ProgramTypeId { get; set; }
    public string? ProgramTypeName { get; set; }
    public int AgencyId { get; set; }
    public string? AgencyName { get; set; }
    public int? ExamPaperId { get; set; }
    public string? ExamPaperTitle { get; set; }
    public int CoordinatorId { get; set; }
    public string? CoordinatorName { get; set; }
    public int? OperationManagerId { get; set; }
    public string? OperationManagerName { get; set; }
    public string Mode { get; set; } = "Physical";
    public string Venue { get; set; } = string.Empty;
    public string? City { get; set; }
    public int StateCode { get; set; }
    public string State { get; set; } = string.Empty;
    public string? MeetingPlatform { get; set; }
    public string? MeetingLink { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int MaxParticipants { get; set; }
    public int ParticipantCount { get; set; }
    public decimal? CumulativeFeedback { get; set; }
    public string? Comments { get; set; }
    public bool RegistrationsOpen { get; set; }
    public DateTime? ExamDateTime { get; set; }
    public string Status { get; set; } = "New";
    public List<ProgrammeSessionDto> Sessions { get; set; } = [];
    public List<ProgrammeParticipantDto> Participants { get; set; } = [];
}

public class ProgrammeUpsertDto
{
    public string? ProgrammeName { get; set; }
    public int? CurriculumId { get; set; }
    public int ProgramTypeId { get; set; }
    public int AgencyId { get; set; }
    public int CoordinatorId { get; set; }
    public int? OperationManagerId { get; set; }
    public string Mode { get; set; } = "Physical";
    public string? Venue { get; set; }
    public string? City { get; set; }
    public int StateCode { get; set; }
    public int? DistrictCode { get; set; }
    public string? MeetingPlatform { get; set; }
    public string? MeetingLink { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    /// <summary>Registrations close by themselves once this many have enrolled.</summary>
    public int MaxParticipants { get; set; } = 30;
    public string? Comments { get; set; }
}

public class ProgrammeStatusDto
{
    public string Status { get; set; } = string.Empty;
    public string? Comments { get; set; }
}

/// <summary>Opening a batch again, and for how many.</summary>
public class ReopenRegistrationsDto
{
    /// <summary>
    /// The places the batch is opening for, counted from nobody rather than
    /// added to what it already holds. A batch that filled at thirty and
    /// reopens at thirty-five is a batch of thirty-five.
    /// </summary>
    public int MaxParticipants { get; set; }
}

public class SetExamTimeDto
{
    public DateTime ExamDateTime { get; set; }

    /// <summary>
    /// The paper this batch sits online. Optional: left out, the program type's
    /// single live paper is used, and a type with several is asked about when a
    /// candidate tries to sit rather than guessed at here.
    /// </summary>
    public int? ExamPaperId { get; set; }
}

public class AttendanceMarkDto
{
    public int ParticipantId { get; set; }
    public bool Present { get; set; }
}

public class MarkAttendanceDto
{
    public List<AttendanceMarkDto> Marks { get; set; } = [];
}

public class EnrolDto
{
    public List<int> ApplicationIds { get; set; } = [];
}

/* -------------------------------------------------------------- dashboard */

public class DashboardKpiDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public int Value { get; set; }
    public string? Suffix { get; set; }
    public string Tone { get; set; } = "primary";
    public string Icon { get; set; } = "inbox";
}

public class SeriesPointDto
{
    public string Label { get; set; } = string.Empty;
    public int Value { get; set; }
}

public class DashboardDto
{
    public List<DashboardKpiDto> Kpis { get; set; } = [];
    public List<SeriesPointDto> ProgramsByMonth { get; set; } = [];

    /* The profile of who actually attended, counted over programme participants
       rather than applicants, so it answers the same question as the "Candidates
       participated" headline and cannot disagree with it.

       Percentages are left to the caller: sending both a count and a percent
       invites the two to round apart. */
    public List<SeriesPointDto> ParticipantsByGender { get; set; } = [];
    public List<SeriesPointDto> ParticipantsBySocialCategory { get; set; } = [];
}

public class DashboardFilterDto
{
    public int? CategoryId { get; set; }
    public int? SubCategoryId { get; set; }
    public int? ProgramTypeId { get; set; }
    public int? AgencyId { get; set; }
    public string? State { get; set; }
    public string? Mode { get; set; }
    /// <summary>Rolling window in months; 0 or null means the full history.</summary>
    public int? Months { get; set; }

    /// <summary>
    /// An explicit window, for the periods a rolling one cannot express — a
    /// financial year, a quarter already closed, the span of one campaign.
    /// When either end is set it takes precedence over <see cref="Months"/>,
    /// and either end may be left open.
    /// </summary>
    public DateOnly? FromDate { get; set; }
    public DateOnly? ToDate { get; set; }

    /// <summary>The window actually in force, resolved once for every query.</summary>
    public (DateOnly? From, DateOnly? To) Window()
    {
        if (FromDate is not null || ToDate is not null)
        {
            /* Tolerate a range entered back to front rather than silently
               returning nothing. */
            return FromDate is not null && ToDate is not null && FromDate > ToDate
                ? (ToDate, FromDate)
                : (FromDate, ToDate);
        }

        return Months is > 0
            ? (DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-Months.Value)), null)
            : (null, null);
    }
}

/// <summary>
/// One state on the dashboard map: how much of the programme reaches it.
/// States with no activity are still returned, with zeros, so the map can show
/// where there is no coverage — which is usually the more interesting question.
/// </summary>
public class StateCoverageDto
{
    /// <summary>LGD state code, which is how the map keys its regions.</summary>
    public int StateCode { get; set; }
    public string State { get; set; } = string.Empty;
    /// <summary>Distinct program types delivered in the state.</summary>
    public int ProgramTypes { get; set; }
    public int Programmes { get; set; }
    public int Participants { get; set; }
}

/// <summary>
/// One district, for when a single state is being looked at.
///
/// Districts are only ever returned for one state at a time. Returning all
/// seven hundred and sixty-odd on every dashboard load, for a table that shows
/// thirty-six rows, would be a great deal of work for nothing.
/// </summary>
public class DistrictCoverageDto
{
    public int DistrictCode { get; set; }
    public string District { get; set; } = string.Empty;

    /// <summary>
    /// The state it sits in. Carried on every row because district names are
    /// not unique across India — there is an Aurangabad in Bihar and another
    /// in Maharashtra — so a national list of districts alone is ambiguous.
    /// </summary>
    public string State { get; set; } = string.Empty;
    public int StateCode { get; set; }

    public int ProgramTypes { get; set; }
    public int Programmes { get; set; }
    public int Participants { get; set; }
}

public class StateCoverageResultDto
{
    public List<StateCoverageDto> States { get; set; } = [];

    /// <summary>
    /// The districts of the filtered state, when exactly one is filtered.
    /// Empty otherwise, which is how the table knows which level it is showing.
    /// </summary>
    public List<DistrictCoverageDto> Districts { get; set; } = [];

    /// <summary>The state those districts belong to, for the column heading.</summary>
    public string? DistrictsOf { get; set; }
    /// <summary>Highest value on each measure, so the map can scale its shading.</summary>
    public int MaxProgramTypes { get; set; }
    public int MaxParticipants { get; set; }
    public int TotalParticipants { get; set; }
    public int TotalProgrammes { get; set; }
    /// <summary>States with at least one programme.</summary>
    public int StatesCovered { get; set; }
}

/* ------------------------------------------------- qualified professionals */

/// <summary>
/// One person who has qualified, on one programme.
///
/// A row per qualification rather than per person: somebody who has passed an
/// assessor programme and a master trainer programme is qualified twice, and
/// collapsing that would hide one of them.
/// </summary>
public class QualifiedProfessionalDto
{
    public int ParticipantId { get; set; }
    public int ApplicantId { get; set; }

    /// <summary>The system generated applicant ID, never the email address.</summary>
    public string ApplicantCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Mobile { get; set; }

    public int CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public int SubCategoryId { get; set; }
    public string? SubCategoryName { get; set; }
    public int ProgramTypeId { get; set; }
    public string? ProgramTypeName { get; set; }

    public int ProgrammeId { get; set; }
    public string? ProgrammeCode { get; set; }
    public string? ProgrammeName { get; set; }

    public int? StateCode { get; set; }
    public string? StateName { get; set; }
    public int? DistrictCode { get; set; }
    public string? DistrictName { get; set; }

    public decimal? ExamScore { get; set; }
    public decimal AttendancePercent { get; set; }
    /// <summary>When the marks added up to a pass.</summary>
    public DateTime? QualifiedOn { get; set; }

    /* The certificate, where one has been issued. */

    /// <summary>
    /// The certificate row, so the screen can open or re-send it. Null where
    /// nothing has been issued, which is what "No certificate" is read from.
    /// </summary>
    public int? CertificateId { get; set; }

    /// <summary>Qualification or Participation.</summary>
    public string? CertificateKind { get; set; }

    public string? CertificateNumber { get; set; }
    public DateOnly? IssuedOn { get; set; }
    public DateOnly? ValidTill { get; set; }
    public DateTime? RevokedOn { get; set; }

    /// <summary>
    /// Where this qualification stands today: Valid, Expiring, Expired,
    /// Revoked, or NotIssued. Computed rather than stored, because Expiring
    /// and Expired are answers about today rather than facts about the record.
    /// </summary>
    public string Standing { get; set; } = "NotIssued";

    /// <summary>Days until expiry. Negative once it has passed, null for no expiry.</summary>
    public int? DaysToExpiry { get; set; }
}
