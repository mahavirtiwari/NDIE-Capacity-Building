using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Puts the two name fields on the sign-up form, and clears up what was
    /// put there in their absence.
    ///
    /// The applicant record has had FirstName and LastName columns since the
    /// name was split, the sign-up code reads them, and the form service's own
    /// list of built-in keys names them - but the seeder never wrote the rows,
    /// so neither field was ever on the form. An administrator wanting a first
    /// and a last name box could not switch them on, because they did not
    /// exist, and could not create them either: the key check refused
    /// firstName and lastName as "already on the form". What was left was to
    /// relabel fullName as "First Name" and create a custom field beside it.
    ///
    /// That combination stopped anybody registering. The sign-up code asks
    /// whether the form wants a lastName without caring about case, so a
    /// custom "LastName" matched; it then read the name from FirstName and
    /// LastName on the request, which the app had left empty because it fills
    /// those from keys spelled the other way. Both boxes filled in, and the
    /// server answered "Name is required. Last name is required."
    ///
    /// So: any field that is one of the two parts under another spelling
    /// becomes that part, keeping its label, its order and its answers; the
    /// two are added where they are still missing; and fullName comes off the
    /// form, because the whole name is composed from the parts and asking for
    /// all three is three questions about two things.
    /// </summary>
    public partial class TheSignupFormAsksForANameInTwoParts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* 1. A field that is already one of the parts under another
                  spelling - "LastName", "last_name", "Surname" - becomes the
                  built-in one. Renaming a key is refused everywhere else,
                  and rightly: it orphans the answers recorded against it.
                  Here it is the repair, because the answers belong to a
                  column now and the next step moves them.

                  The spelling is compared under a binary collation. The
                  database's own is case-insensitive, so "already called
                  lastName" is true of "LastName" as far as = and <> are
                  concerned - and the guard meant to stop this running twice
                  stopped it running at all. Case is the whole subject here,
                  so it has to be said which comparison is wanted. */
            migrationBuilder.Sql(@"
UPDATE dbo.SignupFields
   SET [Key] = 'lastName', IsBuiltIn = 1, IsLocked = 0, ModifiedOn = SYSUTCDATETIME()
 WHERE [Key] COLLATE Latin1_General_BIN2 <> 'lastName'
   AND LOWER(REPLACE(REPLACE([Key], ' ', ''), '_', '')) IN ('lastname', 'surname', 'familyname')
   AND NOT EXISTS (SELECT 1 FROM dbo.SignupFields AS x
                    WHERE x.[Key] COLLATE Latin1_General_BIN2 = 'lastName');");

            migrationBuilder.Sql(@"
UPDATE dbo.SignupFields
   SET [Key] = 'firstName', IsBuiltIn = 1, IsLocked = 1, ModifiedOn = SYSUTCDATETIME()
 WHERE [Key] COLLATE Latin1_General_BIN2 <> 'firstName'
   AND LOWER(REPLACE(REPLACE([Key], ' ', ''), '_', '')) IN ('firstname', 'givenname')
   AND NOT EXISTS (SELECT 1 FROM dbo.SignupFields AS x
                    WHERE x.[Key] COLLATE Latin1_General_BIN2 = 'firstName');");

            /* 2. The answers those fields collected while they were custom
                  ones. They belong in the column now, and against a key
                  that is built in they are a second copy of it that nothing
                  reads and that the profile screens would show as a stray
                  question.

                  Copied before they are deleted. The migration that split
                  the name did this already, matching the same spellings,
                  so for every applicant it saw this changes nothing - but
                  it is the only copy of somebody's family name and it is
                  about to be dropped, which is not a thing to do on the
                  strength of an earlier migration having probably run. */
            migrationBuilder.Sql(@"
UPDATE a
   SET a.LastName = LEFT(LTRIM(RTRIM(ans.Value)), 120)
  FROM dbo.Applicants AS a
 INNER JOIN dbo.ApplicantAnswers AS ans ON ans.ApplicantId = a.Id
 WHERE a.LastName = ''
   AND ans.Value IS NOT NULL
   AND LTRIM(RTRIM(ans.Value)) <> ''
   AND LOWER(REPLACE(REPLACE(ans.[Key], ' ', ''), '_', ''))
       IN ('lastname', 'surname', 'familyname');");

            /* And the whole name rebuilt, where it was left holding only
               the first part because the form asked for them separately. */
            migrationBuilder.Sql(@"
UPDATE dbo.Applicants
   SET FullName = LEFT(LTRIM(RTRIM(FirstName + ' ' + LastName)), 160)
 WHERE LastName <> ''
   AND FirstName <> ''
   AND FullName <> LTRIM(RTRIM(FirstName + ' ' + LastName));");

            migrationBuilder.Sql(@"
DELETE FROM dbo.ApplicantAnswers
 WHERE LOWER(REPLACE(REPLACE([Key], ' ', ''), '_', ''))
       IN ('firstname', 'givenname', 'lastname', 'surname', 'familyname');");

            /* 3. Added where they are still missing, taking fullName's place
                  on the form so the boxes come up in the order they were in
                  rather than after the mobile number. */
            migrationBuilder.Sql(@"
DECLARE @wholeOrder int =
    (SELECT TOP 1 DisplayOrder FROM dbo.SignupFields WHERE [Key] = 'fullName');
DECLARE @last int = ISNULL((SELECT MAX(DisplayOrder) FROM dbo.SignupFields), 0);

IF NOT EXISTS (SELECT 1 FROM dbo.SignupFields WHERE [Key] = 'firstName')
INSERT INTO dbo.SignupFields
    ([Key], Label, Placeholder, HelpText, Type, Required, DisplayOrder,
     IsBuiltIn, IsLocked, Status, CreatedOn)
VALUES
    ('firstName', 'First name', 'As printed on your PAN', NULL, 'Text', 1,
     ISNULL(@wholeOrder, @last + 1), 1, 1, 'Active', SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM dbo.SignupFields WHERE [Key] = 'lastName')
INSERT INTO dbo.SignupFields
    ([Key], Label, Placeholder, HelpText, Type, Required, DisplayOrder,
     IsBuiltIn, IsLocked, Status, CreatedOn)
VALUES
    ('lastName', 'Last name', 'As printed on your PAN', NULL, 'Text', 1,
     ISNULL(@wholeOrder, @last + 1) + 1, 1, 0, 'Active', SYSUTCDATETIME());");

            /* 4. And the whole name comes off the form. It is still a
                  built-in key and still a column - every screen reads it -
                  but it is composed from the two parts now, so asking for
                  it as well is a third box for a thing already answered.
                  Switched off rather than deleted: the row carries whatever
                  label and order somebody chose, and turning a question
                  back on should not mean recreating it. */
            migrationBuilder.Sql(@"
UPDATE dbo.SignupFields
   SET Status = 'Inactive', ModifiedOn = SYSUTCDATETIME()
 WHERE [Key] = 'fullName'
   AND Status = 'Active'
   AND EXISTS (SELECT 1 FROM dbo.SignupFields AS x
                WHERE x.[Key] = 'firstName' AND x.Status = 'Active');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /* Puts the whole-name question back and takes the two parts off,
               which is as far as this goes. The answers deleted above were
               duplicates of columns that still hold them, and the fields
               renamed in step 1 were renamed because their old spelling was
               the fault; neither is worth reconstructing. */
            migrationBuilder.Sql(@"
UPDATE dbo.SignupFields SET Status = 'Active' WHERE [Key] = 'fullName';
UPDATE dbo.SignupFields SET Status = 'Inactive' WHERE [Key] IN ('firstName', 'lastName');");
        }
    }
}
