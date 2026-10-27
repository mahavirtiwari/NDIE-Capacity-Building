using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Tidies the whole-name field after it was taken off the sign-up form.
    ///
    /// Taking it off was right - the name is asked in two parts now and the
    /// whole is composed from them - but it was left in two states that
    /// contradict each other on the screen the Super Admin reads.
    ///
    /// It is locked, which the form screen renders as "Always on" and which
    /// hides the enable and disable actions, so the row shows a field that
    /// says it cannot be switched off sitting there switched off, with no
    /// way to switch it back on. A lock means "this form cannot do without
    /// it", and that stopped being true the moment the two parts arrived.
    ///
    /// And it kept the label somebody had given it while it was standing in
    /// for a first name. On a form that now has a real first-name field, the
    /// list showed "First Name" and "First name" one above the other, one of
    /// them inactive, which reads as a fault rather than as history.
    ///
    /// Unlocked, and named for what it is. Only where it is inactive: a
    /// database whose form still asks for the whole name is one where the
    /// lock and the label are doing their job.
    /// </summary>
    public partial class TheRetiredWholeNameFieldReadsLikeOne : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql(@"
UPDATE dbo.SignupFields
   SET IsLocked   = 0,
       Label      = 'Full name',
       ModifiedOn = SYSUTCDATETIME()
 WHERE [Key] = 'fullName'
   AND Status = 'Inactive'
   AND (IsLocked = 1 OR Label <> 'Full name');");

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /* Not undone. The lock was wrong on a field that is no longer
               asked, and the label it carried was the leftover of a
               workaround; putting either back would restore the confusion
               rather than a state anybody chose. */
        }
    }
}
