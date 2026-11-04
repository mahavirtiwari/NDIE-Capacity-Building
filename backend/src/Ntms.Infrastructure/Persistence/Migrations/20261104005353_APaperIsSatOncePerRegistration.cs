using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// A paper carried a retake count of its own, defaulting to three.
    ///
    /// It governed nothing the scheme intends. A candidate registers for a
    /// batch once and sits its paper once; a second go means registering for
    /// another batch of the same track, and how many of those they may take
    /// is the scheme's own allowance, set in System Settings and counted
    /// against the places they have taken. Read together, the paper's three
    /// retakes turned an allowance of three registrations into nine
    /// sittings.
    ///
    /// Dropped rather than left unread. Nothing was ever recorded in it -
    /// it was a rule somebody typed, not an account of anything that
    /// happened - so there is nothing here to keep.
    /// </summary>
    public partial class APaperIsSatOncePerRegistration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxAttempts",
                table: "ExamPapers");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /* Three, which is what the column defaulted to and what every
               paper in it held. Nought - which is what a scaffolded
               rollback would have written - reads to the code that used
               this column as a paper nobody may sit. */
            migrationBuilder.AddColumn<int>(
                name: "MaxAttempts",
                table: "ExamPapers",
                type: "int",
                nullable: false,
                defaultValue: 3);
        }
    }
}
