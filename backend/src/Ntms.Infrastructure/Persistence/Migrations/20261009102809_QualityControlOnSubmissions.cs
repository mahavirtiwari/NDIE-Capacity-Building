using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class QualityControlOnSubmissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "QcByUserId",
                table: "ProgrammeSubmissions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QcByUserName",
                table: "ProgrammeSubmissions",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "QcOn",
                table: "ProgrammeSubmissions",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QcRemarks",
                table: "ProgrammeSubmissions",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "QcStatus",
                table: "ProgrammeSubmissions",
                type: "varchar(40)",
                nullable: false,
                defaultValue: "Pending");

            /* Programmes submitted before quality control existed have not
               been quality controlled. Writing them in as approved would
               be a record of a check that nobody made — so they go into
               the manager's pending queue, which is both true and
               actionable. On a scheme with years of history that is a
               queue worth knowing about before this is deployed.

               The scaffolded default was an empty string, which is not a
               value the enum can read: every one of these rows would have
               failed to load. */
            migrationBuilder.Sql(
                "EXEC(N'UPDATE [ProgrammeSubmissions] SET [QcStatus] = ''Pending'' "
                + "WHERE [QcStatus] IS NULL OR [QcStatus] = ''''');");

            migrationBuilder.CreateIndex(
                name: "IX_ProgrammeSubmissions_QcByUserId",
                table: "ProgrammeSubmissions",
                column: "QcByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgrammeSubmissions_QcStatus",
                table: "ProgrammeSubmissions",
                column: "QcStatus");

            migrationBuilder.AddForeignKey(
                name: "FK_ProgrammeSubmissions_PortalUsers_QcByUserId",
                table: "ProgrammeSubmissions",
                column: "QcByUserId",
                principalTable: "PortalUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProgrammeSubmissions_PortalUsers_QcByUserId",
                table: "ProgrammeSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_ProgrammeSubmissions_QcByUserId",
                table: "ProgrammeSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_ProgrammeSubmissions_QcStatus",
                table: "ProgrammeSubmissions");

            migrationBuilder.DropColumn(
                name: "QcByUserId",
                table: "ProgrammeSubmissions");

            migrationBuilder.DropColumn(
                name: "QcByUserName",
                table: "ProgrammeSubmissions");

            migrationBuilder.DropColumn(
                name: "QcOn",
                table: "ProgrammeSubmissions");

            migrationBuilder.DropColumn(
                name: "QcRemarks",
                table: "ProgrammeSubmissions");

            migrationBuilder.DropColumn(
                name: "QcStatus",
                table: "ProgrammeSubmissions");
        }
    }
}
