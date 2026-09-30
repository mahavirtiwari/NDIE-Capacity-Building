using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Ntms.Domain.Entities;

namespace Ntms.Infrastructure.Persistence.Configurations;

public class LgdStateConfiguration : IEntityTypeConfiguration<LgdState>
{
    public void Configure(EntityTypeBuilder<LgdState> b)
    {
        b.ToTable("LgdStates");
        /* The LGD code is the key, not a surrogate identity. */
        b.HasKey(x => x.Code);
        b.Property(x => x.Code).ValueGeneratedNever();
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.HasIndex(x => x.Name).IsUnique();
    }
}

public class LgdDistrictConfiguration : IEntityTypeConfiguration<LgdDistrict>
{
    public void Configure(EntityTypeBuilder<LgdDistrict> b)
    {
        b.ToTable("LgdDistricts");
        b.HasKey(x => x.Code);
        b.Property(x => x.Code).ValueGeneratedNever();
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.HasOne(x => x.State)
            .WithMany(x => x.Districts)
            .HasForeignKey(x => x.StateCode)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.StateCode);
    }
}

public class CategoryConfiguration : IEntityTypeConfiguration<Category>
{
    public void Configure(EntityTypeBuilder<Category> b)
    {
        b.ToTable("Categories");
        b.Property(x => x.Code).HasMaxLength(20).IsRequired();
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasIndex(x => x.Code).IsUnique();
    }
}

public class SubCategoryConfiguration : IEntityTypeConfiguration<SubCategory>
{
    public void Configure(EntityTypeBuilder<SubCategory> b)
    {
        b.ToTable("SubCategories");
        b.Property(x => x.Code).HasMaxLength(20).IsRequired();
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasOne(x => x.Category)
            .WithMany(x => x.SubCategories)
            .HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.Code).IsUnique();
        b.HasIndex(x => x.CategoryId);
    }
}

public class BlockReasonConfiguration : IEntityTypeConfiguration<BlockReason>
{
    public void Configure(EntityTypeBuilder<BlockReason> b)
    {
        b.ToTable("BlockReasons");
        b.Property(x => x.Label).HasMaxLength(200).IsRequired();

        /* Unique per direction rather than outright: "Directed by the
           ministry" is a fair reason to block and a fair reason to unblock,
           and the two are different rows. */
        b.HasIndex(x => new { x.Kind, x.Label }).IsUnique();
        b.HasIndex(x => x.DisplayOrder);
    }
}

public class RejectionReasonConfiguration : IEntityTypeConfiguration<RejectionReason>
{
    public void Configure(EntityTypeBuilder<RejectionReason> b)
    {
        b.ToTable("RejectionReasons");
        b.Property(x => x.Label).HasMaxLength(200).IsRequired();

        /* One wording per reason. Two rows saying the same thing differently
           is how a countable list stops being countable. */
        b.HasIndex(x => x.Label).IsUnique();
        b.HasIndex(x => x.DisplayOrder);
    }
}

public class QualificationConfiguration : IEntityTypeConfiguration<Qualification>
{
    public void Configure(EntityTypeBuilder<Qualification> b)
    {
        b.ToTable("Qualifications");
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Label).HasMaxLength(160).IsRequired();
        b.HasIndex(x => x.Code).IsUnique();
        /* The ladder is read in rank order on every programme-type form. */
        b.HasIndex(x => x.Rank);
    }
}

public class ProgramTypeConfiguration : IEntityTypeConfiguration<ProgramType>
{
    public void Configure(EntityTypeBuilder<ProgramType> b)
    {
        b.ToTable("ProgramTypes");
        b.Property(x => x.Code).HasMaxLength(20).IsRequired();
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
        b.Property(x => x.ShortDescription).HasMaxLength(500);
        b.Property(x => x.MinQualification).HasMaxLength(200);
        b.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.SubCategory).WithMany(x => x.ProgramTypes).HasForeignKey(x => x.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasIndex(x => x.Code).IsUnique();
        b.HasIndex(x => new { x.CategoryId, x.SubCategoryId });

        /* Owned, so the marking pattern reads as part of the programme type
           rather than as a table nobody would think to join. */
        b.OwnsOne(x => x.Evaluation, e =>
        {
            /* No explicit conversion: the context stores every enum as text,
               and an int here would be the one column nobody could read. */
            e.Property(p => p.Kind).HasColumnName("Evaluation_Kind");
            e.Property(p => p.TotalMarks).HasColumnName("Evaluation_TotalMarks");
            e.Property(p => p.WrittenMarks).HasColumnName("Evaluation_WrittenMarks");
            e.Property(p => p.VivaMarks).HasColumnName("Evaluation_VivaMarks");
            e.Property(p => p.WrittenPassMarks).HasColumnName("Evaluation_WrittenPassMarks");
            e.Property(p => p.VivaPassMarks).HasColumnName("Evaluation_VivaPassMarks");
            e.Property(p => p.OverallPassMarks).HasColumnName("Evaluation_OverallPassMarks");
            e.Ignore(p => p.HasWritten);
            e.Ignore(p => p.HasViva);
        });
    }
}

public class EvaluationSkillConfiguration : IEntityTypeConfiguration<EvaluationSkill>
{
    public void Configure(EntityTypeBuilder<EvaluationSkill> b)
    {
        b.ToTable("EvaluationSkills");
        b.Property(x => x.Name).HasMaxLength(160).IsRequired();
        b.Property(x => x.Description).HasMaxLength(500);

        b.HasOne(x => x.ProgramType).WithMany(x => x.Skills)
            .HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Cascade);

        /* One skill of a given name per programme type: two rows reading
           "Communication" against the same practical would be marked twice. */
        b.HasIndex(x => new { x.ProgramTypeId, x.Name }).IsUnique();
    }
}

public class AgencyConfiguration : IEntityTypeConfiguration<ImplementingAgency>
{
    public void Configure(EntityTypeBuilder<ImplementingAgency> b)
    {
        b.ToTable("ImplementingAgencies");
        b.Property(x => x.Code).HasMaxLength(30).IsRequired();
        b.Property(x => x.Name).HasMaxLength(250).IsRequired();
        b.Property(x => x.ContactPerson).HasMaxLength(120).IsRequired();
        b.Property(x => x.Email).HasMaxLength(200).IsRequired();
        b.Property(x => x.Mobile).HasMaxLength(10).IsRequired();
        b.Property(x => x.Gstin).HasMaxLength(15);
        b.Property(x => x.Pan).HasMaxLength(10);
        b.Property(x => x.AddressLine1).HasMaxLength(250).IsRequired();
        b.Property(x => x.AddressLine2).HasMaxLength(250);
        b.Property(x => x.City).HasMaxLength(120).IsRequired();
        b.Property(x => x.Pincode).HasMaxLength(6).IsRequired();

        b.HasOne(x => x.State).WithMany().HasForeignKey(x => x.StateCode)
            .OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.District).WithMany().HasForeignKey(x => x.DistrictCode)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasIndex(x => x.Code).IsUnique();
        /* Email is contact data, not an identity key, so the index is not unique. */
        b.HasIndex(x => x.Email);
    }
}

public class AgencyCategoryConfiguration : IEntityTypeConfiguration<AgencyCategory>
{
    public void Configure(EntityTypeBuilder<AgencyCategory> b)
    {
        b.ToTable("AgencyCategories");
        b.HasKey(x => new { x.AgencyId, x.CategoryId });
        b.HasOne(x => x.Agency).WithMany(x => x.Categories).HasForeignKey(x => x.AgencyId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Category).WithMany().HasForeignKey(x => x.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class AgencyStateConfiguration : IEntityTypeConfiguration<AgencyState>
{
    public void Configure(EntityTypeBuilder<AgencyState> b)
    {
        b.ToTable("AgencyStates");
        b.HasKey(x => new { x.AgencyId, x.StateCode });
        b.HasOne(x => x.Agency).WithMany(x => x.States).HasForeignKey(x => x.AgencyId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.State).WithMany().HasForeignKey(x => x.StateCode)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class AgencySubCategoryConfiguration : IEntityTypeConfiguration<AgencySubCategory>
{
    public void Configure(EntityTypeBuilder<AgencySubCategory> b)
    {
        b.ToTable("AgencySubCategories");
        b.HasKey(x => new { x.AgencyId, x.SubCategoryId });
        b.HasOne(x => x.Agency).WithMany(x => x.SubCategories).HasForeignKey(x => x.AgencyId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.SubCategory).WithMany().HasForeignKey(x => x.SubCategoryId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class AgencyProgramTypeConfiguration : IEntityTypeConfiguration<AgencyProgramType>
{
    public void Configure(EntityTypeBuilder<AgencyProgramType> b)
    {
        b.ToTable("AgencyProgramTypes");
        b.HasKey(x => new { x.AgencyId, x.ProgramTypeId });
        b.HasOne(x => x.Agency).WithMany(x => x.ProgramTypes).HasForeignKey(x => x.AgencyId)
            .OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.ProgramType).WithMany().HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

public class BrandingConfiguration : IEntityTypeConfiguration<BrandingSetting>
{
    public void Configure(EntityTypeBuilder<BrandingSetting> b)
    {
        b.ToTable("BrandingSettings");
        /* One row, always id 1, so the seeder and the service can address it
           without a lookup. Nothing generates the key. */
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.OrganisationName).HasMaxLength(200).IsRequired();
        b.Property(x => x.ShortName).HasMaxLength(40).IsRequired();
        b.Property(x => x.PortalTitle).HasMaxLength(200).IsRequired();
        b.Property(x => x.Tagline).HasMaxLength(300);
        b.Property(x => x.SupportEmail).HasMaxLength(200);
        b.Property(x => x.LogoFileName).HasMaxLength(260);
        b.Property(x => x.LogoContentType).HasMaxLength(100);
        b.Property(x => x.PartnerName).HasMaxLength(120);
        b.Property(x => x.PartnerLogoFileName).HasMaxLength(260);
        b.Property(x => x.PartnerLogoContentType).HasMaxLength(100);
        b.Property(x => x.LogoLinkUrl).HasMaxLength(500);
        b.Property(x => x.PartnerLogoLinkUrl).HasMaxLength(500);
        b.Ignore(x => x.HasLogo);
        b.Ignore(x => x.HasPartnerLogo);
    }
}

public class SystemSettingConfiguration : IEntityTypeConfiguration<SystemSetting>
{
    public void Configure(EntityTypeBuilder<SystemSetting> b)
    {
        b.ToTable("SystemSettings");
        /* One row, always id 1. */
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.MaintenanceMessage).HasMaxLength(500);
        b.Property(x => x.PaymentGateway).HasMaxLength(40);
        b.Property(x => x.MerchantId).HasMaxLength(200);
        b.Property(x => x.AccessCode).HasMaxLength(400);
        b.Property(x => x.WorkingKey).HasMaxLength(400);
        b.Property(x => x.ReturnUrl).HasMaxLength(500);
        b.Property(x => x.CancelUrl).HasMaxLength(500);
        b.Property(x => x.PanProvider).HasMaxLength(80);
        b.Property(x => x.PanEndpoint).HasMaxLength(500);
        b.Property(x => x.PanApiKey).HasMaxLength(400);
        b.Property(x => x.PanApiKeyHeader).HasMaxLength(80);
        b.Property(x => x.PanValidPath).HasMaxLength(120);
        b.Property(x => x.PanNamePath).HasMaxLength(120);
    }
}

public class EmailSettingConfiguration : IEntityTypeConfiguration<EmailSetting>
{
    public void Configure(EntityTypeBuilder<EmailSetting> b)
    {
        b.ToTable("EmailSettings");
        /* One row, always id 1. */
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Host).HasMaxLength(200);
        b.Property(x => x.UserName).HasMaxLength(200);
        b.Property(x => x.Password).HasMaxLength(400);
        b.Property(x => x.FromAddress).HasMaxLength(200);
        b.Property(x => x.FromName).HasMaxLength(200);
        b.Property(x => x.ReplyTo).HasMaxLength(200);
        b.Property(x => x.RedirectAllTo).HasMaxLength(200);
    }
}

public class EmailTemplateConfiguration : IEntityTypeConfiguration<EmailTemplate>
{
    public void Configure(EntityTypeBuilder<EmailTemplate> b)
    {
        b.ToTable("EmailTemplates");
        b.Property(x => x.Key).HasMaxLength(60).IsRequired();
        b.Property(x => x.Name).HasMaxLength(120).IsRequired();
        b.Property(x => x.Description).HasMaxLength(400);
        b.Property(x => x.Subject).HasMaxLength(300).IsRequired();
        b.Property(x => x.Placeholders).HasMaxLength(400);
        b.HasIndex(x => x.Key).IsUnique();
    }
}

public class EmailLogConfiguration : IEntityTypeConfiguration<EmailLogEntry>
{
    public void Configure(EntityTypeBuilder<EmailLogEntry> b)
    {
        b.ToTable("EmailLog");
        b.Property(x => x.TemplateKey).HasMaxLength(60);
        b.Property(x => x.Recipient).HasMaxLength(200).IsRequired();
        b.Property(x => x.Subject).HasMaxLength(300);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.Error).HasMaxLength(2000);
        b.Property(x => x.Host).HasMaxLength(200);
        b.HasIndex(x => x.SentOn);
    }
}

public class CertificateTemplateConfiguration : IEntityTypeConfiguration<CertificateTemplate>
{
    public void Configure(EntityTypeBuilder<CertificateTemplate> b)
    {
        b.ToTable("CertificateTemplates");
        b.Property(x => x.RelativePath).HasMaxLength(400).IsRequired();
        b.Property(x => x.FileName).HasMaxLength(260).IsRequired();
        b.Property(x => x.ContentType).HasMaxLength(120).IsRequired();

        /* One template per kind per programme type: uploading again replaces
           what is there rather than leaving two candidates for the same slot. */
        b.HasIndex(x => new { x.ProgramTypeId, x.Kind }).IsUnique();

        b.HasOne(x => x.ProgramType).WithMany(p => p!.CertificateTemplates)
            .HasForeignKey(x => x.ProgramTypeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class SiteTextConfiguration : IEntityTypeConfiguration<SiteText>
{
    public void Configure(EntityTypeBuilder<SiteText> b)
    {
        b.ToTable("SiteTexts");
        b.Property(x => x.Key).HasMaxLength(120).IsRequired();
        b.Property(x => x.Value).HasMaxLength(2000).IsRequired();
        /* One override per key: two rows would make which wins a matter of
           row order. */
        b.HasIndex(x => x.Key).IsUnique();
    }
}
