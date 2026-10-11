namespace Ntms.Application.Contracts;

/// <summary>
/// Contracts used only by the mobile applicant app. Applicants sign in with the
/// generated applicant ID; the e-mail is editable profile data.
/// </summary>
public class ApplicantLoginRequestDto
{
    public string ApplicantCode { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class ApplicantLoginResponseDto
{
    public string Token { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public int ExpiresInSeconds { get; set; }
    public ApplicantDto Applicant { get; set; } = new();
}

/// <summary>
/// What an applicant may change about themselves from the app.
///
/// No e-mail. A new address has to be proven before it is trusted, so it
/// moves through its own pair of endpoints and a code; this one is for the
/// things that need no proof.
/// </summary>
public class ApplicantProfileUpdateDto
{
    public string Mobile { get; set; } = string.Empty;
    /* Correctable by the applicant: it was their own declaration to begin with. */
    public string? Gender { get; set; }
    public string? SocialCategory { get; set; }
    public int? StateCode { get; set; }
    public int? DistrictCode { get; set; }
    public string? City { get; set; }
}

/// <summary>The address an applicant wants to move their account to.</summary>
public class EmailChangeRequestDto
{
    public string Email { get; set; } = string.Empty;
}

/// <summary>The code that proves they can read it.</summary>
public class EmailChangeConfirmDto
{
    public string Code { get; set; } = string.Empty;
}

/// <summary>A programme as the applicant sees it on the home screen.</summary>
public class ApplicantProgramDto
{
    public int ProgramTypeId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ShortDescription { get; set; }
    public string? CategoryName { get; set; }
    public string? SubCategoryName { get; set; }
    public int DurationDays { get; set; }
    public string DeliveryMode { get; set; } = "Physical";
    public string? MinQualification { get; set; }
    /// <summary>Display text; the mobile app shows this, not the code.</summary>
    public string? MinQualificationLabel { get; set; }
    public int MinExperienceYears { get; set; }
    public bool IsExamMandatory { get; set; }
    public decimal FeePayable { get; set; }
    public List<int> TdsOptions { get; set; } = [];
    /// <summary>
    /// False when the track cannot be applied to yet: it wants a registration
    /// form and none is published.
    /// </summary>
    public bool AcceptingApplications { get; set; }

    /// <summary>
    /// Whether applying means filling in a form. False and the app submits
    /// straight away — there is nothing to ask.
    /// </summary>
    public bool RequiresProfileForm { get; set; } = true;

    /// <summary>
    /// Shut to this applicant, and why.
    ///
    /// Three ways in: they passed it, so there is nothing left to gain;
    /// they sat it and the track certifies nobody, so again nothing left;
    /// or they failed it as many times as System Settings allows.
    /// </summary>
    public bool Closed { get; set; }
    public string? ClosedReason { get; set; }

    /// <summary>Tries used and allowed, so the app can warn on the last one.</summary>
    public int AttemptsUsed { get; set; }
    public int AttemptsAllowed { get; set; }
    /* What this applicant has already done about this track.

       Enough to answer "where is my application" without a second call: the
       card shows the standing and the popup behind it shows the rest. */

    /// <summary>Set when this applicant has already applied for the track.</summary>
    public string? ExistingApplicationStatus { get; set; }

    public int? ExistingApplicationId { get; set; }
    public string? ExistingApplicationNo { get; set; }
    public DateTime? ExistingSubmittedOn { get; set; }

    /// <summary>Why the last one was turned down, where it was.</summary>
    public string? ExistingRejectionReason { get; set; }

    /// <summary>
    /// Whether the Apply button should be there at all.
    ///
    /// Not the same as <see cref="AcceptingApplications"/>: a track can be
    /// open while this applicant already has one in flight. A rejected
    /// application does not stand in the way — they are allowed to fix what
    /// was wrong and try again — so this stays true after a rejection.
    /// </summary>
    public bool CanApply { get; set; }
}

/// <summary>A batch the applicant is enrolled in.</summary>
public class ApplicantEnrolmentDto
{
    /// <summary>
    /// The enrolment's own id, which the exam endpoints are scoped by. Not the
    /// applicant's and not the batch's: one person on one batch.
    /// </summary>
    public int ParticipantId { get; set; }

    /// <summary>
    /// The application the seat hangs off, so an unpaid registration has
    /// something to pay against.
    /// </summary>
    public int ApplicationId { get; set; }

    /// <summary>
    /// False while the fee is outstanding: they have registered, but the
    /// seat is not theirs until the money arrives. Everything about the
    /// batch is still worth showing them - it is the programme they chose.
    /// </summary>
    public bool SeatTaken { get; set; } = true;

    /// <summary>What is owed, and where the payment stands. Only on an unpaid one.</summary>
    public decimal AmountDue { get; set; }
    public string? PaymentStatus { get; set; }

    public string ProgrammeId { get; set; } = string.Empty;
    public string ProgrammeName { get; set; } = string.Empty;
    public string? AgencyName { get; set; }
    public string Mode { get; set; } = "Physical";
    public string Venue { get; set; } = string.Empty;
    public string? State { get; set; }
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string? MeetingLink { get; set; }
    public DateTime? ExamDateTime { get; set; }
    public string Status { get; set; } = "New";
    public decimal AttendancePercent { get; set; }
    public decimal? ExamScore { get; set; }
    public string Result { get; set; } = "Pending";
    public string? CertificateNo { get; set; }
}

/* ------------------------------------------------------- password recovery */

/// <summary>
/// Either identifier is accepted, because somebody who has lost their
/// password has usually lost the e-mail carrying their applicant ID too.
/// </summary>
public class ApplicantForgotPasswordDto
{
    public string Identifier { get; set; } = string.Empty;
}

/// <summary>
/// What the app shows after asking. Deliberately the same shape whether or
/// not the account exists: the masked address is filled only when it does,
/// and the wording does not change either way.
/// </summary>
public class ApplicantForgotPasswordResultDto
{
    public string Message { get; set; } = string.Empty;
    public int ValidityMinutes { get; set; }

    /// <summary>
    /// The address the code went to, masked — as far as the confirmation
    /// screen may go. Enough for the holder to recognise their own mailbox,
    /// not enough for anybody else to learn it.
    /// </summary>
    public string? MaskedEmail { get; set; }

    /// <summary>Seconds before another code can be asked for.</summary>
    public int ResendAfterSeconds { get; set; }
}

public class ApplicantResetPasswordDto
{
    public string Identifier { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}
