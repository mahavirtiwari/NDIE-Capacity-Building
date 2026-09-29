using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UploadLimitAndPanSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "MaxUploadMb",
                table: "SystemSettings",
                type: "int",
                nullable: false,
                // The shipped default, not zero: the existing row would
                // otherwise refuse every upload the moment this lands.
                defaultValue: 64);

            migrationBuilder.AddColumn<string>(
                name: "PanApiKey",
                table: "SystemSettings",
                type: "nvarchar(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PanApiKeyHeader",
                table: "SystemSettings",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "X-API-KEY");

            migrationBuilder.AddColumn<string>(
                name: "PanEndpoint",
                table: "SystemSettings",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PanNamePath",
                table: "SystemSettings",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "name");

            migrationBuilder.AddColumn<string>(
                name: "PanProvider",
                table: "SystemSettings",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "PanRefuseWhenUnavailable",
                table: "SystemSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "PanTimeoutSeconds",
                table: "SystemSettings",
                type: "int",
                nullable: false,
                defaultValue: 10);

            migrationBuilder.AddColumn<string>(
                name: "PanValidPath",
                table: "SystemSettings",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "valid");

            migrationBuilder.AddColumn<bool>(
                name: "PanVerificationEnabled",
                table: "SystemSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxUploadMb",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "PanApiKey",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "PanApiKeyHeader",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "PanEndpoint",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "PanNamePath",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "PanProvider",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "PanRefuseWhenUnavailable",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "PanTimeoutSeconds",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "PanValidPath",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "PanVerificationEnabled",
                table: "SystemSettings");
        }
    }
}
