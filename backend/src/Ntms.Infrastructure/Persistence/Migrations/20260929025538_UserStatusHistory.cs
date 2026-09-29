using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class UserStatusHistory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "UserStatusEvents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    FromStatus = table.Column<string>(type: "varchar(40)", nullable: false),
                    ToStatus = table.Column<string>(type: "varchar(40)", nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    ByUserId = table.Column<int>(type: "int", nullable: true),
                    ByUserName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    ByUserCode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    On = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserStatusEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserStatusEvents_PortalUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "PortalUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            /* Attach every account that predates the chain to the tier above
               it, but only where that is unambiguous — exactly one active
               account at the parent tier. Guessing between two would put
               somebody's account in the wrong person's list, which is the
               failure this whole change exists to prevent.

               What stays unattached is visible to the Super Admin and the
               Ministry, who see everything, and can be reassigned from there. */
            migrationBuilder.Sql("""
                WITH parents AS (
                    SELECT BaseRole, MIN(Id) AS ParentId, COUNT(*) AS Candidates
                    FROM PortalUsers
                    WHERE Status = 'Active'
                    GROUP BY BaseRole
                )
                UPDATE u
                SET u.ReportsToUserId = p.ParentId
                FROM PortalUsers u
                JOIN parents p ON p.BaseRole =
                    CASE u.BaseRole
                        WHEN 'Admin'            THEN 'SuperAdmin'
                        WHEN 'Ministry'         THEN 'SuperAdmin'
                        WHEN 'OperationManager' THEN 'Admin'
                        WHEN 'AgencyAdmin'      THEN 'OperationManager'
                        WHEN 'Coordinator'      THEN 'AgencyAdmin'
                    END
                WHERE u.ReportsToUserId IS NULL
                  AND u.BaseRole <> 'SuperAdmin'
                  AND p.Candidates = 1;
                """);

            migrationBuilder.CreateIndex(
                name: "IX_UserStatusEvents_UserId_On",
                table: "UserStatusEvents",
                columns: new[] { "UserId", "On" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UserStatusEvents");
        }
    }
}
