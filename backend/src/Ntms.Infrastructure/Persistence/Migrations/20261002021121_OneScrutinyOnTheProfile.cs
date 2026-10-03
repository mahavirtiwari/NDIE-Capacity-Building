using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// There is one scrutiny, and it is of the profile.
    ///
    /// An application used to be read a second time when somebody picked a
    /// track, which asked the same question of the same answers: the profile
    /// is scrutinised per discipline, and no track in a discipline is offered
    /// until it has been accepted. Applications are now accepted as they
    /// arrive.
    ///
    /// No schema changes with it. What does change is that nobody can act on
    /// an application still sitting in the old queue, so the ones already
    /// there are released rather than left waiting for a screen that no
    /// longer exists.
    /// </summary>
    public partial class OneScrutinyOnTheProfile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* The event first, so the history reads in order: the reason is
               recorded before the status it explains. Written as its own row
               rather than left implicit, because an application that jumps to
               approved with nothing saying why looks like something went
               wrong with it. */
            migrationBuilder.Sql("""
                INSERT INTO ScrutinyEvents
                    (ApplicationId, Action, ByUserName, ByRole, [On], Remarks, CreatedOn)
                SELECT a.Id, 'Approved', 'System', 'Applicant', GETUTCDATE(),
                       'Approved on submission: scrutiny of applications was withdrawn. The '
                       + 'profile for this discipline had already been scrutinised and accepted.',
                       GETUTCDATE()
                FROM Applications a
                WHERE a.Status IN ('Submitted', 'UnderScrutiny', 'Clarification');
                """);

            migrationBuilder.Sql("""
                UPDATE Applications
                SET Status = 'Approved'
                WHERE Status IN ('Submitted', 'UnderScrutiny', 'Clarification');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /* Deliberately empty. Which of the three states each application
               was in is not recorded anywhere this could read, so putting
               them all back as Submitted would be inventing history rather
               than restoring it. The schema is unchanged either way. */
        }
    }
}
