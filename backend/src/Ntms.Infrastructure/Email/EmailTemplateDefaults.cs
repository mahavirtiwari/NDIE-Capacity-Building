using Ntms.Domain.Entities;

namespace Ntms.Infrastructure.Email;

/// <summary>
/// The shipped wording for every transactional message. These seed the
/// editable copies in the database, and remain the fallback if a row is ever
/// missing, so the system can always send.
///
/// Bodies hold only the message itself; the branded frame around it is applied
/// at send time from the portal's branding settings.
/// </summary>
public static class EmailTemplateDefaults
{
    public const string Otp = "otp";
    public const string ApplicantWelcome = "applicant-welcome";
    public const string ApplicantCredentials = "applicant-credentials";
    public const string PortalCredentials = "portal-credentials";
    public const string AdminCredentials = "admin-credentials";
    public const string MinistryCredentials = "ministry-credentials";
    public const string OpsManagerCredentials = "ops-manager-credentials";
    public const string AgencyCredentials = "agency-credentials";
    public const string CoordinatorCredentials = "coordinator-credentials";

    /// <summary>
    /// The credentials template for each tier, so the wording can be tuned to
    /// the audience without touching code. Anything not listed falls back to
    /// the generic portal template.
    /// </summary>
    public static string CredentialsKeyFor(Domain.Common.BaseRole role) => role switch
    {
        Domain.Common.BaseRole.Admin => AdminCredentials,
        Domain.Common.BaseRole.Ministry => MinistryCredentials,
        Domain.Common.BaseRole.OperationManager => OpsManagerCredentials,
        Domain.Common.BaseRole.AgencyAdmin => AgencyCredentials,
        Domain.Common.BaseRole.Coordinator => CoordinatorCredentials,
        _ => PortalCredentials,
    };
    public const string PasswordReset = "password-reset";
    public const string PasswordChanged = "password-changed";
    public const string ApplicationSubmitted = "application-submitted";
    public const string ScrutinyOutcome = "scrutiny-outcome";
    public const string ProgrammeSchedule = "programme-schedule";
    public const string ProgrammeRaised = "programme-raised";
    public const string PostponementRequested = "postponement-requested";
    public const string AgencyEmpanelled = "agency-empanelled";
    public const string AccountStatusChanged = "account-status-changed";
    public const string AccountUpdated = "account-updated";
    public const string CertificateIssued = "certificate-issued";
    public const string ApplicantAccessChanged = "applicant-access-changed";

    /// <summary>
    /// Messages that carry a credential or a one-time code. The editor keeps
    /// these switched on: turning one off would lock people out silently.
    /// </summary>
    public static readonly IReadOnlySet<string> AlwaysOn = new HashSet<string>
    {
        Otp, ApplicantCredentials, PortalCredentials, PasswordReset, PasswordChanged,
        AdminCredentials, MinistryCredentials, OpsManagerCredentials,
        AgencyCredentials, CoordinatorCredentials,
    };

    public static readonly IReadOnlyList<EmailTemplate> All =
    [
        new()
        {
            Key = Otp,
            Name = "Email verification code",
            Description = "Sent when an applicant asks to verify their email address.",
            Placeholders = "name,code,validityMinutes",
            Subject = "{{code}} is your verification code",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>Use the code below to verify your email address.</p>
                <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0;">{{code}}</p>
                <p>The code is valid for {{validityMinutes}} minutes and can be used once.</p>
                """,
            PlainTextBody = "Your verification code is {{code}}. It is valid for {{validityMinutes}} minutes.",
        },
        new()
        {
            Key = ApplicantWelcome,
            Name = "Applicant registered",
            Description = "Confirms a registration and states the applicant ID.",
            Placeholders = "name,applicantCode,email",
            Subject = "Your applicant ID is {{applicantCode}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>Your registration has been received.</p>
                <table style="margin:18px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Applicant ID</td><td style="font-weight:700;">{{applicantCode}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Email</td><td>{{email}}</td></tr>
                </table>
                <p>Verify your email address to finish setting up the account. Always sign in with
                   the applicant ID above, not with your email address.</p>
                """,
            PlainTextBody = "Your applicant ID is {{applicantCode}}. Verify your email to continue.",
        },
        new()
        {
            Key = ApplicantCredentials,
            Name = "Applicant sign-in details",
            Description = "Issues the first password once the email is verified.",
            Placeholders = "name,applicantCode,password",
            Subject = "Sign-in details for {{applicantCode}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>Your email address has been verified and your account is ready.</p>
                <table style="margin:18px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Applicant ID</td><td style="font-weight:700;">{{applicantCode}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Password</td><td style="font-weight:700;">{{password}}</td></tr>
                </table>
                <p>Sign in with the applicant ID, not with your email address. Change the password
                   from your profile once you are in.</p>
                """,
            PlainTextBody =
                "Applicant ID: {{applicantCode}}. Password: {{password}}. Sign in with the applicant ID.",
        },
        new()
        {
            Key = PortalCredentials,
            Name = "Portal user credentials",
            Description = "Sent when an admin creates a portal user or resets their password.",
            Placeholders = "name,userCode,temporaryPassword",
            Subject = "Your portal user ID is {{userCode}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>An account has been created for you on the portal.</p>
                <table style="margin:18px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">User ID</td><td style="font-weight:700;">{{userCode}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Temporary password</td><td style="font-weight:700;">{{temporaryPassword}}</td></tr>
                </table>
                <p>You will be asked to change the password the first time you sign in. Always sign
                   in with the user ID above, not with your email address.</p>
                """,
            PlainTextBody =
                "User ID: {{userCode}}. Temporary password: {{temporaryPassword}}. Change it at first sign-in.",
        },
        new()
        {
            Key = AdminCredentials,
            Name = "Admin credentials",
            Description = "Sent when the Super Admin creates an Admin account.",
            Placeholders = "name,userCode,temporaryPassword,roleName,scopeSummary",
            Subject = "Your Admin account — user ID {{userCode}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>You have been appointed as an Admin on the portal by the Super Admin.</p>
                <table style="margin:18px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">User ID</td><td style="font-weight:700;">{{userCode}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Temporary password</td><td style="font-weight:700;">{{temporaryPassword}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Role</td><td>{{roleName}}</td></tr>
                </table>
                <p><strong>Your allocation:</strong> {{scopeSummary}}</p>
                <p>As an Admin you create and oversee Operation Managers within your allocated categories, sub-categories and states.</p>
                <p>You will be asked to change the password the first time you sign in. Always sign
                   in with the user ID above, never with your email address.</p>
                """,
            PlainTextBody =
                "User ID: {{userCode}}. Temporary password: {{temporaryPassword}}. "
                + "Role: {{roleName}}. Allocation: {{scopeSummary}}. Change the password at first sign-in.",
        },
        new()
        {
            Key = MinistryCredentials,
            Name = "Ministry of MSME credentials",
            Description = "Sent when the Super Admin creates the Ministry oversight account.",
            Placeholders = "name,userCode,temporaryPassword,roleName,scopeSummary",
            Subject = "Your Ministry of MSME account — user ID {{userCode}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>An oversight account has been created for the Ministry of MSME.</p>
                <table style="margin:18px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">User ID</td><td style="font-weight:700;">{{userCode}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Temporary password</td><td style="font-weight:700;">{{temporaryPassword}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Role</td><td>{{roleName}}</td></tr>
                </table>
                <p><strong>Your allocation:</strong> {{scopeSummary}}</p>
                <p>This account has read access across the whole program — dashboards, applications, programs, agencies and reports. It is deliberately view-only: nothing can be created, altered or removed with it.</p>
                <p>You will be asked to change the password the first time you sign in. Always sign
                   in with the user ID above, never with your email address.</p>
                """,
            PlainTextBody =
                "User ID: {{userCode}}. Temporary password: {{temporaryPassword}}. "
                + "Role: {{roleName}}. Allocation: {{scopeSummary}}. Change the password at first sign-in.",
        },
        new()
        {
            Key = OpsManagerCredentials,
            Name = "Operation Manager credentials",
            Description = "Sent when an Admin creates an Operation Manager account.",
            Placeholders = "name,userCode,temporaryPassword,roleName,scopeSummary",
            Subject = "Your Operation Manager account — user ID {{userCode}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>You have been appointed as an Operation Manager on the portal.</p>
                <table style="margin:18px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">User ID</td><td style="font-weight:700;">{{userCode}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Temporary password</td><td style="font-weight:700;">{{temporaryPassword}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Role</td><td>{{roleName}}</td></tr>
                </table>
                <p><strong>Your allocation:</strong> {{scopeSummary}}</p>
                <p>You empanel Implementing Agencies within your allocated program types and states, and oversee the programs they run.</p>
                <p>You will be asked to change the password the first time you sign in. Always sign
                   in with the user ID above, never with your email address.</p>
                """,
            PlainTextBody =
                "User ID: {{userCode}}. Temporary password: {{temporaryPassword}}. "
                + "Role: {{roleName}}. Allocation: {{scopeSummary}}. Change the password at first sign-in.",
        },
        new()
        {
            Key = AgencyCredentials,
            Name = "Implementing Agency credentials",
            Description = "Sent when an Operation Manager empanels an agency and issues its login.",
            Placeholders = "name,userCode,temporaryPassword,roleName,scopeSummary",
            Subject = "Your Implementing Agency account — user ID {{userCode}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>Your organisation has been empanelled as an Implementing Agency, and this is its portal login.</p>
                <table style="margin:18px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">User ID</td><td style="font-weight:700;">{{userCode}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Temporary password</td><td style="font-weight:700;">{{temporaryPassword}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Role</td><td>{{roleName}}</td></tr>
                </table>
                <p><strong>Your allocation:</strong> {{scopeSummary}}</p>
                <p>Use it to add your own coordinators for the program types, states and districts allocated to you, and to run and record training programs.</p>
                <p>You will be asked to change the password the first time you sign in. Always sign
                   in with the user ID above, never with your email address.</p>
                """,
            PlainTextBody =
                "User ID: {{userCode}}. Temporary password: {{temporaryPassword}}. "
                + "Role: {{roleName}}. Allocation: {{scopeSummary}}. Change the password at first sign-in.",
        },
        new()
        {
            Key = CoordinatorCredentials,
            Name = "Coordinator credentials",
            Description = "Sent when an Implementing Agency creates a coordinator account.",
            Placeholders = "name,userCode,temporaryPassword,roleName,scopeSummary",
            Subject = "Your Coordinator account — user ID {{userCode}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>You have been added as a Coordinator by your Implementing Agency.</p>
                <table style="margin:18px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">User ID</td><td style="font-weight:700;">{{userCode}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Temporary password</td><td style="font-weight:700;">{{temporaryPassword}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Role</td><td>{{roleName}}</td></tr>
                </table>
                <p><strong>Your allocation:</strong> {{scopeSummary}}</p>
                <p>You record programs conducted in person or online and mark attendance, for the program types and districts allocated to you.</p>
                <p>You will be asked to change the password the first time you sign in. Always sign
                   in with the user ID above, never with your email address.</p>
                """,
            PlainTextBody =
                "User ID: {{userCode}}. Temporary password: {{temporaryPassword}}. "
                + "Role: {{roleName}}. Allocation: {{scopeSummary}}. Change the password at first sign-in.",
        },
        new()
        {
            Key = PasswordReset,
            Name = "Password reset code",
            Description = "Sent when a portal user asks to reset their own password.",
            Placeholders = "name,userCode,code,validityMinutes",
            Subject = "Password reset code for {{userCode}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>Use the code below to set a new password for user ID <strong>{{userCode}}</strong>.</p>
                <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:20px 0;">{{code}}</p>
                <p>The code is valid for {{validityMinutes}} minutes and can be used once.</p>
                <p>If you did not ask for this, ignore this message — your current password still
                   works and nothing has changed.</p>
                """,
            PlainTextBody =
                "Password reset code for {{userCode}}: {{code}}. Valid for {{validityMinutes}} minutes.",
        },
        new()
        {
            Key = PasswordChanged,
            Name = "Password changed",
            Description =
                "Confirms that a password was changed, so an unauthorised reset is noticed.",
            Placeholders = "name,userCode,changedOn,method",
            Subject = "Your password was changed",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>The password for user ID <strong>{{userCode}}</strong> was changed on
                   {{changedOn}} ({{method}}).</p>
                <p>You have been signed out everywhere, so please sign in again with the new
                   password.</p>
                <p><strong>If this was not you</strong>, contact the portal administrator at once —
                   someone else may have access to your account.</p>
                """,
            PlainTextBody =
                "The password for {{userCode}} was changed on {{changedOn}} ({{method}}). "
                + "If this was not you, contact the portal administrator at once.",
        },
        new()
        {
            Key = ApplicationSubmitted,
            Name = "Application received",
            Description = "Acknowledges an application submitted from the mobile app.",
            Placeholders = "name,applicationNo,programme",
            Subject = "Application {{applicationNo}} received",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>Your application has been received and is queued for scrutiny.</p>
                <table style="margin:18px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Application no.</td><td style="font-weight:700;">{{applicationNo}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Program</td><td>{{programme}}</td></tr>
                </table>
                <p>You will be notified as soon as a decision is recorded.</p>
                """,
            PlainTextBody = "Application {{applicationNo}} for {{programme}} has been received.",
        },
        new()
        {
            Key = ScrutinyOutcome,
            Name = "Scrutiny outcome",
            Description = "Tells an applicant the result of scrutiny, with any remarks.",
            Placeholders = "name,applicationNo,outcome,remarks",
            Subject = "Application {{applicationNo}}: {{outcome}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>Application <strong>{{applicationNo}}</strong> has been
                   <strong>{{outcome}}</strong>.</p>
                <p>{{remarks}}</p>
                """,
            PlainTextBody = "Application {{applicationNo}}: {{outcome}}. {{remarks}}",
        },
        new()
        {
            Key = ApplicantAccessChanged,
            Name = "Applicant blocked or unblocked",
            Description =
                "Tells an applicant their account was blocked or let back in, and on what "
                + "grounds.",
            Placeholders = "name,applicantCode,outcome,reason,remarks",
            Subject = "Your applicant account has been {{outcome}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>Your applicant account <strong>{{applicantCode}}</strong> has been
                   <strong>{{outcome}}</strong>.</p>
                <p><strong>Reason:</strong> {{reason}}</p>
                <p>{{remarks}}</p>
                <p>If you believe this is a mistake, reply to this message.</p>
                """,
            PlainTextBody =
                "Your applicant account {{applicantCode}} has been {{outcome}}. "
                + "Reason: {{reason}}. {{remarks}}",
        },
        new()
        {
            Key = CertificateIssued,
            Name = "Certificate issued",
            Description =
                "Sends the holder their certificate details and where to verify it. "
                + "Also used by the Re-send button.",
            Placeholders = "name,certificateNumber,kind,programme,issuedOn,validTill,verifyUrl",
            Subject = "Your {{kind}} certificate {{certificateNumber}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>Your <strong>{{kind}}</strong> certificate for
                   <strong>{{programme}}</strong> has been issued.</p>
                <table cellpadding="4">
                  <tr><td>Certificate number</td><td><strong>{{certificateNumber}}</strong></td></tr>
                  <tr><td>Issued on</td><td>{{issuedOn}}</td></tr>
                  <tr><td>Valid till</td><td>{{validTill}}</td></tr>
                </table>
                <p>Anybody can confirm it is genuine at
                   <a href="{{verifyUrl}}">{{verifyUrl}}</a>.</p>
                """,
            PlainTextBody =
                "Your {{kind}} certificate {{certificateNumber}} for {{programme}} was issued "
                + "on {{issuedOn}} and is valid till {{validTill}}. Verify it at {{verifyUrl}}.",
        },
        new()
        {
            Key = AccountStatusChanged,
            Name = "Account enabled or disabled",
            Description =
                "Tells the account holder that their access was switched on or off, and why.",
            Placeholders = "name,userCode,state,reason,by,on",
            Subject = "Your {{userCode}} account has been {{state}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>Your account <strong>{{userCode}}</strong> has been
                   <strong>{{state}}</strong>.</p>
                <table style="margin:18px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Reason</td><td>{{reason}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">By</td><td>{{by}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">On</td><td>{{on}}</td></tr>
                </table>
                <p>If this is not what you expected, reply to this message.</p>
                """,
            PlainTextBody =
                "Your account {{userCode}} has been {{state}} on {{on}} by {{by}}. Reason: {{reason}}",
        },
        new()
        {
            Key = AccountUpdated,
            Name = "Account details changed",
            Description = "Tells the account holder that their details or allocation were changed.",
            Placeholders = "name,userCode,on",
            Subject = "Your {{userCode}} account details were updated",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>The details on your account <strong>{{userCode}}</strong> were updated on
                   {{on}}. Your sign-in details have not changed.</p>
                <p>If you did not expect this, reply to this message.</p>
                """,
            PlainTextBody =
                "Your account {{userCode}} was updated on {{on}}. Your sign-in details are unchanged.",
        },
        new()
        {
            Key = AgencyEmpanelled,
            Name = "Agency empanelled",
            Description = "Sent to an implementing agency when it is added to the panel.",
            Placeholders = "agencyName,agencyCode,contactPerson,empanelledOn,validTill,scope",
            Subject = "{{agencyName}} is empanelled — {{agencyCode}}",
            HtmlBody = """
                <p>Dear {{contactPerson}},</p>
                <p><strong>{{agencyName}}</strong> has been empanelled as an implementing agency.</p>
                <table style="margin:18px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Agency code</td><td style="font-weight:700;">{{agencyCode}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Empanelled on</td><td>{{empanelledOn}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Valid till</td><td>{{validTill}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Empanelled for</td><td>{{scope}}</td></tr>
                </table>
                <p>Quote the agency code above in any correspondence. Sign-in details for the
                   portal, where issued, arrive in a separate message.</p>
                """,
            PlainTextBody =
                "{{agencyName}} ({{agencyCode}}) is empanelled from {{empanelledOn}}. Scope: {{scope}}.",
        },
        new()
        {
            Key = ProgrammeRaised,
            Name = "Program awaiting permission",
            Description =
                "Sent to the operation manager when an implementing agency raises a batch.",
            Placeholders = "name,agencyName,programmeName,programmeId,startDate,endDate,venue,state",
            Subject = "{{programmeId}} is waiting for your permission",
            HtmlBody =
                "<p>Dear {{name}},</p>"
                + "<p>{{agencyName}} has raised a batch, and it is waiting for your "
                + "permission.</p>"
                + "<p><strong>{{programmeName}}</strong> ({{programmeId}})<br />"
                + "{{startDate}} to {{endDate}}<br />{{venue}}, {{state}}</p>"
                + "<p>It does not open for registration until you permit it.</p>",
            PlainTextBody =
                "{{agencyName}} has raised {{programmeId}} ({{programmeName}}), "
                + "{{startDate}} to {{endDate}} at {{venue}}, {{state}}. "
                + "It is waiting for your permission.",
        },
        new()
        {
            Key = PostponementRequested,
            Name = "Postponement asked for",
            Description =
                "Sent to the operation manager when an agency asks for a batch to be put off.",
            Placeholders = "name,agencyName,programmeName,programmeId,startDate,reason",
            Subject = "{{agencyName}} has asked to postpone {{programmeId}}",
            HtmlBody =
                "<p>Dear {{name}},</p>"
                + "<p>{{agencyName}} has asked for a batch to be put off.</p>"
                + "<p><strong>{{programmeName}}</strong> ({{programmeId}}), due to start "
                + "{{startDate}}.</p>"
                + "<p>Their reason:</p><blockquote>{{reason}}</blockquote>"
                + "<p>The batch stands until you postpone it.</p>",
            PlainTextBody =
                "{{agencyName}} has asked to postpone {{programmeId}} ({{programmeName}}), "
                + "due to start {{startDate}}. Reason: {{reason}}",
        },
        new()
        {
            Key = ProgrammeSchedule,
            Name = "Program schedule",
            Description = "Sent to a participant when a batch is scheduled.",
            Placeholders =
                "name,programmeName,programmeId,startDate,endDate,timing,mode,venue,"
                + "agencyName,coordinatorName,coordinatorMobile,coordinatorEmail,meetingLink",
            Subject = "{{programmeName}} — {{startDate}}",
            HtmlBody = """
                <p>Dear {{name}},</p>
                <p>You are registered for <strong>{{programmeName}}</strong> ({{programmeId}}).</p>
                <table style="margin:18px 0;border-collapse:collapse;">
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Dates</td><td>{{startDate}} to {{endDate}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Timing</td><td>{{timing}} each day</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Mode</td><td>{{mode}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Venue</td><td>{{venue}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Conducted by</td><td>{{agencyName}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Coordinator</td><td>{{coordinatorName}}</td></tr>
                  <tr><td style="padding:4px 16px 4px 0;color:#7a716f;">Contact</td><td>{{coordinatorMobile}} · {{coordinatorEmail}}</td></tr>
                </table>
                <p>{{meetingLink}}</p>
                <p>The session plan is attached as a PDF — the sessions, their timings and the
                topics covered. Please keep it with you for the program.</p>
                """,
            PlainTextBody =
                "{{programmeName}} ({{programmeId}}), {{startDate}} to {{endDate}}, "
                + "{{timing}} each day, {{venue}}. Coordinator {{coordinatorName}}, "
                + "{{coordinatorMobile}}, {{coordinatorEmail}}. The session plan is attached.",
        },
    ];
}
