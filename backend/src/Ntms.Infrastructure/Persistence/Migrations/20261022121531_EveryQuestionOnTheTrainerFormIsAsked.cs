using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Turns every built-in question on the trainer form back on, and makes
    /// it mandatory.
    ///
    /// The form shipped with all nine required - name, mobile, email,
    /// qualification and its details, experience, Aadhaar, the photograph
    /// and the identity document. But the defaults are written only into an
    /// empty table, so a database set up before they were settled kept the
    /// ones it had: name and mobile required and the rest optional. A
    /// trainer could be registered as a name and a phone number, with no
    /// face, no document and no record of what qualified them to teach -
    /// which is most of what the faculty register exists to hold.
    ///
    /// Required and active together, because a question that is switched
    /// off is not asked at all and "mandatory" would mean nothing. The
    /// office can still turn the optional ones down afterwards from Trainer
    /// form; the name and the mobile number it cannot, and should not.
    ///
    /// Only the built-in ones. A question the office added itself is the
    /// office's, and whether it is required is their decision to have made.
    /// </summary>
    public partial class EveryQuestionOnTheTrainerFormIsAsked : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql("""
                UPDATE dbo.TrainerFields
                SET Required = 1,
                    Status   = 'Active'
                WHERE IsBuiltIn = 1
                  AND (Required = 0 OR Status <> 'Active');
                """);

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /* Not undone. Which questions the form asks is the office's to
               set from Trainer form, and putting back the state a database
               happened to be in would overwrite whatever they have decided
               since. */
        }
    }
}
