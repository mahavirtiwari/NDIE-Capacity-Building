using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <summary>
    /// Puts the six system roles back to the sets the seeder defines.
    ///
    /// They had drifted. A coordinator — whose job is to record what
    /// happened at a session — could empanel an implementing agency and
    /// scrutinise applications; an operation manager could add coordinators
    /// and edit the faculty register. Nothing in the roles screen does this
    /// on its own, so somebody granted them by hand, and once granted there
    /// was no way back: the seeder tops up what is missing and never removes
    /// what is there, deliberately, so that a department can shape a role
    /// without the next deploy undoing it.
    ///
    /// That protection is kept. This is a one-off correction, not a new
    /// rule — a system role can still be shaped from the roles screen after
    /// it runs, and custom roles are not touched at all.
    ///
    /// The sets are written out here rather than read from the seeder. A
    /// migration is a record of what happened on a particular day; if it
    /// read a list that later changed, re-running it against a fresh
    /// database would do something different from what it did here.
    /// </summary>
    public partial class SystemRolesBackToTheirSeededSets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            /* One statement per role so the intent reads: clear what the
               role holds, insert the set it is defined with. Only where
               IsSystemRole is set — a role somebody built for their own
               department is theirs and is left exactly as it is. */
            migrationBuilder.Sql(@"
SET NOCOUNT ON;

DECLARE @sets TABLE (Code nvarchar(60), Permission nvarchar(80));

INSERT INTO @sets (Code, Permission) VALUES
 -- Owns the masters, the roles and the portal. Appoints the tier below it,
 -- and does not hold the operational grants that belong to that tier.
 ('SUPER_ADMIN', 'masters.view'),         ('SUPER_ADMIN', 'masters.manage'),
 ('SUPER_ADMIN', 'curriculum.view'),      ('SUPER_ADMIN', 'curriculum.manage'),
 ('SUPER_ADMIN', 'fees.view'),            ('SUPER_ADMIN', 'fees.manage'),
 ('SUPER_ADMIN', 'exams.view'),           ('SUPER_ADMIN', 'exams.manage'),
 ('SUPER_ADMIN', 'materials.view'),       ('SUPER_ADMIN', 'materials.manage'),
 ('SUPER_ADMIN', 'roles.view'),           ('SUPER_ADMIN', 'roles.manage'),
 ('SUPER_ADMIN', 'users.view'),           ('SUPER_ADMIN', 'users.manage'),
 ('SUPER_ADMIN', 'users.status'),         ('SUPER_ADMIN', 'agencies.view'),
 ('SUPER_ADMIN', 'applications.view'),    ('SUPER_ADMIN', 'programs.view'),
 ('SUPER_ADMIN', 'coordinators.view'),    ('SUPER_ADMIN', 'reports.view'),
 ('SUPER_ADMIN', 'professionals.view'),   ('SUPER_ADMIN', 'trainers.view'),
 ('SUPER_ADMIN', 'trainers.manage'),      ('SUPER_ADMIN', 'settings.manage'),

 -- Sees the whole program and changes none of it.
 ('MINISTRY', 'masters.view'),            ('MINISTRY', 'curriculum.view'),
 ('MINISTRY', 'fees.view'),               ('MINISTRY', 'exams.view'),
 ('MINISTRY', 'materials.view'),          ('MINISTRY', 'agencies.view'),
 ('MINISTRY', 'users.view'),              ('MINISTRY', 'applications.view'),
 ('MINISTRY', 'programs.view'),           ('MINISTRY', 'coordinators.view'),
 ('MINISTRY', 'reports.view'),            ('MINISTRY', 'professionals.view'),
 ('MINISTRY', 'trainers.view'),

 -- Appoints operation managers, and scrutinises applications.
 ('ADMIN', 'masters.view'),               ('ADMIN', 'curriculum.view'),
 ('ADMIN', 'fees.view'),                  ('ADMIN', 'exams.view'),
 ('ADMIN', 'materials.view'),             ('ADMIN', 'agencies.view'),
 ('ADMIN', 'roles.view'),                 ('ADMIN', 'users.view'),
 ('ADMIN', 'users.manage'),               ('ADMIN', 'users.status'),
 ('ADMIN', 'applications.view'),          ('ADMIN', 'applications.scrutinise'),
 ('ADMIN', 'programs.view'),              ('ADMIN', 'coordinators.view'),
 ('ADMIN', 'reports.view'),               ('ADMIN', 'professionals.view'),
 ('ADMIN', 'trainers.view'),

 -- Empanels implementing agencies, and permits the batches they raise.
 ('OPS_MANAGER', 'masters.view'),         ('OPS_MANAGER', 'curriculum.view'),
 ('OPS_MANAGER', 'materials.view'),       ('OPS_MANAGER', 'agencies.view'),
 ('OPS_MANAGER', 'agencies.manage'),      ('OPS_MANAGER', 'users.view'),
 ('OPS_MANAGER', 'users.status'),         ('OPS_MANAGER', 'applications.view'),
 ('OPS_MANAGER', 'programs.view'),        ('OPS_MANAGER', 'programs.manage'),
 ('OPS_MANAGER', 'coordinators.view'),    ('OPS_MANAGER', 'reports.view'),
 ('OPS_MANAGER', 'professionals.view'),   ('OPS_MANAGER', 'trainers.view'),

 -- Raises its programs, adds its coordinators and runs them.
 ('AGENCY_ADMIN', 'masters.view'),        ('AGENCY_ADMIN', 'curriculum.view'),
 ('AGENCY_ADMIN', 'materials.view'),      ('AGENCY_ADMIN', 'roles.view'),
 ('AGENCY_ADMIN', 'users.view'),          ('AGENCY_ADMIN', 'users.manage'),
 ('AGENCY_ADMIN', 'users.status'),        ('AGENCY_ADMIN', 'coordinators.view'),
 ('AGENCY_ADMIN', 'coordinators.manage'), ('AGENCY_ADMIN', 'programs.view'),
 ('AGENCY_ADMIN', 'programs.create'),     ('AGENCY_ADMIN', 'programs.manage'),
 ('AGENCY_ADMIN', 'reports.view'),

 -- Records what happened at a session, and marks attendance.
 ('COORDINATOR', 'programs.view'),        ('COORDINATOR', 'programs.manage'),
 ('COORDINATOR', 'materials.view');

DELETE p
FROM RolePermissions p
JOIN AdminRoles r ON r.Id = p.RoleId
WHERE r.IsSystemRole = 1
  AND r.Code IN (SELECT DISTINCT Code FROM @sets);

INSERT INTO RolePermissions (RoleId, Permission)
SELECT r.Id, s.Permission
FROM @sets s
JOIN AdminRoles r ON r.Code = s.Code AND r.IsSystemRole = 1;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            /* Deliberately nothing. What was here before was drift — grants
               added by hand over time, with no record of who added which or
               why. There is nothing to restore them from, and writing them
               back out of this file would reinstate exactly the problem the
               migration was run to fix. */
        }
    }
}
