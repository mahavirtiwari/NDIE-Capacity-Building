using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// An operation manager is allocated program types and states, and
    /// nothing else.
    ///
    /// That is what the role has always said it is — "empanels Implementing
    /// Agencies within allocated program types and states" — but the code
    /// allocated it categories and sub-categories as well. A manager could
    /// therefore be handed a whole category and, separately, program types
    /// from elsewhere inside it, leaving two different answers to the
    /// question of what that manager actually covers.
    ///
    /// The program types are the answer. The category a manager works in is
    /// read off them.
    ///
    /// Existing managers are converted rather than cleared. Anyone holding
    /// categories or sub-categories but no program types is given every
    /// program type inside what they held, so their reach on the day after
    /// this runs is the same as the day before. Only then are the two
    /// columns of allocation that no longer apply removed.
    /// </summary>
    public partial class OperationManagersHoldProgramTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* From sub-categories first, because it is the finer of the two
               and a manager holding both meant the sub-categories. */
            migrationBuilder.Sql(@"
INSERT INTO UserProgramTypes (UserId, ProgramTypeId)
SELECT DISTINCT u.Id, p.Id
FROM PortalUsers u
JOIN UserSubCategories s ON s.UserId = u.Id
JOIN ProgramTypes p ON p.SubCategoryId = s.SubCategoryId
WHERE u.BaseRole = 'OperationManager'
  AND NOT EXISTS (SELECT 1 FROM UserProgramTypes t WHERE t.UserId = u.Id)
  AND NOT EXISTS (
      SELECT 1 FROM UserProgramTypes t
      WHERE t.UserId = u.Id AND t.ProgramTypeId = p.Id
  );
");

            /* Then from categories, for a manager that held only those. */
            migrationBuilder.Sql(@"
INSERT INTO UserProgramTypes (UserId, ProgramTypeId)
SELECT DISTINCT u.Id, p.Id
FROM PortalUsers u
JOIN UserCategories c ON c.UserId = u.Id
JOIN ProgramTypes p ON p.CategoryId = c.CategoryId
WHERE u.BaseRole = 'OperationManager'
  AND NOT EXISTS (SELECT 1 FROM UserProgramTypes t WHERE t.UserId = u.Id)
  AND NOT EXISTS (
      SELECT 1 FROM UserProgramTypes t
      WHERE t.UserId = u.Id AND t.ProgramTypeId = p.Id
  );
");

            /* Now the axes that no longer apply to the tier. Left in place
               they would be read by nothing and edited away by the first
               person to open the allocation form, which is a worse state
               than not having them. */
            migrationBuilder.Sql(@"
DELETE c FROM UserCategories c
JOIN PortalUsers u ON u.Id = c.UserId
WHERE u.BaseRole = 'OperationManager';

DELETE s FROM UserSubCategories s
JOIN PortalUsers u ON u.Id = s.UserId
WHERE u.BaseRole = 'OperationManager';
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /* Puts the two axes back, derived from the program types the
               manager holds — which is where they came from. Not the
               original rows: those are gone, and this is the same reach
               expressed the other way round. */
            migrationBuilder.Sql(@"
INSERT INTO UserCategories (UserId, CategoryId)
SELECT DISTINCT u.Id, p.CategoryId
FROM PortalUsers u
JOIN UserProgramTypes t ON t.UserId = u.Id
JOIN ProgramTypes p ON p.Id = t.ProgramTypeId
WHERE u.BaseRole = 'OperationManager'
  AND NOT EXISTS (
      SELECT 1 FROM UserCategories c
      WHERE c.UserId = u.Id AND c.CategoryId = p.CategoryId
  );

INSERT INTO UserSubCategories (UserId, SubCategoryId)
SELECT DISTINCT u.Id, p.SubCategoryId
FROM PortalUsers u
JOIN UserProgramTypes t ON t.UserId = u.Id
JOIN ProgramTypes p ON p.Id = t.ProgramTypeId
WHERE u.BaseRole = 'OperationManager'
  AND NOT EXISTS (
      SELECT 1 FROM UserSubCategories s
      WHERE s.UserId = u.Id AND s.SubCategoryId = p.SubCategoryId
  );
");
        }
    }
}
