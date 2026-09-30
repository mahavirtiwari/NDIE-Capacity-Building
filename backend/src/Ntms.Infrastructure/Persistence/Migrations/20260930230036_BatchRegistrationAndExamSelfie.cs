using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BatchRegistrationAndExamSelfie : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SelfieContentType",
                table: "ExamAttempts",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "SelfieData",
                table: "ExamAttempts",
                type: "varbinary(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "SelfieTakenOn",
                table: "ExamAttempts",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SelfieContentType",
                table: "ExamAttempts");

            migrationBuilder.DropColumn(
                name: "SelfieData",
                table: "ExamAttempts");

            migrationBuilder.DropColumn(
                name: "SelfieTakenOn",
                table: "ExamAttempts");
        }
    }
}
