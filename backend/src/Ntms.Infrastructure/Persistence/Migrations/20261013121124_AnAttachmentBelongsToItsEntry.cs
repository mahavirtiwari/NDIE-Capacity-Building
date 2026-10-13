using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AnAttachmentBelongsToItsEntry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProfileAttachments_ApplicantId_SubCategoryId_FieldKey_DisplayOrder",
                table: "ProfileAttachments");

            migrationBuilder.AddColumn<int>(
                name: "EntryIndex",
                table: "ProfileAttachments",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateIndex(
                name: "IX_ProfileAttachments_ApplicantId_SubCategoryId_FieldKey_EntryIndex_DisplayOrder",
                table: "ProfileAttachments",
                columns: new[] { "ApplicantId", "SubCategoryId", "FieldKey", "EntryIndex", "DisplayOrder" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ProfileAttachments_ApplicantId_SubCategoryId_FieldKey_EntryIndex_DisplayOrder",
                table: "ProfileAttachments");

            migrationBuilder.DropColumn(
                name: "EntryIndex",
                table: "ProfileAttachments");

            migrationBuilder.CreateIndex(
                name: "IX_ProfileAttachments_ApplicantId_SubCategoryId_FieldKey_DisplayOrder",
                table: "ProfileAttachments",
                columns: new[] { "ApplicantId", "SubCategoryId", "FieldKey", "DisplayOrder" },
                unique: true);
        }
    }
}
