using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ParticipantMarksheet : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ResultRecordedOn",
                table: "ProgrammeParticipants",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "VivaMarks",
                table: "ProgrammeParticipants",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "WrittenMarks",
                table: "ProgrammeParticipants",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ParticipantSkillMarks",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ParticipantId = table.Column<int>(type: "int", nullable: false),
                    SkillId = table.Column<int>(type: "int", nullable: false),
                    Marks = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TrainerId = table.Column<int>(type: "int", nullable: true),
                    MarkedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParticipantSkillMarks", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ParticipantSkillMarks_EvaluationSkills_SkillId",
                        column: x => x.SkillId,
                        principalTable: "EvaluationSkills",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ParticipantSkillMarks_ProgrammeParticipants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalTable: "ProgrammeParticipants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ParticipantSkillMarks_ProgrammeTrainers_TrainerId",
                        column: x => x.TrainerId,
                        principalTable: "ProgrammeTrainers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantSkillMarks_ParticipantId_SkillId",
                table: "ParticipantSkillMarks",
                columns: new[] { "ParticipantId", "SkillId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantSkillMarks_SkillId",
                table: "ParticipantSkillMarks",
                column: "SkillId");

            migrationBuilder.CreateIndex(
                name: "IX_ParticipantSkillMarks_TrainerId",
                table: "ParticipantSkillMarks",
                column: "TrainerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ParticipantSkillMarks");

            migrationBuilder.DropColumn(
                name: "ResultRecordedOn",
                table: "ProgrammeParticipants");

            migrationBuilder.DropColumn(
                name: "VivaMarks",
                table: "ProgrammeParticipants");

            migrationBuilder.DropColumn(
                name: "WrittenMarks",
                table: "ProgrammeParticipants");
        }
    }
}
