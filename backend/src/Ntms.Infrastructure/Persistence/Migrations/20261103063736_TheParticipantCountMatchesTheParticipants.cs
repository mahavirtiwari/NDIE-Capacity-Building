using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Puts every batch's participant count back in step with the people on
    /// it.
    ///
    /// The count is kept on the batch rather than worked out each time,
    /// because the register, the public catalogue and the seat limit all
    /// read it on every page. Two of the three ways somebody is enrolled
    /// maintained it - from the applicant's own app, and from the office
    /// desk. Enrolling at the door did not: it added the row and left the
    /// number where it was.
    ///
    /// So a batch filled at the door reported nobody on it. No seats taken
    /// in the catalogue, no participants in the register, and - because the
    /// cap is checked against this number and not against the rows - no way
    /// for it ever to fill up and close.
    ///
    /// Counted from the rows, which are the truth; the number is only ever
    /// a cache of them. Idempotent, and worth keeping that way: it is the
    /// repair to run if the two ever drift again.
    /// </summary>
    public partial class TheParticipantCountMatchesTheParticipants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql(@"
UPDATE p
   SET p.ParticipantCount = x.Taken
  FROM dbo.Programmes AS p
 CROSS APPLY (
        SELECT COUNT(*) AS Taken
          FROM dbo.ProgrammeParticipants AS pp
         WHERE pp.ProgrammeId = p.Id
      ) AS x
 WHERE p.ParticipantCount <> x.Taken;");

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /* Not undone. The number it replaced was wrong by definition -
               it disagreed with the rows it is a count of. */
        }
    }
}
