using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ATrainerHasAFaceAndAQualification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ExperienceMonths",
                table: "ProgrammeTrainers",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QualificationDetails",
                table: "ProgrammeTrainers",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "TrainerId",
                table: "MonitoringPhotos",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_MonitoringPhotos_TrainerId",
                table: "MonitoringPhotos",
                column: "TrainerId");

            migrationBuilder.AddForeignKey(
                name: "FK_MonitoringPhotos_ProgrammeTrainers_TrainerId",
                table: "MonitoringPhotos",
                column: "TrainerId",
                principalTable: "ProgrammeTrainers",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MonitoringPhotos_ProgrammeTrainers_TrainerId",
                table: "MonitoringPhotos");

            migrationBuilder.DropIndex(
                name: "IX_MonitoringPhotos_TrainerId",
                table: "MonitoringPhotos");

            migrationBuilder.DropColumn(
                name: "ExperienceMonths",
                table: "ProgrammeTrainers");

            migrationBuilder.DropColumn(
                name: "QualificationDetails",
                table: "ProgrammeTrainers");

            migrationBuilder.DropColumn(
                name: "TrainerId",
                table: "MonitoringPhotos");
        }
    }
}
