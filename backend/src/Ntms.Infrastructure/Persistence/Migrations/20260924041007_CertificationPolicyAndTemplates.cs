using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CertificationPolicyAndTemplates : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CertificationPolicy",
                table: "ProgramTypes",
                type: "varchar(40)",
                nullable: false,
                // Existing programmes keep doing exactly what they did before this
                // setting existed: certify whoever qualifies, nothing for the rest.
                defaultValue: "QualificationOnly");

            migrationBuilder.CreateTable(
                name: "CertificateTemplates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProgramTypeId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<string>(type: "varchar(40)", nullable: false),
                    RelativePath = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CertificateTemplates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CertificateTemplates_ProgramTypes_ProgramTypeId",
                        column: x => x.ProgramTypeId,
                        principalTable: "ProgramTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_CertificateTemplates_ProgramTypeId_Kind",
                table: "CertificateTemplates",
                columns: new[] { "ProgramTypeId", "Kind" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CertificateTemplates");

            migrationBuilder.DropColumn(
                name: "CertificationPolicy",
                table: "ProgramTypes");
        }
    }
}
