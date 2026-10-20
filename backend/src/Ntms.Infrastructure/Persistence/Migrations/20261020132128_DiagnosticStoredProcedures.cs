using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Read-only procedures for looking after the data, alongside the
    /// reporting views.
    ///
    /// The same rule those views were written under, and for the same
    /// reason: the application does not call any of these. Every query it
    /// makes is still EF Core, and the scope rules that decide who may see
    /// what are composed onto those queries in C# — a procedure that read
    /// the tables directly would be a read path outside that boundary, and
    /// the boundary is the point. So nothing here is a data-access layer.
    /// These answer operational questions, for somebody with a database
    /// grant and a reason.
    ///
    /// Each one exists because it was wanted and there was no way to ask.
    /// Finding seven accounts sharing two e-mail addresses meant paging a
    /// thousand applicants through the API; knowing whether the pictures
    /// had finished moving to disk meant guessing; and the timetables that
    /// do not fit their batch are visible one batch at a time on a screen
    /// and nowhere in aggregate.
    ///
    /// Read-only by construction. No procedure here writes, and none takes
    /// a parameter, so there is nothing to inject into.
    /// </summary>
    public partial class DiagnosticStoredProcedures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* EXEC, because CREATE PROCEDURE has to be the first statement
               in its batch and an idempotent script wraps every operation in
               an IF block. Inside EXEC it is its own batch again - the same
               reason the reporting views are written this way. */

            /* One mailbox, one account, is now enforced at sign-up and at
               every e-mail change. It was not always, so this says which
               accounts were made before it was - they cannot be recovered
               by e-mail, because an address shared by two resolves to
               neither, and they must be settled by hand before a unique
               index can go on. */
            migrationBuilder.Sql("""
                EXEC(N'
                CREATE PROCEDURE dbo.uspDuplicateApplicantEmails AS
                BEGIN
                    SET NOCOUNT ON;

                    SELECT
                        a.Email,
                        COUNT(*)                        AS Accounts,
                        STRING_AGG(a.ApplicantCode, N'', '')
                            WITHIN GROUP (ORDER BY a.ApplicantCode) AS ApplicantCodes,
                        MIN(a.RegisteredOn)             AS FirstRegisteredOn,
                        MAX(a.RegisteredOn)             AS LastRegisteredOn
                    FROM dbo.Applicants AS a
                    WHERE a.Email <> N''''
                    GROUP BY a.Email
                    HAVING COUNT(*) > 1
                    ORDER BY COUNT(*) DESC, a.Email;
                END')
                """);

            /* Whether the pictures have finished moving out of the database.
               The drain runs in the background after a release and reports
               to the log; this is the same answer from the other side, and
               the one to check before the Content column is dropped. */
            migrationBuilder.Sql("""
                EXEC(N'
                CREATE PROCEDURE dbo.uspProfileAttachmentStorage AS
                BEGIN
                    SET NOCOUNT ON;

                    SELECT
                        SUM(CASE WHEN p.RelativePath <> N'''' THEN 1 ELSE 0 END) AS OnDisk,
                        SUM(CASE WHEN p.RelativePath =  N'''' AND p.Content IS NOT NULL
                                 THEN 1 ELSE 0 END)                              AS StillInDatabase,
                        SUM(CASE WHEN p.RelativePath =  N'''' AND p.Content IS NULL
                                 THEN 1 ELSE 0 END)                              AS Neither,
                        SUM(CASE WHEN p.RelativePath <> N'''' THEN p.SizeBytes ELSE 0 END)
                                                                                 AS BytesOnDisk,
                        SUM(CASE WHEN p.Content IS NULL THEN 0
                                 ELSE DATALENGTH(p.Content) END)                 AS BytesInDatabase,
                        COUNT(*)                                                 AS Attachments
                    FROM dbo.ProfileAttachments AS p;
                END')
                """);

            /* The given and family names, after the migration that split
               them. A row with no family name is ordinary - plenty of
               people have one name - but a run of them where the whole
               name clearly has two parts means the split found nothing to
               go on, and is worth a look. */
            migrationBuilder.Sql("""
                EXEC(N'
                CREATE PROCEDURE dbo.uspApplicantNameParts AS
                BEGIN
                    SET NOCOUNT ON;

                    SELECT
                        COUNT(*)                                            AS Applicants,
                        SUM(CASE WHEN a.FirstName = N'''' THEN 1 ELSE 0 END) AS WithoutGivenName,
                        SUM(CASE WHEN a.LastName  = N'''' THEN 1 ELSE 0 END) AS WithoutFamilyName,
                        SUM(CASE WHEN a.LastName  = N''''
                                  AND CHARINDEX(N'' '', LTRIM(RTRIM(a.FullName))) > 0
                                 THEN 1 ELSE 0 END)                         AS LooksUnsplit,
                        SUM(CASE WHEN LTRIM(RTRIM(a.FullName)) <>
                                      LTRIM(RTRIM(a.FirstName + N'' '' + a.LastName))
                                 THEN 1 ELSE 0 END)                         AS WholeDisagreesWithParts
                    FROM dbo.Applicants AS a;
                END')
                """);

            /* Timetables that cannot be run as written, across the estate.
               A batch sheet says so one batch at a time; this finds them
               all. Two faults, both of which come of a curriculum being
               fitted to a batch it does not match: sessions that overlap
               each other, and sessions outside the hours the batch keeps. */
            migrationBuilder.Sql("""
                EXEC(N'
                CREATE PROCEDURE dbo.uspProgrammeTimetableTrouble AS
                BEGIN
                    SET NOCOUNT ON;

                    WITH Overlapping AS (
                        SELECT DISTINCT a.ProgrammeId
                        FROM dbo.ProgrammeSessions AS a
                        INNER JOIN dbo.ProgrammeSessions AS b
                            ON  b.ProgrammeId = a.ProgrammeId
                            AND b.Id          > a.Id
                            AND b.SessionDate = a.SessionDate
                            AND a.StartTime   < b.EndTime
                            AND b.StartTime   < a.EndTime
                    ),
                    OutsideHours AS (
                        SELECT s.ProgrammeId, COUNT(*) AS Sessions
                        FROM dbo.ProgrammeSessions AS s
                        INNER JOIN dbo.Programmes AS p ON p.Id = s.ProgrammeId
                        WHERE s.StartTime < p.StartTime OR s.EndTime > p.EndTime
                        GROUP BY s.ProgrammeId
                    ),
                    OutsideDates AS (
                        SELECT s.ProgrammeId, COUNT(*) AS Sessions
                        FROM dbo.ProgrammeSessions AS s
                        INNER JOIN dbo.Programmes AS p ON p.Id = s.ProgrammeId
                        WHERE s.SessionDate < p.StartDate OR s.SessionDate > p.EndDate
                        GROUP BY s.ProgrammeId
                    )
                    SELECT
                        p.ProgrammeId                       AS ProgrammeCode,
                        p.ProgrammeName,
                        p.Status,
                        p.StartDate,
                        p.EndDate,
                        p.StartTime,
                        p.EndTime,
                        CASE WHEN o.ProgrammeId IS NULL THEN 0 ELSE 1 END AS HasOverlappingSessions,
                        ISNULL(h.Sessions, 0)               AS SessionsOutsideHours,
                        ISNULL(d.Sessions, 0)               AS SessionsOutsideDates
                    FROM dbo.Programmes AS p
                    LEFT JOIN Overlapping  AS o ON o.ProgrammeId = p.Id
                    LEFT JOIN OutsideHours AS h ON h.ProgrammeId = p.Id
                    LEFT JOIN OutsideDates AS d ON d.ProgrammeId = p.Id
                    WHERE o.ProgrammeId IS NOT NULL
                       OR h.ProgrammeId IS NOT NULL
                       OR d.ProgrammeId IS NOT NULL
                    ORDER BY p.StartDate DESC;
                END')
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.uspProgrammeTimetableTrouble;");
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.uspApplicantNameParts;");
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.uspProfileAttachmentStorage;");
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.uspDuplicateApplicantEmails;");
        }
    }
}
