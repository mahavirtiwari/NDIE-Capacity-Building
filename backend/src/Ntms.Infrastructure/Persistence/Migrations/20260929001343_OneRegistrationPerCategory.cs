using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class OneRegistrationPerCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Applicants_Pan",
                table: "Applicants");

            migrationBuilder.CreateIndex(
                name: "IX_Applicants_Pan_CategoryId",
                table: "Applicants",
                columns: new[] { "Pan", "CategoryId" },
                unique: true);
        }

        /// <inheritdoc />
        /// <remarks>
        /// Going back restores the unique index on PAN alone, which fails if
        /// anybody has since registered under a second category — as this
        /// change exists to let them. That is the right failure: the rollback
        /// cannot happen without deciding which of their registrations to
        /// drop, and a migration must not make that choice quietly.
        /// </remarks>
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Applicants_Pan_CategoryId",
                table: "Applicants");

            migrationBuilder.CreateIndex(
                name: "IX_Applicants_Pan",
                table: "Applicants",
                column: "Pan",
                unique: true);
        }
    }
}
