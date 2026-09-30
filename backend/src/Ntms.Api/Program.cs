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
    .AllowAnyMethod()
    /* A browser reads none of a response's headers across origins unless
       they are named here. Without it a downloaded document arrives with
       no name and no number, which the portal and the web build of the app
       both need. */
    .WithExposedHeaders("Content-Disposition", "X-Invoice-Number")));

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
       every deployment, and which would not travel if this ever moved off IIS. */

    /* A staging host carries real programme data on pages that are genuinely
       public, so it must not end up in search results competing with the live
       site. Off by default — it is the live site that wants to be found. */
    var discourageCrawlers = builder.Configuration.GetValue("Site:DiscourageSearchEngines", false);

    /* --------------------------------------------- content security policy --
       Off until somebody turns it on, and report-only when they first do.

       A policy that is too tight does not fail loudly: the portal loads, one
       screen is missing its chart or its logo, and the reason is a line in a
       console nobody has open. So the rollout is report-only first — the
       browser reports what the policy would have blocked and blocks nothing —
       and enforcing is a second, deliberate step once the reports are quiet.

       The default below is measured against the built bundle rather than
       guessed. What it allows and why:

         script-src 'self'      the bundles, and nothing else. Angular is built
                                ahead of time, so there is no eval and no inline
                                script in index.html to make room for.
         style-src  'unsafe-inline'
                                Angular injects component styles as <style>
                                elements while it runs. The alternative is a
                                per-response nonce rewritten into index.html,
                                which is real work for a much smaller risk than
                                inline script.
         img-src    data: blob: charts draw into data URIs and an uploaded file
                                is previewed from a blob before it is sent.
         frame-ancestors 'none' the same statement as X-Frame-Options, in the
                                header that modern browsers actually read. */
    var cspSection = builder.Configuration.GetSection("Site:ContentSecurityPolicy");
    var cspEnabled = cspSection.GetValue("Enabled", false);
    var cspReportOnly = cspSection.GetValue("ReportOnly", true);

    var cspPolicy = cspSection.GetValue<string>("Policy");
    if (string.IsNullOrWhiteSpace(cspPolicy))
    {
        cspPolicy = string.Join("; ",
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'");
    }

    /* Only while reporting: an endpoint that accepts anonymous writes is worth
       having for the week it is useful and not a day longer. */
    if (cspEnabled && cspReportOnly)
    {
        cspPolicy += "; report-uri /api/csp-report";
    }

    var cspHeader = cspReportOnly
        ? "Content-Security-Policy-Report-Only"
        : "Content-Security-Policy";

    app.Use(async (context, next) =>
    {
        var headers = context.Response.Headers;
        headers["X-Content-Type-Options"] = "nosniff";
        headers["X-Frame-Options"] = "DENY";
        headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()";

        if (cspEnabled) headers[cspHeader] = cspPolicy;

        /* The header as well as robots.txt: a crawler that reached a page
           through a link somebody shared never asked for robots.txt, and this
           is the only instruction it will see. */
        if (discourageCrawlers)
        {
            headers["X-Robots-Tag"] = "noindex, nofollow, noarchive";
        }

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

/* After authentication, so the Super Admin exemption can be read off the
   token, and before authorization, so a closed site answers "we are shut"
   rather than "you may not". */
app.UseMiddleware<MaintenanceMiddleware>();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

/* ------------------------------------------------- policy violation reports
   Where a browser sends what the policy would have blocked, while the policy
   is still only reporting. Mounted only then: an endpoint that takes anonymous
   writes earns its place for the week it is useful and not a day longer.

   Appended to a file rather than logged, because there is no log anybody reads
   on this deployment — the application writes to stdout and IIS throws it away.
   The file is capped, so a bored stranger posting reports fills a megabyte and
   then nothing. */
if (app.Configuration.GetValue("Site:ContentSecurityPolicy:Enabled", false)
    && app.Configuration.GetValue("Site:ContentSecurityPolicy:ReportOnly", true))
{
    app.MapPost("/api/csp-report", async (HttpContext context) =>
    {
        var folder = app.Configuration["Storage:MonitoringRoot"] is { Length: > 0 } configured
            ? Path.GetDirectoryName(configured.TrimEnd(Path.DirectorySeparatorChar))
              ?? AppContext.BaseDirectory
            : AppContext.BaseDirectory;

        var path = Path.Combine(folder, "csp-reports.log");

        try
        {
            if (File.Exists(path) && new FileInfo(path).Length > 1_000_000) return Results.NoContent();

            using var reader = new StreamReader(context.Request.Body);
            /* Bounded read: the browser sends a small JSON object, and anything
               larger is not a report. */
            var buffer = new char[4096];
            var read = await reader.ReadBlockAsync(buffer, 0, buffer.Length);
            /* One report to a line, so the file can be read with anything
               that reads lines. A report carrying its own newlines would
               otherwise look like several. */
            var body = new string(buffer, 0, read)
                .Replace('\r', ' ')
                .Replace('\n', ' ');

            await File.AppendAllTextAsync(path, string.Join('\t',
                DateTime.UtcNow.ToString("O"),
                context.Request.Headers.UserAgent.ToString(),
                body) + Environment.NewLine);
        }
        catch (IOException)
        {
            /* Two browsers reporting at once, or a folder that has gone away.
               A violation report is diagnostics: losing one must never turn
               into a 500 on somebody's page load. */
        }

        return Results.NoContent();
    }).AllowAnonymous();
}

if (app.Configuration.GetValue("Site:DiscourageSearchEngines", false))
{
    app.MapGet("/robots.txt", () => Results.Text(
        "User-agent: *\nDisallow: /\n", "text/plain"));
}

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

/* --seed brings the database to a usable state and exits without serving
   anything: the roles, the LGD location master, the branding defaults and the
   first Super Admin. A deployment needs all of that and must not have it
   happen on an app-pool recycle, so in production MigrateOnStartup is false
   and this is run once, deliberately, as a step of its own.

   Everything DbSeeder does is idempotent, so running it again costs nothing
   and changes nothing. */
var seedOnly = args.Contains("--seed");

if (seedOnly || builder.Configuration.GetValue("Database:MigrateOnStartup", app.Environment.IsDevelopment()))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<NtmsDbContext>();
    await db.Database.MigrateAsync();

    var seeder = scope.ServiceProvider.GetRequiredService<DbSeeder>();
    await seeder.SeedAsync(
        args.Contains("--with-sample-data") ||
        builder.Configuration.GetValue("Database:SeedSampleData", app.Environment.IsDevelopment()));
}

/* The qualification ladder is a master an administrator edits, and the places
   that only need a label for a stored code read a copy of it held in memory.
   Load that copy now, so the first request shows wording rather than codes.

   Deliberately tolerant: a database that cannot be reached, or one this
   build's migrations have not been applied to yet, leaves the shipped ladder
   in place instead of stopping the site from starting. */
using (var warmUp = app.Services.CreateScope())
{
    try
    {
        await warmUp.ServiceProvider.GetRequiredService<QualificationService>()
            .ReloadCatalogueAsync(CancellationToken.None);
    }
    catch (Exception ex)
    {
        warmUp.ServiceProvider.GetRequiredService<ILoggerFactory>()
            .CreateLogger("Startup")
            .LogWarning(ex, "The qualification catalogue could not be read at start-up. " +
                            "Using the built-in ladder until it can be.");
    }
}

if (seedOnly)
{
    return;
}

await app.RunAsync();

/// <summary>Exposed so an integration test project can spin the API up.</summary>
public partial class Program;
