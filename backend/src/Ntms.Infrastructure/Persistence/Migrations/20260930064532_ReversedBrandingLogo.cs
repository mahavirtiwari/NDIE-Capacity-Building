using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ReversedBrandingLogo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ReversedLogoContentType",
                table: "BrandingSettings",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "ReversedLogoData",
                table: "BrandingSettings",
                type: "varbinary(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ReversedLogoFileName",
                table: "BrandingSettings",
                type: "nvarchar(260)",
                maxLength: 260,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReversedLogoVersion",
                table: "BrandingSettings",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReversedLogoContentType",
                table: "BrandingSettings");

            migrationBuilder.DropColumn(
                name: "ReversedLogoData",
                table: "BrandingSettings");

            migrationBuilder.DropColumn(
                name: "ReversedLogoFileName",
                table: "BrandingSettings");

            migrationBuilder.DropColumn(
                name: "ReversedLogoVersion",
                table: "BrandingSettings");
        }
    }
}
