using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class PaymentTransactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "FeeGst",
                table: "Applications",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "FeeTaxable",
                table: "Applications",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "PaymentTransactions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrderId = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    ApplicationId = table.Column<int>(type: "int", nullable: false),
                    ApplicantId = table.Column<int>(type: "int", nullable: false),
                    FeeGross = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    TdsAmount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    Currency = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    Status = table.Column<string>(type: "varchar(40)", nullable: false),
                    Gateway = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    TestMode = table.Column<bool>(type: "bit", nullable: false),
                    Method = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    TrackingId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    BankReference = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    FailureReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    InitiatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PaymentTransactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PaymentTransactions_Applicants_ApplicantId",
                        column: x => x.ApplicantId,
                        principalTable: "Applicants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PaymentTransactions_Applications_ApplicationId",
                        column: x => x.ApplicationId,
                        principalTable: "Applications",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_ApplicantId_InitiatedOn",
                table: "PaymentTransactions",
                columns: new[] { "ApplicantId", "InitiatedOn" });

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_ApplicationId",
                table: "PaymentTransactions",
                column: "ApplicationId");

            migrationBuilder.CreateIndex(
                name: "IX_PaymentTransactions_OrderId",
                table: "PaymentTransactions",
                column: "OrderId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PaymentTransactions");

            migrationBuilder.DropColumn(
                name: "FeeGst",
                table: "Applications");

            migrationBuilder.DropColumn(
                name: "FeeTaxable",
                table: "Applications");
        }
    }
}
