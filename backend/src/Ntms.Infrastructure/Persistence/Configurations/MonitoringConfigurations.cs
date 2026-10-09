using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Ntms.Domain.Entities;

namespace Ntms.Infrastructure.Persistence.Configurations;

/*
  Coordinator field-monitoring tables.

  Deletes cascade from the programme downwards, because a monitoring record has
  no meaning apart from the workshop it documents — but never sideways onto the
  masters a row merely points at.

  Coordinates are decimal(9,6): six decimal places is roughly a tenth of a
  metre, far finer than any phone's fix, and decimal avoids the drift a float
  would introduce every time the value is read back and written again.
*/

public class ProgrammeVenueConfiguration : IEntityTypeConfiguration<ProgrammeVenue>
{
    public void Configure(EntityTypeBuilder<ProgrammeVenue> b)
    {
        b.ToTable("ProgrammeVenues");
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Address).HasMaxLength(500).IsRequired();
        b.Property(x => x.Landmark).HasMaxLength(200);
        b.Property(x => x.Latitude).HasColumnType("decimal(9,6)");
        b.Property(x => x.Longitude).HasColumnType("decimal(9,6)");
        b.Property(x => x.AccuracyMetres).HasColumnType("decimal(8,2)");

        /* One venue per programme, enforced by the database rather than by the
           service remembering to check. */
        b.HasIndex(x => x.ProgrammeId).IsUnique();

        b.HasOne(x => x.Programme).WithMany().HasForeignKey(x => x.ProgrammeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class ProgrammeTrainerConfiguration : IEntityTypeConfiguration<ProgrammeTrainer>
{
    public void Configure(EntityTypeBuilder<ProgrammeTrainer> b)
    {
        b.ToTable("ProgrammeTrainers");
        b.Property(x => x.FullName).HasMaxLength(160).IsRequired();
        b.Property(x => x.Mobile).HasMaxLength(15).IsRequired();
        b.Property(x => x.Email).HasMaxLength(200);
        b.Property(x => x.Designation).HasMaxLength(160);
        b.Property(x => x.Organisation).HasMaxLength(200);
        b.Property(x => x.Qualification).HasMaxLength(120);
        b.Property(x => x.Aadhaar).HasMaxLength(12);

        b.HasIndex(x => x.ProgrammeId);

        b.HasOne(x => x.Programme).WithMany().HasForeignKey(x => x.ProgrammeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class MonitoringSessionConfiguration : IEntityTypeConfiguration<MonitoringSession>
{
    public void Configure(EntityTypeBuilder<MonitoringSession> b)
    {
        b.ToTable("MonitoringSessions");
        b.Property(x => x.Comments).HasMaxLength(1000);

        b.HasIndex(x => x.ProgrammeId);

        b.HasOne(x => x.Programme).WithMany().HasForeignKey(x => x.ProgrammeId)
            .OnDelete(DeleteBehavior.Cascade);

        /* Restrict, not cascade: removing a trainer or retiring a curriculum
           topic must not silently delete the evidence that it was delivered. */
        b.HasOne(x => x.Trainer).WithMany().HasForeignKey(x => x.TrainerId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.CurriculumSession).WithMany().HasForeignKey(x => x.CurriculumSessionId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.CurriculumTopic).WithMany().HasForeignKey(x => x.CurriculumTopicId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class OnSpotParticipantConfiguration : IEntityTypeConfiguration<OnSpotParticipant>
{
    public void Configure(EntityTypeBuilder<OnSpotParticipant> b)
    {
        b.ToTable("OnSpotParticipants");
        b.Property(x => x.FullName).HasMaxLength(160).IsRequired();
        b.Property(x => x.Mobile).HasMaxLength(15).IsRequired();
        b.Property(x => x.Email).HasMaxLength(200).IsRequired();
        b.Property(x => x.EnterpriseName).HasMaxLength(250).IsRequired();
        b.Property(x => x.Designation).HasMaxLength(160);
        b.Property(x => x.UdyamNumber).HasMaxLength(40).IsRequired();
        b.Property(x => x.FeedbackComments).HasMaxLength(1000);

        b.HasIndex(x => x.ProgrammeId);
        /* One registration per mobile number per workshop: the same person
           joining the queue twice would otherwise be counted twice. */
        b.HasIndex(x => new { x.ProgrammeId, x.Mobile }).IsUnique();

        b.HasOne(x => x.Programme).WithMany().HasForeignKey(x => x.ProgrammeId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.State).WithMany().HasForeignKey(x => x.StateCode)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.District).WithMany().HasForeignKey(x => x.DistrictCode)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class MonitoringPhotoConfiguration : IEntityTypeConfiguration<MonitoringPhoto>
{
    public void Configure(EntityTypeBuilder<MonitoringPhoto> b)
    {
        b.ToTable("MonitoringPhotos");
        b.Property(x => x.RelativePath).HasMaxLength(400).IsRequired();
        b.Property(x => x.FileName).HasMaxLength(260).IsRequired();
        b.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
        b.Property(x => x.Latitude).HasColumnType("decimal(9,6)");
        b.Property(x => x.Longitude).HasColumnType("decimal(9,6)");

        b.Property(x => x.DevicePlatform).HasMaxLength(40);
        b.Property(x => x.DeviceModel).HasMaxLength(120);
        b.Property(x => x.DeviceOsVersion).HasMaxLength(40);

        b.HasIndex(x => new { x.ProgrammeId, x.Kind });

        b.HasOne(x => x.Programme).WithMany().HasForeignKey(x => x.ProgrammeId)
            .OnDelete(DeleteBehavior.Cascade);

        /* The owners cascade from the programme already, so these stay on
           NoAction to keep SQL Server off the multiple-cascade-path error. The
           photo rows go when the programme goes, which is the only delete that
           happens here. */
        b.HasOne(x => x.Venue).WithMany(v => v!.Photos).HasForeignKey(x => x.VenueId)
            .OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.Session).WithMany(s => s!.Photos).HasForeignKey(x => x.SessionId)
            .OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.Participant).WithMany(p => p!.Photos).HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public class OnSpotAttendanceConfiguration : IEntityTypeConfiguration<OnSpotAttendance>
{
    public void Configure(EntityTypeBuilder<OnSpotAttendance> b)
    {
        b.ToTable("OnSpotAttendance");
        b.Property(x => x.MarkedBy).HasMaxLength(200);

        /* One answer per person per day. A second pass down the row of
           chairs corrects the first rather than recording the same
           person twice, and the index is what actually enforces it when
           two taps race on a slow connection. */
        b.HasIndex(x => new { x.ParticipantId, x.Day }).IsUnique();

        /* The report reads a whole programme's register at once. */
        b.HasIndex(x => new { x.ProgrammeId, x.Day });

        b.HasOne(x => x.Participant).WithMany(p => p.Days)
            .HasForeignKey(x => x.ParticipantId)
            .OnDelete(DeleteBehavior.Cascade);

        /* NoAction: the participant already cascades from the programme,
           and two cascade paths to the same table is the error SQL
           Server will not have. */
        b.HasOne(x => x.Programme).WithMany()
            .HasForeignKey(x => x.ProgrammeId)
            .OnDelete(DeleteBehavior.NoAction);
    }
}

public class ProgrammeSubmissionConfiguration : IEntityTypeConfiguration<ProgrammeSubmission>
{
    public void Configure(EntityTypeBuilder<ProgrammeSubmission> b)
    {
        b.ToTable("ProgrammeSubmissions");
        b.Property(x => x.Remarks).HasMaxLength(1000);
        b.Property(x => x.QcRemarks).HasMaxLength(1000);
        b.Property(x => x.QcByUserName).HasMaxLength(200);

        /* The queue is read by status far more often than by anything
           else: a manager opens this screen to see what is waiting. */
        b.HasIndex(x => x.QcStatus);

        /* A programme is submitted once. The unique index is what actually
           prevents a second submission racing the first. */
        b.HasIndex(x => x.ProgrammeId).IsUnique();

        b.HasOne(x => x.Programme).WithMany().HasForeignKey(x => x.ProgrammeId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.SubmittedBy).WithMany().HasForeignKey(x => x.SubmittedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.QcBy).WithMany().HasForeignKey(x => x.QcByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
