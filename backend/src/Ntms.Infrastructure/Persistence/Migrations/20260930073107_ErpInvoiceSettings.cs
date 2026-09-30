using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ErpInvoiceSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ErpApiKey",
                table: "SystemSettings",
                type: "nvarchar(400)",
                maxLength: 400,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ErpApiKeyHeader",
                table: "SystemSettings",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: false,
                /* Not "": the property opens at X-API-KEY and the existing row
                   must match it, or the header goes out empty. */
                defaultValue: "X-API-KEY");

            migrationBuilder.AddColumn<bool>(
                name: "ErpInvoiceEnabled",
                table: "SystemSettings",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ErpInvoiceEndpoint",
                table: "SystemSettings",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ErpInvoiceNumberPath",
                table: "SystemSettings",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ErpInvoicePdfPath",
                table: "SystemSettings",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ErpInvoiceReference",
                table: "SystemSettings",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                /* Not "": OrderId is what the property opens at. */
                defaultValue: "OrderId");

            migrationBuilder.AddColumn<string>(
                name: "ErpProvider",
                table: "SystemSettings",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "ErpStoreInvoiceCopy",
                table: "SystemSettings",
                type: "bit",
                nullable: false,
                /* Not false: keeping a copy is the default the property sets. */
                defaultValue: true);

            migrationBuilder.AddColumn<int>(
                name: "ErpTimeoutSeconds",
                table: "SystemSettings",
                type: "int",
                nullable: false,
                /* Not 0: a zero timeout would abandon every call at once. */
                defaultValue: 30);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ErpApiKey",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "ErpApiKeyHeader",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "ErpInvoiceEnabled",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "ErpInvoiceEndpoint",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "ErpInvoiceNumberPath",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "ErpInvoicePdfPath",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "ErpInvoiceReference",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "ErpProvider",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "ErpStoreInvoiceCopy",
                table: "SystemSettings");

            migrationBuilder.DropColumn(
                name: "ErpTimeoutSeconds",
                table: "SystemSettings");
        }
    }
}
