using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MoreThanOneWayIntoAProgramme : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProgramTypeEligibilityRoutes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProgramTypeId = table.Column<int>(type: "int", nullable: false),
                    QualificationCode = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    MinExperienceYears = table.Column<int>(type: "int", nullable: false),
                    Requirements = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: true),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgramTypeEligibilityRoutes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgramTypeEligibilityRoutes_ProgramTypes_ProgramTypeId",
                        column: x => x.ProgramTypeId,
                        principalTable: "ProgramTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProgramTypeEligibilityRoutes_ProgramTypeId_DisplayOrder",
                table: "ProgramTypeEligibilityRoutes",
                columns: new[] { "ProgramTypeId", "DisplayOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_ProgramTypeEligibilityRoutes_ProgramTypeId_QualificationCode",
                table: "ProgramTypeEligibilityRoutes",
                columns: new[] { "ProgramTypeId", "QualificationCode" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProgramTypeEligibilityRoutes");
        }
    }
}
