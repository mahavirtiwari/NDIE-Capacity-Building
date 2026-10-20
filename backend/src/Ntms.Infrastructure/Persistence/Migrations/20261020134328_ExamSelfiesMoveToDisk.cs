using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Makes room for the exam selfies to live on disk, beside the
    /// applicant's other files.
    ///
    /// Columns only, like the attachment migration before it: a migration
    /// speaks SQL and the destination is a filesystem, so the background
    /// drain writes the files after the application starts. SelfieData was
    /// already nullable and stays, so a sitting is read from whichever of
    /// the two it has until the drain has emptied it.
    /// </summary>
    public partial class ExamSelfiesMoveToDisk : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SelfiePath",
                table: "ExamAttempts",
                type: "nvarchar(400)",
                maxLength: 400,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "SelfieSizeBytes",
                table: "ExamAttempts",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SelfiePath",
                table: "ExamAttempts");

            migrationBuilder.DropColumn(
                name: "SelfieSizeBytes",
                table: "ExamAttempts");
        }
    }
}
