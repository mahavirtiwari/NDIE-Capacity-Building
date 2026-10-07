using System.Text.Json;
using Ntms.Application.Common;
using Ntms.Application.Contracts;
using Ntms.Domain.Common;
using Ntms.Domain.Entities;

namespace Ntms.Infrastructure.Mapping;

/// <summary>
/// Entity to DTO projections. Written by hand rather than convention-mapped so
/// the exact shape the clients depend on is visible in one place.
/// </summary>
public static class DtoMappings
{
    private static void FillAudit(AuditDto dto, AuditableEntity entity)
    {
        dto.CreatedBy = entity.CreatedBy;
        dto.CreatedOn = entity.CreatedOn;
        dto.ModifiedBy = entity.ModifiedBy;
        dto.ModifiedOn = entity.ModifiedOn;
    }

    /* --------------------------------------------------------- masters */

    public static CategoryDto ToDto(this Category e, int subCategoryCount = 0)
    {
        var dto = new CategoryDto
        {
            Id = e.Id,
            Code = e.Code,
            Name = e.Name,
            Description = e.Description,
            DisplayOrder = e.DisplayOrder,
            Status = e.Status.ToApi(),
            SubCategoryCount = subCategoryCount,
        };
        FillAudit(dto, e);
        return dto;
    }

    public static QualificationDto ToDto(this Qualification e, int programTypeCount = 0)
    {
        var dto = new QualificationDto
        {
            Id = e.Id,
            Code = e.Code,
            Label = e.Label,
            Rank = e.Rank,
            Status = e.Status.ToApi(),
            IsSystem = string.Equals(e.Code, QualificationLevels.None, StringComparison.OrdinalIgnoreCase),
            ProgramTypeCount = programTypeCount,
        };
        FillAudit(dto, e);
        return dto;
    }

    public static SubCategoryDto ToDto(this SubCategory e)
    {
        var dto = new SubCategoryDto
        {
            Id = e.Id,
            CategoryId = e.CategoryId,
            CategoryName = e.Category?.Name,
            Code = e.Code,
            Name = e.Name,
            Description = e.Description,
            DisplayOrder = e.DisplayOrder,
            Status = e.Status.ToApi(),
            RequiresSignupForm = e.RequiresSignupForm,
            RequiresProfileForm = e.RequiresProfileForm,
        };
        FillAudit(dto, e);
        return dto;
    }

    public static ProgramTypeDto ToDto(this ProgramType e)
    {
        var dto = new ProgramTypeDto
        {
            Id = e.Id,
            CategoryId = e.CategoryId,
            CategoryName = e.Category?.Name,
            SubCategoryId = e.SubCategoryId,
            SubCategoryName = e.SubCategory?.Name,
            Code = e.Code,
            Name = e.Name,
            ShortDescription = e.ShortDescription,
            DurationDays = e.DurationDays,
            DeliveryMode = e.DeliveryMode.ToApi(),
            MinQualification = e.MinQualification,
            MinQualificationLabel = QualificationLevels.LabelFor(e.MinQualification),
            MinExperienceYears = e.MinExperienceYears,
            MinParticipants = e.MinParticipants,
            CertificateValidityMonths = e.CertificateValidityMonths,
            IsExamMandatory = e.IsExamMandatory,
            IsFeeApplicable = e.IsFeeApplicable,
            CertificationPolicy = e.CertificationPolicy.ToString(),
            CertificationPolicyLabel = CertificationPolicies.Label(e.CertificationPolicy),
            CertificateKinds =
            [
                .. CertificationPolicies.KindsFor(e.CertificationPolicy).Select(k => k.ToString()),
            ],
            CertificateTemplates =
            [
                .. e.CertificateTemplates.OrderBy(t => t.Kind).Select(t => t.ToDto()),
            ],
            Evaluation = e.Evaluation.ToDto(),
            /* Only the live ones: a retired skill is history on past marksheets,
               not something a trainer will be asked to mark against. */
            SkillCount = e.Skills.Count(s => s.Status == RecordStatus.Active),
            Status = e.Status.ToApi(),
        };
        FillAudit(dto, e);
        return dto;
    }

    public static EvaluationSchemeDto ToDto(this EvaluationScheme e) => new()
    {
        Kind = e.Kind.ToString(),
        KindLabel = ExaminationKinds.Label(e.Kind),
        TotalMarks = e.TotalMarks,
        WrittenMarks = e.WrittenMarks,
        VivaMarks = e.VivaMarks,
        WrittenPassMarks = e.WrittenPassMarks,
        VivaPassMarks = e.VivaPassMarks,
        OverallPassMarks = e.OverallPassMarks,
        HasWritten = e.HasWritten,
        HasViva = e.HasViva,
    };

    public static EvaluationSkillDto ToDto(this EvaluationSkill e)
    {
        var dto = new EvaluationSkillDto
        {
            Id = e.Id,
            ProgramTypeId = e.ProgramTypeId,
            ProgramTypeName = e.ProgramType?.Name ?? string.Empty,
            Name = e.Name,
            Description = e.Description,
            MaxMarks = e.MaxMarks,
            DisplayOrder = e.DisplayOrder,
            Status = e.Status.ToApi(),
        };
        FillAudit(dto, e);
        return dto;
    }

    public static CertificateTemplateDto ToDto(this CertificateTemplate e) => new()
    {
        Id = e.Id,
        Kind = e.Kind.ToString(),
        FileName = e.FileName,
        ContentType = e.ContentType,
        SizeBytes = e.SizeBytes,
        UploadedOn = e.ModifiedOn ?? e.CreatedOn,
        UploadedBy = e.ModifiedBy ?? e.CreatedBy,
        Url = $"program-types/{e.ProgramTypeId}/certificate-templates/{e.Kind}",
    };

    public static AgencyDto ToDto(this ImplementingAgency e)
    {
        var dto = new AgencyDto
        {
            Id = e.Id,
            Code = e.Code,
            Name = e.Name,
            AgencyType = e.AgencyType.ToApi(),
            ContactPerson = e.ContactPerson,
            Email = e.Email,
            Mobile = e.Mobile,
            Gstin = e.Gstin,
            Pan = e.Pan,
            AddressLine1 = e.AddressLine1,
            AddressLine2 = e.AddressLine2,
            City = e.City,
            StateCode = e.StateCode,
            State = e.State?.Name,
            DistrictCode = e.DistrictCode,
            District = e.District?.Name,
            Pincode = e.Pincode,
            EmpanelledOn = e.EmpanelledOn,
            EmpanelmentValidTill = e.EmpanelmentValidTill,
            CategoryIds = [.. e.Categories.Select(x => x.CategoryId)],
            SubCategoryIds = [.. e.SubCategories.Select(x => x.SubCategoryId)],
            ProgramTypeIds = [.. e.ProgramTypes.Select(x => x.ProgramTypeId)],
            StateCodes = [.. e.States.Select(x => x.StateCode)],
            /* Ordered, and only where the navigation was loaded: a caller
               that did not include them gets an empty list rather than a
               list of blanks. */
            CategoryNames =
            [
                .. e.Categories.Where(x => x.Category is not null)
                    .Select(x => x.Category!.Name).OrderBy(n => n),
            ],
            ProgramTypeNames =
            [
                .. e.ProgramTypes.Where(x => x.ProgramType is not null)
                    .Select(x => x.ProgramType!.Name).OrderBy(n => n),
            ],
            Status = e.Status.ToApi(),
        };
        FillAudit(dto, e);
        return dto;
    }

    /* ------------------------------------------------------ curriculum */

    public static CurriculumDto ToDto(this Curriculum e)
    {
        var dto = new CurriculumDto
        {
            Id = e.Id,
            ProgramTypeId = e.ProgramTypeId,
            ProgramTypeName = e.ProgramType?.Name,
            CategoryId = e.ProgramType?.CategoryId,
            CategoryName = e.ProgramType?.Category?.Name,
            SubCategoryId = e.ProgramType?.SubCategoryId,
            SubCategoryName = e.ProgramType?.SubCategory?.Name,
            ProgramTypeCode = e.ProgramType?.Code,
            Objective = e.Objective,
            DurationDays = e.DurationDays,
            EffectiveFrom = e.EffectiveFrom,
            Status = e.Status.ToApi(),
            Sessions =
            [
                .. e.Sessions.OrderBy(s => s.DisplayOrder).Select(s => new CurriculumSessionDto
                {
                    Id = s.Id,
                    SessionCode = s.SessionCode,
                    SessionName = s.SessionName,
                    DisplayOrder = s.DisplayOrder,
                    Day = s.Day,
                    Status = s.Status.ToApi(),
                    Topics =
                    [
                        .. s.Topics.OrderBy(t => t.DisplayOrder).Select(t => new CurriculumTopicDto
                        {
                            Id = t.Id,
                            TopicCode = t.TopicCode,
                            TopicName = t.TopicName,
                            DisplayOrder = t.DisplayOrder,
                            DurationMinutes = t.DurationMinutes,
                            LearningOutcome = t.LearningOutcome,
                            Status = t.Status.ToApi(),
                        }),
                    ],
                }),
            ],
        };
        FillAudit(dto, e);
        return dto;
    }

    /* ----------------------------------------------- profile form */

    public static ProfileFormDto ToDto(this ProfileForm e)
    {
        var dto = new ProfileFormDto
        {
            Id = e.Id,
            SubCategoryId = e.SubCategoryId,
            SubCategoryName = e.SubCategory?.Name,
            CategoryId = e.SubCategory?.CategoryId,
            CategoryName = e.SubCategory?.Category?.Name,
            Version = e.Version,
            RequiresScrutiny = e.RequiresScrutiny,
            Status = e.Status.ToApi(),
            Sections =
            [
                .. e.Sections.OrderBy(s => s.DisplayOrder).Select(s => new ProfileSectionDto
                {
                    Id = s.Id,
                    Key = s.Key,
                    Title = s.Title,
                    Description = s.Description,
                    DisplayOrder = s.DisplayOrder,
                    IsEnabled = s.IsEnabled,
                    IsRepeatable = s.IsRepeatable,
                    MinEntries = s.MinEntries,
                    MaxEntries = s.MaxEntries,
                    ItemLabel = s.ItemLabel,
                    Fields =
                    [
                        .. s.Fields.OrderBy(f => f.DisplayOrder).Select(f => new ProfileFieldDto
                        {
                            Id = f.Id,
                            Key = f.Key,
                            Label = f.Label,
                            Type = f.Type.ToApi(),
                            IsEnabled = f.IsEnabled,
                            Placeholder = f.Placeholder,
                            HelpText = f.HelpText,
                            DisplayOrder = f.DisplayOrder,
                            ColSpan = f.ColSpan,
                            EligibilityRole = f.EligibilityRole.ToString(),
                            /* A field pointing at a shared list is served
                               that list's choices, so a reader of the form
                               sees ordinary options and needs to know
                               nothing about where they came from. Only the
                               ones still switched on: a choice withdrawn
                               stops being offered while the answers that
                               already name it keep reading. */
                            OptionSetId = f.OptionSetId,
                            OptionSetName = f.OptionSet?.Name,
                            Options = f.OptionSetId is null
                                ?
                                [
                                    .. f.Options.OrderBy(o => o.DisplayOrder)
                                        .Select(o => new FieldOptionDto { Value = o.Value, Label = o.Label }),
                                ]
                                :
                                [
                                    .. (f.OptionSet?.Items ?? [])
                                        .Where(i => i.Status == RecordStatus.Active)
                                        .OrderBy(i => i.DisplayOrder).ThenBy(i => i.Id)
                                        .Select(i => new FieldOptionDto { Value = i.Value, Label = i.Label }),
                                ],
                            Validation = new FieldValidationDto
                            {
                                Required = f.Validation.Required,
                                MinLength = f.Validation.MinLength,
                                MaxLength = f.Validation.MaxLength,
                                Min = f.Validation.Min,
                                Max = f.Validation.Max,
                                MinDate = f.Validation.MinDate,
                                MaxDate = f.Validation.MaxDate,
                                Pattern = f.Validation.Pattern,
                                AllowedExtensions = EnumMaps.SplitList(f.Validation.AllowedExtensions),
                                MaxFileSizeMb = f.Validation.MaxFileSizeMb,
                                MaxPhotos = f.Validation.MaxPhotos,
                            },
                            VisibleWhenFieldKey = f.VisibleWhenFieldKey,
                            VisibleWhenValues = EnumMaps.SplitList(f.VisibleWhenValues),
                        }),
                    ],
                }),
            ],
        };
        FillAudit(dto, e);
        return dto;
    }

    /* ------------------------------------------------------------- fee */

    public static FeeStructureDto ToDto(this FeeStructure e)
    {
        var taxable = e.Components.Where(c => c.IsTaxable).Sum(c => c.Amount);
        var nonTaxable = e.Components.Where(c => !c.IsTaxable).Sum(c => c.Amount);
        var gst = Math.Round(taxable * e.GstPercent / 100m, 2);

        var dto = new FeeStructureDto
        {
            Id = e.Id,
            ProgramTypeId = e.ProgramTypeId,
            ProgramTypeName = e.ProgramType?.Name,
            CategoryId = e.ProgramType?.CategoryId,
            CategoryName = e.ProgramType?.Category?.Name,
            SubCategoryId = e.ProgramType?.SubCategoryId,
            SubCategoryName = e.ProgramType?.SubCategory?.Name,
            Title = e.Title,
            Currency = e.Currency,
            GstPercent = e.GstPercent,
            TdsOptions = EnumMaps.SplitInts(e.TdsOptions),
            EffectiveFrom = e.EffectiveFrom,
            EffectiveTo = e.EffectiveTo,
            Status = e.Status.ToApi(),
            Components =
            [
                .. e.Components.Select(c => new FeeComponentDto
                {
                    Id = c.Id, Kind = c.Kind.ToApi(), Label = c.Label,
                    Amount = c.Amount, IsTaxable = c.IsTaxable,
                }),
            ],
            Concessions =
            [
                .. e.Concessions.Select(c => new FeeConcessionDto
                {
                    Id = c.Id, Label = c.Label, Percentage = c.Percentage, Remarks = c.Remarks,
                }),
            ],
            Totals = new FeeTotalsDto
            {
                Taxable = taxable,
                NonTaxable = nonTaxable,
                Gst = gst,
                Gross = Math.Round(taxable + nonTaxable + gst, 2),
            },
        };
        FillAudit(dto, e);
        return dto;
    }

    /* ------------------------------------------------------------ exam */

    public static ExamPaperDto ToDto(this ExamPaper e)
    {
        var dto = new ExamPaperDto
        {
            Id = e.Id,
            ProgramTypeId = e.ProgramTypeId,
            ProgramTypeName = e.ProgramType?.Name,
            CategoryId = e.ProgramType?.CategoryId,
            CategoryName = e.ProgramType?.Category?.Name,
            SubCategoryId = e.ProgramType?.SubCategoryId,
            SubCategoryName = e.ProgramType?.SubCategory?.Name,
            Code = e.Code,
            Title = e.Title,
            Instructions = e.Instructions,
            DurationMinutes = e.DurationMinutes,
            PassPercentage = e.PassPercentage,
            MaxAttempts = e.MaxAttempts,
            ShuffleQuestions = e.ShuffleQuestions,
            NegativeMarking = e.NegativeMarking,
            Status = e.Status.ToApi(),
            TotalMarks = e.Questions.Sum(q => q.Marks),
            Questions =
            [
                .. e.Questions.OrderBy(q => q.DisplayOrder).Select(q => new ExamQuestionDto
                {
                    Id = q.Id,
                    DisplayOrder = q.DisplayOrder,
                    Text = q.Text,
                    Type = q.Type.ToApi(),
                    Difficulty = q.Difficulty.ToApi(),
                    Marks = q.Marks,
                    NegativeMarks = q.NegativeMarks,
                    ModuleRef = q.ModuleRef,
                    Explanation = q.Explanation,
                    Options =
                    [
                        .. q.Options.OrderBy(o => o.DisplayOrder).Select(o => new ExamQuestionOptionDto
                        {
                            Id = o.Id, Text = o.Text, IsCorrect = o.IsCorrect,
                        }),
                    ],
                }),
            ],
        };
        FillAudit(dto, e);
        return dto;
    }

    /* -------------------------------------------------------- material */

    public static TrainingMaterialDto ToDto(this TrainingMaterial e)
    {
        var dto = new TrainingMaterialDto
        {
            Id = e.Id,
            Title = e.Title,
            Description = e.Description,
            Kind = e.Kind.ToApi(),
            CategoryId = e.CategoryId,
            CategoryName = e.Category?.Name,
            SubCategoryId = e.SubCategoryId,
            SubCategoryName = e.SubCategory?.Name,
            ProgramTypeId = e.ProgramTypeId,
            ProgramTypeName = e.ProgramType?.Name,
            CurriculumSessionId = e.CurriculumSessionId,
            FileName = e.FileName,
            FileSizeKb = e.FileSizeKb,
            MimeType = e.MimeType,
            Url = e.Url,
            DurationMinutes = e.DurationMinutes,
            Language = e.Language,
            VisibleToRoles = EnumMaps.SplitList(e.VisibleToRoles),
            Version = e.Version,
            PublishedOn = e.PublishedOn,
            DownloadAllowed = e.DownloadAllowed,
            Status = e.Status.ToApi(),
        };
        FillAudit(dto, e);
        return dto;
    }

    /* ---------------------------------------------------------- access */

    public static AdminRoleDto ToDto(this AdminRole e, int userCount = 0)
    {
        var dto = new AdminRoleDto
        {
            Id = e.Id,
            Name = e.Name,
            Code = e.Code,
            BaseRole = e.BaseRole.ToApi(),
            Description = e.Description,
            Permissions = [.. e.Permissions.Select(p => p.Permission).Order()],
            UserCount = userCount,
            IsSystemRole = e.IsSystemRole,
            IsDefault = e.OwnerUserId is null,
            /* Read from RoleHierarchy, which is the one definition of what
               a tier is allocated on. */
            Axes = e.BaseRole.ToAxesDto(),
            Status = e.Status.ToApi(),
        };
        FillAudit(dto, e);
        return dto;
    }

    /// <summary>The allocation axes of a tier, flattened for the browser.</summary>
    public static ScopeAxesDto ToAxesDto(this BaseRole role)
    {
        var axes = RoleHierarchy.AxesFor(role);
        return new ScopeAxesDto
        {
            Category = axes.HasFlag(ScopeAxis.Category),
            SubCategory = axes.HasFlag(ScopeAxis.SubCategory),
            ProgramType = axes.HasFlag(ScopeAxis.ProgramType),
            State = axes.HasFlag(ScopeAxis.State),
            District = axes.HasFlag(ScopeAxis.District),
        };
    }

    public static PortalUserDto ToDto(this PortalUser e)
    {
        var dto = new PortalUserDto
        {
            Id = e.Id,
            UserCode = e.UserCode,
            FullName = e.FullName,
            Email = e.Email,
            Mobile = e.Mobile,
            Designation = e.Designation,
            RoleId = e.RoleId,
            RoleName = e.Role?.Name,
            BaseRole = e.BaseRole.ToApi(),
            CategoryIds = [.. e.Categories.Select(x => x.CategoryId)],
            SubCategoryIds = [.. e.SubCategories.Select(x => x.SubCategoryId)],
            ProgramTypeIds = [.. e.ProgramTypes.Select(x => x.ProgramTypeId)],
            StateCodes = [.. e.States.Select(x => x.StateCode)],
            DistrictCodes = [.. e.Districts.Select(x => x.DistrictCode)],
            AgencyId = e.AgencyId,
            AgencyName = e.Agency?.Name,
            ReportsToUserId = e.ReportsToUserId,
            ReportsToName = e.ReportsToUser?.FullName,
            StateCode = e.StateCode,
            State = e.State?.Name,
            DistrictCode = e.DistrictCode,
            District = e.District?.Name,
            City = e.City,
            Pincode = e.Pincode,
            Pan = e.Pan,
            Aadhaar = e.Aadhaar,
            OrganisationName = e.OrganisationName,
            LastLoginOn = e.LastLoginOn,
            Status = e.Status.ToApi(),
        };
        FillAudit(dto, e);
        return dto;
    }

    public static ApplicantDto ToDto(this Applicant e)
    {
        var dto = new ApplicantDto
        {
            Id = e.Id,
            ApplicantCode = e.ApplicantCode,
            FullName = e.FullName,
            Email = e.Email,
            Mobile = e.Mobile,
            Pan = e.Pan,
            Gender = e.Gender?.ToString(),
            SocialCategory = e.SocialCategory?.ToString(),
            CategoryId = e.CategoryId,
            CategoryName = e.Category?.Name,
            SubCategoryId = e.SubCategoryId,
            SubCategoryName = e.SubCategory?.Name,
            EmailVerified = e.EmailVerified,
            MobileVerified = e.MobileVerified,
            KycStatus = e.KycStatus.ToApi(),
            StateCode = e.StateCode,
            State = e.State?.Name,
            DistrictCode = e.DistrictCode,
            District = e.District?.Name,
            City = e.City,
            RegisteredOn = e.RegisteredOn,
            LastLoginOn = e.LastLoginOn,
            IsBlocked = e.IsBlocked,
            Answers = [.. e.Answers
                .OrderBy(a => a.Id)
                .Select(a => new ApplicantAnswerDto
                {
                    Key = a.Key,
                    Label = a.Label,
                    Value = a.Value,
                })],
        };
        FillAudit(dto, e);
        return dto;
    }

    /* ---------------------------------------------------- applications */

    public static ApplicationDto ToDto(this TrainingApplication e)
    {
        var dto = new ApplicationDto
        {
            Id = e.Id,
            ApplicationNo = e.ApplicationNo,
            ApplicantId = e.ApplicantId,
            ApplicantName = e.Applicant?.FullName ?? string.Empty,
            ApplicantEmail = e.Applicant?.Email ?? string.Empty,
            ApplicantMobile = e.Applicant?.Mobile ?? string.Empty,
            Pan = e.Applicant?.Pan ?? string.Empty,
            CategoryId = e.CategoryId,
            CategoryName = e.Category?.Name,
            SubCategoryId = e.SubCategoryId,
            SubCategoryName = e.SubCategory?.Name,
            ProgramTypeId = e.ProgramTypeId,
            ProgramTypeName = e.ProgramType?.Name,
            Status = e.Status.ToApi(),
            SubmittedOn = e.SubmittedOn,
            AssignedToUserId = e.AssignedToUserId,
            AssignedToName = e.AssignedToUser?.FullName,
            PaymentStatus = e.PaymentStatus.ToApi(),
            FeeAmount = e.FeeAmount,
            TdsPercent = e.TdsPercent,
            RejectionReasonLabel = e.RejectionReasonLabel,
            Payments = [.. e.Payments
                .Where(p => p.Status != PaymentAttemptStatus.Initiated
                            && p.Status != PaymentAttemptStatus.Abandoned)
                .OrderByDescending(p => p.InitiatedOn)
                .Select(p => new PaymentTransactionDto
                {
                    Id = p.Id,
                    OrderId = p.OrderId,
                    ApplicationId = p.ApplicationId,
                    ApplicationNo = e.ApplicationNo,
                    ProgramTypeName = e.ProgramType?.Name,
                    FeeGross = p.FeeGross,
                    TdsAmount = p.TdsAmount,
                    Amount = p.Amount,
                    Currency = p.Currency,
                    Status = p.Status.ToString(),
                    Gateway = p.Gateway,
                    TestMode = p.TestMode,
                    Method = p.Method,
                    TrackingId = p.TrackingId,
                    BankReference = p.BankReference,
                    FailureReason = p.FailureReason,
                    InitiatedOn = p.InitiatedOn,
                    CompletedOn = p.CompletedOn,
                })],
            Tan = e.Tan,
            DeductorName = e.DeductorName,
            Score = e.Score,
            StateCode = e.StateCode,
            State = e.State?.Name,
            City = e.Applicant?.City,
            Responses = ParseJson(e.ResponsesJson),
            Documents =
            [
                .. e.Documents.Select(d => new ApplicationDocumentDto
                {
                    Id = d.Id, FieldKey = d.FieldKey, Label = d.Label, FileName = d.FileName,
                    FileSizeKb = d.FileSizeKb, UploadedOn = d.UploadedOn,
                    Verified = d.Verified, Remarks = d.Remarks,
                }),
            ],
            History =
            [
                .. e.History.OrderBy(h => h.On).Select(h => new ScrutinyEventDto
                {
                    Id = h.Id, Action = h.Action.ToApi(), ByUserName = h.ByUserName,
                    ByRole = h.ByRole, On = h.On, Remarks = h.Remarks,
                    RejectionReasonLabel = h.RejectionReasonLabel,
                }),
            ],
        };
        FillAudit(dto, e);
        return dto;
    }

    private static JsonElement ParseJson(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json);
            return document.RootElement.Clone();
        }
        catch (JsonException)
        {
            using var empty = JsonDocument.Parse("{}");
            return empty.RootElement.Clone();
        }
    }

    /* ------------------------------------------------------ programmes */

    public static ProgrammeDto ToDto(this Programme e)
    {
        var dto = new ProgrammeDto
        {
            Id = e.Id,
            ProgrammeId = e.ProgrammeId,
            PostponementReason = e.PostponementReason,
            PostponementRequestedOn = e.PostponementRequestedOn,
            ProgrammeName = e.ProgrammeName,
            CurriculumId = e.CurriculumId,
            ProgrammeCode = e.Curriculum?.ProgramType?.Code,
            CategoryId = e.CategoryId,
            CategoryName = e.Category?.Name,
            SubCategoryId = e.SubCategoryId,
            SubCategoryName = e.SubCategory?.Name,
            ProgramTypeId = e.ProgramTypeId,
            ProgramTypeName = e.ProgramType?.Name,
            AgencyId = e.AgencyId,
            AgencyName = e.Agency?.Name,
            CoordinatorId = e.CoordinatorId,
            CoordinatorName = e.Coordinator?.FullName,
            OperationManagerId = e.OperationManagerId,
            OperationManagerName = e.OperationManager?.FullName,
            Mode = e.Mode.ToApi(),
            Venue = e.Venue,
            City = e.City,
            Pincode = e.Pincode,
            StateCode = e.StateCode,
            State = e.State?.Name ?? string.Empty,
            MeetingPlatform = e.MeetingPlatform,
            MeetingLink = e.MeetingLink,
            StartDate = e.StartDate,
            EndDate = e.EndDate,
            StartTime = e.StartTime.ToString("HH\\:mm"),
            EndTime = e.EndTime.ToString("HH\\:mm"),
            MaxParticipants = e.MaxParticipants,
            ParticipantCount = e.ParticipantCount,
            CumulativeFeedback = e.CumulativeFeedback,
            Comments = e.Comments,
            RegistrationsOpen = e.RegistrationsOpen,
            ExamDateTime = e.ExamDateTime,
            ExamPaperId = e.ExamPaperId,
            ExamPaperTitle = e.ExamPaper?.Title,
            Status = e.Status.ToApi(),
            Sessions =
            [
                .. e.Sessions.OrderBy(s => s.SessionDate).Select(s => new ProgrammeSessionDto
                {
                    Id = s.Id,
                    SessionCode = s.SessionCode,
                    Title = s.Title,
                    SessionDate = s.SessionDate,
                    StartTime = s.StartTime.ToString("HH\\:mm"),
                    EndTime = s.EndTime.ToString("HH\\:mm"),
                    FacultyName = s.FacultyName,
                    PresentCount = s.PresentCount,
                    IsAttendanceLocked = s.IsAttendanceLocked,
                }),
            ],
            Participants =
            [
                .. e.Participants.Select(p => new ProgrammeParticipantDto
                {
                    Id = p.Id,
                    ApplicantId = p.ApplicantId,
                    ApplicationNo = p.Application?.ApplicationNo ?? string.Empty,
                    Name = p.Applicant?.FullName ?? string.Empty,
                    Email = p.Applicant?.Email ?? string.Empty,
                    Mobile = p.Applicant?.Mobile ?? string.Empty,
                    EnrolledOn = p.EnrolledOn,
                    AttendancePercent = p.AttendancePercent,
                    ExamScore = p.ExamScore,
                    Result = p.Result.ToApi(),
                    CertificateNo = p.CertificateNo,
                    FeedbackRating = p.FeedbackRating,
                }),
            ],
        };
        FillAudit(dto, e);
        return dto;
    }
}
