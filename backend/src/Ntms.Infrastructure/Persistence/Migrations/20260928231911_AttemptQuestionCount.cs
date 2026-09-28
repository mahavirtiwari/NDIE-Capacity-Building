using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AttemptQuestionCount : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "QuestionCount",
                table: "ExamAttempts",
                type: "int",
                nullable: false,
                defaultValue: 0);

            /* Sittings taken before the count was recorded. Their paper is the
               best answer available, and from here on it is also the right
               one: a paper that has been sat can no longer have its questions
               changed, so what it holds now is what it held then. */
            migrationBuilder.Sql("""
                UPDATE a
                SET a.QuestionCount = (
                    SELECT COUNT(*) FROM ExamQuestions q WHERE q.ExamPaperId = a.ExamPaperId)
                FROM ExamAttempts a
                WHERE a.QuestionCount = 0;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "QuestionCount",
                table: "ExamAttempts");
        }
    }
}
