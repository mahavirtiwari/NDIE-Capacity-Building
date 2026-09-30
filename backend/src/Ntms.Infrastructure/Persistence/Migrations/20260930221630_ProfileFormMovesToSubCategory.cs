using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// The profile form moves from the program type to the sub-category, and
    /// the two "is this form required" flags move with it.
    ///
    /// Written by hand. EF scaffolded a RenameColumn from ProgramTypeId to
    /// SubCategoryId, which keeps the program type's id in a column that now
    /// means something else — every form silently attached to whichever
    /// sub-category happened to share its old id. It also defaulted both new
    /// flags to false where the properties open at true, and made no
    /// allowance for two program types in one sub-category each having a
    /// form, which the new unique index forbids.
    ///
    /// So: add the column, carry the values across through the program type,
    /// settle the collisions, fold the flags up, and only then drop what is
    /// finished with.
    /// </summary>
    public partial class ProfileFormMovesToSubCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* ---- 1. the new column, empty for the moment ---------------- */
            migrationBuilder.AddColumn<int>(
                name: "SubCategoryId",
                table: "ProfileForms",
                type: "int",
                nullable: false,
                defaultValue: 0);

            /* ---- 2. carried across through the program type ------------- */
            migrationBuilder.Sql(@"
                UPDATE f
                SET f.SubCategoryId = pt.SubCategoryId
                FROM ProfileForms f
                JOIN ProgramTypes pt ON pt.Id = f.ProgramTypeId;");

            /* ---- 3. collisions -------------------------------------------
               Several program types can share a sub-category, and each may
               have had its own form. They cannot all keep the same version
               string under the new unique index, and only one of them can be
               the active form for the discipline.

               The newest survives as it is. The others keep their rows —
               they are somebody's work and the answers already given point
               at them — but their version is made unique and their status is
               dropped to inactive, so the sub-category has exactly one form
               in force and nothing is deleted. */
            migrationBuilder.Sql(@"
                WITH ranked AS (
                    SELECT Id, SubCategoryId, Version,
                           ROW_NUMBER() OVER (
                               PARTITION BY SubCategoryId ORDER BY Id DESC) AS rn
                    FROM ProfileForms
                )
                UPDATE f
                SET f.Version = LEFT(f.Version, 12) + '-' + CAST(f.Id AS varchar(6)),
                    f.Status = 'Inactive'
                FROM ProfileForms f
                JOIN ranked r ON r.Id = f.Id
                WHERE r.rn > 1;");

            /* ---- 4. the flags, opening where the properties open --------- */
            migrationBuilder.AddColumn<bool>(
                name: "RequiresSignupForm",
                table: "SubCategories",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequiresProfileForm",
                table: "SubCategories",
                type: "bit",
                nullable: false,
                defaultValue: true);

            /* ---- 5. folded up from the program types ---------------------
               If any program type in the discipline asked for a form, the
               discipline asks for it. Requiring is the safe direction: it
               keeps scrutiny that was being done, where the other way round
               would quietly stop it. */
            migrationBuilder.Sql(@"
                UPDATE sc
                SET sc.RequiresSignupForm = CASE WHEN EXISTS (
                        SELECT 1 FROM ProgramTypes pt
                        WHERE pt.SubCategoryId = sc.Id AND pt.RequiresSignupForm = 1)
                    THEN 1 ELSE 0 END,
                    sc.RequiresProfileForm = CASE WHEN EXISTS (
                        SELECT 1 FROM ProgramTypes pt
                        WHERE pt.SubCategoryId = sc.Id AND pt.RequiresProfileForm = 1)
                    THEN 1 ELSE 0 END
                FROM SubCategories sc
                WHERE EXISTS (SELECT 1 FROM ProgramTypes pt WHERE pt.SubCategoryId = sc.Id);");

            /* ---- 6. and only now let go of the old shape ---------------- */
            migrationBuilder.DropForeignKey(
                name: "FK_ProfileForms_ProgramTypes_ProgramTypeId",
                table: "ProfileForms");

            migrationBuilder.DropIndex(
                name: "IX_ProfileForms_ProgramTypeId_Version",
                table: "ProfileForms");

            migrationBuilder.DropColumn(name: "ProgramTypeId", table: "ProfileForms");
            migrationBuilder.DropColumn(name: "RequiresProfileForm", table: "ProgramTypes");
            migrationBuilder.DropColumn(name: "RequiresSignupForm", table: "ProgramTypes");

            migrationBuilder.CreateIndex(
                name: "IX_ProfileForms_SubCategoryId_Version",
                table: "ProfileForms",
                columns: new[] { "SubCategoryId", "Version" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ProfileForms_SubCategories_SubCategoryId",
                table: "ProfileForms",
                column: "SubCategoryId",
                principalTable: "SubCategories",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ProfileForms_SubCategories_SubCategoryId",
                table: "ProfileForms");

            migrationBuilder.DropIndex(
                name: "IX_ProfileForms_SubCategoryId_Version",
                table: "ProfileForms");

            migrationBuilder.AddColumn<bool>(
                name: "RequiresSignupForm",
                table: "ProgramTypes",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<bool>(
                name: "RequiresProfileForm",
                table: "ProgramTypes",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.Sql(@"
                UPDATE pt
                SET pt.RequiresSignupForm = sc.RequiresSignupForm,
                    pt.RequiresProfileForm = sc.RequiresProfileForm
                FROM ProgramTypes pt
                JOIN SubCategories sc ON sc.Id = pt.SubCategoryId;");

            migrationBuilder.AddColumn<int>(
                name: "ProgramTypeId",
                table: "ProfileForms",
                type: "int",
                nullable: false,
                defaultValue: 0);

            /* Lossy on the way back: a form belonged to a discipline and a
               discipline has several program types, so it is put on the
               lowest-numbered one. Going back is a rollback, not a design. */
            migrationBuilder.Sql(@"
                UPDATE f
                SET f.ProgramTypeId = (
                    SELECT MIN(pt.Id) FROM ProgramTypes pt
                    WHERE pt.SubCategoryId = f.SubCategoryId)
                FROM ProfileForms f
                WHERE EXISTS (
                    SELECT 1 FROM ProgramTypes pt WHERE pt.SubCategoryId = f.SubCategoryId);");

            migrationBuilder.DropColumn(name: "SubCategoryId", table: "ProfileForms");
            migrationBuilder.DropColumn(name: "RequiresProfileForm", table: "SubCategories");
            migrationBuilder.DropColumn(name: "RequiresSignupForm", table: "SubCategories");

            migrationBuilder.CreateIndex(
                name: "IX_ProfileForms_ProgramTypeId_Version",
                table: "ProfileForms",
                columns: new[] { "ProgramTypeId", "Version" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ProfileForms_ProgramTypes_ProgramTypeId",
                table: "ProfileForms",
                column: "ProgramTypeId",
                principalTable: "ProgramTypes",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
