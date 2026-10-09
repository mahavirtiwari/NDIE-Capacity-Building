using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class MonitoringPhotoCapture : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "DeviceModel",
                table: "MonitoringPhotos",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DeviceOsVersion",
                table: "MonitoringPhotos",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DevicePlatform",
                table: "MonitoringPhotos",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "Stamped",
                table: "MonitoringPhotos",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "SyncedOn",
                table: "MonitoringPhotos",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            /* Every photograph already on the server arrived before this
               column existed, and CapturedOn held the moment it arrived —
               it was set from the server's clock, not the handset's. So
               for the existing rows the two are the same instant, and
               that is the honest value to carry across. Left at the
               scaffolded default they would read as the year 1.

               EXEC, because an idempotent script compiles a migration as
               one batch and a statement naming a column that the same
               batch adds will not compile. */
            migrationBuilder.Sql(
                "EXEC(N'UPDATE [MonitoringPhotos] SET [SyncedOn] = [CapturedOn]');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "DeviceModel",
                table: "MonitoringPhotos");

            migrationBuilder.DropColumn(
                name: "DeviceOsVersion",
                table: "MonitoringPhotos");

            migrationBuilder.DropColumn(
                name: "DevicePlatform",
                table: "MonitoringPhotos");

            migrationBuilder.DropColumn(
                name: "Stamped",
                table: "MonitoringPhotos");

            migrationBuilder.DropColumn(
                name: "SyncedOn",
                table: "MonitoringPhotos");
        }
    }
}
