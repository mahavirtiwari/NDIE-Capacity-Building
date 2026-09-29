using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProgramTypeFormRequirements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* True, not the false EF defaults a bool to.
            
               Every programme type that already exists asks for both forms and
               has its applications scrutinised — that is how the system worked
               before the setting existed. Taking EF's default would switch the
               whole estate to "no registration form, no scrutiny" the moment
               this migration ran, and the applications would stop arriving in
               the queue with nothing on screen to explain why. */
            migrationBuilder.AddColumn<bool>(
                name: "RequiresRegistrationForm",
                table: "ProgramTypes",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequiresSignupForm",
                table: "ProgramTypes",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RequiresRegistrationForm",
                table: "ProgramTypes");

            migrationBuilder.DropColumn(
                name: "RequiresSignupForm",
                table: "ProgramTypes");
        }
    }
}
