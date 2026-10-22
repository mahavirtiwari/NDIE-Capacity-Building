using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Writes down the state a recorded session was always in and nobody
    /// could read.
    ///
    /// A session is created by one call and photographed by the next, so
    /// between the two there is a session that has been started and not
    /// finished. Nothing said so. If the photograph failed to upload - and
    /// it is a photograph, taken on a phone, at a venue - the topic had a
    /// row against it, dropped out of the coordinator's list for good, and
    /// went into the report counted among the sessions that had evidence
    /// behind them.
    ///
    /// Backfilled from the photographs themselves, which is the only
    /// honest source: a session with a picture against it was conducted, and
    /// one without it was started and left. The second of those is now
    /// visible, blocks submission, and can be picked up again - recording
    /// the same topic reopens the row rather than writing a second one.
    /// </summary>
    public partial class ASessionIsInProgressUntilItIsPhotographed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "MonitoringSessions",
                type: "varchar(40)",
                maxLength: 20,
                nullable: false,
                defaultValue: "InProgress");

            /* The photograph is what finished a session, so it is what says
               which of the existing rows were finished. */
            migrationBuilder.Sql("""
                UPDATE s
                SET s.Status = 'Conducted'
                FROM dbo.MonitoringSessions AS s
                WHERE EXISTS (
                    SELECT 1 FROM dbo.MonitoringPhotos AS p
                    WHERE p.SessionId = s.Id AND p.Kind = 'Session');
                """);

            migrationBuilder.CreateIndex(
                name: "IX_MonitoringSessions_ProgrammeId_Status",
                table: "MonitoringSessions",
                columns: new[] { "ProgrammeId", "Status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_MonitoringSessions_ProgrammeId_Status",
                table: "MonitoringSessions");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "MonitoringSessions");
        }
    }
}
