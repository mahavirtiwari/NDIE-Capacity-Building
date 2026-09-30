using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// The registration form is now the profile form, and the tables follow
    /// the name.
    ///
    /// Written by hand. EF cannot tell a renamed type from a deleted one and
    /// scaffolded four DropTable/CreateTable pairs, which would have taken
    /// every published form, every section, every field and every option
    /// with them — and left the answers already captured pointing at forms
    /// that no longer existed. sp_rename moves the name and leaves the rows
    /// where they are.
    ///
    /// Indexes and foreign keys are renamed too. SQL Server keeps their old
    /// names through a table rename, and a later migration generated against
    /// the model would then try to drop constraints under names the database
    /// has never heard of.
    /// </summary>
    public partial class RegistrationFormBecomesProfileForm : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* Children first is not required for a rename, but keeping the
               order the same in both directions makes the two halves of this
               migration readable side by side. */
            migrationBuilder.RenameTable(name: "RegistrationFieldOptions", newName: "ProfileFieldOptions");
            migrationBuilder.RenameTable(name: "RegistrationFields", newName: "ProfileFields");
            migrationBuilder.RenameTable(name: "RegistrationSections", newName: "ProfileSections");
            migrationBuilder.RenameTable(name: "RegistrationForms", newName: "ProfileForms");

            migrationBuilder.RenameColumn(
                name: "RegistrationFormId", table: "Applications", newName: "ProfileFormId");

            /* The flag on the program type carries the concept's name too.
               Left behind on the first pass, which took the API down on
               startup with "Invalid column name 'RequiresProfileForm'" —
               the model had moved and the column had not. */
            migrationBuilder.RenameColumn(
                name: "RequiresRegistrationForm", table: "ProgramTypes",
                newName: "RequiresProfileForm");

            Rename(migrationBuilder, new[]
            {
                ("PK_RegistrationFieldOptions", "PK_ProfileFieldOptions", "OBJECT"),
                ("PK_RegistrationFields", "PK_ProfileFields", "OBJECT"),
                ("PK_RegistrationSections", "PK_ProfileSections", "OBJECT"),
                ("PK_RegistrationForms", "PK_ProfileForms", "OBJECT"),

                ("FK_RegistrationFieldOptions_RegistrationFields_FieldId",
                    "FK_ProfileFieldOptions_ProfileFields_FieldId", "OBJECT"),
                ("FK_RegistrationFields_RegistrationSections_SectionId",
                    "FK_ProfileFields_ProfileSections_SectionId", "OBJECT"),
                ("FK_RegistrationSections_RegistrationForms_FormId",
                    "FK_ProfileSections_ProfileForms_FormId", "OBJECT"),
                ("FK_RegistrationForms_ProgramTypes_ProgramTypeId",
                    "FK_ProfileForms_ProgramTypes_ProgramTypeId", "OBJECT"),
                ("FK_Applications_RegistrationForms_RegistrationFormId",
                    "FK_Applications_ProfileForms_ProfileFormId", "OBJECT"),

                ("ProfileFieldOptions.IX_RegistrationFieldOptions_FieldId",
                    "IX_ProfileFieldOptions_FieldId", "INDEX"),
                ("ProfileFields.IX_RegistrationFields_SectionId_Key",
                    "IX_ProfileFields_SectionId_Key", "INDEX"),
                ("ProfileSections.IX_RegistrationSections_FormId_Key",
                    "IX_ProfileSections_FormId_Key", "INDEX"),
                ("ProfileForms.IX_RegistrationForms_ProgramTypeId_Version",
                    "IX_ProfileForms_ProgramTypeId_Version", "INDEX"),
                ("Applications.IX_Applications_RegistrationFormId",
                    "IX_Applications_ProfileFormId", "INDEX"),
            });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            Rename(migrationBuilder, new[]
            {
                ("PK_ProfileFieldOptions", "PK_RegistrationFieldOptions", "OBJECT"),
                ("PK_ProfileFields", "PK_RegistrationFields", "OBJECT"),
                ("PK_ProfileSections", "PK_RegistrationSections", "OBJECT"),
                ("PK_ProfileForms", "PK_RegistrationForms", "OBJECT"),

                ("FK_ProfileFieldOptions_ProfileFields_FieldId",
                    "FK_RegistrationFieldOptions_RegistrationFields_FieldId", "OBJECT"),
                ("FK_ProfileFields_ProfileSections_SectionId",
                    "FK_RegistrationFields_RegistrationSections_SectionId", "OBJECT"),
                ("FK_ProfileSections_ProfileForms_FormId",
                    "FK_RegistrationSections_RegistrationForms_FormId", "OBJECT"),
                ("FK_ProfileForms_ProgramTypes_ProgramTypeId",
                    "FK_RegistrationForms_ProgramTypes_ProgramTypeId", "OBJECT"),
                ("FK_Applications_ProfileForms_ProfileFormId",
                    "FK_Applications_RegistrationForms_RegistrationFormId", "OBJECT"),

                ("ProfileFieldOptions.IX_ProfileFieldOptions_FieldId",
                    "IX_RegistrationFieldOptions_FieldId", "INDEX"),
                ("ProfileFields.IX_ProfileFields_SectionId_Key",
                    "IX_RegistrationFields_SectionId_Key", "INDEX"),
                ("ProfileSections.IX_ProfileSections_FormId_Key",
                    "IX_RegistrationSections_FormId_Key", "INDEX"),
                ("ProfileForms.IX_ProfileForms_ProgramTypeId_Version",
                    "IX_RegistrationForms_ProgramTypeId_Version", "INDEX"),
                ("Applications.IX_Applications_ProfileFormId",
                    "IX_Applications_RegistrationFormId", "INDEX"),
            });

            migrationBuilder.RenameColumn(
                name: "RequiresProfileForm", table: "ProgramTypes",
                newName: "RequiresRegistrationForm");

            migrationBuilder.RenameColumn(
                name: "ProfileFormId", table: "Applications", newName: "RegistrationFormId");

            migrationBuilder.RenameTable(name: "ProfileForms", newName: "RegistrationForms");
            migrationBuilder.RenameTable(name: "ProfileSections", newName: "RegistrationSections");
            migrationBuilder.RenameTable(name: "ProfileFields", newName: "RegistrationFields");
            migrationBuilder.RenameTable(name: "ProfileFieldOptions", newName: "RegistrationFieldOptions");
        }

        /// <summary>
        /// sp_rename for each constraint and index, but only where the old
        /// name is actually there.
        ///
        /// A deployment that has never run the migration this one supersedes,
        /// or one where somebody renamed something by hand, would otherwise
        /// fail on a name that does not exist — and a release that stops half
        /// way through a rename is worse than one that does not start.
        /// </summary>
        private static void Rename(
            MigrationBuilder builder, (string Old, string New, string Kind)[] names)
        {
            foreach (var (old, fresh, kind) in names)
            {
                var lookup = kind == "INDEX"
                    // An index is addressed as Table.Index, and OBJECT_ID will
                    // not resolve that, so the check goes through sys.indexes.
                    ? $@"IF EXISTS (SELECT 1 FROM sys.indexes i
                                    JOIN sys.tables t ON t.object_id = i.object_id
                                    WHERE t.name = '{old.Split('.')[0]}'
                                      AND i.name = '{old.Split('.')[1]}')"
                    : $"IF OBJECT_ID('{old}') IS NOT NULL";

                builder.Sql(
                    $"{lookup} EXEC sp_rename N'{old}', N'{fresh}', N'{kind}';");
            }
        }
    }
}
