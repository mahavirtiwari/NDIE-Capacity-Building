using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Teaches the storage procedure about the exam selfies.
    ///
    /// It was written to answer one question — have the pictures finished
    /// moving out of the database — and that question now has two kinds of
    /// picture behind it. Answering for only one of them would say the
    /// drain had finished while a table full of faces was still waiting,
    /// which is precisely the mistake it exists to prevent: this is the
    /// report somebody reads before dropping the columns.
    /// </summary>
    public partial class TheStorageProcedureCountsSelfiesToo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.uspProfileAttachmentStorage;");

            /* One row per kind, so the answer reads as a list of things
               still to do rather than as a single number that has to be
               taken apart. Nothing is left to move when every row says
               nought still in the database. */
            migrationBuilder.Sql("""
                EXEC(N'
                CREATE PROCEDURE dbo.uspApplicantFileStorage AS
                BEGIN
                    SET NOCOUNT ON;

                    SELECT
                        N''Profile attachments'' AS Kind,
                        COUNT(*)                 AS Total,
                        SUM(CASE WHEN p.RelativePath <> N'''' THEN 1 ELSE 0 END) AS OnDisk,
                        SUM(CASE WHEN p.RelativePath =  N'''' AND p.Content IS NOT NULL
                                 THEN 1 ELSE 0 END)                              AS StillInDatabase,
                        SUM(CASE WHEN p.RelativePath =  N'''' AND p.Content IS NULL
                                 THEN 1 ELSE 0 END)                              AS Neither,
                        SUM(CASE WHEN p.RelativePath <> N'''' THEN p.SizeBytes ELSE 0 END)
                                                                                 AS BytesOnDisk,
                        SUM(CASE WHEN p.Content IS NULL THEN 0
                                 ELSE DATALENGTH(p.Content) END)                 AS BytesInDatabase
                    FROM dbo.ProfileAttachments AS p

                    UNION ALL

                    SELECT
                        N''Exam selfies''        AS Kind,
                        COUNT(*)                 AS Total,
                        SUM(CASE WHEN a.SelfiePath <> N'''' THEN 1 ELSE 0 END)   AS OnDisk,
                        SUM(CASE WHEN a.SelfiePath =  N'''' AND a.SelfieData IS NOT NULL
                                 THEN 1 ELSE 0 END)                              AS StillInDatabase,
                        SUM(CASE WHEN a.SelfiePath =  N'''' AND a.SelfieData IS NULL
                                 THEN 1 ELSE 0 END)                              AS Neither,
                        SUM(CASE WHEN a.SelfiePath <> N'''' THEN a.SelfieSizeBytes ELSE 0 END)
                                                                                 AS BytesOnDisk,
                        SUM(CASE WHEN a.SelfieData IS NULL THEN 0
                                 ELSE DATALENGTH(a.SelfieData) END)              AS BytesInDatabase
                    FROM dbo.ExamAttempts AS a;
                END')
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP PROCEDURE IF EXISTS dbo.uspApplicantFileStorage;");

            /* Put the attachment-only version back, as it was. */
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
        }
    }
}
