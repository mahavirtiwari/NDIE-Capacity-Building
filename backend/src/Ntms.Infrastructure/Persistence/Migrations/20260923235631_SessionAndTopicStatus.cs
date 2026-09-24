using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SessionAndTopicStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* Active, not the scaffolded empty string: every session and topic
               that already exists was being delivered, and an unreadable status
               would hide them from the plan. */
            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "CurriculumTopics",
                type: "varchar(40)",
                nullable: false,
                defaultValue: "Active");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "CurriculumSessions",
                type: "varchar(40)",
                nullable: false,
                defaultValue: "Active");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Status",
                table: "CurriculumTopics");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "CurriculumSessions");
        }
    }
}
