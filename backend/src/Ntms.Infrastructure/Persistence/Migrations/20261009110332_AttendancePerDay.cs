using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AttendancePerDay : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OnSpotAttendance",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ParticipantId = table.Column<int>(type: "int", nullable: false),
                    ProgrammeId = table.Column<int>(type: "int", nullable: false),
                    Day = table.Column<DateOnly>(type: "date", nullable: false),
                    IsPresent = table.Column<bool>(type: "bit", nullable: false),
                    MarkedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    MarkedBy = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OnSpotAttendance", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OnSpotAttendance_OnSpotParticipants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalTable: "OnSpotParticipants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_OnSpotAttendance_Programmes_ProgrammeId",
                        column: x => x.ProgrammeId,
                        principalTable: "Programmes",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_OnSpotAttendance_ParticipantId_Day",
                table: "OnSpotAttendance",
                columns: new[] { "ParticipantId", "Day" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OnSpotAttendance_ProgrammeId_Day",
                table: "OnSpotAttendance",
                columns: new[] { "ProgrammeId", "Day" });

            /* A one-day programme already marked has its answer: the single
               tick on the participant IS that day's mark, because there was
               only ever one day to tick. Those are carried across so an old
               one-day programme's report shows a proper column rather than a
               register nobody took.

               Multi-day programmes are left alone. Their single tick cannot
               be attributed to a day without guessing which, and a guess
               here would be evidence of attendance on a day nobody recorded.
               The roll-up on the participant still stands for those.

               EXEC, because an idempotent script compiles a migration as one
               batch and a statement naming a table that the same batch
               creates will not compile. */
            migrationBuilder.Sql(
                "EXEC(N'"
                + "INSERT INTO [OnSpotAttendance] "
                + "([ParticipantId], [ProgrammeId], [Day], [IsPresent], [MarkedOn], [MarkedBy]) "
                + "SELECT p.[Id], p.[ProgrammeId], g.[StartDate], p.[IsPresent], "
                + "ISNULL(p.[AttendanceMarkedOn], SYSUTCDATETIME()), ''Carried over'' "
                + "FROM [OnSpotParticipants] p "
                + "JOIN [Programmes] g ON g.[Id] = p.[ProgrammeId] "
                + "WHERE p.[IsPresent] IS NOT NULL AND g.[StartDate] = g.[EndDate]"
                + "');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OnSpotAttendance");
        }
    }
}
