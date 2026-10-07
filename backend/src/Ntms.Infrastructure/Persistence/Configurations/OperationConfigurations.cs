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

        /* Restrict, not cascade: deleting the account that shaped a role must
           not take the role — and the accounts assigned to it — with it. */
        b.HasOne(x => x.OwnerUser).WithMany()
            .HasForeignKey(x => x.OwnerUserId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.OwnerUserId);
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
        b.Property(x => x.Pincode).HasMaxLength(6);
        b.Property(x => x.Pan).HasMaxLength(10);
        b.Property(x => x.Aadhaar).HasMaxLength(12);
        b.Property(x => x.OrganisationName).HasMaxLength(200);

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

public class AgencyStatusEventConfiguration : IEntityTypeConfiguration<AgencyStatusEvent>
{
    public void Configure(EntityTypeBuilder<AgencyStatusEvent> b)
    {
        b.ToTable("AgencyStatusEvents");
        b.Property(x => x.Reason).HasMaxLength(500).IsRequired();
        b.Property(x => x.ByUserName).HasMaxLength(160);
        b.Property(x => x.ByUserCode).HasMaxLength(20);

        b.HasOne(x => x.Agency).WithMany().HasForeignKey(x => x.AgencyId)
            .OnDelete(DeleteBehavior.Cascade);

        /* Read newest first, always for one agency. */
        b.HasIndex(x => new { x.AgencyId, x.On });
    }
}

public class UserStatusEventConfiguration : IEntityTypeConfiguration<UserStatusEvent>
{
    public void Configure(EntityTypeBuilder<UserStatusEvent> b)
    {
        b.ToTable("UserStatusEvents");
        b.Property(x => x.Reason).HasMaxLength(500).IsRequired();
        b.Property(x => x.ByUserName).HasMaxLength(160);
        b.Property(x => x.ByUserCode).HasMaxLength(20);

        b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        /* Read newest first, always for one account. */
        b.HasIndex(x => new { x.UserId, x.On });
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
        b.Property(x => x.BlockReasonLabel).HasMaxLength(200);
        b.Property(x => x.PasswordHash).HasMaxLength(400);
        b.Property(x => x.City).HasMaxLength(120);

        /* Same rule as portal users: the generated code is the identity. */
        b.HasIndex(x => x.ApplicantCode).IsUnique();
        b.HasIndex(x => x.Email);

        /* One account per person, where the person is their PAN.

           It was once unique on (Pan, CategoryId), because a category was
           chosen at sign-up and training under a second one meant a second
           applicant ID. One account now holds a profile in each category, so
           a second row for the same PAN is a duplicate of a person.

           Filtered, because the form may be configured not to ask for a PAN,
           and a rule keyed on one cannot be applied to a row without it.

           The service says so in words; this is what makes it true even if two
           sign-ups arrive at the same moment. */
        b.HasIndex(x => x.Pan).IsUnique().HasFilter("[Pan] <> ''");

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
        b.Property(x => x.RejectionReasonLabel).HasMaxLength(200);

        /* Restrict, not cascade: retiring a reason must never delete the
           applications that were turned down for it. */
        b.HasOne(x => x.RejectionReason).WithMany()
            .HasForeignKey(x => x.RejectionReasonId)
            .OnDelete(DeleteBehavior.Restrict);
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
        b.HasOne(x => x.ProfileForm).WithMany().HasForeignKey(x => x.ProfileFormId)
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
        b.Property(x => x.RejectionReasonLabel).HasMaxLength(200);
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
        b.Property(x => x.Pincode).HasMaxLength(6);
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
        b.HasOne(x => x.ExamPaper).WithMany().HasForeignKey(x => x.ExamPaperId)
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

/// <summary>
/// One attempt to pay a fee. Nothing here is a secret of the payer's - the
/// card never touches this system - so the only care needed is that the
/// order id stays unique and the application can be reached from it.
/// </summary>
public class PaymentInvoiceConfiguration : IEntityTypeConfiguration<PaymentInvoice>
{
    public void Configure(EntityTypeBuilder<PaymentInvoice> b)
    {
        b.ToTable("PaymentInvoices");

        b.Property(x => x.InvoiceNumber).HasMaxLength(80);
        b.Property(x => x.FileName).HasMaxLength(260).IsRequired();
        b.Property(x => x.ContentType).HasMaxLength(100).IsRequired();

        /* One copy per payment. A second fetch replaces what is held rather
           than leaving two documents for the same money. */
        b.HasIndex(x => x.PaymentTransactionId).IsUnique();

        b.HasOne(x => x.Payment).WithMany()
            .HasForeignKey(x => x.PaymentTransactionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class PaymentTransactionConfiguration : IEntityTypeConfiguration<PaymentTransaction>
{
    public void Configure(EntityTypeBuilder<PaymentTransaction> b)
    {
        b.ToTable("PaymentTransactions");

        b.Property(x => x.OrderId).HasMaxLength(40).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.Gateway).HasMaxLength(40).IsRequired();
        b.Property(x => x.Method).HasMaxLength(80);
        b.Property(x => x.TrackingId).HasMaxLength(80);
        b.Property(x => x.BankReference).HasMaxLength(80);
        b.Property(x => x.FailureReason).HasMaxLength(500);

        /* The order id is what the gateway answers with, so it has to find
           exactly one attempt. A retry gets a new one. */
        b.HasIndex(x => x.OrderId).IsUnique();
        b.HasIndex(x => new { x.ApplicantId, x.InitiatedOn });

        b.HasOne(x => x.Application).WithMany(a => a.Payments)
            .HasForeignKey(x => x.ApplicationId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Applicant).WithMany()
            .HasForeignKey(x => x.ApplicantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

/// <summary>
/// The record of an account being blocked or let back in. Cascades with the
/// applicant: an account that is gone has no history worth keeping.
/// </summary>
public class ApplicantStatusEventConfiguration : IEntityTypeConfiguration<ApplicantStatusEvent>
{
    public void Configure(EntityTypeBuilder<ApplicantStatusEvent> b)
    {
        b.ToTable("ApplicantStatusEvents");
        b.Property(x => x.ReasonLabel).HasMaxLength(200);
        b.Property(x => x.Remarks).HasMaxLength(1000);
        b.Property(x => x.ByUserName).HasMaxLength(160).IsRequired();
        b.Property(x => x.ByUserCode).HasMaxLength(40).IsRequired();

        b.HasIndex(x => new { x.ApplicantId, x.On });

        b.HasOne(x => x.Applicant).WithMany(a => a.StatusEvents)
            .HasForeignKey(x => x.ApplicantId)
            .OnDelete(DeleteBehavior.Cascade);

        /* Restrict: retiring a reason must not delete the blocks taken for it. */
        b.HasOne(x => x.BlockReason).WithMany()
            .HasForeignKey(x => x.BlockReasonId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
