using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Raising a batch becomes its own permission, and the top of the
    /// system stops holding the grants that belong to the tiers below it.
    ///
    /// They were the same permission, which meant Super Admin — holding
    /// everything — could raise a program nobody had asked for and that no
    /// agency was accountable for delivering. A batch is proposed by the
    /// implementing agency that will deliver it and permitted by the
    /// operation manager above it; there is no step in that for the top of
    /// the system to take.
    ///
    /// No schema change: the permission catalogue is rows, not columns. The
    /// seeder only tops up Super Admin, so every other existing role has to
    /// be given the new key here or nobody could raise a program after this
    /// deploys.
    /// </summary>
    public partial class RaisingAProgramIsItsOwnPermission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* Granted to the implementing agency tier and to nobody else.
               Not to every role that holds programs.manage: the operation
               manager holds it to permit and run batches, and giving it the
               power to raise one as well would let it approve its own.

               Matched on the tier rather than on the role code, so a
               scheme that renamed the role, or added a second agency-tier
               role of its own, is covered too. BaseRole is stored as text,
               not as the enum's number. */
            migrationBuilder.Sql(@"
INSERT INTO RolePermissions (RoleId, Permission)
SELECT r.Id, 'programs.create'
FROM AdminRoles r
WHERE r.BaseRole = 'AgencyAdmin'
  AND NOT EXISTS (
      SELECT 1 FROM RolePermissions p
      WHERE p.RoleId = r.Id AND p.Permission = 'programs.create'
  );
");

            /* And the top of the system stops holding the grants that
               belong to a tier answering to somebody.

               Super Admin owns the masters, the roles and the portal and
               appoints the tier below it. Empanelling an agency is the
               operation manager's, adding coordinators and raising
               programs are the agency's, and reading applications is the
               admin's and its scrutiny officers'. Holding all of them at
               the top made the chain of accountability decorative: a
               record could appear with nobody below responsible for it,
               and an approval could be given by the account that asked
               for it.

               Removed explicitly, because the seeder only ever adds. Each
               one stays in the catalogue and can be granted to a custom
               role from the roles screen. */
            migrationBuilder.Sql(@"
DELETE p FROM RolePermissions p
JOIN AdminRoles r ON r.Id = p.RoleId
WHERE r.BaseRole = 'SuperAdmin'
  AND p.Permission IN (
      'agencies.manage',
      'coordinators.manage',
      'programs.create',
      'programs.manage',
      'applications.scrutinise'
  );
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /* The key stops being meaningful, and programs.manage covers
               creating again. Super Admin gets it back along with everyone
               who held programs.manage, which is where it came from. */
            migrationBuilder.Sql(@"
DELETE FROM RolePermissions WHERE Permission = 'programs.create';
");
        }
    }
}
