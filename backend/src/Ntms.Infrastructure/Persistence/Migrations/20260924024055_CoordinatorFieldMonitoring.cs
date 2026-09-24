using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ntms.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class CoordinatorFieldMonitoring : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OnSpotParticipants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProgrammeId = table.Column<int>(type: "int", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Mobile = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    EnterpriseName = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    Designation = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    UdyamNumber = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Gender = table.Column<string>(type: "varchar(40)", nullable: true),
                    SocialCategory = table.Column<string>(type: "varchar(40)", nullable: true),
                    StateCode = table.Column<int>(type: "int", nullable: true),
                    DistrictCode = table.Column<int>(type: "int", nullable: true),
                    IsPresent = table.Column<bool>(type: "bit", nullable: true),
                    AttendanceMarkedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FeedbackRating = table.Column<int>(type: "int", nullable: true),
                    FeedbackComments = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    FeedbackOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OnSpotParticipants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OnSpotParticipants_LgdDistricts_DistrictCode",
                        column: x => x.DistrictCode,
                        principalTable: "LgdDistricts",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OnSpotParticipants_LgdStates_StateCode",
                        column: x => x.StateCode,
                        principalTable: "LgdStates",
                        principalColumn: "Code",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OnSpotParticipants_Programmes_ProgrammeId",
                        column: x => x.ProgrammeId,
                        principalTable: "Programmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProgrammeSubmissions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProgrammeId = table.Column<int>(type: "int", nullable: false),
                    SubmittedByUserId = table.Column<int>(type: "int", nullable: false),
                    SubmittedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TrainerCount = table.Column<int>(type: "int", nullable: false),
                    SessionCount = table.Column<int>(type: "int", nullable: false),
                    ParticipantCount = table.Column<int>(type: "int", nullable: false),
                    PresentCount = table.Column<int>(type: "int", nullable: false),
                    PhotoCount = table.Column<int>(type: "int", nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgrammeSubmissions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgrammeSubmissions_PortalUsers_SubmittedByUserId",
                        column: x => x.SubmittedByUserId,
                        principalTable: "PortalUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProgrammeSubmissions_Programmes_ProgrammeId",
                        column: x => x.ProgrammeId,
                        principalTable: "Programmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProgrammeTrainers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProgrammeId = table.Column<int>(type: "int", nullable: false),
                    FullName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Mobile = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Designation = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    Organisation = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgrammeTrainers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgrammeTrainers_Programmes_ProgrammeId",
                        column: x => x.ProgrammeId,
                        principalTable: "Programmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ProgrammeVenues",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProgrammeId = table.Column<int>(type: "int", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Address = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Landmark = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Latitude = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Longitude = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    AccuracyMetres = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    GeoTaggedOn = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProgrammeVenues", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProgrammeVenues_Programmes_ProgrammeId",
                        column: x => x.ProgrammeId,
                        principalTable: "Programmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MonitoringSessions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProgrammeId = table.Column<int>(type: "int", nullable: false),
                    TrainerId = table.Column<int>(type: "int", nullable: false),
                    CurriculumSessionId = table.Column<int>(type: "int", nullable: false),
                    CurriculumTopicId = table.Column<int>(type: "int", nullable: false),
                    ConductedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Comments = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MonitoringSessions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MonitoringSessions_CurriculumSessions_CurriculumSessionId",
                        column: x => x.CurriculumSessionId,
                        principalTable: "CurriculumSessions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MonitoringSessions_CurriculumTopics_CurriculumTopicId",
                        column: x => x.CurriculumTopicId,
                        principalTable: "CurriculumTopics",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MonitoringSessions_ProgrammeTrainers_TrainerId",
                        column: x => x.TrainerId,
                        principalTable: "ProgrammeTrainers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_MonitoringSessions_Programmes_ProgrammeId",
                        column: x => x.ProgrammeId,
                        principalTable: "Programmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "MonitoringPhotos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProgrammeId = table.Column<int>(type: "int", nullable: false),
                    Kind = table.Column<string>(type: "varchar(40)", nullable: false),
                    VenueId = table.Column<int>(type: "int", nullable: true),
                    SessionId = table.Column<int>(type: "int", nullable: true),
                    ParticipantId = table.Column<int>(type: "int", nullable: true),
                    RelativePath = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    SizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    Latitude = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Longitude = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    CapturedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CreatedOn = table.Column<DateTime>(type: "datetime2", nullable: false),
                    ModifiedBy = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    ModifiedOn = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MonitoringPhotos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_MonitoringPhotos_MonitoringSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "MonitoringSessions",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_MonitoringPhotos_OnSpotParticipants_ParticipantId",
                        column: x => x.ParticipantId,
                        principalTable: "OnSpotParticipants",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_MonitoringPhotos_ProgrammeVenues_VenueId",
                        column: x => x.VenueId,
                        principalTable: "ProgrammeVenues",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_MonitoringPhotos_Programmes_ProgrammeId",
                        column: x => x.ProgrammeId,
                        principalTable: "Programmes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_MonitoringPhotos_ParticipantId",
                table: "MonitoringPhotos",
                column: "ParticipantId");

            migrationBuilder.CreateIndex(
                name: "IX_MonitoringPhotos_ProgrammeId_Kind",
                table: "MonitoringPhotos",
                columns: new[] { "ProgrammeId", "Kind" });

            migrationBuilder.CreateIndex(
                name: "IX_MonitoringPhotos_SessionId",
                table: "MonitoringPhotos",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_MonitoringPhotos_VenueId",
                table: "MonitoringPhotos",
                column: "VenueId");

            migrationBuilder.CreateIndex(
                name: "IX_MonitoringSessions_CurriculumSessionId",
                table: "MonitoringSessions",
                column: "CurriculumSessionId");

            migrationBuilder.CreateIndex(
                name: "IX_MonitoringSessions_CurriculumTopicId",
                table: "MonitoringSessions",
                column: "CurriculumTopicId");

            migrationBuilder.CreateIndex(
                name: "IX_MonitoringSessions_ProgrammeId",
                table: "MonitoringSessions",
                column: "ProgrammeId");

            migrationBuilder.CreateIndex(
                name: "IX_MonitoringSessions_TrainerId",
                table: "MonitoringSessions",
                column: "TrainerId");

            migrationBuilder.CreateIndex(
                name: "IX_OnSpotParticipants_DistrictCode",
                table: "OnSpotParticipants",
                column: "DistrictCode");

            migrationBuilder.CreateIndex(
                name: "IX_OnSpotParticipants_ProgrammeId",
                table: "OnSpotParticipants",
                column: "ProgrammeId");

            migrationBuilder.CreateIndex(
                name: "IX_OnSpotParticipants_ProgrammeId_Mobile",
                table: "OnSpotParticipants",
                columns: new[] { "ProgrammeId", "Mobile" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OnSpotParticipants_StateCode",
                table: "OnSpotParticipants",
                column: "StateCode");

            migrationBuilder.CreateIndex(
                name: "IX_ProgrammeSubmissions_ProgrammeId",
                table: "ProgrammeSubmissions",
                column: "ProgrammeId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProgrammeSubmissions_SubmittedByUserId",
                table: "ProgrammeSubmissions",
                column: "SubmittedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgrammeTrainers_ProgrammeId",
                table: "ProgrammeTrainers",
                column: "ProgrammeId");

            migrationBuilder.CreateIndex(
                name: "IX_ProgrammeVenues_ProgrammeId",
                table: "ProgrammeVenues",
                column: "ProgrammeId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MonitoringPhotos");

            migrationBuilder.DropTable(
                name: "ProgrammeSubmissions");

            migrationBuilder.DropTable(
                name: "MonitoringSessions");

            migrationBuilder.DropTable(
                name: "OnSpotParticipants");

            migrationBuilder.DropTable(
                name: "ProgrammeVenues");

            migrationBuilder.DropTable(
                name: "ProgrammeTrainers");
        }
    }
}
