using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AnAgencyForwardsItsReport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ForwardRemarks",
                table: "ProgrammeSubmissions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ForwardedByUserId",
                table: "ProgrammeSubmissions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ForwardedByUserName",
                table: "ProgrammeSubmissions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ForwardedOn",
                table: "ProgrammeSubmissions",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ForwardRemarks",
                table: "ProgrammeSubmissions");

            migrationBuilder.DropColumn(
                name: "ForwardedByUserId",
                table: "ProgrammeSubmissions");

            migrationBuilder.DropColumn(
                name: "ForwardedByUserName",
                table: "ProgrammeSubmissions");

            migrationBuilder.DropColumn(
                name: "ForwardedOn",
                table: "ProgrammeSubmissions");
        }
    }
}
