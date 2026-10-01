using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// One account, a profile in each category.
    ///
    /// Sign-up used to ask which category and sub-category somebody was in,
    /// which fixed that choice before they had seen what the programs were,
    /// and made a second discipline a second account. It is chosen in the app
    /// now, on the profile form, and one account carries one profile per
    /// category — never two within a category.
    ///
    /// Four data problems the scaffolder cannot see, each handled below:
    ///   - a submission needs the category it was made under, which exists
    ///     already by way of its sub-category and has to be copied down
    ///     before the column can be made compulsory;
    ///   - an attachment needs the discipline it belongs to, which until now
    ///     was whatever single one the account held;
    ///   - the PAN index becomes unique on PAN alone, which is a merge of
    ///     accounts if anybody holds two, so this stops rather than guesses;
    ///   - the sign-up form becomes one form, which is a merge of forms if
    ///     any sub-category configured its own, so this stops as well.
    /// </summary>
    public partial class ApplicantHoldsAProfilePerCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* ---- stop before anything is lost ---------------------------
               Both of these are decisions rather than conversions: which of
               two accounts for one person is the real one, and which of two
               sign-up forms everybody should now fill in. A migration that
               picked for itself would be picking in the dark. */
            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM Applicants WHERE Pan <> '' GROUP BY Pan HAVING COUNT(*) > 1)
    THROW 50000, 'Two or more accounts share a PAN. One account now covers every category, so these have to be merged by hand before this migration can run. SELECT Pan, COUNT(*) FROM Applicants WHERE Pan <> '''' GROUP BY Pan HAVING COUNT(*) > 1 lists them.', 1;

IF EXISTS (SELECT 1 FROM SignupFields WHERE SubCategoryId IS NOT NULL)
    THROW 50000, 'A sub-category has its own sign-up form. There is one sign-up form now, so decide which fields belong on it and remove the rest before this migration can run. SELECT * FROM SignupFields WHERE SubCategoryId IS NOT NULL lists them.', 1;
");

            /* ---- the two pickers leave the sign-up form -----------------
               Removed rather than switched off: the columns behind them are
               no longer written at sign-up, so a field that asked for them
               would be a question whose answer went nowhere. */
            migrationBuilder.Sql(@"
DELETE o FROM SignupFieldOptions o
JOIN SignupFields f ON f.Id = o.FieldId
WHERE f.[Key] IN ('categoryId', 'subCategoryId');

DELETE FROM SignupFields WHERE [Key] IN ('categoryId', 'subCategoryId');
");

            migrationBuilder.DropForeignKey(
                name: "FK_SignupFields_SubCategories_SubCategoryId",
                table: "SignupFields");

            migrationBuilder.DropIndex(
                name: "IX_SignupFields_SubCategoryId_Key",
                table: "SignupFields");

            migrationBuilder.DropIndex(
                name: "IX_ProfileSubmissions_ApplicantId_AttemptNo",
                table: "ProfileSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_ProfileAttachments_ApplicantId_FieldKey_DisplayOrder",
                table: "ProfileAttachments");

            migrationBuilder.DropIndex(
                name: "IX_Applicants_Pan_CategoryId",
                table: "Applicants");

            migrationBuilder.DropColumn(
                name: "SubCategoryId",
                table: "SignupFields");

            /* Never written: the block out of a discipline after repeated
               rejection is read from the submissions now, so that one
               column cannot claim to hold a block that applies to one
               discipline and not another. */
            migrationBuilder.DropColumn(
                name: "ProfileBlockReason",
                table: "Applicants");

            migrationBuilder.DropColumn(
                name: "ProfileBlockedUntil",
                table: "Applicants");

            /* ---- the category a submission was made under ---------------
               Added empty, filled from the sub-category it already names,
               and only then made compulsory. Scaffolded as NOT NULL with a
               default of zero, which every existing row would have taken
               and no category answers to. */
            migrationBuilder.AddColumn<int>(
                name: "CategoryId",
                table: "ProfileSubmissions",
                type: "int",
                nullable: true);

            migrationBuilder.Sql(@"
UPDATE s SET s.CategoryId = c.CategoryId
FROM ProfileSubmissions s
JOIN SubCategories c ON c.Id = s.SubCategoryId
WHERE s.CategoryId IS NULL;
");

            migrationBuilder.Sql(@"
IF EXISTS (SELECT 1 FROM ProfileSubmissions WHERE CategoryId IS NULL)
    THROW 50000, 'A profile submission names a sub-category that does not exist, so its category cannot be worked out. Fix those rows before this migration can run.', 1;
");

            migrationBuilder.AlterColumn<int>(
                name: "CategoryId",
                table: "ProfileSubmissions",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            /* ---- the discipline an attachment belongs to ----------------
               Two forms may name a field the same thing, so a picture or a
               document is only identified by the sub-category as well.
               Filled from the single discipline the account held until now,
               which is where every existing attachment was taken. */
            migrationBuilder.AddColumn<int>(
                name: "SubCategoryId",
                table: "ProfileAttachments",
                type: "int",
                nullable: true);

            migrationBuilder.Sql(@"
UPDATE a SET a.SubCategoryId = p.SubCategoryId
FROM ProfileAttachments a
JOIN Applicants p ON p.Id = a.ApplicantId
WHERE a.SubCategoryId IS NULL AND p.SubCategoryId IS NOT NULL;

DELETE FROM ProfileAttachments WHERE SubCategoryId IS NULL;
");

            migrationBuilder.AlterColumn<int>(
                name: "SubCategoryId",
                table: "ProfileAttachments",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            /* ---- the account's own columns become a record, not a rule --
               Kept, because the reports that group applicants by one
               discipline read them, and nullable because an account exists
               before any discipline is chosen. They hold the first one
               entered and are not changed afterwards. */
            migrationBuilder.AlterColumn<int>(
                name: "SubCategoryId",
                table: "Applicants",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<int>(
                name: "CategoryId",
                table: "Applicants",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.CreateIndex(
                name: "IX_SignupFields_Key",
                table: "SignupFields",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProfileSubmissions_ApplicantId_SubCategoryId_AttemptNo",
                table: "ProfileSubmissions",
                columns: new[] { "ApplicantId", "SubCategoryId", "AttemptNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProfileSubmissions_CategoryId",
                table: "ProfileSubmissions",
                column: "CategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_ProfileAttachments_ApplicantId_SubCategoryId_FieldKey_DisplayOrder",
                table: "ProfileAttachments",
                columns: new[] { "ApplicantId", "SubCategoryId", "FieldKey", "DisplayOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProfileAttachments_SubCategoryId",
                table: "ProfileAttachments",
                column: "SubCategoryId");

            migrationBuilder.CreateIndex(
                name: "IX_Applicants_Pan",
                table: "Applicants",
                column: "Pan",
                unique: true,
                filter: "[Pan] <> ''");

            migrationBuilder.AddForeignKey(
                name: "FK_ProfileAttachments_SubCategories_SubCategoryId",
                table: "ProfileAttachments",
                column: "SubCategoryId",
                principalTable: "SubCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ProfileSubmissions_Categories_CategoryId",
                table: "ProfileSubmissions",
                column: "CategoryId",
                principalTable: "Categories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProfileAttachments_SubCategories_SubCategoryId",
                table: "ProfileAttachments");

            migrationBuilder.DropForeignKey(
                name: "FK_ProfileSubmissions_Categories_CategoryId",
                table: "ProfileSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_SignupFields_Key",
                table: "SignupFields");

            migrationBuilder.DropIndex(
                name: "IX_ProfileSubmissions_ApplicantId_SubCategoryId_AttemptNo",
                table: "ProfileSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_ProfileSubmissions_CategoryId",
                table: "ProfileSubmissions");

            migrationBuilder.DropIndex(
                name: "IX_ProfileAttachments_ApplicantId_SubCategoryId_FieldKey_DisplayOrder",
                table: "ProfileAttachments");

            migrationBuilder.DropIndex(
                name: "IX_ProfileAttachments_SubCategoryId",
                table: "ProfileAttachments");

            migrationBuilder.DropIndex(
                name: "IX_Applicants_Pan",
                table: "Applicants");

            migrationBuilder.DropColumn(
                name: "CategoryId",
                table: "ProfileSubmissions");

            migrationBuilder.DropColumn(
                name: "SubCategoryId",
                table: "ProfileAttachments");

            migrationBuilder.AddColumn<int>(
                name: "SubCategoryId",
                table: "SignupFields",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProfileBlockReason",
                table: "Applicants",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "ProfileBlockedUntil",
                table: "Applicants",
                type: "datetime2",
                nullable: true);

            /* An account with no discipline cannot go back into a column
               that insists on one. It is given the discipline of its oldest
               profile, and dropped only if it has none at all - which is an
               account that could not have existed before this migration. */
            migrationBuilder.Sql(@"
UPDATE p SET p.CategoryId = x.CategoryId, p.SubCategoryId = x.SubCategoryId
FROM Applicants p
CROSS APPLY (
    SELECT TOP 1 s.CategoryId, s.SubCategoryId
    FROM ProfileSubmissions s
    WHERE s.ApplicantId = p.Id
    ORDER BY s.Id
) x
WHERE p.CategoryId IS NULL OR p.SubCategoryId IS NULL;

DELETE FROM Applicants WHERE CategoryId IS NULL OR SubCategoryId IS NULL;
");

            migrationBuilder.AlterColumn<int>(
                name: "SubCategoryId",
                table: "Applicants",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "CategoryId",
                table: "Applicants",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            /* Only the newest profile per applicant can survive a unique
               index on (ApplicantId, AttemptNo); the others were attempts
               at other disciplines, which this shape cannot hold. */
            migrationBuilder.Sql(@"
DELETE s FROM ProfileSubmissions s
WHERE EXISTS (
    SELECT 1 FROM ProfileSubmissions o
    WHERE o.ApplicantId = s.ApplicantId
      AND o.AttemptNo = s.AttemptNo
      AND o.Id > s.Id
);
");

            migrationBuilder.CreateIndex(
                name: "IX_SignupFields_SubCategoryId_Key",
                table: "SignupFields",
                columns: new[] { "SubCategoryId", "Key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProfileSubmissions_ApplicantId_AttemptNo",
                table: "ProfileSubmissions",
                columns: new[] { "ApplicantId", "AttemptNo" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProfileAttachments_ApplicantId_FieldKey_DisplayOrder",
                table: "ProfileAttachments",
                columns: new[] { "ApplicantId", "FieldKey", "DisplayOrder" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Applicants_Pan_CategoryId",
                table: "Applicants",
                columns: new[] { "Pan", "CategoryId" },
                unique: true,
                filter: "[Pan] <> ''");

            migrationBuilder.AddForeignKey(
                name: "FK_SignupFields_SubCategories_SubCategoryId",
                table: "SignupFields",
                column: "SubCategoryId",
                principalTable: "SubCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
