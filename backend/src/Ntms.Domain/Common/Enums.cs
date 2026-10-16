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

    /// <summary>
    /// Pictures taken with the camera, up to a limit the form sets.
    ///
    /// Distinct from File: a file is chosen from the device and could be
    /// anything from anywhere, while these are taken at the time. They are
    /// served back merged into one PDF, because a reader wants the document
    /// the pages add up to, not five separate images.
    /// </summary>
    Photos = 18,

    /// <summary>
    /// A span of time: two dates, and the length between them.
    ///
    /// Asked as one question because it is one fact. "How long did you
    /// work there" answered on its own is somebody's arithmetic, done
    /// from memory, and two people doing it from the same two dates will
    /// not always agree; asked as the dates, the answer carries what it
    /// was worked out from. The length is calculated as the dates are
    /// picked rather than typed, so nobody can disagree with it.
    ///
    /// The answer is an object - from, to, and the months between them -
    /// where the other types store a string. A reader that expects one
    /// shows nothing for it rather than something wrong.
    /// </summary>
    Duration = 19,

    /// <summary>
    /// A State or Union Territory, chosen from the LGD master.
    ///
    /// Not a Select with the states typed into it. The list is a national
    /// master that the rest of the system already keys off - an agency's
    /// empanelment, a batch's venue, a coordinator's districts - and a
    /// form that carried its own copy would drift from all of them the
    /// first time a state was renamed. The answer stored is the LGD code,
    /// so it means the same thing as every other state on the record.
    /// </summary>
    State = 20,

    /// <summary>
    /// A district of whichever State was answered above it.
    ///
    /// Follows the nearest State field before it in the same section -
    /// and, in a repeating section, in the same entry - because that is
    /// how an address is laid out and asking the designer to wire the two
    /// together would be asking them to say twice what the order already
    /// says. The answer stored is the LGD district code.
    /// </summary>
    District = 21,
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

    /// <summary>
    /// The candidate left the app while the paper was open.
    ///
    /// An online paper is only worth as much as the supervision around it,
    /// and the one thing a phone can tell us is whether the candidate was
    /// still looking at it. A sitting that was left is closed on what it
    /// had, and the next one starts at question one with a fresh clock.
    /// </summary>
    Abandoned = 4,
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

/// <summary>
/// Where an applicant's profile submission stands.
///
/// Deliberately shorter than ApplicationStatus: a profile is accepted or it
/// is not, and there is no enrolment at the end of it.
/// </summary>
/// <summary>
/// What a profile field means, beyond being a question.
///
/// A program type states a minimum qualification and a minimum experience,
/// but what the applicant has is answered in a field whose key an
/// administrator chose. Rather than guess at names — and silently hide
/// programs when the guess is wrong — the designer says which field holds
/// which, and only a field that has been pointed at is ever read this way.
/// </summary>
public enum ProfileFieldRole
{
    /// <summary>An ordinary question. The default, and almost everything.</summary>
    None = 1,

    /// <summary>Holds the applicant's highest qualification, as a catalogue code.</summary>
    Qualification = 2,

    /// <summary>Holds their years of experience, as a number.</summary>
    ExperienceYears = 3,

    /// <summary>
    /// Holds the enterprise or employer the applicant answers for.
    ///
    /// Printed on a programme's participants register, where the question
    /// being asked of a row is which firm sent this person. Which field
    /// that is differs by discipline, which is why it is pointed at
    /// rather than guessed from a name.
    /// </summary>
    Organisation = 4,

    /// <summary>
    /// Holds their Udyam registration — or the UAM, EM-2 or SSI number
    /// that preceded it, which is the same column on a register and the
    /// same question with a different answer depending on when the
    /// enterprise registered.
    /// </summary>
    UdyamNumber = 5,
}

public enum ProfileSubmissionStatus
{
    Draft = 1,
    Submitted = 2,
    UnderScrutiny = 3,
    Approved = 4,
    Rejected = 5,
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

/// <summary>
/// How a batch is delivered.
///
/// Hybrid is both at once rather than a third thing: the room is real and
/// so is the meeting link, and people attend through whichever suits them.
/// It therefore carries a venue and a joining link together, which is what
/// distinguishes it from the other two.
/// </summary>
/// <summary>What a feedback question asks for.</summary>
public enum FeedbackQuestionType
{
    /// <summary>A score out of the question's own maximum, five by default.</summary>
    Rating = 1,

    /// <summary>Whatever they want to say.</summary>
    Text = 2,

    /// <summary>One of a list, shown as a dropdown.</summary>
    Select = 3,

    /// <summary>One of a list, shown as buttons. The same data, fewer taps.</summary>
    Radio = 4,

    YesNo = 5,
}

public enum ProgramMode
{
    Physical = 1,
    Virtual = 2,
    Hybrid = 3,
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

/// <summary>
/// How a trainer is engaged on a programme.
///
/// Asked because the scheme reports on it: a panel carried by full-time
/// faculty and one assembled from part-time consultants are different
/// things to fund and to assure, and the distinction is not recoverable
/// from anything else on the record.
/// </summary>
public enum TrainerEngagement
{
    FullTime = 1,
    PartTime = 2,
}

/// <summary>
/// Where a conducted programme's report stands with quality control.
///
/// The coordinator closes the programme from the app, which seals the
/// record and hands it to the agency that raised the batch. The agency
/// reads it and forwards it to the Operation Manager, who accepts it —
/// at which point the programme is conducted and the report is
/// readable — or sends it back.
///
/// The agency sits in the middle on purpose: it is answerable for what
/// its coordinator handed in, and a report that goes straight from a
/// phone to the scheme's manager is one nobody at the agency has read.
/// </summary>
public enum QcStatus
{
    /// <summary>Submitted by the coordinator, waiting on the manager.</summary>
    Pending = 1,

    /// <summary>Read and accepted. The report can be opened from Reports.</summary>
    Approved = 2,

    /// <summary>Sent back with a reason. The batch is marked QC rejected.</summary>
    Rejected = 3,

    /// <summary>
    /// Sealed by the coordinator and waiting on the implementing
    /// agency to forward it, or send it back.
    ///
    /// Stored as its name like every other enum here, so adding it
    /// changes nothing already written: the submissions that exist are
    /// Pending, Approved or Rejected and stay that way.
    /// </summary>
    AwaitingAgency = 4,
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
    /// <summary>The trainer themselves, photographed on the day.</summary>
    TrainerPhoto = 6,
    /// <summary>Whatever identity document the trainer produced.</summary>
    TrainerIdProof = 7,
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
/// <summary>
/// Which direction a reason on the access list is for.
///
/// One list rather than two tables: blocking and unblocking are two sides of
/// the same decision about the same account, and an administrator managing
/// them wants them side by side. That is not true of the rejection reasons,
/// which are about an application rather than a person.
/// </summary>
public enum AccessReasonKind
{
    Block = 1,
    Unblock = 2,
}

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
