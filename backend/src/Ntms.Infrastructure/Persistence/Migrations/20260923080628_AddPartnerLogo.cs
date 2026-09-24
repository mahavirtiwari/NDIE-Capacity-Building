using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPartnerLogo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PartnerLogoContentType",
                table: "BrandingSettings",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "PartnerLogoData",
                table: "BrandingSettings",
                type: "varbinary(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PartnerLogoFileName",
                table: "BrandingSettings",
                type: "nvarchar(260)",
                maxLength: 260,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PartnerLogoVersion",
                table: "BrandingSettings",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "PartnerName",
                table: "BrandingSettings",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PartnerLogoContentType",
                table: "BrandingSettings");

            migrationBuilder.DropColumn(
                name: "PartnerLogoData",
                table: "BrandingSettings");

            migrationBuilder.DropColumn(
                name: "PartnerLogoFileName",
                table: "BrandingSettings");

            migrationBuilder.DropColumn(
                name: "PartnerLogoVersion",
                table: "BrandingSettings");

            migrationBuilder.DropColumn(
                name: "PartnerName",
                table: "BrandingSettings");
        }
    }
}
