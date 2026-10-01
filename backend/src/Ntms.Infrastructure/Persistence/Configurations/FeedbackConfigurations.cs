using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Ntms.Domain.Entities;

namespace Ntms.Infrastructure.Persistence.Configurations;

public class FeedbackFormConfiguration : IEntityTypeConfiguration<FeedbackForm>
{
    public void Configure(EntityTypeBuilder<FeedbackForm> b)
    {
        b.ToTable("FeedbackForms");
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.Intro).HasMaxLength(600);

        /* One form per programme type. Filtered to the active one, so a
           form switched off can sit beside its replacement. */
        b.HasIndex(x => x.ProgramTypeId).IsUnique().HasFilter("[Status] = 'Active'");

        b.HasOne(x => x.ProgramType).WithMany().HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class FeedbackQuestionConfiguration : IEntityTypeConfiguration<FeedbackQuestion>
{
    public void Configure(EntityTypeBuilder<FeedbackQuestion> b)
    {
        b.ToTable("FeedbackQuestions");
        b.Property(x => x.Key).HasMaxLength(80).IsRequired();
        b.Property(x => x.Text).HasMaxLength(400).IsRequired();
        b.Property(x => x.HelpText).HasMaxLength(400);

        /* A key answers are stored against appears once on a form. */
        b.HasIndex(x => new { x.FormId, x.Key }).IsUnique();

        b.HasOne(x => x.Form).WithMany(x => x.Questions).HasForeignKey(x => x.FormId)
            .OnDelete(DeleteBehavior.Cascade);

        /* A shared list in use must not vanish from under the question. */
        b.HasOne(x => x.OptionSet).WithMany().HasForeignKey(x => x.OptionSetId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class FeedbackQuestionOptionConfiguration : IEntityTypeConfiguration<FeedbackQuestionOption>
{
    public void Configure(EntityTypeBuilder<FeedbackQuestionOption> b)
    {
        b.ToTable("FeedbackQuestionOptions");
        b.Property(x => x.Value).HasMaxLength(120).IsRequired();
        b.Property(x => x.Label).HasMaxLength(200).IsRequired();

        b.HasOne(x => x.Question).WithMany(x => x.Options).HasForeignKey(x => x.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class FeedbackResponseConfiguration : IEntityTypeConfiguration<FeedbackResponse>
{
    public void Configure(EntityTypeBuilder<FeedbackResponse> b)
    {
        b.ToTable("FeedbackResponses");

        /* Reports read by batch and by programme type. */
        b.HasIndex(x => x.ProgrammeId);
        b.HasIndex(x => x.ProgramTypeId);

        /* No applicant and no participant on this table, and no index that
           could become one. Anonymity here is the absence of a column
           rather than a rule somebody has to remember. */
        b.HasOne(x => x.Programme).WithMany().HasForeignKey(x => x.ProgrammeId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.ProgramType).WithMany().HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class FeedbackReceiptConfiguration : IEntityTypeConfiguration<FeedbackReceipt>
{
    public void Configure(EntityTypeBuilder<FeedbackReceipt> b)
    {
        b.ToTable("FeedbackReceipts");

        /* Once each. This is what stops a second submission, and it is the
           only row that knows who has given feedback. */
        b.HasIndex(x => x.ParticipantId).IsUnique();

        b.HasOne(x => x.Participant).WithMany().HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
