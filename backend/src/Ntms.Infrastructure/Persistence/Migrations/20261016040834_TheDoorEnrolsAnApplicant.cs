using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TheDoorEnrolsAnApplicant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ApplicantId",
                table: "OnSpotParticipants",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_OnSpotParticipants_ApplicantId",
                table: "OnSpotParticipants",
                column: "ApplicantId");

            migrationBuilder.CreateIndex(
                name: "IX_OnSpotParticipants_ProgrammeId_ApplicantId",
                table: "OnSpotParticipants",
                columns: new[] { "ProgrammeId", "ApplicantId" },
                unique: true,
                filter: "[ApplicantId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_OnSpotParticipants_Applicants_ApplicantId",
                table: "OnSpotParticipants",
                column: "ApplicantId",
                principalTable: "Applicants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OnSpotParticipants_Applicants_ApplicantId",
                table: "OnSpotParticipants");

            migrationBuilder.DropIndex(
                name: "IX_OnSpotParticipants_ApplicantId",
                table: "OnSpotParticipants");

            migrationBuilder.DropIndex(
                name: "IX_OnSpotParticipants_ProgrammeId_ApplicantId",
                table: "OnSpotParticipants");

            migrationBuilder.DropColumn(
                name: "ApplicantId",
                table: "OnSpotParticipants");
        }
    }
}
