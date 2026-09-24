using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CurriculumKeyedOnProgramType : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Curricula_ProgrammeCode",
                table: "Curricula");

            migrationBuilder.DropIndex(
                name: "IX_Curricula_ProgramTypeId",
                table: "Curricula");

            migrationBuilder.DropColumn(
                name: "ProgrammeCategory",
                table: "Curricula");

            migrationBuilder.DropColumn(
                name: "ProgrammeCode",
                table: "Curricula");

            migrationBuilder.DropColumn(
                name: "ProgrammeName",
                table: "Curricula");

            migrationBuilder.DropColumn(
                name: "Version",
                table: "Curricula");

            migrationBuilder.AlterColumn<int>(
                name: "ProgramTypeId",
                table: "Curricula",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Curricula_ProgramTypeId",
                table: "Curricula",
                column: "ProgramTypeId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Curricula_ProgramTypeId",
                table: "Curricula");

            migrationBuilder.AlterColumn<int>(
                name: "ProgramTypeId",
                table: "Curricula",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<string>(
                name: "ProgrammeCategory",
                table: "Curricula",
                type: "varchar(40)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ProgrammeCode",
                table: "Curricula",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ProgrammeName",
                table: "Curricula",
                type: "nvarchar(250)",
                maxLength: 250,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Version",
                table: "Curricula",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Curricula_ProgrammeCode",
                table: "Curricula",
                column: "ProgrammeCode",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Curricula_ProgramTypeId",
                table: "Curricula",
                column: "ProgramTypeId");
        }
    }
}
