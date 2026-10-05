using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RolesBelongToTheirCreator : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OwnerUserId",
                table: "AdminRoles",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_AdminRoles_OwnerUserId",
                table: "AdminRoles",
                column: "OwnerUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_AdminRoles_PortalUsers_OwnerUserId",
                table: "AdminRoles",
                column: "OwnerUserId",
                principalTable: "PortalUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            /* ---- the Super Admin keeps the two it settles ---------------
               Admin and Ministry are the Super Admin's to shape, so the
               seeded roles for those tiers are handed to it. Everything
               below stays ownerless: the default for its tier, offered to
               whoever appoints one and reshaped by none of them. */
            migrationBuilder.Sql("""
                EXEC(N'
                UPDATE r
                SET r.OwnerUserId = u.Id
                FROM AdminRoles r
                CROSS JOIN (SELECT TOP 1 Id FROM PortalUsers
                            WHERE BaseRole = ''SuperAdmin'' ORDER BY Id) u
                WHERE r.BaseRole IN (''Admin'', ''Ministry'');
                ');
                """);

            /* ---- each tier settles the tier it appoints ------------------
               Taken away on 1 October, when roles were the Super Admin's
               alone. They are not: an Admin decides what its Operation
               Managers may reach, within what it holds itself, and the same
               down the chain. Granted to the three tiers that appoint
               somebody; a Coordinator appoints nobody and gets nothing. */
            migrationBuilder.Sql("""
                INSERT INTO RolePermissions (RoleId, Permission)
                SELECT r.Id, p.Permission
                FROM AdminRoles r
                CROSS JOIN (VALUES ('roles.view'), ('roles.manage')) AS p(Permission)
                WHERE r.BaseRole IN ('Admin', 'OperationManager', 'AgencyAdmin')
                  AND NOT EXISTS (
                      SELECT 1 FROM RolePermissions x
                      WHERE x.RoleId = r.Id AND x.Permission = p.Permission);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /* The grants go back with the column. Ownership cannot be
               restored — there is nowhere left to read it from — so a
               reverted database has the Super Admin settling everything
               again, which is where it started. */
            migrationBuilder.Sql("""
                DELETE p FROM RolePermissions p
                JOIN AdminRoles r ON r.Id = p.RoleId
                WHERE r.BaseRole IN ('Admin', 'OperationManager', 'AgencyAdmin')
                  AND p.Permission IN ('roles.view', 'roles.manage');
                """);

            migrationBuilder.DropForeignKey(
                name: "FK_AdminRoles_PortalUsers_OwnerUserId",
                table: "AdminRoles");

            migrationBuilder.DropIndex(
                name: "IX_AdminRoles_OwnerUserId",
                table: "AdminRoles");

            migrationBuilder.DropColumn(
                name: "OwnerUserId",
                table: "AdminRoles");
        }
    }
}
