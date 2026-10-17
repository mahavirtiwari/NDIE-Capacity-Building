using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Records the reporting line on the agency logins that were created
    /// without one.
    ///
    /// No schema changes. Every other account has written down who created
    /// it since the chain was introduced; the one an agency signs in with
    /// never did, because it is made by the empanelment rather than by the
    /// Portal users screen. The chain is what that register is filtered by
    /// and it is walked a tier at a time, so a null at the agency broke the
    /// walk at its first step: the login was invisible to the manager who
    /// empanelled it, and so was every coordinator the agency went on to
    /// appoint - while those coordinators' names carried on appearing on
    /// the batch sheets the same manager permits.
    ///
    /// The right answer is already on the agency: whoever empanelled it
    /// answers for it. So this is a repair with a derivable value and no
    /// guesswork, which is why it is done here rather than left for
    /// somebody to notice one agency at a time.
    /// </summary>
    public partial class AnAgencyLoginAnswersToWhoeverEmpanelledIt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* Only where it is unset, so a line somebody has since corrected
               by hand is left alone, and only for the agency tier - no other
               account reaches this state. */
            migrationBuilder.Sql(@"
UPDATE u
   SET u.ReportsToUserId = a.OwnerUserId
  FROM PortalUsers AS u
 INNER JOIN ImplementingAgencies AS a ON a.Id = u.AgencyId
 WHERE u.ReportsToUserId IS NULL
   AND u.BaseRole = 'AgencyAdmin'
   AND a.OwnerUserId IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /* Deliberately nothing. Blanking these again would not restore a
               previous state, it would reintroduce the fault - and there is
               no record of which rows were null beforehand, so the ones that
               were always set correctly would be cleared with them. */
        }
    }
}
