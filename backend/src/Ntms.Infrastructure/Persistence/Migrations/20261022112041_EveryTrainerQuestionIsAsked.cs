using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Makes every question on the trainer form compulsory.
    ///
    /// The nine shipped fields went out with only the name and the mobile
    /// marked required, so a trainer could be registered as little more
    /// than a name and a number - no qualification, no experience, no
    /// photograph, no identity document. The scheme wants all of it, and
    /// the shipped defaults now say so; this brings the forms already
    /// seeded into line, since a default only applies to an install that
    /// has not happened yet.
    ///
    /// Only the fields that shipped. Anything a department added itself is
    /// their decision and is left exactly as they set it, and so is any
    /// shipped field they have switched off - a question that is not asked
    /// cannot be compulsory.
    /// </summary>
    public partial class EveryTrainerQuestionIsAsked : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
UPDATE dbo.TrainerFields
   SET Required = 1
 WHERE IsBuiltIn = 1
   AND Status = 'Active'
   AND Required = 0;");


        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
