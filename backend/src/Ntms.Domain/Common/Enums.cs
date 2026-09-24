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
