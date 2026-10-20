using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Splits the name into the two parts it is made of, and recovers the
    /// family names that were being kept somewhere else.
    ///
    /// Until now an applicant had one name column. A department that
    /// wanted the two halves separately did the only thing the system
    /// allowed: relabelled the built-in name field "First Name" and added
    /// a custom question called something like "Last Name" beside it. The
    /// surname then lived in an answer row that nothing reads - not the
    /// profile header, not a register, not a certificate - so every
    /// screen in the estate showed people by their given name alone.
    ///
    /// So the parts are filled in from the best source available, in
    /// order: a custom answer whose key is some spelling of "last name",
    /// where one exists; otherwise the last word of the name already
    /// recorded. The second is a guess and is only applied where there is
    /// nothing better, which is the same convention those records were
    /// typed under.
    ///
    /// The answer rows are left where they are. They are what the
    /// applicant sent, the form may still be asking the question, and
    /// deleting somebody's submitted answer to tidy up a column is not a
    /// migration's business.
    /// </summary>
    public partial class AnApplicantHasAGivenNameAndAFamilyName : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "FirstName",
                table: "Applicants",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "LastName",
                table: "Applicants",
                type: "nvarchar(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            /* 1. The family name, where the form collected one under a
                  question of its own. Matched on the key with the spacing
                  and case taken out, so lastName, LastName, last_name and
                  "Last Name" all land. */
            migrationBuilder.Sql(@"
UPDATE a
   SET a.LastName = LEFT(LTRIM(RTRIM(ans.Value)), 120)
  FROM Applicants AS a
 INNER JOIN ApplicantAnswers AS ans ON ans.ApplicantId = a.Id
 WHERE a.LastName = ''
   AND ans.Value IS NOT NULL
   AND LTRIM(RTRIM(ans.Value)) <> ''
   AND LOWER(REPLACE(REPLACE(ans.[Key], ' ', ''), '_', '')) IN ('lastname', 'surname', 'familyname');");

            /* 2. The given name is then whatever the recorded name is,
                  minus that family name where it is sitting on the end of
                  it - and the whole recorded name where it is not. */
            migrationBuilder.Sql(@"
UPDATE Applicants
   SET FirstName = CASE
         WHEN LastName <> ''
          AND LEN(FullName) > LEN(LastName)
          AND RIGHT(FullName, LEN(LastName) + 1) = ' ' + LastName
         THEN LEFT(LTRIM(RTRIM(LEFT(FullName, LEN(FullName) - LEN(LastName) - 1))), 120)
         /* Clamped: the whole name may be longer than either part's
            column, and a name that does not fit is better shortened
            than a migration that stops a release. */
         ELSE LEFT(LTRIM(RTRIM(FullName)), 120)
       END
 WHERE FirstName = '';");

            /* 3. Anybody still without a family name: the last word of the
                  name they gave, where it has more than one. */
            migrationBuilder.Sql(@"
UPDATE Applicants
   SET LastName  = LEFT(REVERSE(LEFT(REVERSE(LTRIM(RTRIM(FullName))),
                                CHARINDEX(' ', REVERSE(LTRIM(RTRIM(FullName)))) - 1)), 120),
       FirstName = LEFT(LTRIM(RTRIM(LEFT(LTRIM(RTRIM(FullName)),
                                LEN(LTRIM(RTRIM(FullName)))
                                - CHARINDEX(' ', REVERSE(LTRIM(RTRIM(FullName))))))), 120)
 WHERE LastName = ''
   AND CHARINDEX(' ', LTRIM(RTRIM(FullName))) > 0;");

            /* 4. And the whole, rebuilt from the two, so the column every
                  other screen reads now carries the complete name. */
            migrationBuilder.Sql(@"
UPDATE Applicants
   SET FullName = LEFT(LTRIM(RTRIM(FirstName + ' ' + LastName)), 160)
 WHERE LastName <> '';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "FirstName",
                table: "Applicants");

            /* FullName keeps whatever the backfill composed; it is the
               applicant's complete name and dropping the parts is no
               reason to shorten it again. */
            migrationBuilder.DropColumn(
                name: "LastName",
                table: "Applicants");
        }
    }
}
