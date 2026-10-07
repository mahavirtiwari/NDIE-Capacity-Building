using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AFloorForABatchAndAPostponementAsked : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MinParticipants",
                table: "ProgramTypes",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "PostponementReason",
                table: "Programmes",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PostponementRequestedByUserId",
                table: "Programmes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PostponementRequestedOn",
                table: "Programmes",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MinParticipants",
                table: "ProgramTypes");

            migrationBuilder.DropColumn(
                name: "PostponementReason",
                table: "Programmes");

            migrationBuilder.DropColumn(
                name: "PostponementRequestedByUserId",
                table: "Programmes");

            migrationBuilder.DropColumn(
                name: "PostponementRequestedOn",
                table: "Programmes");
        }
    }
}
