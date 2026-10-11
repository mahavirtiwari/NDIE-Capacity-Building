using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ARegistrationRemembersItsBatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProgrammeId",
                table: "Applications",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Applications_ProgrammeId",
                table: "Applications",
                column: "ProgrammeId");

            migrationBuilder.AddForeignKey(
                name: "FK_Applications_Programmes_ProgrammeId",
                table: "Applications",
                column: "ProgrammeId",
                principalTable: "Programmes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Applications_Programmes_ProgrammeId",
                table: "Applications");

            migrationBuilder.DropIndex(
                name: "IX_Applications_ProgrammeId",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "ProgrammeId",
                table: "Applications");
        }
    }
}
