namespace Ntms.Domain.Common;

/// <summary>
/// Master records are never hard deleted; they are switched off so history and
/// downstream references stay intact.
/// </summary>
public enum RecordStatus
{
    Active = 1,
    Inactive = 2,
}

/// <summary>The base role decides default landing screens and data scope.</summary>
public enum BaseRole
{
    SuperAdmin = 1,
    Admin = 2,
    OperationManager = 3,
    Coordinator = 4,
    Applicant = 5,
    /// <summary>
    /// The Implementing Agency's own login. Sits below Operation Manager and
    /// exists so an agency can add its own coordinators within the program
    /// types and states the manager allocated to it.
    /// </summary>
    AgencyAdmin = 6,
    /// <summary>
    /// Ministry of MSME oversight. Sees the whole estate and changes none of
    /// it: the parent ministry needs assurance, not operational control.
    /// </summary>
    Ministry = 7,
}

public enum DeliveryMode
{
    Physical = 1,
    Virtual = 2,
    Hybrid = 3,
}

public enum AgencyType
{
    GovernmentBody = 1,
    IndustryAssociation = 2,
    AcademicInstitute = 3,
    PrivatePartner = 4,
}

public enum FieldType
{
    Text = 1,
    TextArea = 2,
    Number = 3,
    Email = 4,
    Mobile = 5,
    Pan = 6,
    Tan = 7,
    Gstin = 8,
    Ifsc = 9,
    Pincode = 10,
    Aadhaar = 11,
    Date = 12,
    Select = 13,
    MultiSelect = 14,
    Radio = 15,
    Checkbox = 16,
    File = 17,
}

public enum FeeComponentKind
{
    Base = 1,
    Exam = 2,
    Certification = 3,
    Material = 4,
    Other = 5,
}

public enum QuestionType
{
    SingleChoice = 1,
    MultipleChoice = 2,
    TrueFalse = 3,
    Descriptive = 4,
}

/// <summary>
/// Where one sitting of an online paper got to.
///
/// Expired is its own state rather than a submitted attempt with a flag: a
/// candidate whose time ran out did sit the paper, and what they had answered
/// by then is what they scored.
/// </summary>
public enum ExamAttemptStatus
{
    InProgress = 1,
    Submitted = 2,
    Expired = 3,
}

public enum DifficultyLevel
{
    Easy = 1,
    Moderate = 2,
    Hard = 3,
}

public enum MaterialKind
{
    Document = 1,
    Video = 2,
    Presentation = 3,
    Link = 4,
}

public enum KycStatus
{
    Pending = 1,
    Verified = 2,
    Rejected = 3,
}

public enum ApplicationStatus
{
    Draft = 1,
    Submitted = 2,
    UnderScrutiny = 3,
    Clarification = 4,
    Approved = 5,
    Rejected = 6,
    Enrolled = 7,
}

public enum PaymentStatus
{
    NotApplicable = 1,
    Pending = 2,
    Paid = 3,
    Failed = 4,
    Refunded = 5,
}

/// <summary>
/// Where one attempt to pay got to. Wider than <see cref="PaymentStatus"/>,
/// which answers for the application as a whole: an attempt can be in flight,
/// and the application is still simply unpaid while it is.
/// </summary>
public enum PaymentAttemptStatus
{
    /// <summary>Created here; the payer has not reached the gateway yet.</summary>
    Initiated = 1,

    /// <summary>At the gateway. Nothing is known until it answers.</summary>
    Processing = 2,

    Paid = 3,
    Failed = 4,

    /// <summary>The payer backed out at the gateway.</summary>
    Cancelled = 5,

    /// <summary>
    /// Started and never concluded. An attempt nobody finished must not sit
    /// as "in flight" forever, or a retry looks like a double payment.
    /// </summary>
    Abandoned = 6,
}

public enum ScrutinyAction
{
    Submitted = 1,
    Assigned = 2,
    Clarification = 3,
    Approved = 4,
    Rejected = 5,
    Enrolled = 6,
    Comment = 7,
}

public enum ProgramMode
{
    Physical = 1,
    Virtual = 2,
}

/// <summary>Lifecycle of a batch on the programmes register.</summary>
public enum ProgramStatus
{
    New = 1,
    PermissionAccepted = 2,
    CalendarCreated = 3,
    Conducted = 4,
    PermissionRejected = 5,
    QCRejected = 6,
    Postponed = 7,
}

public enum ParticipantResult
{
    Pending = 1,
    Pass = 2,
    Fail = 3,
}

/// <summary>
/// Reported by the applicant at sign-up. Nullable on the record: the question is
/// answered by the person, not inferred, so "not stated" has to stay expressible
/// rather than collapsing into one of the options.
/// </summary>
public enum Gender
{
    Male = 1,
    Female = 2,
    Other = 3,
}

/// <summary>
/// The social category the applicant reports, used for the scheme's reporting
/// obligation on reach into reserved categories. Self-declared, same as
/// <see cref="Gender"/>, so null means unanswered and not "General".
/// </summary>
public enum SocialCategory
{
    General = 1,
    OBC = 2,
    SC = 3,
    ST = 4,
}

/// <summary>
/// What a monitoring photograph shows. Drives which owner key is set on the
/// row and which folder the file lands in.
/// </summary>
public enum MonitoringPhotoKind
{
    VenueExterior = 1,
    VenueInterior = 2,
    Session = 3,
    Participant = 4,
    AttendanceSheet = 5,
}

/// <summary>
/// What a programme awards at the end of it.
///
/// The distinction matters because the two documents say different things: a
/// certification attests that someone met the standard, a participation
/// certificate only that they attended. A programme may award neither, either,
/// or both — where "both" means the outcome decides which one a candidate gets.
/// </summary>
public enum CertificationPolicy
{
    /// <summary>Nothing is awarded.</summary>
    None = 1,

    /// <summary>Everyone who attends gets a participation certificate.</summary>
    ParticipationOnly = 2,

    /// <summary>Only those who qualify are certified; the rest get nothing.</summary>
    QualificationOnly = 3,

    /// <summary>
    /// Those who qualify are certified; those who do not still get a
    /// participation certificate for attending.
    /// </summary>
    QualificationAndParticipation = 4,
}

/// <summary>Which of the two documents a stored template produces.</summary>
public enum CertificateKind
{
    Qualification = 1,
    Participation = 2,
}

/// <summary>
/// How a programme type decides whether a candidate has passed.
///
/// Both is a separate value rather than a pair of flags, so an impossible
/// state - neither, while still examining - cannot be written down.
/// </summary>
public enum ExaminationKind
{
    None = 1,
    Written = 2,
    VivaPractical = 3,
    WrittenAndViva = 4,
}
