using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Ntms.Application.Common;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;
using Ntms.Infrastructure.Email;
using Ntms.Infrastructure.Identity;

namespace Ntms.Infrastructure.Persistence;

/// <summary>
/// Brings a fresh database up to a usable state: the LGD location master, the
/// system roles, and a first Super Admin. Everything here is idempotent, so it
/// is safe to run on every start.
/// </summary>
public class DbSeeder(
    NtmsDbContext db,
    IPasswordService passwords,
    IConfiguration config,
    ILogger<DbSeeder> logger)
{
    /// <summary>
    /// The first-run password for the seeded Super Admin.
    ///
    /// Taken from configuration, and otherwise generated. It is deliberately not
    /// a constant in this file: a checked-in default is a published credential,
    /// and anyone reading the repository would know how to sign in to any
    /// deployment whose administrator had not yet changed it.
    ///
    /// The generated password is written to the log once, at warning level,
    /// which is the only place it ever appears.
    /// </summary>
    private string FirstRunPassword()
    {
        var configured = config["Seed:SuperAdminPassword"];
        if (!string.IsNullOrWhiteSpace(configured)) return configured;

        /* URL-safe base64 of 18 random bytes: 24 characters, no ambiguity about
           what has to be typed, and far beyond guessing. */
        var raw = RandomNumberGenerator.GetBytes(18);
        return Convert.ToBase64String(raw).Replace('+', 'A').Replace('/', 'B').TrimEnd('=');
    }

    public async Task SeedAsync(bool includeSampleData, CancellationToken ct = default)
    {
        await SeedLocationsAsync(ct);
        await SeedRolesAsync(ct);
        await SeedSuperAdminAsync(ct);
        await SeedBrandingAsync(ct);
        await SeedEmailAsync(ct);
        await SeedSignupFormAsync(ct);
        await BackfillDelegationScopeAsync(ct);

        if (includeSampleData)
        {
            await SeedSampleMastersAsync(ct);
        }
    }

    /* ------------------------------------------------------------ locations */

    private async Task SeedLocationsAsync(CancellationToken ct)
    {
        if (!await db.States.AnyAsync(ct))
        {
            db.States.AddRange(LgdSeedData.States.Select(s => new LgdState
            {
                Code = s.Code,
                Name = s.Name,
                IsUnionTerritory = s.IsUnionTerritory,
            }));
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seeded {Count} LGD states", LgdSeedData.States.Count);
        }

        if (!await db.Districts.AnyAsync(ct))
        {
            var stateCodes = await db.States.Select(s => s.Code).ToListAsync(ct);
            var districts = LgdSeedData.Districts
                .Where(d => stateCodes.Contains(d.StateCode))
                .Select(d => new LgdDistrict { Code = d.Code, StateCode = d.StateCode, Name = d.Name });
            db.Districts.AddRange(districts);
            await db.SaveChangesAsync(ct);
            logger.LogInformation("Seeded LGD districts");
        }
    }

    /* ---------------------------------------------------------------- roles */

    private static readonly (string Name, string Code, BaseRole Base, string Description, string[] Permissions)[]
        SystemRoles =
        [
            /* Everything the top of the system actually does. The
                operational grants it does not hold are listed, with the
                reasoning, on Permissions.NotForSuperAdmin. */
            ("Super Admin", "SUPER_ADMIN", BaseRole.SuperAdmin,
                "Owns the masters, the roles and the portal itself. Appoints Admins and the "
                + "Ministry account.",
                [.. Permissions.All.Except(Permissions.NotForSuperAdmin)]),
            ("Ministry of MSME", "MINISTRY", BaseRole.Ministry,
                "Oversight for the parent ministry: sees the whole program, changes none of it.",
                [
                    Permissions.MastersView, Permissions.CurriculumView, Permissions.FeesView,
                    Permissions.ExamsView, Permissions.MaterialsView, Permissions.AgenciesView,
                    Permissions.UsersView, Permissions.ApplicationsView, Permissions.ProgramsView,
                    Permissions.CoordinatorsView, Permissions.ReportsView,
                    /* The two read-only registers. They were added to the
                       catalogue after this list was written, which is the
                       only reason an account described as seeing the whole
                       program could not open either of them. */
                    Permissions.ProfessionalsView, Permissions.TrainersView,
                ]),
            ("Admin", "ADMIN", BaseRole.Admin,
                "Appoints Operation Managers within allocated categories, sub-categories and states.",
                [
                    Permissions.MastersView, Permissions.CurriculumView, Permissions.FeesView,
                    Permissions.ExamsView, Permissions.MaterialsView, Permissions.AgenciesView,
                    Permissions.RolesView,
                    Permissions.UsersView, Permissions.UsersManage, Permissions.UsersStatus,
                    Permissions.ApplicationsView, Permissions.ApplicationsScrutinise,
                    Permissions.ProgramsView, Permissions.CoordinatorsView, Permissions.ReportsView,
                    Permissions.ProfessionalsView, Permissions.TrainersView,
                ]),
            ("Operation Manager", "OPS_MANAGER", BaseRole.OperationManager,
                "Empanels Implementing Agencies within allocated program types and states.",
                [
                    Permissions.MastersView, Permissions.CurriculumView, Permissions.MaterialsView,
                    Permissions.AgenciesView, Permissions.AgenciesManage,
                    Permissions.UsersView, Permissions.UsersStatus, Permissions.ApplicationsView,
                    Permissions.ProgramsView, Permissions.ProgramsManage,
                    Permissions.CoordinatorsView, Permissions.ReportsView,
                    Permissions.ProfessionalsView, Permissions.TrainersView,
                ]),
            ("Implementing Agency", "AGENCY_ADMIN", BaseRole.AgencyAdmin,
                "The agency's own login. Raises its programs, adds its coordinators and runs them.",
                [
                    Permissions.MastersView, Permissions.CurriculumView, Permissions.MaterialsView,
                    Permissions.RolesView,
                    Permissions.UsersView, Permissions.UsersManage, Permissions.UsersStatus,
                    Permissions.CoordinatorsView, Permissions.CoordinatorsManage,
                    Permissions.ProgramsView, Permissions.ProgramsCreate, Permissions.ProgramsManage,
                    Permissions.ReportsView,
                ]),
            ("Coordinator", "COORDINATOR", BaseRole.Coordinator,
                "Captures programs conducted physically or virtually and marks attendance.",
                [Permissions.ProgramsView, Permissions.ProgramsManage, Permissions.MaterialsView]),
        ];

    private async Task SeedRolesAsync(CancellationToken ct)
    {
        foreach (var (name, code, baseRole, description, permissions) in SystemRoles)
        {
            var role = await db.Roles.Include(r => r.Permissions)
                .FirstOrDefaultAsync(r => r.Code == code, ct);

            if (role is null)
            {
                role = new AdminRole
                {
                    Name = name,
                    Code = code,
                    BaseRole = baseRole,
                    Description = description,
                    IsSystemRole = true,
                    Status = RecordStatus.Active,
                };
                db.Roles.Add(role);
            }

            /* Top up permissions that were added to the catalogue after the role
               was first created, without touching anything an admin removed. */
            var existing = role.Permissions.Select(p => p.Permission).ToHashSet();
            if (code == "SUPER_ADMIN")
            {
                foreach (var permission in permissions.Where(p => !existing.Contains(p)))
                {
                    role.Permissions.Add(new RolePermission { Permission = permission });
                }
            }
            else if (existing.Count == 0)
            {
                foreach (var permission in permissions)
                {
                    role.Permissions.Add(new RolePermission { Permission = permission });
                }
            }
        }

        await db.SaveChangesAsync(ct);
    }

    /* --------------------------------------------------------- super admin */

    private async Task SeedSuperAdminAsync(CancellationToken ct)
    {
        if (await db.Users.AnyAsync(ct)) return;

        var role = await db.Roles.FirstAsync(r => r.Code == "SUPER_ADMIN", ct);
        var delhi = await db.States.FirstOrDefaultAsync(s => s.Name == "DELHI", ct);
        var firstRunPassword = FirstRunPassword();

        db.Users.Add(new PortalUser
        {
            UserCode = "SA0001",
            FullName = "System Administrator",
            Email = "superadmin@ntms.gov.in",
            Mobile = "9000000001",
            Designation = "Director (Training)",
            PasswordHash = passwords.Hash(firstRunPassword),
            MustChangePassword = true,
            RoleId = role.Id,
            BaseRole = BaseRole.SuperAdmin,
            StateCode = delhi?.Code,
            City = "New Delhi",
            Status = RecordStatus.Active,
        });

        await db.SaveChangesAsync(ct);
        logger.LogWarning(
            "Seeded Super Admin SA0001 with the first-run password: {Password}. " +
            "It must be changed at first sign-in, and this is the only time it is shown.",
            firstRunPassword);
    }

    /* --------------------------------------------------- account sign-up form */

    /// <summary>
    /// The fields an applicant fills in to create an account.
    ///
    /// These six exist as columns on the applicant record whether or not
    /// there is a row here, so seeding them is not creating the form - it is
    /// making the form that already exists editable. Only the ones missing are
    /// added, so a label somebody changed is never quietly put back.
    /// </summary>
    private async Task SeedSignupFormAsync(CancellationToken ct)
    {
        /* key, label, placeholder, type, required, locked */
        var builtIn = new (string Key, string Label, string? Placeholder, FieldType Type, bool Required, bool Locked)[]
        {
            ("fullName", "Full name", "As printed on your PAN", FieldType.Text, true, true),
            ("email", "Email", "Enter email address", FieldType.Email, true, true),
            ("mobile", "Mobile", "Enter mobile number", FieldType.Mobile, true, true),
            ("pan", "PAN", "ABCDE1234F", FieldType.Pan, true, false),
            ("gender", "Gender", "Select a gender", FieldType.Select, true, false),
            ("socialCategory", "Social category", "Select a social category", FieldType.Select, true, false),
        };

        var existing = await db.SignupFields.Select(f => f.Key).ToListAsync(ct);
        var order = await db.SignupFields.MaxAsync(f => (int?)f.DisplayOrder, ct) ?? 0;
        var added = 0;

        foreach (var field in builtIn)
        {
            if (existing.Contains(field.Key)) continue;

            db.SignupFields.Add(new SignupField
            {
                Key = field.Key,
                Label = field.Label,
                Placeholder = field.Placeholder,
                Type = field.Type,
                Required = field.Required,
                IsBuiltIn = true,
                IsLocked = field.Locked,
                DisplayOrder = ++order,
                Status = RecordStatus.Active,
            });
            added++;
        }

        if (added == 0) return;

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded {Count} sign-up form fields", added);
    }

    /* ---------------------------------------------------- portal identity */

    private async Task SeedBrandingAsync(CancellationToken ct)
    {
        if (await db.Branding.AnyAsync(ct)) return;

        db.Branding.Add(new BrandingSetting
        {
            Id = 1,
            OrganisationName = "National Division for Industry Excellence",
            ShortName = "NDIE",
            PortalTitle = "Capacity Building Management System",
            Tagline = "One platform for the entire training and certification lifecycle.",
            SupportEmail = "support@ntms.gov.in",
        });
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded default portal branding");
    }

    /* ---------------------------------------------------------- email */

    /// <summary>
    /// Seeds the editable copy of every shipped template, and tops up any that
    /// were added since the database was created. Existing rows are never
    /// overwritten — the whole point is that they can be edited.
    /// </summary>
    private async Task SeedEmailAsync(CancellationToken ct)
    {
        if (!await db.EmailSettings.AnyAsync(ct))
        {
            db.EmailSettings.Add(new EmailSetting { Id = 1 });
        }

        var existing = await db.EmailTemplates.Select(t => t.Key).ToListAsync(ct);
        var added = 0;

        foreach (var template in EmailTemplateDefaults.All.Where(t => !existing.Contains(t.Key)))
        {
            db.EmailTemplates.Add(new EmailTemplate
            {
                Key = template.Key,
                Name = template.Name,
                Description = template.Description,
                Subject = template.Subject,
                HtmlBody = template.HtmlBody,
                PlainTextBody = template.PlainTextBody,
                Placeholders = template.Placeholders,
                IsEnabled = true,
            });
            added++;
        }

        await db.SaveChangesAsync(ct);
        if (added > 0) logger.LogInformation("Seeded {Count} email templates", added);
    }

    /* ------------------------------------------------- delegation backfill */

    /// <summary>
    /// Brings accounts created before the delegation chain existed into line
    /// with it. Runs on every start and does nothing once satisfied.
    ///
    /// Two jobs. First, an agency's own login used to be issued as an Operation
    /// Manager, which under the chain is a rung too high — those are re-roled.
    /// Second, an empty allocation now means "nothing" rather than
    /// "everything", so an account that predates the change would silently lose
    /// its reach; each empty axis is filled with what that account could see
    /// before, which keeps behaviour identical while making it explicit.
    /// </summary>
    private async Task BackfillDelegationScopeAsync(CancellationToken ct)
    {
        var changed = 0;

        /* ---- permissions the chain depends on ------------------------------
           Role permissions are the Super Admin's to edit, so the seeder leaves
           existing roles alone. These few are structural rather than
           discretionary: empanelling moved from Admin to Operation Manager, and
           a role left on the wrong side of that would break the chain. Only
           these keys are touched; everything else stays as configured. */
        var corrections = new (string Code, string[] Grant, string[] Revoke)[]
        {
            /* RolesView is read-only. A tier that creates the one below it has
               to be able to list roles to fill the dropdown; managing them
               stays with the Super Admin. */
            /* The registers were added after these roles were configured, and
               a permission that exists but is on no role is a screen nobody
               can reach. Granted to whoever already had the equivalent reach:
               reading reports and running programmes. */
            ("ADMIN",
                [Permissions.CoordinatorsView, Permissions.UsersStatus, Permissions.RolesView,
                 Permissions.ProfessionalsView, Permissions.TrainersView],
                [Permissions.AgenciesManage]),
            ("OPS_MANAGER",
                [Permissions.AgenciesView, Permissions.AgenciesManage,
                 Permissions.UsersView, Permissions.UsersStatus,
                 Permissions.ProfessionalsView, Permissions.TrainersView,
                 Permissions.TrainersManage], []),
            ("AGENCY_ADMIN", [Permissions.UsersStatus, Permissions.RolesView], []),
            /* Oversight only: the Ministry must never gain a write key. */
            ("MINISTRY",
                [Permissions.ProfessionalsView, Permissions.TrainersView],
                [Permissions.UsersStatus, Permissions.UsersManage, Permissions.TrainersManage]),
        };

        foreach (var (code, grant, revoke) in corrections)
        {
            var role = await db.Roles.Include(r => r.Permissions)
                .FirstOrDefaultAsync(r => r.Code == code, ct);
            if (role is null) continue;

            foreach (var key in grant.Where(k => !role.Permissions.Any(p => p.Permission == k)))
            {
                role.Permissions.Add(new RolePermission { Permission = key });
                changed++;
                logger.LogInformation("Granted {Permission} to {Role}", key, code);
            }

            foreach (var stale in role.Permissions.Where(p => revoke.Contains(p.Permission)).ToList())
            {
                role.Permissions.Remove(stale);
                changed++;
                logger.LogInformation("Revoked {Permission} from {Role}", stale.Permission, code);
            }
        }

        /* ---- free-text qualifications become catalogue codes -------------
           The field used to hold a sentence. Where one named several levels,
           the lowest is taken, since that is the bar it actually set. Anything
           unrecognisable is left exactly as it was rather than guessed at, and
           reported so it can be corrected by hand. */
        var loose = await db.ProgramTypes
            .Where(p => p.MinQualification != null && p.MinQualification != "")
            .ToListAsync(ct);

        foreach (var programType in loose)
        {
            var current = programType.MinQualification!;
            if (QualificationLevels.IsValid(current)) continue;

            var mapped = QualificationLevels.Interpret(current);
            if (mapped is null)
            {
                logger.LogWarning(
                    "Program type {Code} has a minimum qualification that could not be matched " +
                    "to the catalogue: \"{Value}\". Left unchanged; set it from the form.",
                    programType.Code, current);
                continue;
            }

            programType.MinQualification = mapped;
            changed++;
            logger.LogInformation(
                "Program type {Code}: minimum qualification \"{Old}\" read as {New}",
                programType.Code, current, mapped);
        }

        /* ---- agency logins move to their own tier -------------------------- */
        var agencyRole = await db.Roles.FirstOrDefaultAsync(r => r.Code == "AGENCY_ADMIN", ct);
        if (agencyRole is not null)
        {
            var misfiled = await db.Users
                .Where(u => u.AgencyId != null && u.BaseRole == BaseRole.OperationManager)
                .ToListAsync(ct);

            foreach (var user in misfiled)
            {
                user.BaseRole = BaseRole.AgencyAdmin;
                user.RoleId = agencyRole.Id;
                changed++;
                logger.LogInformation(
                    "Re-roled {UserCode} to Implementing Agency; it is an agency login", user.UserCode);
            }
        }

        /* ---- agencies gain an explicit state allocation -------------------- */
        var allStates = await db.States.Select(x => x.Code).ToListAsync(ct);
        var agenciesWithoutStates = await db.Agencies
            .Include(a => a.States)
            .Where(a => a.States.Count == 0)
            .ToListAsync(ct);

        foreach (var agency in agenciesWithoutStates)
        {
            /* These were empanelled before states were recorded, and were
               unrestricted in practice. Recording that as-is keeps them working;
               narrowing them is an operational decision, not a migration's. */
            foreach (var code in allStates) agency.States.Add(new AgencyState { StateCode = code });
            changed++;
        }

        /* ---- users gain an explicit allocation on every axis that applies -- */
        var scopedUsers = await db.Users
            .Include(u => u.Categories).Include(u => u.SubCategories)
            .Include(u => u.ProgramTypes).Include(u => u.States).Include(u => u.Districts)
            .Where(u => u.BaseRole != BaseRole.SuperAdmin && u.BaseRole != BaseRole.Ministry)
            .ToListAsync(ct);

        foreach (var user in scopedUsers)
        {
            var axes = RoleHierarchy.AxesFor(user.BaseRole);

            if (axes.HasFlag(ScopeAxis.Category) && user.Categories.Count == 0)
            {
                foreach (var id in await db.Categories.Select(c => c.Id).ToListAsync(ct))
                    user.Categories.Add(new UserCategory { CategoryId = id });
                changed++;
            }

            /* Narrowed by whatever the account already holds one level up, so a
               manager scoped to one category does not quietly acquire another's
               sub-categories. */
            var categoryIds = user.Categories.Select(c => c.CategoryId).ToList();

            if (axes.HasFlag(ScopeAxis.SubCategory) && user.SubCategories.Count == 0)
            {
                var ids = await db.SubCategories
                    .Where(x => categoryIds.Count == 0 || categoryIds.Contains(x.CategoryId))
                    .Select(x => x.Id).ToListAsync(ct);
                foreach (var id in ids) user.SubCategories.Add(new UserSubCategory { SubCategoryId = id });
                changed++;
            }

            var subCategoryIds = user.SubCategories.Select(c => c.SubCategoryId).ToList();

            if (axes.HasFlag(ScopeAxis.ProgramType) && user.ProgramTypes.Count == 0)
            {
                var ids = await db.ProgramTypes
                    .Where(x => subCategoryIds.Count == 0 || subCategoryIds.Contains(x.SubCategoryId))
                    .Select(x => x.Id).ToListAsync(ct);
                foreach (var id in ids) user.ProgramTypes.Add(new UserProgramType { ProgramTypeId = id });
                changed++;
            }

            if (axes.HasFlag(ScopeAxis.State) && user.States.Count == 0)
            {
                foreach (var code in allStates) user.States.Add(new UserState { StateCode = code });
                changed++;
            }

            if (axes.HasFlag(ScopeAxis.District) && user.Districts.Count == 0)
            {
                var stateCodes = user.States.Select(x => x.StateCode).ToList();
                var ids = await db.Districts
                    .Where(d => stateCodes.Contains(d.StateCode))
                    .Select(d => d.Code).ToListAsync(ct);
                foreach (var id in ids) user.Districts.Add(new UserDistrict { DistrictCode = id });
                changed++;
            }
        }

        if (changed == 0) return;

        await db.SaveChangesAsync(ct);
        logger.LogWarning(
            "Delegation backfill applied {Count} allocation changes. Existing accounts kept the " +
            "reach they had; review them so each one is allocated deliberately.", changed);
    }

    /* -------------------------------------------------------- sample data */

    private async Task SeedSampleMastersAsync(CancellationToken ct)
    {
        if (await db.Categories.AnyAsync(ct)) return;

        var zed = new Category
        {
            Code = "ZED", Name = "ZED Certification", DisplayOrder = 1,
            Description = "Zero Defect Zero Effect certification ecosystem for MSMEs.",
        };
        var lean = new Category
        {
            Code = "LMC", Name = "Lean Manufacturing Competitiveness", DisplayOrder = 2,
            Description = "Lean tools and productivity improvement for manufacturing clusters.",
        };
        db.Categories.AddRange(zed, lean);
        await db.SaveChangesAsync(ct);

        var bronze = new SubCategory
        {
            CategoryId = zed.Id, Code = "ZED-BRZ", Name = "Bronze", DisplayOrder = 1,
            Description = "Entry level ZED maturity.",
        };
        var silver = new SubCategory
        {
            CategoryId = zed.Id, Code = "ZED-SLV", Name = "Silver", DisplayOrder = 2,
            Description = "Intermediate ZED maturity.",
        };
        var basic = new SubCategory
        {
            CategoryId = lean.Id, Code = "LMC-BAS", Name = "Basic Level", DisplayOrder = 1,
            Description = "Foundation lean interventions.",
        };
        db.SubCategories.AddRange(bronze, silver, basic);
        await db.SaveChangesAsync(ct);

        db.ProgramTypes.AddRange(
            new ProgramType
            {
                CategoryId = zed.Id, SubCategoryId = bronze.Id, Code = "ZED-MT-B",
                Name = "Master Trainer - Bronze", DurationDays = 5,
                DeliveryMode = DeliveryMode.Hybrid, MinExperienceYears = 5,
                MinQualification = "DIPLOMA",
                ShortDescription = "Prepares professionals to deliver ZED Bronze sessions.",
            },
            new ProgramType
            {
                CategoryId = zed.Id, SubCategoryId = silver.Id, Code = "ZED-AS-S",
                Name = "Assessor - Silver", DurationDays = 5,
                DeliveryMode = DeliveryMode.Physical, MinExperienceYears = 7,
                MinQualification = "GRADUATION",
                ShortDescription = "Certifies assessors for on-site ZED Silver assessments.",
            },
            new ProgramType
            {
                CategoryId = lean.Id, SubCategoryId = basic.Id, Code = "LMC-CN-B",
                Name = "Lean Consultant - Basic", DurationDays = 6,
                DeliveryMode = DeliveryMode.Physical, MinExperienceYears = 4,
                MinQualification = "DIPLOMA",
                ShortDescription = "5S, Kaizen, visual control and basic value stream mapping.",
            });

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Seeded sample masters");
    }
}
