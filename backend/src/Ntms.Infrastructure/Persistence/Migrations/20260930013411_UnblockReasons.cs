using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UnblockReasons : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BlockReasons_Label",
                table: "BlockReasons");

            migrationBuilder.AddColumn<string>(
                name: "Kind",
                table: "BlockReasons",
                type: "varchar(40)",
                nullable: false,
                defaultValue: "Block");

            migrationBuilder.CreateIndex(
                name: "IX_BlockReasons_Kind_Label",
                table: "BlockReasons",
                columns: new[] { "Kind", "Label" },
                unique: true);

            /* The other half of the list, so letting somebody back in is as
               accountable as locking them out. */
            /* EXEC, because the column is added in this same migration and an
               idempotent script puts the whole migration in one batch: SQL
               Server resolves column names when it compiles the batch, so a
               bare statement here fails to parse before the ALTER has run. */
            migrationBuilder.Sql("""
                EXEC(N'
                SET QUOTED_IDENTIFIER ON;
                INSERT INTO dbo.BlockReasons
                    (Kind, Label, DisplayOrder, RequiresNote, Status, CreatedOn)
                VALUES
                    (''Unblock'', ''Blocked in error'',                    10, 1, ''Active'', GETUTCDATE()),
                    (''Unblock'', ''Documents since verified'',            20, 0, ''Active'', GETUTCDATE()),
                    (''Unblock'', ''Identity since confirmed'',            30, 0, ''Active'', GETUTCDATE()),
                    (''Unblock'', ''Appeal upheld'',                       40, 1, ''Active'', GETUTCDATE()),
                    (''Unblock'', ''Suspension period completed'',         50, 0, ''Active'', GETUTCDATE()),
                    (''Unblock'', ''Requested by the applicant'',          60, 0, ''Active'', GETUTCDATE()),
                    (''Unblock'', ''Directed by the ministry'',            70, 1, ''Active'', GETUTCDATE()),
                    (''Unblock'', ''Other'',                               80, 1, ''Active'', GETUTCDATE());
                ');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BlockReasons_Kind_Label",
                table: "BlockReasons");

            migrationBuilder.DropColumn(
                name: "Kind",
                table: "BlockReasons");

            migrationBuilder.CreateIndex(
                name: "IX_BlockReasons_Label",
                table: "BlockReasons",
                column: "Label",
                unique: true);
        }
    }
}
