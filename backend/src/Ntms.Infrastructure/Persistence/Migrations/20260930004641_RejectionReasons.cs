using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RejectionReasons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RejectionReasonLabel",
                table: "ScrutinyEvents",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RejectionReasonId",
                table: "Applications",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RejectionReasonLabel",
                table: "Applications",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "RejectionReasons",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Label = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    RequiresNote = table.Column<bool>(type: "bit", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "varchar(40)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RejectionReasons", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Applications_RejectionReasonId",
                table: "Applications",
                column: "RejectionReasonId");

            migrationBuilder.CreateIndex(
                name: "IX_RejectionReasons_DisplayOrder",
                table: "RejectionReasons",
                column: "DisplayOrder");

            migrationBuilder.CreateIndex(
                name: "IX_RejectionReasons_Label",
                table: "RejectionReasons",
                column: "Label",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Applications_RejectionReasons_RejectionReasonId",
                table: "Applications",
                column: "RejectionReasonId",
                principalTable: "RejectionReasons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            /* A starting list, so the dropdown is usable the day this lands
               rather than the day somebody remembers to fill it in. Every
               one of them is editable, and a scheme that rejects for
               something else adds it. */
            migrationBuilder.Sql("""
                SET QUOTED_IDENTIFIER ON;
                INSERT INTO dbo.RejectionReasons
                    (Label, DisplayOrder, RequiresNote, Status, CreatedOn)
                VALUES
                    ('Documents are not legible',              10, 0, 'Active', GETUTCDATE()),
                    ('Required documents are missing',         20, 1, 'Active', GETUTCDATE()),
                    ('Documents do not match the details given', 30, 1, 'Active', GETUTCDATE()),
                    ('PAN could not be verified',              40, 0, 'Active', GETUTCDATE()),
                    ('Does not meet the minimum qualification', 50, 0, 'Active', GETUTCDATE()),
                    ('Does not meet the experience requirement', 60, 0, 'Active', GETUTCDATE()),
                    ('Already registered under this category', 70, 0, 'Active', GETUTCDATE()),
                    ('Fee has not been paid',                  80, 0, 'Active', GETUTCDATE()),
                    ('Other',                                  90, 1, 'Active', GETUTCDATE());
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Applications_RejectionReasons_RejectionReasonId",
                table: "Applications");

            migrationBuilder.DropTable(
                name: "RejectionReasons");

            migrationBuilder.DropIndex(
                name: "IX_Applications_RejectionReasonId",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "RejectionReasonLabel",
                table: "ScrutinyEvents");

            migrationBuilder.DropColumn(
                name: "RejectionReasonId",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "RejectionReasonLabel",
                table: "Applications");
        }
    }
}
