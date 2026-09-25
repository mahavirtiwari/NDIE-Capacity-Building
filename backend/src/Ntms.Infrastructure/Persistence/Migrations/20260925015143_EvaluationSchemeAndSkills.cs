using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class EvaluationSchemeAndSkills : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Evaluation_Kind",
                table: "ProgramTypes",
                type: "varchar(40)",
                nullable: false,
                /* Existing types default to Written rather than to an empty
                   string that parses to nothing: every one of them already has
                   IsExamMandatory true, so Written is what they mean today. */
                defaultValue: "Written");

            migrationBuilder.AddColumn<int>(
                name: "Evaluation_OverallPassMarks",
                table: "ProgramTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Evaluation_TotalMarks",
                table: "ProgramTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Evaluation_VivaMarks",
                table: "ProgramTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Evaluation_VivaPassMarks",
                table: "ProgramTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Evaluation_WrittenMarks",
                table: "ProgramTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "Evaluation_WrittenPassMarks",
                table: "ProgramTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "EvaluationSkills",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProgramTypeId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    MaxMarks = table.Column<int>(type: "int", nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "varchar(40)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvaluationSkills", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvaluationSkills_ProgramTypes_ProgramTypeId",
                        column: x => x.ProgramTypeId,
                        principalTable: "ProgramTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_EvaluationSkills_ProgramTypeId_Name",
                table: "EvaluationSkills",
                columns: new[] { "ProgramTypeId", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "EvaluationSkills");

            migrationBuilder.DropColumn(
                name: "Evaluation_Kind",
                table: "ProgramTypes");

            migrationBuilder.DropColumn(
                name: "Evaluation_OverallPassMarks",
                table: "ProgramTypes");

            migrationBuilder.DropColumn(
                name: "Evaluation_TotalMarks",
                table: "ProgramTypes");

            migrationBuilder.DropColumn(
                name: "Evaluation_VivaMarks",
                table: "ProgramTypes");

            migrationBuilder.DropColumn(
                name: "Evaluation_VivaPassMarks",
                table: "ProgramTypes");

            migrationBuilder.DropColumn(
                name: "Evaluation_WrittenMarks",
                table: "ProgramTypes");

            migrationBuilder.DropColumn(
                name: "Evaluation_WrittenPassMarks",
                table: "ProgramTypes");
        }
    }
}
