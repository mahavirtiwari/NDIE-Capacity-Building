using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProfileFormScrutinyOptional : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "RequiresScrutiny",
                table: "ProfileForms",
                type: "bit",
                nullable: false,
                /* Not false: every form that exists is scrutinised today,
                   and defaulting the other way would quietly switch that
                   off for all of them on the release. */
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RequiresScrutiny",
                table: "ProfileForms");
        }
    }
}
