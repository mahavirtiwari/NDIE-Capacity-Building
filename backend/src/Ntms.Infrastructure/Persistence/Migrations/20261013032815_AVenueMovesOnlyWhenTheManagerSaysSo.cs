using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AVenueMovesOnlyWhenTheManagerSaysSo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RequestedCity",
                table: "Programmes",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "RequestedDistrictCode",
                table: "Programmes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequestedPincode",
                table: "Programmes",
                type: "nvarchar(6)",
                maxLength: 6,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RequestedVenue",
                table: "Programmes",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "VenueChangeReason",
                table: "Programmes",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "VenueChangeRequestedByUserId",
                table: "Programmes",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "VenueChangeRequestedOn",
                table: "Programmes",
                type: "datetime2",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Programmes_RequestedDistrictCode",
                table: "Programmes",
                column: "RequestedDistrictCode");

            migrationBuilder.AddForeignKey(
                name: "FK_Programmes_LgdDistricts_RequestedDistrictCode",
                table: "Programmes",
                column: "RequestedDistrictCode",
                principalTable: "LgdDistricts",
                principalColumn: "Code",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Programmes_LgdDistricts_RequestedDistrictCode",
                table: "Programmes");

            migrationBuilder.DropIndex(
                name: "IX_Programmes_RequestedDistrictCode",
                table: "Programmes");

            migrationBuilder.DropColumn(
                name: "RequestedCity",
                table: "Programmes");

            migrationBuilder.DropColumn(
                name: "RequestedDistrictCode",
                table: "Programmes");

            migrationBuilder.DropColumn(
                name: "RequestedPincode",
                table: "Programmes");

            migrationBuilder.DropColumn(
                name: "RequestedVenue",
                table: "Programmes");

            migrationBuilder.DropColumn(
                name: "VenueChangeReason",
                table: "Programmes");

            migrationBuilder.DropColumn(
                name: "VenueChangeRequestedByUserId",
                table: "Programmes");

            migrationBuilder.DropColumn(
                name: "VenueChangeRequestedOn",
                table: "Programmes");
        }
    }
}
