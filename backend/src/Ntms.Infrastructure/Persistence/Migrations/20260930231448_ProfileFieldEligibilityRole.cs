using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProfileFieldEligibilityRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EligibilityRole",
                table: "ProfileFields",
                type: "varchar(40)",
                nullable: false,
                /* Not "": the column stores the enum by name, and an empty
                   string parses to nothing — every existing field would
                   have failed to read back. None is where the property
                   opens, and what every field already is. */
                defaultValue: "None");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EligibilityRole",
                table: "ProfileFields");
        }
    }
}
