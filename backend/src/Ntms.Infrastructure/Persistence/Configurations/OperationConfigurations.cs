using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Ntms.Domain.Entities;

namespace Ntms.Infrastructure.Persistence.Configurations;

public class AdminRoleConfiguration : IEntityTypeConfiguration<AdminRole>
{
    public void Configure(EntityTypeBuilder<AdminRole> b)
    {
        b.ToTable("AdminRoles");
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.Code).HasMaxLength(60).IsRequired();
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasIndex(x => x.Code).IsUnique();
    }
}

public class RolePermissionConfiguration : IEntityTypeConfiguration<RolePermission>
{
    public void Configure(EntityTypeBuilder<RolePermission> b)
    {
        b.ToTable("RolePermissions");
        b.Property(x => x.Permission).HasMaxLength(80).IsRequired();
        b.HasOne(x => x.Role).WithMany(x => x.Permissions).HasForeignKey(x => x.RoleId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.RoleId, x.Permission }).IsUnique();
    }
}

public class PortalUserConfiguration : IEntityTypeConfiguration<PortalUser>
{
    public void Configure(EntityTypeBuilder<PortalUser> b)
    {
        b.ToTable("PortalUsers");
        b.Property(x => x.UserCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.FullName).HasMaxLength(160).IsRequired();
        b.Property(x => x.Email).HasMaxLength(200).IsRequired();
        b.Property(x => x.Mobile).HasMaxLength(10).IsRequired();
        b.Property(x => x.Designation).HasMaxLength(120);
        b.Property(x => x.PasswordHash).HasMaxLength(400).IsRequired();
        b.Property(x => x.City).HasMaxLength(120);

        /* Identity is the generated user code. Email is profile data the user
           can change, so it is indexed for lookup but never made unique. */
        b.HasIndex(x => x.UserCode).IsUnique();
        b.HasIndex(x => x.Email);

        b.HasOne(x => x.Role).WithMany(x => x.Users).HasForeignKey(x => x.RoleId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Agency).WithMany().HasForeignKey(x => x.AgencyId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ReportsToUser).WithMany().HasForeignKey(x => x.ReportsToUserId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.State).WithMany().HasForeignKey(x => x.StateCode)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.District).WithMany().HasForeignKey(x => x.DistrictCode)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class UserCategoryConfiguration : IEntityTypeConfiguration<UserCategory>
{
    public void Configure(EntityTypeBuilder<UserCategory> b)
    {
        b.ToTable("UserCategories");
        b.HasKey(x => new { x.UserId, x.CategoryId });
        b.HasOne(x => x.User).WithMany(x => x.Categories).HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class UserSubCategoryConfiguration : IEntityTypeConfiguration<UserSubCategory>
{
    public void Configure(EntityTypeBuilder<UserSubCategory> b)
    {
        b.ToTable("UserSubCategories");
        b.HasKey(x => new { x.UserId, x.SubCategoryId });
        b.HasOne(x => x.User).WithMany(x => x.SubCategories).HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.SubCategory).WithMany().HasForeignKey(x => x.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class UserProgramTypeConfiguration : IEntityTypeConfiguration<UserProgramType>
{
    public void Configure(EntityTypeBuilder<UserProgramType> b)
    {
        b.ToTable("UserProgramTypes");
        b.HasKey(x => new { x.UserId, x.ProgramTypeId });
        b.HasOne(x => x.User).WithMany(x => x.ProgramTypes).HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.ProgramType).WithMany().HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class UserStateConfiguration : IEntityTypeConfiguration<UserState>
{
    public void Configure(EntityTypeBuilder<UserState> b)
    {
        b.ToTable("UserStates");
        b.HasKey(x => new { x.UserId, x.StateCode });
        b.HasOne(x => x.User).WithMany(x => x.States).HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.State).WithMany().HasForeignKey(x => x.StateCode)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class UserDistrictConfiguration : IEntityTypeConfiguration<UserDistrict>
{
    public void Configure(EntityTypeBuilder<UserDistrict> b)
    {
        b.ToTable("UserDistricts");
        b.HasKey(x => new { x.UserId, x.DistrictCode });
        b.HasOne(x => x.User).WithMany(x => x.Districts).HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.District).WithMany().HasForeignKey(x => x.DistrictCode)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> b)
    {
        b.ToTable("RefreshTokens");
        b.Property(x => x.Token).HasMaxLength(200).IsRequired();
        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => x.Token).IsUnique();
    }
}

public class ApplicantConfiguration : IEntityTypeConfiguration<Applicant>
{
    public void Configure(EntityTypeBuilder<Applicant> b)
    {
        b.ToTable("Applicants");
        b.Property(x => x.ApplicantCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.FullName).HasMaxLength(160).IsRequired();
        b.Property(x => x.Email).HasMaxLength(200).IsRequired();
        b.Property(x => x.Mobile).HasMaxLength(10).IsRequired();
        b.Property(x => x.Pan).HasMaxLength(10).IsRequired();
        b.Property(x => x.PasswordHash).HasMaxLength(400);
        b.Property(x => x.City).HasMaxLength(120);

        /* Same rule as portal users: the generated code is the identity. */
        b.HasIndex(x => x.ApplicantCode).IsUnique();
        b.HasIndex(x => x.Email);
        b.HasIndex(x => x.Pan).IsUnique();

        b.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.SubCategory).WithMany().HasForeignKey(x => x.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.State).WithMany().HasForeignKey(x => x.StateCode)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.District).WithMany().HasForeignKey(x => x.DistrictCode)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class OtpChallengeConfiguration : IEntityTypeConfiguration<OtpChallenge>
{
    public void Configure(EntityTypeBuilder<OtpChallenge> b)
    {
        b.ToTable("OtpChallenges");
        b.Property(x => x.Channel).HasMaxLength(10).IsRequired();
        b.Property(x => x.Destination).HasMaxLength(200).IsRequired();
        b.Property(x => x.CodeHash).HasMaxLength(200).IsRequired();
        b.HasIndex(x => new { x.Destination, x.Channel });
    }
}

public class ApplicationConfiguration : IEntityTypeConfiguration<TrainingApplication>
{
    public void Configure(EntityTypeBuilder<TrainingApplication> b)
    {
        b.ToTable("Applications");
        b.Property(x => x.ApplicationNo).HasMaxLength(40).IsRequired();
        b.Property(x => x.Tan).HasMaxLength(10);
        b.Property(x => x.DeductorName).HasMaxLength(200);
        b.Property(x => x.TdsPercent).HasColumnType("decimal(5,2)");
        b.Property(x => x.Score).HasColumnType("decimal(6,2)");
        /* Answers follow the form definition, so they are kept as JSON rather
           than a column per field. SQL Server 2022 can query this with
           OPENJSON when reporting needs it. */
        b.Property(x => x.ResponsesJson).HasColumnName("Responses").IsRequired();

        b.HasIndex(x => x.ApplicationNo).IsUnique();
        b.HasIndex(x => new { x.Status, x.SubmittedOn });

        b.HasOne(x => x.Applicant).WithMany(x => x.Applications).HasForeignKey(x => x.ApplicantId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ProgramType).WithMany().HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.SubCategory).WithMany().HasForeignKey(x => x.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.RegistrationForm).WithMany().HasForeignKey(x => x.RegistrationFormId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.AssignedToUser).WithMany().HasForeignKey(x => x.AssignedToUserId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.State).WithMany().HasForeignKey(x => x.StateCode)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.District).WithMany().HasForeignKey(x => x.DistrictCode)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ApplicationDocumentConfiguration : IEntityTypeConfiguration<ApplicationDocument>
{
    public void Configure(EntityTypeBuilder<ApplicationDocument> b)
    {
        b.ToTable("ApplicationDocuments");
        b.Property(x => x.FieldKey).HasMaxLength(80).IsRequired();
        b.Property(x => x.Label).HasMaxLength(250).IsRequired();
        b.Property(x => x.FileName).HasMaxLength(260).IsRequired();
        b.Property(x => x.ContentType).HasMaxLength(150);
        b.Property(x => x.StoragePath).HasMaxLength(500);
        b.Property(x => x.Remarks).HasMaxLength(500);
        b.HasOne(x => x.Application).WithMany(x => x.Documents).HasForeignKey(x => x.ApplicationId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ScrutinyEventConfiguration : IEntityTypeConfiguration<ScrutinyEvent>
{
    public void Configure(EntityTypeBuilder<ScrutinyEvent> b)
    {
        b.ToTable("ScrutinyEvents");
        b.Property(x => x.ByUserName).HasMaxLength(160).IsRequired();
        b.Property(x => x.ByRole).HasMaxLength(60).IsRequired();
        b.Property(x => x.Remarks).HasMaxLength(1000);
        b.HasOne(x => x.Application).WithMany(x => x.History).HasForeignKey(x => x.ApplicationId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProgrammeConfiguration : IEntityTypeConfiguration<Programme>
{
    public void Configure(EntityTypeBuilder<Programme> b)
    {
        b.ToTable("Programmes");
        b.Property(x => x.ProgrammeId).HasMaxLength(30).IsRequired();
        b.Property(x => x.ProgrammeName).HasMaxLength(250).IsRequired();
        b.Property(x => x.Venue).HasMaxLength(300).IsRequired();
        b.Property(x => x.City).HasMaxLength(120);
        b.Property(x => x.MeetingPlatform).HasMaxLength(120);
        b.Property(x => x.MeetingLink).HasMaxLength(500);
        b.Property(x => x.Comments).HasMaxLength(1000);
        b.Property(x => x.CumulativeFeedback).HasColumnType("decimal(4,2)");

        b.HasIndex(x => x.ProgrammeId).IsUnique();
        b.HasIndex(x => new { x.Status, x.StartDate });

        b.HasOne(x => x.Curriculum).WithMany().HasForeignKey(x => x.CurriculumId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.SubCategory).WithMany().HasForeignKey(x => x.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ProgramType).WithMany().HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Agency).WithMany().HasForeignKey(x => x.AgencyId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Coordinator).WithMany().HasForeignKey(x => x.CoordinatorId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.OperationManager).WithMany().HasForeignKey(x => x.OperationManagerId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.State).WithMany().HasForeignKey(x => x.StateCode)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.District).WithMany().HasForeignKey(x => x.DistrictCode)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ProgrammeSessionConfiguration : IEntityTypeConfiguration<ProgrammeSession>
{
    public void Configure(EntityTypeBuilder<ProgrammeSession> b)
    {
        b.ToTable("ProgrammeSessions");
        b.Property(x => x.SessionCode).HasMaxLength(60);
        b.Property(x => x.Title).HasMaxLength(250).IsRequired();
        b.Property(x => x.FacultyName).HasMaxLength(160);
        b.HasOne(x => x.Programme).WithMany(x => x.Sessions).HasForeignKey(x => x.ProgrammeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProgrammeParticipantConfiguration : IEntityTypeConfiguration<ProgrammeParticipant>
{
    public void Configure(EntityTypeBuilder<ProgrammeParticipant> b)
    {
        b.ToTable("ProgrammeParticipants");
        b.Property(x => x.AttendancePercent).HasColumnType("decimal(5,2)");
        b.Property(x => x.ExamScore).HasColumnType("decimal(6,2)");
        b.Property(x => x.CertificateNo).HasMaxLength(60);
        b.HasOne(x => x.Programme).WithMany(x => x.Participants).HasForeignKey(x => x.ProgrammeId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Applicant).WithMany().HasForeignKey(x => x.ApplicantId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Application).WithMany().HasForeignKey(x => x.ApplicationId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.ProgrammeId, x.ApplicantId }).IsUnique();
    }
}

public class ParticipantSkillMarkConfiguration : IEntityTypeConfiguration<ParticipantSkillMark>
{
    public void Configure(EntityTypeBuilder<ParticipantSkillMark> b)
    {
        b.ToTable("ParticipantSkillMarks");

        b.HasOne(x => x.Participant).WithMany(x => x.SkillMarks)
            .HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Cascade);

        /* Restrict, not cascade: a skill is retired rather than deleted once it
           has been marked against, and a delete that quietly took the marks
           with it would rewrite results that have already been declared. */
        b.HasOne(x => x.Skill).WithMany()
            .HasForeignKey(x => x.SkillId)
            .OnDelete(DeleteBehavior.Restrict);

        /* No action, not set-null: a programme already cascades to its
           participants and their marks, and a second cascading path to the
           same rows through the trainers is more than SQL Server will accept.
           Restricting is also the truer rule — a trainer who marked a
           candidate is part of that record. */
        b.HasOne(x => x.Trainer).WithMany()
            .HasForeignKey(x => x.TrainerId)
            .OnDelete(DeleteBehavior.Restrict);

        /* One mark per skill per candidate: a second row would make the viva
           total depend on which one was read. */
        b.HasIndex(x => new { x.ParticipantId, x.SkillId }).IsUnique();
    }
}

public class AttendanceRecordConfiguration : IEntityTypeConfiguration<AttendanceRecord>
{
    public void Configure(EntityTypeBuilder<AttendanceRecord> b)
    {
        b.ToTable("AttendanceRecords");
        b.Property(x => x.MarkedBy).HasMaxLength(160);
        b.HasOne(x => x.Session).WithMany(x => x.Attendance).HasForeignKey(x => x.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Participant).WithMany(x => x.Attendance).HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.SessionId, x.ParticipantId }).IsUnique();
    }
}

public class CertificateConfiguration : IEntityTypeConfiguration<Certificate>
{
    public void Configure(EntityTypeBuilder<Certificate> b)
    {
        b.ToTable("Certificates");
        b.Property(x => x.Number).HasMaxLength(60).IsRequired();
        b.Property(x => x.RecipientName).HasMaxLength(200).IsRequired();
        b.Property(x => x.ProgrammeName).HasMaxLength(250).IsRequired();
        b.Property(x => x.ProgramTypeName).HasMaxLength(250).IsRequired();
        b.Property(x => x.RevokedReason).HasMaxLength(500);
        b.Ignore(x => x.IsRevoked);

        /* The number is the certificate's identity, and a revoked one keeps
           its number so the series can never be reissued. */
        b.HasIndex(x => x.Number).IsUnique();

        /* One live certificate per participant. Filtered, so revoking frees the
           participant for a corrected reissue without freeing the number. */
        b.HasIndex(x => x.ParticipantId)
            .IsUnique()
            .HasFilter("[RevokedOn] IS NULL");

        b.HasIndex(x => new { x.ProgramTypeId, x.IssuedOn });

        b.HasOne(x => x.Participant).WithMany().HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Programme).WithMany().HasForeignKey(x => x.ProgrammeId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ProgramType).WithMany().HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.IssuedBy).WithMany().HasForeignKey(x => x.IssuedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
