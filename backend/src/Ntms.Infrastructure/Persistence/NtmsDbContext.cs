using Microsoft.EntityFrameworkCore;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Identity;

namespace Ntms.Infrastructure.Persistence;

public class NtmsDbContext(DbContextOptions<NtmsDbContext> options, ICurrentUser? currentUser = null)
    : DbContext(options)
{
    private readonly ICurrentUser? _currentUser = currentUser;

    /* Location (LGD) */
    public DbSet<LgdState> States => Set<LgdState>();
    public DbSet<LgdDistrict> Districts => Set<LgdDistrict>();

    /* Portal identity */
    public DbSet<BrandingSetting> Branding => Set<BrandingSetting>();

    /* Outgoing mail */
    public DbSet<EmailSetting> EmailSettings => Set<EmailSetting>();
    public DbSet<EmailTemplate> EmailTemplates => Set<EmailTemplate>();
    public DbSet<EmailLogEntry> EmailLog => Set<EmailLogEntry>();

    /* Masters */
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<SubCategory> SubCategories => Set<SubCategory>();
    public DbSet<Qualification> Qualifications => Set<Qualification>();
    public DbSet<RejectionReason> RejectionReasons => Set<RejectionReason>();
    public DbSet<BlockReason> BlockReasons => Set<BlockReason>();
    public DbSet<ApplicantStatusEvent> ApplicantStatusEvents => Set<ApplicantStatusEvent>();
    public DbSet<SystemSetting> SystemSettings => Set<SystemSetting>();
    public DbSet<UserStatusEvent> UserStatusEvents => Set<UserStatusEvent>();
    public DbSet<ProgramType> ProgramTypes => Set<ProgramType>();
    public DbSet<ImplementingAgency> Agencies => Set<ImplementingAgency>();
    public DbSet<AgencyCategory> AgencyCategories => Set<AgencyCategory>();
    public DbSet<AgencySubCategory> AgencySubCategories => Set<AgencySubCategory>();
    public DbSet<AgencyProgramType> AgencyProgramTypes => Set<AgencyProgramType>();
    public DbSet<AgencyState> AgencyStates => Set<AgencyState>();

    /* Academics */
    public DbSet<Curriculum> Curricula => Set<Curriculum>();
    public DbSet<CurriculumSession> CurriculumSessions => Set<CurriculumSession>();
    public DbSet<CurriculumTopic> CurriculumTopics => Set<CurriculumTopic>();
    public DbSet<ProfileForm> ProfileForms => Set<ProfileForm>();
    public DbSet<ProfileSubmission> ProfileSubmissions => Set<ProfileSubmission>();
    public DbSet<ProfilePhoto> ProfilePhotos => Set<ProfilePhoto>();
    public DbSet<ProfileScrutinyEvent> ProfileScrutinyEvents => Set<ProfileScrutinyEvent>();
    public DbSet<ProfileSection> ProfileSections => Set<ProfileSection>();
    public DbSet<ProfileField> ProfileFields => Set<ProfileField>();
    public DbSet<ProfileFieldOption> ProfileFieldOptions => Set<ProfileFieldOption>();

    /* The account creation form, which exists once and before any applicant
       does - not to be confused with the per programme type form above. */
    public DbSet<SignupField> SignupFields => Set<SignupField>();
    public DbSet<SignupFieldOption> SignupFieldOptions => Set<SignupFieldOption>();
    public DbSet<ApplicantAnswer> ApplicantAnswers => Set<ApplicantAnswer>();
    public DbSet<PaymentTransaction> PaymentTransactions => Set<PaymentTransaction>();
    public DbSet<PaymentInvoice> PaymentInvoices => Set<PaymentInvoice>();

    /* Overrides only: the shipped wording lives in code. */
    public DbSet<SiteText> SiteTexts => Set<SiteText>();

    public DbSet<EvaluationSkill> EvaluationSkills => Set<EvaluationSkill>();
    public DbSet<ParticipantSkillMark> ParticipantSkillMarks => Set<ParticipantSkillMark>();
    public DbSet<ExamAttempt> ExamAttempts => Set<ExamAttempt>();
    public DbSet<ExamAnswer> ExamAnswers => Set<ExamAnswer>();
    public DbSet<FeeStructure> FeeStructures => Set<FeeStructure>();
    public DbSet<FeeComponent> FeeComponents => Set<FeeComponent>();
    public DbSet<FeeConcession> FeeConcessions => Set<FeeConcession>();
    public DbSet<ExamPaper> ExamPapers => Set<ExamPaper>();
    public DbSet<ExamQuestion> ExamQuestions => Set<ExamQuestion>();
    public DbSet<ExamQuestionOption> ExamQuestionOptions => Set<ExamQuestionOption>();
    public DbSet<TrainingMaterial> TrainingMaterials => Set<TrainingMaterial>();

    /* Access */
    public DbSet<AdminRole> Roles => Set<AdminRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<PortalUser> Users => Set<PortalUser>();
    public DbSet<UserCategory> UserCategories => Set<UserCategory>();
    public DbSet<UserSubCategory> UserSubCategories => Set<UserSubCategory>();
    public DbSet<UserProgramType> UserProgramTypes => Set<UserProgramType>();
    public DbSet<UserState> UserStates => Set<UserState>();
    public DbSet<UserDistrict> UserDistricts => Set<UserDistrict>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    /* Applicants & applications */
    public DbSet<Applicant> Applicants => Set<Applicant>();
    public DbSet<OtpChallenge> OtpChallenges => Set<OtpChallenge>();
    public DbSet<TrainingApplication> Applications => Set<TrainingApplication>();
    public DbSet<ApplicationDocument> ApplicationDocuments => Set<ApplicationDocument>();
    public DbSet<ScrutinyEvent> ScrutinyEvents => Set<ScrutinyEvent>();

    /* Programmes */
    public DbSet<Programme> Programmes => Set<Programme>();
    public DbSet<ProgrammeSession> ProgrammeSessions => Set<ProgrammeSession>();
    public DbSet<ProgrammeParticipant> ProgrammeParticipants => Set<ProgrammeParticipant>();

    /* Coordinator field monitoring. */
    public DbSet<CertificateTemplate> CertificateTemplates => Set<CertificateTemplate>();
    public DbSet<Certificate> Certificates => Set<Certificate>();

    public DbSet<ProgrammeVenue> ProgrammeVenues => Set<ProgrammeVenue>();
    public DbSet<ProgrammeTrainer> ProgrammeTrainers => Set<ProgrammeTrainer>();
    public DbSet<MonitoringSession> MonitoringSessions => Set<MonitoringSession>();
    public DbSet<OnSpotParticipant> OnSpotParticipants => Set<OnSpotParticipant>();
    public DbSet<MonitoringPhoto> MonitoringPhotos => Set<MonitoringPhoto>();
    public DbSet<ProgrammeSubmission> ProgrammeSubmissions => Set<ProgrammeSubmission>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(NtmsDbContext).Assembly);

        /* Enums are stored as text so the database stays readable in SSMS and
           the values line up with the strings the clients exchange. */
        foreach (var entity in builder.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                var type = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
                if (type.IsEnum)
                {
                    property.SetColumnType("varchar(40)");
                }

                if (type == typeof(decimal))
                {
                    property.SetColumnType("decimal(18,2)");
                }
            }
        }

        builder.UseStringEnumsForAllEnums();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        Stamp();
        return base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        Stamp();
        return base.SaveChanges();
    }

    /// <summary>Fills the audit columns from the signed-in user on every write.</summary>
    private void Stamp()
    {
        var who = _currentUser?.DisplayName ?? "system";
        var now = DateTime.UtcNow;

        foreach (var entry in ChangeTracker.Entries<AuditableEntity>())
        {
            if (entry.State == EntityState.Added)
            {
                entry.Entity.CreatedBy = who;
                entry.Entity.CreatedOn = now;
            }
            else if (entry.State == EntityState.Modified)
            {
                entry.Entity.ModifiedBy = who;
                entry.Entity.ModifiedOn = now;
            }
        }
    }
}

internal static class EnumConversionExtensions
{
    /// <summary>
    /// Applies a string conversion to every enum property. Done after the
    /// configurations run so explicit mappings win.
    /// </summary>
    public static void UseStringEnumsForAllEnums(this ModelBuilder builder)
    {
        foreach (var entity in builder.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                var type = Nullable.GetUnderlyingType(property.ClrType) ?? property.ClrType;
                if (!type.IsEnum || property.GetValueConverter() is not null) continue;

                var converterType = typeof(Microsoft.EntityFrameworkCore.Storage.ValueConversion
                    .EnumToStringConverter<>).MakeGenericType(type);
                property.SetValueConverter(
                    (Microsoft.EntityFrameworkCore.Storage.ValueConversion.ValueConverter?)
                    Activator.CreateInstance(converterType, [null]));
            }
        }
    }
}
