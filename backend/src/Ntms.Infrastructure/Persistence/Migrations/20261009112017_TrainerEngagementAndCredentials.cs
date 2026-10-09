using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class TrainerEngagementAndCredentials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Aadhaar",
                table: "ProgrammeTrainers",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Engagement",
                table: "ProgrammeTrainers",
                type: "varchar(40)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Qualification",
                table: "ProgrammeTrainers",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "YearsExperience",
                table: "ProgrammeTrainers",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Aadhaar",
                table: "ProgrammeTrainers");

            migrationBuilder.DropColumn(
                name: "Engagement",
                table: "ProgrammeTrainers");

            migrationBuilder.DropColumn(
                name: "Qualification",
                table: "ProgrammeTrainers");

            migrationBuilder.DropColumn(
                name: "YearsExperience",
                table: "ProgrammeTrainers");
        }
    }
}
