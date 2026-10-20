using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RegistersAreIndexedByTheirDefaultOrder : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Programmes_StartDate",
                table: "Programmes",
                column: "StartDate");

            migrationBuilder.CreateIndex(
                name: "IX_Applicants_RegisteredOn",
                table: "Applicants",
                column: "RegisteredOn");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Programmes_StartDate",
                table: "Programmes");

            migrationBuilder.DropIndex(
                name: "IX_Applicants_RegisteredOn",
                table: "Applicants");
        }
    }
}
