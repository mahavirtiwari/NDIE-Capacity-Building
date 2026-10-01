using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    /// <summary>
    /// What a programme type asks its participants once the batch is over.
    ///
    /// Four tables, and their shape is the point. FeedbackResponses holds
    /// the batch, the programme type and the answers - no applicant, no
    /// participant, and no CreatedBy either, which is why it is not an
    /// auditable entity: that column is filled with the signed-in
    /// person's name on every write and would have put the author's name
    /// on an anonymous answer.
    ///
    /// Its SubmittedOn is a date rather than a timestamp. A receipt is
    /// written at the same instant as the answers it belongs to, so two
    /// exact times would let the pair be matched up and the anonymity
    /// undone by anybody able to read the tables. The day is all a report
    /// needs.
    ///
    /// FeedbackReceipts holds the participant and no answers, so the app
    /// can stop asking and a second submission can be refused.
    ///
    /// Anonymity is therefore a property of the schema rather than a rule
    /// to remember: the query that would attribute an answer to a person
    /// cannot be written.
    /// </summary>
    public partial class FeedbackAfterTheBatch : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "FeedbackForms",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProgramTypeId = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Intro = table.Column<string>(type: "nvarchar(600)", maxLength: 600, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "varchar(40)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackForms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackForms_ProgramTypes_ProgramTypeId",
                        column: x => x.ProgramTypeId,
                        principalTable: "ProgramTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackReceipts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ParticipantId = table.Column<int>(type: "int", nullable: false),
                    SubmittedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackReceipts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackReceipts_ProgrammeParticipants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalTable: "ProgrammeParticipants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackResponses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProgrammeId = table.Column<int>(type: "int", nullable: false),
                    ProgramTypeId = table.Column<int>(type: "int", nullable: false),
                    FeedbackFormId = table.Column<int>(type: "int", nullable: true),
                    Answers = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    SubmittedOn = table.Column<DateOnly>(type: "date", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackResponses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackResponses_ProgramTypes_ProgramTypeId",
                        column: x => x.ProgramTypeId,
                        principalTable: "ProgramTypes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_FeedbackResponses_Programmes_ProgrammeId",
                        column: x => x.ProgrammeId,
                        principalTable: "Programmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackQuestions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    FormId = table.Column<int>(type: "int", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Text = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    HelpText = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    Type = table.Column<string>(type: "varchar(40)", nullable: false),
                    Required = table.Column<bool>(type: "bit", nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    MaxRating = table.Column<int>(type: "int", nullable: false),
                    OptionSetId = table.Column<int>(type: "int", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackQuestions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackQuestions_FeedbackForms_FormId",
                        column: x => x.FormId,
                        principalTable: "FeedbackForms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_FeedbackQuestions_OptionSets_OptionSetId",
                        column: x => x.OptionSetId,
                        principalTable: "OptionSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "FeedbackQuestionOptions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    QuestionId = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FeedbackQuestionOptions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_FeedbackQuestionOptions_FeedbackQuestions_QuestionId",
                        column: x => x.QuestionId,
                        principalTable: "FeedbackQuestions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackForms_ProgramTypeId",
                table: "FeedbackForms",
                column: "ProgramTypeId",
                unique: true,
                filter: "[Status] = 'Active'");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackQuestionOptions_QuestionId",
                table: "FeedbackQuestionOptions",
                column: "QuestionId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackQuestions_FormId_Key",
                table: "FeedbackQuestions",
                columns: new[] { "FormId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackQuestions_OptionSetId",
                table: "FeedbackQuestions",
                column: "OptionSetId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackReceipts_ParticipantId",
                table: "FeedbackReceipts",
                column: "ParticipantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackResponses_ProgrammeId",
                table: "FeedbackResponses",
                column: "ProgrammeId");

            migrationBuilder.CreateIndex(
                name: "IX_FeedbackResponses_ProgramTypeId",
                table: "FeedbackResponses",
                column: "ProgramTypeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "FeedbackQuestionOptions");

            migrationBuilder.DropTable(
                name: "FeedbackReceipts");

            migrationBuilder.DropTable(
                name: "FeedbackResponses");

            migrationBuilder.DropTable(
                name: "FeedbackQuestions");

            migrationBuilder.DropTable(
                name: "FeedbackForms");
        }
    }
}
