using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class QualificationCatalogue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Qualifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Code = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Rank = table.Column<int>(type: "int", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    Status = table.Column<string>(type: "varchar(40)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Qualifications", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Qualifications_Code",
                table: "Qualifications",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Qualifications_Rank",
                table: "Qualifications",
                column: "Rank");

            /* The ladder the system ships with. Seeded here rather than by the
               seeder because a production deployment applies migrations as a
               step of its own and does not seed on every start, and a
               programme-type form with an empty qualification list is not a
               form anybody can fill in.

               Guarded, so re-running against a catalogue an administrator has
               already edited adds nothing back. */
            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM Qualifications)
                INSERT INTO Qualifications (Code, Label, [Rank], Status, CreatedOn, CreatedBy)
                VALUES
                    ('NONE', 'No minimum', 0, 'Active', SYSUTCDATETIME(), 'system'),
                    ('CLASS_8', 'Class 8 (Middle)', 10, 'Active', SYSUTCDATETIME(), 'system'),
                    ('CLASS_10', 'Class 10 (Secondary)', 20, 'Active', SYSUTCDATETIME(), 'system'),
                    ('CLASS_12', 'Class 12 (Higher Secondary)', 30, 'Active', SYSUTCDATETIME(), 'system'),
                    ('ITI', 'ITI', 40, 'Active', SYSUTCDATETIME(), 'system'),
                    ('DIPLOMA', 'Diploma', 50, 'Active', SYSUTCDATETIME(), 'system'),
                    ('GRADUATION', 'Graduation', 60, 'Active', SYSUTCDATETIME(), 'system'),
                    ('POST_GRADUATION', 'Post Graduation', 70, 'Active', SYSUTCDATETIME(), 'system'),
                    ('DOCTORATE', 'Doctorate', 80, 'Active', SYSUTCDATETIME(), 'system');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Qualifications");
        }
    }
}
