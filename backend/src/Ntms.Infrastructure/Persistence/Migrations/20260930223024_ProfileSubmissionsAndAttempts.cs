using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProfileSubmissionsAndAttempts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProfileBlockMonths",
                table: "SystemSettings",
                type: "int",
                nullable: false,
                /* Not 0: a zero-month block would expire the instant it was set. */
                defaultValue: 6);

            migrationBuilder.AddColumn<int>(
                name: "ProfileMaxAttempts",
                table: "SystemSettings",
                type: "int",
                nullable: false,
                /* Not 0: zero attempts would shut out every applicant at once. */
                defaultValue: 3);

            migrationBuilder.AddColumn<int>(
                name: "ProgramTypeMaxAttempts",
                table: "SystemSettings",
                type: "int",
                nullable: false,
                /* Not 0, for the same reason. */
                defaultValue: 3);

            migrationBuilder.AddColumn<string>(
                name: "ProfileBlockReason",
                table: "Applicants",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ProfileBlockedUntil",
                table: "Applicants",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ProfileSubmissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ApplicantId = table.Column<int>(type: "int", nullable: false),
                    SubCategoryId = table.Column<int>(type: "int", nullable: false),
                    ProfileFormId = table.Column<int>(type: "int", nullable: true),
                    AttemptNo = table.Column<int>(type: "int", nullable: false),
                    Responses = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<string>(type: "varchar(40)", nullable: false),
                    SubmittedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DecidedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DecidedByUserName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    RejectionReasonId = table.Column<int>(type: "int", nullable: true),
                    RejectionReasonLabel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfileSubmissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProfileSubmissions_Applicants_ApplicantId",
                        column: x => x.ApplicantId,
                        principalTable: "Applicants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProfileSubmissions_ProfileForms_ProfileFormId",
                        column: x => x.ProfileFormId,
                        principalTable: "ProfileForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProfileSubmissions_RejectionReasons_RejectionReasonId",
                        column: x => x.RejectionReasonId,
                        principalTable: "RejectionReasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProfileSubmissions_SubCategories_SubCategoryId",
                        column: x => x.SubCategoryId,
                        principalTable: "SubCategories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ProfileScrutinyEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    SubmissionId = table.Column<int>(type: "int", nullable: false),
                    Action = table.Column<string>(type: "varchar(40)", nullable: false),
                    ByUserName = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    ByRole = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    On = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    RejectionReasonLabel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfileScrutinyEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProfileScrutinyEvents_ProfileSubmissions_SubmissionId",
                        column: x => x.SubmissionId,
                        principalTable: "ProfileSubmissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProfileScrutinyEvents_SubmissionId",
                table: "ProfileScrutinyEvents",
                column: "SubmissionId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfileSubmissions_ApplicantId_AttemptNo",
                table: "ProfileSubmissions",
                columns: new[] { "ApplicantId", "AttemptNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProfileSubmissions_ProfileFormId",
                table: "ProfileSubmissions",
                column: "ProfileFormId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfileSubmissions_RejectionReasonId",
                table: "ProfileSubmissions",
                column: "RejectionReasonId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfileSubmissions_Status_SubmittedOn",
                table: "ProfileSubmissions",
                columns: new[] { "Status", "SubmittedOn" });

            migrationBuilder.CreateIndex(
                name: "IX_ProfileSubmissions_SubCategoryId",
                table: "ProfileSubmissions",
                column: "SubCategoryId");

            /* ---- everybody already through the door stays through it -----
               The profile form is a new gate in front of a journey people
               are part way along. An applicant whose application has been
               approved or who is enrolled has already had these same
               declarations read by the same officers — asking them to
               submit again, and holding their training until somebody gets
               to it, would be a gate closing behind them.

               So they are given an accepted profile, built from the answers
               they actually gave, marked as decided by the migration so
               nobody mistakes it for a scrutiny that happened. New
               applicants meet the gate normally. */
            migrationBuilder.Sql(@"
                INSERT INTO ProfileSubmissions
                    (ApplicantId, SubCategoryId, ProfileFormId, AttemptNo, Responses,
                     Status, SubmittedOn, DecidedOn, DecidedByUserName, CreatedOn, CreatedBy)
                SELECT  a.Id,
                        a.SubCategoryId,
                        NULL,
                        1,
                        ISNULL(x.Responses, N'{}'),
                        'Approved',
                        ISNULL(x.SubmittedOn, a.RegisteredOn),
                        SYSUTCDATETIME(),
                        'Carried over',
                        SYSUTCDATETIME(),
                        'Migration'
                FROM Applicants a
                OUTER APPLY (
                    SELECT TOP 1 ap.Responses, ap.SubmittedOn
                    FROM Applications ap
                    WHERE ap.ApplicantId = a.Id
                      AND ap.Status IN ('Approved', 'Enrolled')
                    ORDER BY ap.SubmittedOn DESC
                ) x
                WHERE EXISTS (
                    SELECT 1 FROM Applications ap
                    WHERE ap.ApplicantId = a.Id
                      AND ap.Status IN ('Approved', 'Enrolled'))
                  AND NOT EXISTS (
                    SELECT 1 FROM ProfileSubmissions ps WHERE ps.ApplicantId = a.Id);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProfileScrutinyEvents");

            migrationBuilder.DropTable(
                name: "ProfileSubmissions");

            migrationBuilder.DropColumn(
                name: "ProfileBlockMonths",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "ProfileMaxAttempts",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "ProgramTypeMaxAttempts",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "ProfileBlockReason",
                table: "Applicants");

            migrationBuilder.DropColumn(
                name: "ProfileBlockedUntil",
                table: "Applicants");
        }
    }
}
