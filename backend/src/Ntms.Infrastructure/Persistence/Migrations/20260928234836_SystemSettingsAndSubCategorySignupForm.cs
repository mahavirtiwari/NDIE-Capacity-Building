using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class SystemSettingsAndSubCategorySignupForm : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_SignupFields_Key",
                table: "SignupFields");

            migrationBuilder.AddColumn<int>(
                name: "SubCategoryId",
                table: "SignupFields",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "SystemSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    MaintenanceMode = table.Column<bool>(type: "bit", nullable: false),
                    MaintenanceMessage = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    MaintenanceUntil = table.Column<DateTime>(type: "datetime2", nullable: true),
                    PaymentGateway = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    PaymentEnabled = table.Column<bool>(type: "bit", nullable: false),
                    PaymentTestMode = table.Column<bool>(type: "bit", nullable: false),
                    MerchantId = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    AccessCode = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    WorkingKey = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    ReturnUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CancelUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemSettings", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SignupFields_SubCategoryId_Key",
                table: "SignupFields",
                columns: new[] { "SubCategoryId", "Key" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_SignupFields_SubCategories_SubCategoryId",
                table: "SignupFields",
                column: "SubCategoryId",
                principalTable: "SubCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_SignupFields_SubCategories_SubCategoryId",
                table: "SignupFields");

            migrationBuilder.DropTable(
                name: "SystemSettings");

            migrationBuilder.DropIndex(
                name: "IX_SignupFields_SubCategoryId_Key",
                table: "SignupFields");

            migrationBuilder.DropColumn(
                name: "SubCategoryId",
                table: "SignupFields");

            migrationBuilder.CreateIndex(
                name: "IX_SignupFields_Key",
                table: "SignupFields",
                column: "Key",
                unique: true);
        }
    }
}
