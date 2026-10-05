using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProfilesAreAssignedToAnOfficer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AssignedToUserId",
                table: "ProfileSubmissions",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProfileSubmissions_AssignedToUserId_Status",
                table: "ProfileSubmissions",
                columns: new[] { "AssignedToUserId", "Status" });

            migrationBuilder.AddForeignKey(
                name: "FK_ProfileSubmissions_PortalUsers_AssignedToUserId",
                table: "ProfileSubmissions",
                column: "AssignedToUserId",
                principalTable: "PortalUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            /* ---- the ones already waiting --------------------------------
               A profile handed in before this existed has no officer, and
               after the upgrade an Operation Manager sees only their own
               desk — so without this every one of them would vanish from
               the queue of the people meant to read them.

               Placed with the lowest-numbered manager who qualifies, rather
               than the lightest-loaded: load only means something once
               assignment exists, and at this instant nobody is holding
               anything. New submissions balance properly from here on.

               Anything nobody qualifies for stays null, which is the
               unassigned pile the tiers above can see and place. */
            /* EXEC, because the column is added in this same migration and an
               idempotent script puts the whole migration in one batch: SQL
               Server resolves column names when it compiles the batch. */
            migrationBuilder.Sql("""
                EXEC(N'
                UPDATE s
                SET s.AssignedToUserId = pick.UserId
                FROM ProfileSubmissions s
                JOIN Applicants a ON a.Id = s.ApplicantId
                CROSS APPLY (
                    SELECT TOP 1 u.Id AS UserId
                    FROM PortalUsers u
                    WHERE u.BaseRole = ''OperationManager''
                      AND u.Status = ''Active''
                      AND EXISTS (
                          SELECT 1 FROM UserProgramTypes upt
                          JOIN ProgramTypes p ON p.Id = upt.ProgramTypeId
                          WHERE upt.UserId = u.Id AND p.SubCategoryId = s.SubCategoryId)
                      AND (a.StateCode IS NULL OR EXISTS (
                          SELECT 1 FROM UserStates us
                          WHERE us.UserId = u.Id AND us.StateCode = a.StateCode))
                    ORDER BY u.Id
                ) pick
                WHERE s.AssignedToUserId IS NULL
                  AND s.Status IN (''Submitted'', ''UnderScrutiny'');
                ');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProfileSubmissions_PortalUsers_AssignedToUserId",
                table: "ProfileSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_ProfileSubmissions_AssignedToUserId_Status",
                table: "ProfileSubmissions");

            migrationBuilder.DropColumn(
                name: "AssignedToUserId",
                table: "ProfileSubmissions");
        }
    }
}
