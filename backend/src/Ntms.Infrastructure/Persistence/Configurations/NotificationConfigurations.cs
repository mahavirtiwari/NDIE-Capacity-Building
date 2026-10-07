using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Ntms.Domain.Entities;

namespace Ntms.Infrastructure.Persistence.Configurations;

public class PushDeviceConfiguration : IEntityTypeConfiguration<PushDevice>
{
    public void Configure(EntityTypeBuilder<PushDevice> b)
    {
        b.ToTable("PushDevices");
        b.Property(x => x.Token).HasMaxLength(200).IsRequired();
        b.Property(x => x.Platform).HasMaxLength(20).IsRequired();
        b.Property(x => x.App).HasMaxLength(20).IsRequired();

        /* The token is the handset. Registering the same one twice is the
           same phone saying hello again, not a second device. */
        b.HasIndex(x => x.Token).IsUnique();
        b.HasIndex(x => x.ApplicantId);
        b.HasIndex(x => x.UserId);

        b.HasOne(x => x.Applicant).WithMany()
            .HasForeignKey(x => x.ApplicantId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.User).WithMany()
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.ToTable("Notifications");
        b.Property(x => x.Title).HasMaxLength(120).IsRequired();
        b.Property(x => x.Body).HasMaxLength(500).IsRequired();
        b.Property(x => x.LinkPath).HasMaxLength(200);
        b.Property(x => x.Kind).HasMaxLength(40).IsRequired();
        b.Property(x => x.Note).HasMaxLength(500);

        b.HasIndex(x => x.SentOn);

        b.HasOne(x => x.SubCategory).WithMany()
            .HasForeignKey(x => x.SubCategoryId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.State).WithMany()
            .HasForeignKey(x => x.StateCode).HasPrincipalKey(x => x.Code)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class NotificationReadConfiguration : IEntityTypeConfiguration<NotificationRead>
{
    public void Configure(EntityTypeBuilder<NotificationRead> b)
    {
        b.ToTable("NotificationReads");

        /* One row per person per notification, written the first time it is
           opened. Reading it twice is still having read it. */
        b.HasIndex(x => new { x.NotificationId, x.ApplicantId }).IsUnique()
            .HasFilter("[ApplicantId] IS NOT NULL");
        b.HasIndex(x => new { x.NotificationId, x.UserId }).IsUnique()
            .HasFilter("[UserId] IS NOT NULL");

        b.HasOne(x => x.Notification).WithMany(x => x.Reads)
            .HasForeignKey(x => x.NotificationId).OnDelete(DeleteBehavior.Cascade);
    }
}
