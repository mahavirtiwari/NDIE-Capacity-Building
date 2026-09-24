using System.Globalization;
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

/* The service must format the same way on every machine it runs on.
   Left to the host's locale, an unqualified "yyyy" can render a non-Gregorian
   year and month names come out in the server's language — so the culture is
   stated here rather than inherited. en-IN because the audience is Indian;
   anything that travels on the wire still formats invariantly at its own call
   site, which is not a matter of taste. */
var culture = new CultureInfo("en-IN");
CultureInfo.DefaultThreadCurrentCulture = culture;
CultureInfo.DefaultThreadCurrentUICulture = culture;

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

    /* Set here rather than in web.config, which `dotnet publish` regenerates on
       every deployment, and which would not travel if this ever moved off IIS.

       No Content-Security-Policy: Angular's runtime needs style-src 'unsafe-inline'
       and getting the rest wrong breaks the portal silently in one browser.
       It deserves its own change, measured against the built bundle. */
    app.Use(async (context, next) =>
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()";
        await next();
    });
}

/* The built portal is published into wwwroot and served from the same origin
   as the API, so a deployment is one site with one certificate and there is no
   CORS between the two halves. It also keeps the API's own routes where they
   are: mounted as an IIS sub-application under /api they would have answered on
   /api/api/... instead.

   Guarded on index.html actually being there — in development the portal runs
   on its own dev server and wwwroot is empty. */
var webRoot = app.Environment.WebRootPath;
var hostsPortal = !string.IsNullOrEmpty(webRoot) && File.Exists(Path.Combine(webRoot, "index.html"));

if (hostsPortal)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseCors(CorsPolicy);
app.UseAuthentication();
/* After authentication, so the principal exists; before authorization, so the
   scope filters have the allocation by the time any handler composes a query. */
app.UseMiddleware<UserScopeMiddleware>();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

if (hostsPortal)
{
    /* An unmatched /api path is a mistyped endpoint and must stay a 404.
       Without this it would fall through to the SPA and answer 200 with a page
       of HTML, which is harder for a client to diagnose than an honest 404. */
    app.MapFallback("/api/{**rest}", () => Results.NotFound());

    /* Everything else is an Angular route — /programmes, /p/{code}, the portal
       itself — so the shell is returned and the browser router takes over.
       MapFallbackToFile ignores paths that look like files, so a missing asset
       still 404s rather than returning the shell. */
    app.MapFallbackToFile("index.html");
}

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
