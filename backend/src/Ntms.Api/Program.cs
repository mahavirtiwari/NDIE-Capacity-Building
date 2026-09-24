using System.Text;
using System.Text.Json.Serialization;
using Ntms.Api.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using Ntms.Api.Middleware;
using Ntms.Api.Security;
using Ntms.Application.Common;
using Ntms.Infrastructure;
using Ntms.Infrastructure.Identity;
using Ntms.Infrastructure.Persistence;
using Ntms.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

/* ------------------------------------------------------------------ config */

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
if (string.IsNullOrWhiteSpace(jwt.SigningKey) || jwt.SigningKey.Length < 32)
{
    /* Refuse to boot with a weak key rather than silently issuing forgeable
       tokens. In production this comes from the environment or a key vault. */
    throw new InvalidOperationException(
        "Jwt:SigningKey must be configured with at least 32 characters.");
}

const string CorsPolicy = "portal";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? ["http://localhost:4200"];

/* --------------------------------------------------------------- services */

builder.Services.AddNtmsInfrastructure(builder.Configuration);

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<CurrentUser>();
builder.Services.AddScoped<ICurrentUser>(sp => sp.GetRequiredService<CurrentUser>());
builder.Services.AddScoped<ICurrentUserRoles>(sp => sp.GetRequiredService<CurrentUser>());

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        /* Enums travel as the same strings the clients already use. */
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        /* A blank <input type="date"> posts "" — read that as "not set"
           rather than failing the whole body. */
        options.JsonSerializerOptions.Converters.Add(new NullableDateOnlyConverter());
        options.JsonSerializerOptions.Converters.Add(new NullableDateTimeConverter());
        options.JsonSerializerOptions.Converters.Add(new NullableTimeOnlyConverter());
        /* Timestamps go out marked as UTC so the portal can show them in IST
           instead of five and a half hours behind. */
        options.JsonSerializerOptions.Converters.Add(new UtcDateTimeConverter());
        options.JsonSerializerOptions.DefaultIgnoreCondition =
            JsonIgnoreCondition.WhenWritingNull;
    });

/* Model binding failures should look like every other error. */
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context =>
    {
        var errors = context.ModelState
            .Where(e => e.Value?.Errors.Count > 0)
            .SelectMany(e => e.Value!.Errors.Select(x => $"{e.Key}: {x.ErrorMessage}"))
            .ToList();

        return new BadRequestObjectResult(
            ApiEnvelope<object>.Fail("The request could not be processed.", errors));
    };
});

builder.Services.AddSingleton<IAuthorizationPolicyProvider, PermissionPolicyProvider>();
builder.Services.AddSingleton<IAuthorizationHandler, PermissionHandler>();
builder.Services.AddAuthorization();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.SigningKey)),
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });

builder.Services.AddCors(options => options.AddPolicy(CorsPolicy, policy => policy
    .WithOrigins(allowedOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()));

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Capacity Building Management System API",
        Version = "v1",
        Description = "Training and certification lifecycle for the Ministry of MSME.",
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste the access token returned by /api/auth/login.",
    });
    /* Swashbuckle 10 takes a factory so the reference can resolve against the
       document being generated. */
    options.AddSecurityRequirement(_ => new OpenApiSecurityRequirement
    {
        { new OpenApiSecuritySchemeReference("Bearer"), new List<string>() },
    });
});

builder.Services.AddHealthChecks().AddDbContextCheck<NtmsDbContext>();

var app = builder.Build();

/* ---------------------------------------------------------------- pipeline */

app.UseMiddleware<ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "CBMS API v1");
        options.DocumentTitle = "CBMS API";
    });
}
else
{
    app.UseHsts();
    app.UseHttpsRedirection();
}

app.UseCors(CorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

/* --------------------------------------------------------------- database */

if (builder.Configuration.GetValue("Database:MigrateOnStartup", app.Environment.IsDevelopment()))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<NtmsDbContext>();
    await db.Database.MigrateAsync();

    var seeder = scope.ServiceProvider.GetRequiredService<DbSeeder>();
    await seeder.SeedAsync(
        builder.Configuration.GetValue("Database:SeedSampleData", app.Environment.IsDevelopment()));
}

await app.RunAsync();

/// <summary>Exposed so an integration test project can spin the API up.</summary>
public partial class Program;
