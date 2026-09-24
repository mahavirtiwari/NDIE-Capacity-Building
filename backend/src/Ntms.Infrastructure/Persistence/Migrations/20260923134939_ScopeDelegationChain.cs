using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ScopeDelegationChain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AgencyStates",
                columns: table => new
                {
                    AgencyId = table.Column<int>(type: "int", nullable: false),
                    StateCode = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AgencyStates", x => new { x.AgencyId, x.StateCode });
                    table.ForeignKey(
                        name: "FK_AgencyStates_ImplementingAgencies_AgencyId",
                        column: x => x.AgencyId,
                        principalTable: "ImplementingAgencies",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AgencyStates_LgdStates_StateCode",
                        column: x => x.StateCode,
                        principalTable: "LgdStates",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UserDistricts",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    DistrictCode = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserDistricts", x => new { x.UserId, x.DistrictCode });
                    table.ForeignKey(
                        name: "FK_UserDistricts_LgdDistricts_DistrictCode",
                        column: x => x.DistrictCode,
                        principalTable: "LgdDistricts",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserDistricts_PortalUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "PortalUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "UserStates",
                columns: table => new
                {
                    UserId = table.Column<int>(type: "int", nullable: false),
                    StateCode = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserStates", x => new { x.UserId, x.StateCode });
                    table.ForeignKey(
                        name: "FK_UserStates_LgdStates_StateCode",
                        column: x => x.StateCode,
                        principalTable: "LgdStates",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UserStates_PortalUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "PortalUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AgencyStates_StateCode",
                table: "AgencyStates",
                column: "StateCode");

            migrationBuilder.CreateIndex(
                name: "IX_UserDistricts_DistrictCode",
                table: "UserDistricts",
                column: "DistrictCode");

            migrationBuilder.CreateIndex(
                name: "IX_UserStates_StateCode",
                table: "UserStates",
                column: "StateCode");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AgencyStates");

            migrationBuilder.DropTable(
                name: "UserDistricts");

            migrationBuilder.DropTable(
                name: "UserStates");
        }
    }
}
