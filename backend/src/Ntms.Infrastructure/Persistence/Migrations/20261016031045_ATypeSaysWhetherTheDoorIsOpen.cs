using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ATypeSaysWhetherTheDoorIsOpen : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "OnSpotRegistrationAllowed",
                table: "ProgramTypes",
                type: "bit",
                nullable: false,
                /* True for the types that already exist. Every one of
                   them has had on-spot registration all along, and a
                   migration that quietly switches it off on all of
                   them would take a step away from batches that are
                   mid-flight. New types are ticked on by default and
                   unticked deliberately. */
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OnSpotRegistrationAllowed",
                table: "ProgramTypes");
        }
    }
}
