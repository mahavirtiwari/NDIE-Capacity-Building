using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RepeatableFormSections : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RegistrationSections_FormId",
                table: "RegistrationSections");

            migrationBuilder.AddColumn<bool>(
                name: "IsRepeatable",
                table: "RegistrationSections",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "ItemLabel",
                table: "RegistrationSections",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Key",
                table: "RegistrationSections",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "MaxEntries",
                table: "RegistrationSections",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MinEntries",
                table: "RegistrationSections",
                type: "int",
                nullable: false,
                defaultValue: 0);

            /* Existing sections have no key and the index about to be created
               insists on one. None of them repeats, so nothing is stored under
               a section key yet and any unique value will do: the row id. The
               next save of each form derives a readable key from the title —
               a key is only kept as it stands once a section repeats. */
            migrationBuilder.Sql(
                "UPDATE RegistrationSections SET [Key] = 's' + CAST(Id AS nvarchar(20)) " +
                "WHERE [Key] = '' OR [Key] IS NULL;");

            /* One entry, and no more than one, is what a section that does not
               repeat has always meant. */
            migrationBuilder.Sql(
                "UPDATE RegistrationSections SET MinEntries = 1, MaxEntries = 1 " +
                "WHERE MaxEntries = 0;");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrationSections_FormId_Key",
                table: "RegistrationSections",
                columns: new[] { "FormId", "Key" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_RegistrationSections_FormId_Key",
                table: "RegistrationSections");

            migrationBuilder.DropColumn(
                name: "IsRepeatable",
                table: "RegistrationSections");

            migrationBuilder.DropColumn(
                name: "ItemLabel",
                table: "RegistrationSections");

            migrationBuilder.DropColumn(
                name: "Key",
                table: "RegistrationSections");

            migrationBuilder.DropColumn(
                name: "MaxEntries",
                table: "RegistrationSections");

            migrationBuilder.DropColumn(
                name: "MinEntries",
                table: "RegistrationSections");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrationSections_FormId",
                table: "RegistrationSections",
                column: "FormId");
        }
    }
}
