using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Named lists of choices, kept once and used by any number of fields.
    ///
    /// A dropdown could always have its options typed into it, and for a
    /// question asked in one place that is still right. It stops being
    /// right once the same list appears on three forms: they drift, and a
    /// report that groups by one of them has to reconcile answers that
    /// were never the same set of words.
    ///
    /// Nothing is converted. Every field keeps the options it has; the
    /// link is null until somebody points a field at a list.
    /// </summary>
    public partial class SharedChoiceLists : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OptionSetId",
                table: "ProfileFields",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OptionSets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "varchar(40)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OptionSets", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OptionSetItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OptionSetId = table.Column<int>(type: "int", nullable: false),
                    Value = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    DisplayOrder = table.Column<int>(type: "int", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "varchar(40)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OptionSetItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OptionSetItems_OptionSets_OptionSetId",
                        column: x => x.OptionSetId,
                        principalTable: "OptionSets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProfileFields_OptionSetId",
                table: "ProfileFields",
                column: "OptionSetId");

            migrationBuilder.CreateIndex(
                name: "IX_OptionSetItems_OptionSetId_Value",
                table: "OptionSetItems",
                columns: new[] { "OptionSetId", "Value" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OptionSets_Code",
                table: "OptionSets",
                column: "Code",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ProfileFields_OptionSets_OptionSetId",
                table: "ProfileFields",
                column: "OptionSetId",
                principalTable: "OptionSets",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProfileFields_OptionSets_OptionSetId",
                table: "ProfileFields");

            migrationBuilder.DropTable(
                name: "OptionSetItems");

            migrationBuilder.DropTable(
                name: "OptionSets");

            migrationBuilder.DropIndex(
                name: "IX_ProfileFields_OptionSetId",
                table: "ProfileFields");

            migrationBuilder.DropColumn(
                name: "OptionSetId",
                table: "ProfileFields");
        }
    }
}
