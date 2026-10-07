using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class BatchHoursAndVenuePincode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<TimeOnly>(
                name: "EndTime",
                table: "Programmes",
                type: "time",
                nullable: false,
                // The batches already on the books ran office hours; saying
                // midnight to midnight would be worse than saying nothing.
                defaultValue: new TimeOnly(17, 0, 0));

            migrationBuilder.AddColumn<string>(
                name: "Pincode",
                table: "Programmes",
                type: "nvarchar(6)",
                maxLength: 6,
                nullable: true);

            migrationBuilder.AddColumn<TimeOnly>(
                name: "StartTime",
                table: "Programmes",
                type: "time",
                nullable: false,
                defaultValue: new TimeOnly(10, 0, 0));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EndTime",
                table: "Programmes");

            migrationBuilder.DropColumn(
                name: "Pincode",
                table: "Programmes");

            migrationBuilder.DropColumn(
                name: "StartTime",
                table: "Programmes");
        }
    }
}
