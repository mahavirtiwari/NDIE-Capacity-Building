using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Makes room for the files to live on disk.
    ///
    /// Columns only — no bytes move here. A migration speaks SQL and the
    /// bytes have to become files, which SQL cannot do; the drain that
    /// writes them runs in the application, once, on the first start after
    /// this. Content is made nullable rather than dropped so that it can:
    /// a row is read from whichever of the two it has until the drain has
    /// emptied it, and the column goes in a later release once that has
    /// finished everywhere.
    /// </summary>
    public partial class ProfilePicturesMoveToDisk : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<byte[]>(
                name: "Content",
                table: "ProfileAttachments",
                type: "varbinary(max)",
                nullable: true,
                oldClrType: typeof(byte[]),
                oldType: "varbinary(max)");

            migrationBuilder.AddColumn<string>(
                name: "RelativePath",
                table: "ProfileAttachments",
                type: "nvarchar(400)",
                maxLength: 400,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<long>(
                name: "SizeBytes",
                table: "ProfileAttachments",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "RelativePath",
                table: "ProfileAttachments");

            migrationBuilder.DropColumn(
                name: "SizeBytes",
                table: "ProfileAttachments");

            migrationBuilder.AlterColumn<byte[]>(
                name: "Content",
                table: "ProfileAttachments",
                type: "varbinary(max)",
                nullable: false,
                defaultValue: new byte[0],
                oldClrType: typeof(byte[]),
                oldType: "varbinary(max)",
                oldNullable: true);
        }
    }
}
