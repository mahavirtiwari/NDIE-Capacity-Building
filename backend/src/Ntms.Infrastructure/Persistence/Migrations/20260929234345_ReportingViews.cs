using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Read-only views for reporting and for whatever MIS or BI tool is
    /// pointed at this database.
    ///
    /// Views rather than stored procedures, and read rather than write. The
    /// application does not use these — every one of its queries is still EF
    /// Core, parameterised, and unchanged by this migration — so nothing here
    /// can break the system. What they give is a stable, documented shape for
    /// somebody outside it to query, one that survives a table being
    /// reorganised underneath, and a set of database objects a DBA review can
    /// actually look at.
    ///
    /// Nothing sensitive is exposed: no password hash, no gateway key, no
    /// token. A PAN is included because a scheme's own reporting is entitled
    /// to it, and access to these views is a database grant like any other.
    /// </summary>
    public partial class ReportingViews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* One registration, with the names behind every code on it. */
            /* EXEC, because CREATE VIEW has to be the first statement in its
               batch and an idempotent script wraps every operation in an IF
               block. Inside EXEC the view is its own batch again. */
            migrationBuilder.Sql("""
                EXEC(N'
                CREATE VIEW dbo.vwApplicants AS
                SELECT
                    a.Id                AS ApplicantId,
                    a.ApplicantCode,
                    a.FullName,
                    a.Email,
                    a.Mobile,
                    a.Pan,
                    a.Gender,
                    a.SocialCategory,
                    a.CategoryId,
                    c.Name              AS CategoryName,
                    a.SubCategoryId,
                    sc.Name             AS SubCategoryName,
                    a.StateCode,
                    st.Name             AS StateName,
                    a.DistrictCode,
                    d.Name              AS DistrictName,
                    a.City,
                    a.KycStatus,
                    a.EmailVerified,
                    a.MobileVerified,
                    a.IsBlocked,
                    a.RegisteredOn,
                    a.LastLoginOn
                FROM dbo.Applicants a
                LEFT JOIN dbo.Categories    c  ON c.Id  = a.CategoryId
                LEFT JOIN dbo.SubCategories sc ON sc.Id = a.SubCategoryId
                LEFT JOIN dbo.LgdStates     st ON st.Code = a.StateCode
                LEFT JOIN dbo.LgdDistricts  d  ON d.Code  = a.DistrictCode;
                ');
                """);

            /* One application, with who made it and what it is for. The
               answers JSON is deliberately left out: it is shaped by whatever
               registration form was in force, so it is not something a report
               can column-map. */
            /* EXEC, because CREATE VIEW has to be the first statement in its
               batch and an idempotent script wraps every operation in an IF
               block. Inside EXEC the view is its own batch again. */
            migrationBuilder.Sql("""
                EXEC(N'
                CREATE VIEW dbo.vwApplications AS
                SELECT
                    ap.Id               AS ApplicationId,
                    ap.ApplicationNo,
                    ap.Status,
                    ap.SubmittedOn,
                    ap.Score,
                    a.Id                AS ApplicantId,
                    a.ApplicantCode,
                    a.FullName          AS ApplicantName,
                    a.Pan               AS ApplicantPan,
                    ap.CategoryId,
                    c.Name              AS CategoryName,
                    ap.SubCategoryId,
                    sc.Name             AS SubCategoryName,
                    ap.ProgramTypeId,
                    pt.Name             AS ProgramTypeName,
                    ap.StateCode,
                    st.Name             AS StateName,
                    ap.DistrictCode,
                    d.Name              AS DistrictName,
                    ap.PaymentStatus,
                    ap.FeeAmount,
                    ap.FeeTaxable,
                    ap.FeeGst,
                    ap.TdsPercent,
                    ap.Tan,
                    ap.AssignedToUserId,
                    u.FullName          AS AssignedToName
                FROM dbo.Applications ap
                JOIN      dbo.Applicants    a  ON a.Id  = ap.ApplicantId
                LEFT JOIN dbo.Categories    c  ON c.Id  = ap.CategoryId
                LEFT JOIN dbo.SubCategories sc ON sc.Id = ap.SubCategoryId
                LEFT JOIN dbo.ProgramTypes  pt ON pt.Id = ap.ProgramTypeId
                LEFT JOIN dbo.LgdStates     st ON st.Code = ap.StateCode
                LEFT JOIN dbo.LgdDistricts  d  ON d.Code  = ap.DistrictCode
                LEFT JOIN dbo.PortalUsers   u  ON u.Id  = ap.AssignedToUserId;
                ');
                """);

            /* One programme, with the agency running it and where. */
            /* EXEC, because CREATE VIEW has to be the first statement in its
               batch and an idempotent script wraps every operation in an IF
               block. Inside EXEC the view is its own batch again. */
            migrationBuilder.Sql("""
                EXEC(N'
                CREATE VIEW dbo.vwProgrammes AS
                SELECT
                    p.Id                AS ProgrammeKey,
                    p.ProgrammeId       AS ProgrammeCode,
                    p.ProgrammeName,
                    p.Status,
                    p.Mode,
                    p.StartDate,
                    p.EndDate,
                    p.MaxParticipants,
                    p.ParticipantCount,
                    p.CumulativeFeedback,
                    p.RegistrationsOpen,
                    p.ExamDateTime,
                    p.CategoryId,
                    c.Name              AS CategoryName,
                    p.SubCategoryId,
                    sc.Name             AS SubCategoryName,
                    p.ProgramTypeId,
                    pt.Name             AS ProgramTypeName,
                    p.AgencyId,
                    ia.Name             AS AgencyName,
                    p.Venue,
                    p.City,
                    p.StateCode,
                    st.Name             AS StateName,
                    p.DistrictCode,
                    d.Name              AS DistrictName
                FROM dbo.Programmes p
                LEFT JOIN dbo.Categories          c  ON c.Id  = p.CategoryId
                LEFT JOIN dbo.SubCategories       sc ON sc.Id = p.SubCategoryId
                LEFT JOIN dbo.ProgramTypes        pt ON pt.Id = p.ProgramTypeId
                LEFT JOIN dbo.ImplementingAgencies ia ON ia.Id = p.AgencyId
                LEFT JOIN dbo.LgdStates           st ON st.Code = p.StateCode
                LEFT JOIN dbo.LgdDistricts        d  ON d.Code  = p.DistrictCode;
                ');
                """);

            /* One person on one programme: attendance, marks, result and the
               certificate if one was issued. This is the grain most of the
               scheme's reporting actually counts on. */
            /* EXEC, because CREATE VIEW has to be the first statement in its
               batch and an idempotent script wraps every operation in an IF
               block. Inside EXEC the view is its own batch again. */
            migrationBuilder.Sql("""
                EXEC(N'
                CREATE VIEW dbo.vwParticipants AS
                SELECT
                    pp.Id               AS ParticipantId,
                    pp.ProgrammeId      AS ProgrammeKey,
                    p.ProgrammeId       AS ProgrammeCode,
                    p.ProgrammeName,
                    p.StartDate,
                    p.EndDate,
                    p.ProgramTypeId,
                    pt.Name             AS ProgramTypeName,
                    p.AgencyId,
                    ia.Name             AS AgencyName,
                    p.StateCode,
                    st.Name             AS StateName,
                    a.Id                AS ApplicantId,
                    a.ApplicantCode,
                    a.FullName          AS ApplicantName,
                    a.Gender,
                    a.SocialCategory,
                    pp.ApplicationId,
                    pp.EnrolledOn,
                    pp.AttendancePercent,
                    pp.WrittenMarks,
                    pp.VivaMarks,
                    pp.ExamScore,
                    pp.Result,
                    pp.ResultRecordedOn,
                    pp.FeedbackRating,
                    pp.CertificateNo,
                    cert.IssuedOn       AS CertificateIssuedOn,
                    cert.ValidTill      AS CertificateValidTill,
                    cert.RevokedOn      AS CertificateRevokedOn
                FROM dbo.ProgrammeParticipants pp
                JOIN      dbo.Programmes           p  ON p.Id  = pp.ProgrammeId
                JOIN      dbo.Applicants           a  ON a.Id  = pp.ApplicantId
                LEFT JOIN dbo.ProgramTypes         pt ON pt.Id = p.ProgramTypeId
                LEFT JOIN dbo.ImplementingAgencies ia ON ia.Id = p.AgencyId
                LEFT JOIN dbo.LgdStates            st ON st.Code = p.StateCode
                LEFT JOIN dbo.Certificates         cert ON cert.ParticipantId = pp.Id
                                                       AND cert.RevokedOn IS NULL;
                ');
                """);

            /* Every attempt to pay a fee, successful or not. No card number
               and no gateway credential has ever been stored, so there is
               none to leave out. */
            /* EXEC, because CREATE VIEW has to be the first statement in its
               batch and an idempotent script wraps every operation in an IF
               block. Inside EXEC the view is its own batch again. */
            migrationBuilder.Sql("""
                EXEC(N'
                CREATE VIEW dbo.vwPayments AS
                SELECT
                    t.Id                AS PaymentId,
                    t.OrderId,
                    t.Status,
                    t.Gateway,
                    t.TestMode,
                    t.Method,
                    t.TrackingId,
                    t.BankReference,
                    t.FailureReason,
                    t.FeeGross,
                    t.TdsAmount,
                    t.Amount,
                    t.Currency,
                    t.InitiatedOn,
                    t.CompletedOn,
                    ap.Id               AS ApplicationId,
                    ap.ApplicationNo,
                    ap.ProgramTypeId,
                    pt.Name             AS ProgramTypeName,
                    a.Id                AS ApplicantId,
                    a.ApplicantCode,
                    a.FullName          AS ApplicantName
                FROM dbo.PaymentTransactions t
                JOIN      dbo.Applications ap ON ap.Id = t.ApplicationId
                JOIN      dbo.Applicants   a  ON a.Id  = t.ApplicantId
                LEFT JOIN dbo.ProgramTypes pt ON pt.Id = ap.ProgramTypeId;
                ');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP VIEW IF EXISTS dbo.vwPayments;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS dbo.vwParticipants;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS dbo.vwProgrammes;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS dbo.vwApplications;");
            migrationBuilder.Sql("DROP VIEW IF EXISTS dbo.vwApplicants;");
        }
    }
}
