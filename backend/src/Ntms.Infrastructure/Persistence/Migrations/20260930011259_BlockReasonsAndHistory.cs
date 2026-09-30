using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BlockReasonsAndHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "BlockReasonLabel",
                table: "Applicants",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "BlockedOn",
                table: "Applicants",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "BlockReasons",
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
                    table.PrimaryKey("PK_BlockReasons", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ApplicantStatusEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ApplicantId = table.Column<int>(type: "int", nullable: false),
                    Blocked = table.Column<bool>(type: "bit", nullable: false),
                    BlockReasonId = table.Column<int>(type: "int", nullable: true),
                    ReasonLabel = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Remarks = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    ByUserId = table.Column<int>(type: "int", nullable: true),
                    ByUserName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    ByUserCode = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    On = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ApplicantStatusEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ApplicantStatusEvents_Applicants_ApplicantId",
                        column: x => x.ApplicantId,
                        principalTable: "Applicants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ApplicantStatusEvents_BlockReasons_BlockReasonId",
                        column: x => x.BlockReasonId,
                        principalTable: "BlockReasons",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ApplicantStatusEvents_ApplicantId_On",
                table: "ApplicantStatusEvents",
                columns: new[] { "ApplicantId", "On" });

            migrationBuilder.CreateIndex(
                name: "IX_ApplicantStatusEvents_BlockReasonId",
                table: "ApplicantStatusEvents",
                column: "BlockReasonId");

            migrationBuilder.CreateIndex(
                name: "IX_BlockReasons_DisplayOrder",
                table: "BlockReasons",
                column: "DisplayOrder");

            migrationBuilder.CreateIndex(
                name: "IX_BlockReasons_Label",
                table: "BlockReasons",
                column: "Label",
                unique: true);

            /* A starting list, so an account can be blocked the day this
               lands. Every one is editable; a scheme that blocks for
               something else adds it. */
            migrationBuilder.Sql("""
                SET QUOTED_IDENTIFIER ON;
                INSERT INTO dbo.BlockReasons
                    (Label, DisplayOrder, RequiresNote, Status, CreatedOn)
                VALUES
                    ('Fraudulent or forged documents',       10, 1, 'Active', GETUTCDATE()),
                    ('Impersonation or a false identity',    20, 1, 'Active', GETUTCDATE()),
                    ('Duplicate account for the same person', 30, 1, 'Active', GETUTCDATE()),
                    ('Misconduct during a programme',        40, 1, 'Active', GETUTCDATE()),
                    ('Misconduct during an examination',     50, 1, 'Active', GETUTCDATE()),
                    ('Requested by the applicant',           60, 0, 'Active', GETUTCDATE()),
                    ('Directed by the ministry',             70, 1, 'Active', GETUTCDATE()),
                    ('Other',                                80, 1, 'Active', GETUTCDATE());
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ApplicantStatusEvents");

            migrationBuilder.DropTable(
                name: "BlockReasons");

            migrationBuilder.DropColumn(
                name: "BlockReasonLabel",
                table: "Applicants");

            migrationBuilder.DropColumn(
                name: "BlockedOn",
                table: "Applicants");
        }
    }
}
