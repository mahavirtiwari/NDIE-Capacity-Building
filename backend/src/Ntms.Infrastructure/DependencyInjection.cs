using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Invoicing;
using Ntms.Infrastructure.Payments;
using Ntms.Infrastructure.Persistence;
using Ntms.Infrastructure.Services;
using Ntms.Infrastructure.Verification;
using Ntms.Infrastructure.Storage;

namespace Ntms.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddNtmsInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        /* Blank counts as missing. The shipped appsettings.json leaves it empty
           so a deployment has to supply one; falling through to a default would
           have the service quietly try a database that is not there. */
        var connectionString = configuration.GetConnectionString("Default");
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "ConnectionStrings:Default is not set. Provide it through configuration, "
                + "an environment variable (ConnectionStrings__Default) or user-secrets.");
        }

        services.AddDbContext<NtmsDbContext>(options =>
            options.UseSqlServer(connectionString, sql =>
            {
                sql.MigrationsAssembly(typeof(NtmsDbContext).Assembly.FullName);
                /* SQL Server occasionally drops a connection under load; retry
                   the transient ones rather than failing the request. */
                sql.EnableRetryOnFailure(maxRetryCount: 3, TimeSpan.FromSeconds(5), null);
                sql.CommandTimeout(60);
            }));

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<EmailOptions>(configuration.GetSection(EmailOptions.SectionName));
        services.Configure<PanVerificationOptions>(
            configuration.GetSection(PanVerificationOptions.SectionName));

        services.AddSingleton<IPasswordService, PasswordService>();
        services.AddSingleton<ITokenService, JwtTokenService>();
        services.AddScoped<ICodeGenerator, CodeGenerator>();
        /* Scoped, not singleton: the sender now reads its settings from the
           database on each send. */
        services.AddScoped<IEmailSettingsProvider, EmailSettingsProvider>();
        services.AddScoped<IEmailSender, SmtpEmailSender>();
        services.AddScoped<INotificationService, NotificationService>();

        /* Through the factory so the handler is pooled and the timeout is the
           one in settings rather than the default hundred seconds. */
        services.AddHttpClient(nameof(PanVerifier));
        services.AddHttpClient(nameof(InvoiceFetcher));
        services.AddScoped<IPanVerifier, PanVerifier>();
        services.AddScoped<OtpService>();
        services.AddScoped<DbSeeder>();

        services.AddScoped<CategoryService>();
        services.AddScoped<SubCategoryService>();
        services.AddScoped<QualificationService>();
        services.AddScoped<QualifiedProfessionalService>();
        services.AddScoped<ReportService>();
        services.AddScoped<FacultyService>();
        services.AddScoped<SystemSettingService>();
        services.AddScoped<ProgramTypeService>();
        services.AddScoped<EvaluationSkillService>();
        services.AddScoped<MarksheetService>();
        services.AddScoped<ResultRecorder>();
        services.AddScoped<ExamSittingService>();
        services.AddScoped<ExamReviewService>();
        services.AddScoped<DelegationGuard>();
        services.AddScoped<AgencyService>();
        services.AddScoped<OptionSetService>();
        services.AddScoped<FeedbackService>();
        services.AddScoped<CurriculumService>();
        services.AddScoped<ProfileFormService>();
        services.AddScoped<SignupFormService>();
        services.AddScoped<RejectionReasonService>();
        services.AddScoped<BlockReasonService>();
        services.AddScoped<SiteTextService>();
        services.AddScoped<FeeService>();
        services.AddScoped<ExamPaperService>();
        services.AddScoped<TrainingMaterialService>();
        services.AddScoped<RoleService>();
        services.AddScoped<UserService>();
        services.AddScoped<AuthService>();
        services.AddScoped<ApplicantAuthService>();
        services.AddScoped<ApplicantService>();
        services.AddScoped<ApplicationService>();
        services.AddScoped<ProgrammeService>();
        services.AddScoped<BrandingService>();
        services.AddScoped<EmailAdminService>();
        services.AddScoped<LookupService>();
        services.AddScoped<DashboardService>();

        /* Payments. The gateways are stateless and registered as the one
           interface, so the registry can refuse by name any of the others the
           settings screen offers but nobody has integrated. */
        services.AddSingleton<IPaymentGateway, CCAvenueGateway>();
        services.AddSingleton<PaymentGateways>();
        services.AddScoped<ProfileSubmissionService>();
        services.AddScoped<ProfileAttachmentService>();
        services.AddScoped<BatchRegistrationService>();
        services.AddScoped<PaymentService>();
        services.AddScoped<InvoiceFetcher>();
        services.AddScoped<InvoiceService>();

        /* Coordinator field monitoring. The photo store is a singleton: it holds
           only the configured root path and creates folders on demand. */
        services.AddSingleton<MonitoringPhotoStore>();
        services.AddSingleton<CertificateTemplateStore>();
        services.AddSingleton<TrainingMaterialStore>();
        services.AddSingleton<MaterialTickets>();
        services.AddScoped<CertificateService>();

        /* Reads an account's allocation per request, now that it no longer
           travels on the token. */
        services.AddScoped<UserScopeProvider>();

        /* Batches as the public and the applicant see them; unscoped by
           design, so kept apart from the administrative ProgrammeService. */
        services.AddScoped<ProgrammeCatalogueService>();
        services.AddScoped<MonitoringService>();

        return services;
    }
}
