using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AnAgencySuspensionIsRecorded : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AgencyStatusEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    AgencyId = table.Column<int>(type: "int", nullable: false),
                    FromStatus = table.Column<string>(type: "varchar(40)", nullable: false),
                    ToStatus = table.Column<string>(type: "varchar(40)", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ByUserId = table.Column<int>(type: "int", nullable: true),
                    ByUserName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    ByUserCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    On = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgencyStatusEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AgencyStatusEvents_ImplementingAgencies_AgencyId",
                        column: x => x.AgencyId,
                        principalTable: "ImplementingAgencies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgencyStatusEvents_AgencyId_On",
                table: "AgencyStatusEvents",
                columns: new[] { "AgencyId", "On" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AgencyStatusEvents");
        }
    }
}
