using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// The picture store becomes the attachment store: same table, now
    /// holding the file a field was given as well as the pictures.
    ///
    /// Written by hand. EF scaffolded a DropTable and a CreateTable, which
    /// it is entitled to do — it cannot tell a renamed type from a deleted
    /// one — but any deployment that has already run the migration before
    /// this one may hold pictures somebody took, and a release is not the
    /// place to find out whether it does.
    /// </summary>
    public partial class ProfileAttachmentsHoldFilesToo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(name: "ProfilePhotos", newName: "ProfileAttachments");

            Rename(migrationBuilder,
                ("PK_ProfilePhotos", "PK_ProfileAttachments", "OBJECT"),
                ("FK_ProfilePhotos_Applicants_ApplicantId",
                    "FK_ProfileAttachments_Applicants_ApplicantId", "OBJECT"),
                ("ProfileAttachments.IX_ProfilePhotos_ApplicantId_FieldKey_DisplayOrder",
                    "IX_ProfileAttachments_ApplicantId_FieldKey_DisplayOrder", "INDEX"));

            /* Null for every row that is there, which is right: they are
               all pictures, and a picture was never a file with a name. */
            migrationBuilder.AddColumn<string>(
                name: "FileName",
                table: "ProfileAttachments",
                type: "nvarchar(260)",
                maxLength: 260,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "FileName", table: "ProfileAttachments");

            Rename(migrationBuilder,
                ("PK_ProfileAttachments", "PK_ProfilePhotos", "OBJECT"),
                ("FK_ProfileAttachments_Applicants_ApplicantId",
                    "FK_ProfilePhotos_Applicants_ApplicantId", "OBJECT"),
                ("ProfileAttachments.IX_ProfileAttachments_ApplicantId_FieldKey_DisplayOrder",
                    "IX_ProfilePhotos_ApplicantId_FieldKey_DisplayOrder", "INDEX"));

            migrationBuilder.RenameTable(name: "ProfileAttachments", newName: "ProfilePhotos");
        }

        /// <summary>
        /// sp_rename for each constraint and index, but only where the old
        /// name is there. A deployment that never ran the migration before
        /// this one would otherwise fail on a name that does not exist.
        /// </summary>
        private static void Rename(
            MigrationBuilder builder, params (string Old, string New, string Kind)[] names)
        {
            foreach (var (old, fresh, kind) in names)
            {
                var guard = kind == "INDEX"
                    ? $@"IF EXISTS (SELECT 1 FROM sys.indexes i
                                    JOIN sys.tables t ON t.object_id = i.object_id
                                    WHERE t.name = '{old.Split('.')[0]}'
                                      AND i.name = '{old.Split('.')[1]}')"
                    : $"IF OBJECT_ID('{old}') IS NOT NULL";

                builder.Sql($"{guard} EXEC sp_rename N'{old}', N'{fresh}', N'{kind}';");
            }
        }
    }
}
