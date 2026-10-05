using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AgenciesBelongToTheirOperationManager : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OwnerUserId",
                table: "ImplementingAgencies",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ImplementingAgencies_OwnerUserId",
                table: "ImplementingAgencies",
                column: "OwnerUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_ImplementingAgencies_PortalUsers_OwnerUserId",
                table: "ImplementingAgencies",
                column: "OwnerUserId",
                principalTable: "PortalUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            /* ---- who empanelled what, for the ones already here ---------
               The agency's own login reports to whoever created it, which
               is the Operation Manager who empanelled the agency. That is
               the same answer this column will hold from now on, so it is
               read back out rather than left blank.

               An agency with no login, or one whose login reports to
               nobody, keeps a null owner and stays visible from the
               allocation alone — it belongs to nobody to hide it from. */
            /* EXEC, because the column is added in this same migration and an
               idempotent script puts the whole migration in one batch: SQL
               Server resolves column names when it compiles the batch. */
            migrationBuilder.Sql("""
                EXEC(N'
                UPDATE a
                SET a.OwnerUserId = u.ReportsToUserId
                FROM ImplementingAgencies a
                JOIN PortalUsers u ON u.AgencyId = a.Id
                                  AND u.BaseRole = ''AgencyAdmin''
                WHERE a.OwnerUserId IS NULL
                  AND u.ReportsToUserId IS NOT NULL;
                ');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ImplementingAgencies_PortalUsers_OwnerUserId",
                table: "ImplementingAgencies");

            migrationBuilder.DropIndex(
                name: "IX_ImplementingAgencies_OwnerUserId",
                table: "ImplementingAgencies");

            migrationBuilder.DropColumn(
                name: "OwnerUserId",
                table: "ImplementingAgencies");
        }
    }
}
