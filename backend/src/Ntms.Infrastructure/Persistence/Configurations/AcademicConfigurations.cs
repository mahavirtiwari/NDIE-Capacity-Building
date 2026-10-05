using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Ntms.Domain.Entities;

namespace Ntms.Infrastructure.Persistence.Configurations;

public class CurriculumConfiguration : IEntityTypeConfiguration<Curriculum>
{
    public void Configure(EntityTypeBuilder<Curriculum> b)
    {
        b.ToTable("Curricula");
        b.Property(x => x.Objective).HasMaxLength(1000);
        b.HasOne(x => x.ProgramType).WithMany().HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Restrict);
        /* One curriculum per programme type, enforced in the database as well
           as in the service — the programme screen picks a curriculum by type
           and cannot choose between two. */
        b.HasIndex(x => x.ProgramTypeId).IsUnique();
    }
}

public class CurriculumSessionConfiguration : IEntityTypeConfiguration<CurriculumSession>
{
    public void Configure(EntityTypeBuilder<CurriculumSession> b)
    {
        b.ToTable("CurriculumSessions");
        b.Property(x => x.SessionCode).HasMaxLength(60).IsRequired();
        b.Property(x => x.SessionName).HasMaxLength(250).IsRequired();
        b.HasOne(x => x.Curriculum).WithMany(x => x.Sessions).HasForeignKey(x => x.CurriculumId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.CurriculumId, x.SessionCode }).IsUnique();
    }
}

public class CurriculumTopicConfiguration : IEntityTypeConfiguration<CurriculumTopic>
{
    public void Configure(EntityTypeBuilder<CurriculumTopic> b)
    {
        b.ToTable("CurriculumTopics");
        b.Property(x => x.TopicCode).HasMaxLength(80).IsRequired();
        b.Property(x => x.TopicName).HasMaxLength(250).IsRequired();
        b.Property(x => x.LearningOutcome).HasMaxLength(500);
        b.HasOne(x => x.Session).WithMany(x => x.Topics).HasForeignKey(x => x.SessionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProfileFormConfiguration : IEntityTypeConfiguration<ProfileForm>
{
    public void Configure(EntityTypeBuilder<ProfileForm> b)
    {
        b.ToTable("ProfileForms");
        b.Property(x => x.Version).HasMaxLength(20).IsRequired();
        b.HasOne(x => x.SubCategory).WithMany().HasForeignKey(x => x.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.SubCategoryId, x.Version }).IsUnique();
    }
}

public class ProfileSubmissionConfiguration : IEntityTypeConfiguration<ProfileSubmission>
{
    public void Configure(EntityTypeBuilder<ProfileSubmission> b)
    {
        b.ToTable("ProfileSubmissions");

        b.Property(x => x.Responses).IsRequired();
        b.Property(x => x.DecidedByUserName).HasMaxLength(200);
        b.Property(x => x.RejectionReasonLabel).HasMaxLength(200);
        b.Property(x => x.Remarks).HasMaxLength(1000);

        /* One attempt per number per discipline: a retry is a new row, and
           two rows claiming to be the same attempt would make the count the
           block is calculated from meaningless. Keyed on the sub-category
           too, because an applicant holds one profile per category and
           their attempts at each are counted separately. */
        b.HasIndex(x => new { x.ApplicantId, x.SubCategoryId, x.AttemptNo }).IsUnique();
        b.HasIndex(x => new { x.Status, x.SubmittedOn });

        /* The officer's own queue is the commonest read of this table. */
        b.HasIndex(x => new { x.AssignedToUserId, x.Status });

        /* Restrict: an officer leaving must not take the profiles on their
           desk with them. They are reassigned, not deleted. */
        b.HasOne(x => x.AssignedToUser).WithMany()
            .HasForeignKey(x => x.AssignedToUserId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.Applicant).WithMany(a => a.ProfileSubmissions)
            .HasForeignKey(x => x.ApplicantId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.SubCategory).WithMany()
            .HasForeignKey(x => x.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.Category).WithMany()
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.ProfileForm).WithMany()
            .HasForeignKey(x => x.ProfileFormId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasOne(x => x.RejectionReason).WithMany()
            .HasForeignKey(x => x.RejectionReasonId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ProfileAttachmentConfiguration : IEntityTypeConfiguration<ProfileAttachment>
{
    public void Configure(EntityTypeBuilder<ProfileAttachment> b)
    {
        b.ToTable("ProfileAttachments");

        b.Property(x => x.FieldKey).HasMaxLength(80).IsRequired();
        b.Property(x => x.FileName).HasMaxLength(260);
        b.Property(x => x.ContentType).HasMaxLength(100).IsRequired();

        /* One per position per field per discipline, so a set of pictures
           has no gaps and no duplicates and the PDF's page order is the
           stored order. A file field only ever uses position one. */
        b.HasIndex(x => new { x.ApplicantId, x.SubCategoryId, x.FieldKey, x.DisplayOrder })
            .IsUnique();

        b.HasOne(x => x.Applicant).WithMany()
            .HasForeignKey(x => x.ApplicantId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.SubCategory).WithMany()
            .HasForeignKey(x => x.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class ProfileScrutinyEventConfiguration : IEntityTypeConfiguration<ProfileScrutinyEvent>
{
    public void Configure(EntityTypeBuilder<ProfileScrutinyEvent> b)
    {
        b.ToTable("ProfileScrutinyEvents");

        b.Property(x => x.ByUserName).HasMaxLength(200).IsRequired();
        b.Property(x => x.ByRole).HasMaxLength(80).IsRequired();
        b.Property(x => x.Remarks).HasMaxLength(1000);
        b.Property(x => x.RejectionReasonLabel).HasMaxLength(200);

        b.HasOne(x => x.Submission).WithMany(s => s.History)
            .HasForeignKey(x => x.SubmissionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProfileSectionConfiguration : IEntityTypeConfiguration<ProfileSection>
{
    public void Configure(EntityTypeBuilder<ProfileSection> b)
    {
        b.ToTable("ProfileSections");
        b.Property(x => x.Key).HasMaxLength(80).IsRequired();
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(500);
        b.Property(x => x.ItemLabel).HasMaxLength(80);
        /* Unique per form: a repeating section's key is what its answers are
           stored under, and two of them would overwrite each other. */
        b.HasIndex(x => new { x.FormId, x.Key }).IsUnique();
        b.HasOne(x => x.Form).WithMany(x => x.Sections).HasForeignKey(x => x.FormId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProfileFieldConfiguration : IEntityTypeConfiguration<ProfileField>
{
    public void Configure(EntityTypeBuilder<ProfileField> b)
    {
        b.ToTable("ProfileFields");
        b.Property(x => x.Key).HasMaxLength(80).IsRequired();
        b.Property(x => x.Label).HasMaxLength(250).IsRequired();
        b.Property(x => x.Placeholder).HasMaxLength(200);
        b.Property(x => x.HelpText).HasMaxLength(500);
        b.Property(x => x.VisibleWhenFieldKey).HasMaxLength(80);
        b.Property(x => x.VisibleWhenValues).HasMaxLength(500);

        /* Restrict, not cascade: a list in use must not be deletable out
           from under the forms that read it. The screen says which forms
           hold it so somebody can unpick that deliberately. */
        b.HasOne(x => x.OptionSet).WithMany()
            .HasForeignKey(x => x.OptionSetId)
            .OnDelete(DeleteBehavior.Restrict);

        b.OwnsOne(x => x.Validation, v =>
        {
            v.Property(p => p.Required).HasColumnName("Validation_Required");
            v.Property(p => p.MinLength).HasColumnName("Validation_MinLength");
            v.Property(p => p.MaxLength).HasColumnName("Validation_MaxLength");
            v.Property(p => p.Min).HasColumnName("Validation_Min").HasColumnType("decimal(18,2)");
            v.Property(p => p.Max).HasColumnName("Validation_Max").HasColumnType("decimal(18,2)");
            v.Property(p => p.Pattern).HasColumnName("Validation_Pattern").HasMaxLength(250);
            v.Property(p => p.AllowedExtensions).HasColumnName("Validation_AllowedExtensions")
                .HasMaxLength(200);
            v.Property(p => p.MaxFileSizeMb).HasColumnName("Validation_MaxFileSizeMb");
        });
        b.Navigation(x => x.Validation).IsRequired();

        b.HasOne(x => x.Section).WithMany(x => x.Fields).HasForeignKey(x => x.SectionId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasIndex(x => new { x.SectionId, x.Key }).IsUnique();
    }
}

public class ProfileFieldOptionConfiguration : IEntityTypeConfiguration<ProfileFieldOption>
{
    public void Configure(EntityTypeBuilder<ProfileFieldOption> b)
    {
        b.ToTable("ProfileFieldOptions");
        b.Property(x => x.Value).HasMaxLength(120).IsRequired();
        b.Property(x => x.Label).HasMaxLength(250).IsRequired();
        b.HasOne(x => x.Field).WithMany(x => x.Options).HasForeignKey(x => x.FieldId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class FeeStructureConfiguration : IEntityTypeConfiguration<FeeStructure>
{
    public void Configure(EntityTypeBuilder<FeeStructure> b)
    {
        b.ToTable("FeeStructures");
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.GstPercent).HasColumnType("decimal(5,2)");
        b.Property(x => x.TdsOptions).HasMaxLength(40);
        b.HasOne(x => x.ProgramType).WithMany().HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => new { x.ProgramTypeId, x.EffectiveFrom });
    }
}

public class FeeComponentConfiguration : IEntityTypeConfiguration<FeeComponent>
{
    public void Configure(EntityTypeBuilder<FeeComponent> b)
    {
        b.ToTable("FeeComponents");
        b.Property(x => x.Label).HasMaxLength(200).IsRequired();
        b.HasOne(x => x.FeeStructure).WithMany(x => x.Components).HasForeignKey(x => x.FeeStructureId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class FeeConcessionConfiguration : IEntityTypeConfiguration<FeeConcession>
{
    public void Configure(EntityTypeBuilder<FeeConcession> b)
    {
        b.ToTable("FeeConcessions");
        b.Property(x => x.Label).HasMaxLength(200).IsRequired();
        b.Property(x => x.Percentage).HasColumnType("decimal(5,2)");
        b.Property(x => x.Remarks).HasMaxLength(500);
        b.HasOne(x => x.FeeStructure).WithMany(x => x.Concessions).HasForeignKey(x => x.FeeStructureId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ExamPaperConfiguration : IEntityTypeConfiguration<ExamPaper>
{
    public void Configure(EntityTypeBuilder<ExamPaper> b)
    {
        b.ToTable("ExamPapers");
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Title).HasMaxLength(250).IsRequired();
        b.Property(x => x.Instructions).HasMaxLength(2000);
        b.Property(x => x.PassPercentage).HasColumnType("decimal(5,2)");
        b.HasOne(x => x.ProgramType).WithMany().HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.Code).IsUnique();
    }
}

public class ExamAttemptConfiguration : IEntityTypeConfiguration<ExamAttempt>
{
    public void Configure(EntityTypeBuilder<ExamAttempt> b)
    {
        b.Property(x => x.SelfieContentType).HasMaxLength(100);
        b.ToTable("ExamAttempts");

        b.HasOne(x => x.Participant).WithMany()
            .HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Cascade);

        /* Restrict: a paper that has been sat is evidence of what was asked,
           and deleting it would leave scores nobody could explain. */
        b.HasOne(x => x.ExamPaper).WithMany()
            .HasForeignKey(x => x.ExamPaperId)
            .OnDelete(DeleteBehavior.Restrict);

        /* One attempt number per candidate: the limit is counted on this, so
           two rows claiming the same sitting would let it be exceeded. */
        b.HasIndex(x => new { x.ParticipantId, x.AttemptNo }).IsUnique();
    }
}

public class ExamAnswerConfiguration : IEntityTypeConfiguration<ExamAnswer>
{
    public void Configure(EntityTypeBuilder<ExamAnswer> b)
    {
        b.ToTable("ExamAnswers");
        b.Property(x => x.SelectedOptionIds).HasMaxLength(200);

        b.HasOne(x => x.Attempt).WithMany(x => x.Answers)
            .HasForeignKey(x => x.AttemptId)
            .OnDelete(DeleteBehavior.Cascade);

        b.HasOne(x => x.Question).WithMany()
            .HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Restrict);

        /* One answer per question: answering again replaces it rather than
           adding a second row that would be marked twice. */
        b.HasIndex(x => new { x.AttemptId, x.QuestionId }).IsUnique();
    }
}

public class ExamQuestionConfiguration : IEntityTypeConfiguration<ExamQuestion>
{
    public void Configure(EntityTypeBuilder<ExamQuestion> b)
    {
        b.ToTable("ExamQuestions");
        b.Property(x => x.Text).HasMaxLength(1000).IsRequired();
        b.Property(x => x.ModuleRef).HasMaxLength(200);
        b.Property(x => x.Explanation).HasMaxLength(1000);
        b.Property(x => x.Marks).HasColumnType("decimal(6,2)");
        b.Property(x => x.NegativeMarks).HasColumnType("decimal(6,2)");
        b.HasOne(x => x.ExamPaper).WithMany(x => x.Questions).HasForeignKey(x => x.ExamPaperId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ExamQuestionOptionConfiguration : IEntityTypeConfiguration<ExamQuestionOption>
{
    public void Configure(EntityTypeBuilder<ExamQuestionOption> b)
    {
        b.ToTable("ExamQuestionOptions");
        b.Property(x => x.Text).HasMaxLength(500).IsRequired();
        b.HasOne(x => x.Question).WithMany(x => x.Options).HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class TrainingMaterialConfiguration : IEntityTypeConfiguration<TrainingMaterial>
{
    public void Configure(EntityTypeBuilder<TrainingMaterial> b)
    {
        b.ToTable("TrainingMaterials");
        b.Property(x => x.Title).HasMaxLength(250).IsRequired();
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.FileName).HasMaxLength(260);
        b.Property(x => x.MimeType).HasMaxLength(150);
        b.Property(x => x.Url).HasMaxLength(500);
        b.Property(x => x.Language).HasMaxLength(60).IsRequired();
        b.Property(x => x.VisibleToRoles).HasMaxLength(200).IsRequired();
        b.Property(x => x.Version).HasMaxLength(20).IsRequired();

        b.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.SubCategory).WithMany().HasForeignKey(x => x.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.ProgramType).WithMany().HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.CurriculumSession).WithMany().HasForeignKey(x => x.CurriculumSessionId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}

public class SignupFieldConfiguration : IEntityTypeConfiguration<SignupField>
{
    public void Configure(EntityTypeBuilder<SignupField> b)
    {
        b.ToTable("SignupFields");
        b.Property(x => x.Key).HasMaxLength(80).IsRequired();
        b.Property(x => x.Label).HasMaxLength(250).IsRequired();
        b.Property(x => x.Placeholder).HasMaxLength(200);
        b.Property(x => x.HelpText).HasMaxLength(500);

        /* One field per key within a form. The sign-up code looks fields up by
           key, so two rows claiming the same one would make which is honoured
           a matter of row order — but the same key on two different
           sub-categories is two different forms asking the same question,
           which is the point.

           There is one sign-up form now, so a key appears once in it. */
        b.HasIndex(x => x.Key).IsUnique();
    }
}

public class SignupFieldOptionConfiguration : IEntityTypeConfiguration<SignupFieldOption>
{
    public void Configure(EntityTypeBuilder<SignupFieldOption> b)
    {
        b.ToTable("SignupFieldOptions");
        b.Property(x => x.Value).HasMaxLength(120).IsRequired();
        b.Property(x => x.Label).HasMaxLength(250).IsRequired();
        b.HasOne(x => x.Field).WithMany(x => x.Options).HasForeignKey(x => x.FieldId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ApplicantAnswerConfiguration : IEntityTypeConfiguration<ApplicantAnswer>
{
    public void Configure(EntityTypeBuilder<ApplicantAnswer> b)
    {
        b.ToTable("ApplicantAnswers");
        b.Property(x => x.Key).HasMaxLength(80).IsRequired();
        b.Property(x => x.Label).HasMaxLength(200).IsRequired();
        b.Property(x => x.Value).HasMaxLength(2000);

        b.HasOne(x => x.Applicant).WithMany(a => a.Answers).HasForeignKey(x => x.ApplicantId)
            .OnDelete(DeleteBehavior.Cascade);

        /* One answer per question per applicant. */
        b.HasIndex(x => new { x.ApplicantId, x.Key }).IsUnique();
    }
}
