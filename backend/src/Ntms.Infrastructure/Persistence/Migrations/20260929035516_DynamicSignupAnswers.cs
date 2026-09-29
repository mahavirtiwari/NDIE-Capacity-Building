using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class DynamicSignupAnswers : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Applicants_Pan_CategoryId",
                table: "Applicants");

            migrationBuilder.AddColumn<string>(
                name: "Label",
                table: "ApplicantAnswers",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Applicants_Pan_CategoryId",
                table: "Applicants",
                columns: new[] { "Pan", "CategoryId" },
                unique: true,
                filter: "[Pan] <> ''");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Applicants_Pan_CategoryId",
                table: "Applicants");

            migrationBuilder.DropColumn(
                name: "Label",
                table: "ApplicantAnswers");

            migrationBuilder.CreateIndex(
                name: "IX_Applicants_Pan_CategoryId",
                table: "Applicants",
                columns: new[] { "Pan", "CategoryId" },
                unique: true);
        }
    }
}
