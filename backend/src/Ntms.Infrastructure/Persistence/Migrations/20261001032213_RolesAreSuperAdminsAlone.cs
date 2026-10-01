using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// The roles screen becomes Super Admin's alone.
    ///
    /// What a role is, and what it may do, is settled at the top. Everyone
    /// below allocates out of what they themselves hold, which is a
    /// different question and is enforced elsewhere - an Admin could never
    /// grant a permission it did not have, but it could read and reshape
    /// the catalogue those permissions come from.
    ///
    /// Admin and Implementing Agency both still appoint people, so both
    /// still need the list of roles to put in a dropdown. That list moved
    /// to the permission for creating a user, which is what it is actually
    /// for, so taking roles.view away does not stop either of them
    /// appointing anybody.
    /// </summary>
    public partial class RolesAreSuperAdminsAlone : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
DELETE p FROM RolePermissions p
JOIN AdminRoles r ON r.Id = p.RoleId
WHERE r.BaseRole IN ('Admin', 'AgencyAdmin')
  AND p.Permission = 'roles.view';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
INSERT INTO RolePermissions (RoleId, Permission)
SELECT r.Id, 'roles.view'
FROM AdminRoles r
WHERE r.BaseRole IN ('Admin', 'AgencyAdmin')
  AND NOT EXISTS (
      SELECT 1 FROM RolePermissions p
      WHERE p.RoleId = r.Id AND p.Permission = 'roles.view'
  );
");
        }
    }
}
