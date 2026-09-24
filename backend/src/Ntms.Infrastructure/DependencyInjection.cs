using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;
using Ntms.Infrastructure.Services;
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

        services.AddSingleton<IPasswordService, PasswordService>();
        services.AddSingleton<ITokenService, JwtTokenService>();
        services.AddScoped<ICodeGenerator, CodeGenerator>();
        /* Scoped, not singleton: the sender now reads its settings from the
           database on each send. */
        services.AddScoped<IEmailSettingsProvider, EmailSettingsProvider>();
        services.AddScoped<IEmailSender, SmtpEmailSender>();
        services.AddScoped<INotificationService, NotificationService>();
        services.AddScoped<OtpService>();
        services.AddScoped<DbSeeder>();

        services.AddScoped<CategoryService>();
        services.AddScoped<SubCategoryService>();
        services.AddScoped<ProgramTypeService>();
        services.AddScoped<DelegationGuard>();
        services.AddScoped<AgencyService>();
        services.AddScoped<CurriculumService>();
        services.AddScoped<RegistrationFormService>();
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

        /* Coordinator field monitoring. The photo store is a singleton: it holds
           only the configured root path and creates folders on demand. */
        services.AddSingleton<MonitoringPhotoStore>();
        services.AddSingleton<CertificateTemplateStore>();
        services.AddScoped<CertificateService>();
        services.AddScoped<MonitoringService>();

        return services;
    }
}
