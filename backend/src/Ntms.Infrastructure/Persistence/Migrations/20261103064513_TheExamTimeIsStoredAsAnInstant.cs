using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Shifts the exam times already set from the clock face they were typed
    /// on to the instant they name.
    ///
    /// The time is entered in a datetime-local field, which posts no zone,
    /// and it was stored exactly as it arrived. Everything that reads it
    /// treats it as UTC - the serialiser stamps a Z on it so clients render
    /// it in their own zone, the gate that opens the paper compares it
    /// against UtcNow, and IndianTime turns it into IST for the candidate.
    /// So a paper set for twenty to twelve in the morning was recorded as
    /// twenty to twelve UTC, which is ten past five in the evening here: it
    /// opened then, and told the candidate so.
    ///
    /// The writing side now converts. These rows were written before it did,
    /// and every one of them is a wall clock in India, because that path is
    /// the only way an exam time has ever been set. Five and a half hours
    /// back puts each of them on the instant its manager meant.
    ///
    /// Not idempotent, unlike most of the repairs here, and it cannot be:
    /// nothing in the value says whether it has been shifted. It runs once,
    /// which is what a migration does.
    /// </summary>
    public partial class TheExamTimeIsStoredAsAnInstant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql(@"
UPDATE dbo.Programmes
   SET ExamDateTime = DATEADD(MINUTE, -330, ExamDateTime)
 WHERE ExamDateTime IS NOT NULL;");

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql(@"
UPDATE dbo.Programmes
   SET ExamDateTime = DATEADD(MINUTE, 330, ExamDateTime)
 WHERE ExamDateTime IS NOT NULL;");
    }
}
