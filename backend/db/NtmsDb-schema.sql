IF OBJECT_ID(N'[__EFMigrationsHistory]') IS NULL
BEGIN
    CREATE TABLE [__EFMigrationsHistory] (
        [MigrationId] nvarchar(150) NOT NULL,
        [ProductVersion] nvarchar(32) NOT NULL,
        CONSTRAINT [PK___EFMigrationsHistory] PRIMARY KEY ([MigrationId])
    );
END;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [AdminRoles] (
        [Id] int NOT NULL IDENTITY,
        [Name] nvarchar(120) NOT NULL,
        [Code] nvarchar(60) NOT NULL,
        [BaseRole] varchar(40) NOT NULL,
        [Description] nvarchar(500) NULL,
        [IsSystemRole] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_AdminRoles] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [Categories] (
        [Id] int NOT NULL IDENTITY,
        [Code] nvarchar(20) NOT NULL,
        [Name] nvarchar(160) NOT NULL,
        [Description] nvarchar(500) NULL,
        [DisplayOrder] int NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_Categories] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [LgdStates] (
        [Code] int NOT NULL,
        [Name] nvarchar(120) NOT NULL,
        [IsUnionTerritory] bit NOT NULL,
        CONSTRAINT [PK_LgdStates] PRIMARY KEY ([Code])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [OtpChallenges] (
        [Id] int NOT NULL IDENTITY,
        [Channel] nvarchar(10) NOT NULL,
        [Destination] nvarchar(200) NOT NULL,
        [CodeHash] nvarchar(200) NOT NULL,
        [ExpiresOn] datetime2 NOT NULL,
        [Attempts] int NOT NULL,
        [IsUsed] bit NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        CONSTRAINT [PK_OtpChallenges] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [RolePermissions] (
        [Id] int NOT NULL IDENTITY,
        [RoleId] int NOT NULL,
        [Permission] nvarchar(80) NOT NULL,
        CONSTRAINT [PK_RolePermissions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RolePermissions_AdminRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AdminRoles] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [SubCategories] (
        [Id] int NOT NULL IDENTITY,
        [CategoryId] int NOT NULL,
        [Code] nvarchar(20) NOT NULL,
        [Name] nvarchar(160) NOT NULL,
        [Description] nvarchar(500) NULL,
        [DisplayOrder] int NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_SubCategories] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_SubCategories_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [LgdDistricts] (
        [Code] int NOT NULL,
        [StateCode] int NOT NULL,
        [Name] nvarchar(120) NOT NULL,
        CONSTRAINT [PK_LgdDistricts] PRIMARY KEY ([Code]),
        CONSTRAINT [FK_LgdDistricts_LgdStates_StateCode] FOREIGN KEY ([StateCode]) REFERENCES [LgdStates] ([Code]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [ProgramTypes] (
        [Id] int NOT NULL IDENTITY,
        [CategoryId] int NOT NULL,
        [SubCategoryId] int NOT NULL,
        [Code] nvarchar(20) NOT NULL,
        [Name] nvarchar(160) NOT NULL,
        [ShortDescription] nvarchar(500) NULL,
        [DurationDays] int NOT NULL,
        [DeliveryMode] varchar(40) NOT NULL,
        [MinQualification] nvarchar(200) NULL,
        [MinExperienceYears] int NOT NULL,
        [CertificateValidityMonths] int NOT NULL,
        [IsExamMandatory] bit NOT NULL,
        [IsFeeApplicable] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_ProgramTypes] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProgramTypes_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ProgramTypes_SubCategories_SubCategoryId] FOREIGN KEY ([SubCategoryId]) REFERENCES [SubCategories] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [Applicants] (
        [Id] int NOT NULL IDENTITY,
        [ApplicantCode] nvarchar(20) NOT NULL,
        [FullName] nvarchar(160) NOT NULL,
        [Email] nvarchar(200) NOT NULL,
        [Mobile] nvarchar(10) NOT NULL,
        [Pan] nvarchar(10) NOT NULL,
        [CategoryId] int NOT NULL,
        [SubCategoryId] int NOT NULL,
        [PasswordHash] nvarchar(400) NOT NULL,
        [EmailVerified] bit NOT NULL,
        [MobileVerified] bit NOT NULL,
        [KycStatus] varchar(40) NOT NULL,
        [StateCode] int NULL,
        [DistrictCode] int NULL,
        [City] nvarchar(120) NULL,
        [RegisteredOn] datetime2 NOT NULL,
        [LastLoginOn] datetime2 NULL,
        [IsBlocked] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_Applicants] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Applicants_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Applicants_LgdDistricts_DistrictCode] FOREIGN KEY ([DistrictCode]) REFERENCES [LgdDistricts] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Applicants_LgdStates_StateCode] FOREIGN KEY ([StateCode]) REFERENCES [LgdStates] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Applicants_SubCategories_SubCategoryId] FOREIGN KEY ([SubCategoryId]) REFERENCES [SubCategories] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [ImplementingAgencies] (
        [Id] int NOT NULL IDENTITY,
        [Code] nvarchar(30) NOT NULL,
        [Name] nvarchar(250) NOT NULL,
        [AgencyType] varchar(40) NOT NULL,
        [ContactPerson] nvarchar(120) NOT NULL,
        [Email] nvarchar(200) NOT NULL,
        [Mobile] nvarchar(10) NOT NULL,
        [Gstin] nvarchar(15) NULL,
        [Pan] nvarchar(10) NULL,
        [AddressLine1] nvarchar(250) NOT NULL,
        [AddressLine2] nvarchar(250) NULL,
        [City] nvarchar(120) NOT NULL,
        [StateCode] int NOT NULL,
        [DistrictCode] int NULL,
        [Pincode] nvarchar(6) NOT NULL,
        [EmpanelledOn] date NOT NULL,
        [EmpanelmentValidTill] date NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_ImplementingAgencies] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ImplementingAgencies_LgdDistricts_DistrictCode] FOREIGN KEY ([DistrictCode]) REFERENCES [LgdDistricts] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ImplementingAgencies_LgdStates_StateCode] FOREIGN KEY ([StateCode]) REFERENCES [LgdStates] ([Code]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [Curricula] (
        [Id] int NOT NULL IDENTITY,
        [ProgrammeCategory] varchar(40) NOT NULL,
        [ProgrammeCode] nvarchar(40) NOT NULL,
        [ProgrammeName] nvarchar(250) NOT NULL,
        [ProgramTypeId] int NULL,
        [Version] nvarchar(20) NOT NULL,
        [Objective] nvarchar(1000) NULL,
        [DurationDays] int NOT NULL,
        [EffectiveFrom] date NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_Curricula] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Curricula_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [ExamPapers] (
        [Id] int NOT NULL IDENTITY,
        [ProgramTypeId] int NOT NULL,
        [Code] nvarchar(40) NOT NULL,
        [Title] nvarchar(250) NOT NULL,
        [Instructions] nvarchar(2000) NULL,
        [DurationMinutes] int NOT NULL,
        [PassPercentage] decimal(18,2) NOT NULL,
        [MaxAttempts] int NOT NULL,
        [ShuffleQuestions] bit NOT NULL,
        [NegativeMarking] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_ExamPapers] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ExamPapers_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [FeeStructures] (
        [Id] int NOT NULL IDENTITY,
        [ProgramTypeId] int NOT NULL,
        [Title] nvarchar(200) NOT NULL,
        [Currency] nvarchar(3) NOT NULL,
        [GstPercent] decimal(18,2) NOT NULL,
        [TdsOptions] nvarchar(40) NOT NULL,
        [EffectiveFrom] date NOT NULL,
        [EffectiveTo] date NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_FeeStructures] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_FeeStructures_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [RegistrationForms] (
        [Id] int NOT NULL IDENTITY,
        [ProgramTypeId] int NOT NULL,
        [Version] nvarchar(20) NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_RegistrationForms] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RegistrationForms_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [AgencyCategories] (
        [AgencyId] int NOT NULL,
        [CategoryId] int NOT NULL,
        CONSTRAINT [PK_AgencyCategories] PRIMARY KEY ([AgencyId], [CategoryId]),
        CONSTRAINT [FK_AgencyCategories_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_AgencyCategories_ImplementingAgencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [ImplementingAgencies] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [AgencyProgramTypes] (
        [AgencyId] int NOT NULL,
        [ProgramTypeId] int NOT NULL,
        CONSTRAINT [PK_AgencyProgramTypes] PRIMARY KEY ([AgencyId], [ProgramTypeId]),
        CONSTRAINT [FK_AgencyProgramTypes_ImplementingAgencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [ImplementingAgencies] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_AgencyProgramTypes_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [AgencySubCategories] (
        [AgencyId] int NOT NULL,
        [SubCategoryId] int NOT NULL,
        CONSTRAINT [PK_AgencySubCategories] PRIMARY KEY ([AgencyId], [SubCategoryId]),
        CONSTRAINT [FK_AgencySubCategories_ImplementingAgencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [ImplementingAgencies] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_AgencySubCategories_SubCategories_SubCategoryId] FOREIGN KEY ([SubCategoryId]) REFERENCES [SubCategories] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [PortalUsers] (
        [Id] int NOT NULL IDENTITY,
        [UserCode] nvarchar(20) NOT NULL,
        [FullName] nvarchar(160) NOT NULL,
        [Email] nvarchar(200) NOT NULL,
        [Mobile] nvarchar(10) NOT NULL,
        [Designation] nvarchar(120) NULL,
        [PasswordHash] nvarchar(400) NOT NULL,
        [MustChangePassword] bit NOT NULL,
        [LastLoginOn] datetime2 NULL,
        [FailedLoginCount] int NOT NULL,
        [LockedOutUntil] datetime2 NULL,
        [RoleId] int NOT NULL,
        [BaseRole] varchar(40) NOT NULL,
        [AgencyId] int NULL,
        [ReportsToUserId] int NULL,
        [StateCode] int NULL,
        [DistrictCode] int NULL,
        [City] nvarchar(120) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_PortalUsers] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PortalUsers_AdminRoles_RoleId] FOREIGN KEY ([RoleId]) REFERENCES [AdminRoles] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_PortalUsers_ImplementingAgencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [ImplementingAgencies] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_PortalUsers_LgdDistricts_DistrictCode] FOREIGN KEY ([DistrictCode]) REFERENCES [LgdDistricts] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_PortalUsers_LgdStates_StateCode] FOREIGN KEY ([StateCode]) REFERENCES [LgdStates] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_PortalUsers_PortalUsers_ReportsToUserId] FOREIGN KEY ([ReportsToUserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [CurriculumSessions] (
        [Id] int NOT NULL IDENTITY,
        [CurriculumId] int NOT NULL,
        [SessionCode] nvarchar(60) NOT NULL,
        [SessionName] nvarchar(250) NOT NULL,
        [DisplayOrder] int NOT NULL,
        [Day] int NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_CurriculumSessions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_CurriculumSessions_Curricula_CurriculumId] FOREIGN KEY ([CurriculumId]) REFERENCES [Curricula] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [ExamQuestions] (
        [Id] int NOT NULL IDENTITY,
        [ExamPaperId] int NOT NULL,
        [DisplayOrder] int NOT NULL,
        [Text] nvarchar(1000) NOT NULL,
        [Type] varchar(40) NOT NULL,
        [Difficulty] varchar(40) NOT NULL,
        [Marks] decimal(18,2) NOT NULL,
        [NegativeMarks] decimal(18,2) NOT NULL,
        [ModuleRef] nvarchar(200) NULL,
        [Explanation] nvarchar(1000) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ExamQuestions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ExamQuestions_ExamPapers_ExamPaperId] FOREIGN KEY ([ExamPaperId]) REFERENCES [ExamPapers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [FeeComponents] (
        [Id] int NOT NULL IDENTITY,
        [FeeStructureId] int NOT NULL,
        [Kind] varchar(40) NOT NULL,
        [Label] nvarchar(200) NOT NULL,
        [Amount] decimal(18,2) NOT NULL,
        [IsTaxable] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_FeeComponents] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_FeeComponents_FeeStructures_FeeStructureId] FOREIGN KEY ([FeeStructureId]) REFERENCES [FeeStructures] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [FeeConcessions] (
        [Id] int NOT NULL IDENTITY,
        [FeeStructureId] int NOT NULL,
        [Label] nvarchar(200) NOT NULL,
        [Percentage] decimal(18,2) NOT NULL,
        [Remarks] nvarchar(500) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_FeeConcessions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_FeeConcessions_FeeStructures_FeeStructureId] FOREIGN KEY ([FeeStructureId]) REFERENCES [FeeStructures] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [RegistrationSections] (
        [Id] int NOT NULL IDENTITY,
        [FormId] int NOT NULL,
        [Title] nvarchar(200) NOT NULL,
        [Description] nvarchar(500) NULL,
        [DisplayOrder] int NOT NULL,
        [IsEnabled] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_RegistrationSections] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RegistrationSections_RegistrationForms_FormId] FOREIGN KEY ([FormId]) REFERENCES [RegistrationForms] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [Applications] (
        [Id] int NOT NULL IDENTITY,
        [ApplicationNo] nvarchar(40) NOT NULL,
        [ApplicantId] int NOT NULL,
        [ProgramTypeId] int NOT NULL,
        [CategoryId] int NOT NULL,
        [SubCategoryId] int NOT NULL,
        [RegistrationFormId] int NULL,
        [Status] varchar(40) NOT NULL,
        [SubmittedOn] datetime2 NULL,
        [AssignedToUserId] int NULL,
        [PaymentStatus] varchar(40) NOT NULL,
        [FeeAmount] decimal(18,2) NOT NULL,
        [TdsPercent] decimal(18,2) NOT NULL,
        [Tan] nvarchar(10) NULL,
        [DeductorName] nvarchar(200) NULL,
        [Score] decimal(18,2) NULL,
        [StateCode] int NULL,
        [DistrictCode] int NULL,
        [Responses] nvarchar(max) NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_Applications] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Applications_Applicants_ApplicantId] FOREIGN KEY ([ApplicantId]) REFERENCES [Applicants] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Applications_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Applications_LgdDistricts_DistrictCode] FOREIGN KEY ([DistrictCode]) REFERENCES [LgdDistricts] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Applications_LgdStates_StateCode] FOREIGN KEY ([StateCode]) REFERENCES [LgdStates] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Applications_PortalUsers_AssignedToUserId] FOREIGN KEY ([AssignedToUserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Applications_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Applications_RegistrationForms_RegistrationFormId] FOREIGN KEY ([RegistrationFormId]) REFERENCES [RegistrationForms] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Applications_SubCategories_SubCategoryId] FOREIGN KEY ([SubCategoryId]) REFERENCES [SubCategories] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [Programmes] (
        [Id] int NOT NULL IDENTITY,
        [ProgrammeId] nvarchar(30) NOT NULL,
        [ProgrammeName] nvarchar(250) NOT NULL,
        [CurriculumId] int NULL,
        [CategoryId] int NOT NULL,
        [SubCategoryId] int NOT NULL,
        [ProgramTypeId] int NOT NULL,
        [AgencyId] int NOT NULL,
        [CoordinatorId] int NOT NULL,
        [OperationManagerId] int NULL,
        [Mode] varchar(40) NOT NULL,
        [Venue] nvarchar(300) NOT NULL,
        [City] nvarchar(120) NULL,
        [StateCode] int NOT NULL,
        [DistrictCode] int NULL,
        [MeetingPlatform] nvarchar(120) NULL,
        [MeetingLink] nvarchar(500) NULL,
        [StartDate] date NOT NULL,
        [EndDate] date NOT NULL,
        [SeatCapacity] int NOT NULL,
        [ParticipantCount] int NOT NULL,
        [CumulativeFeedback] decimal(18,2) NULL,
        [Comments] nvarchar(1000) NULL,
        [RegistrationsOpen] bit NOT NULL,
        [ExamDateTime] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_Programmes] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Programmes_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Programmes_Curricula_CurriculumId] FOREIGN KEY ([CurriculumId]) REFERENCES [Curricula] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Programmes_ImplementingAgencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [ImplementingAgencies] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Programmes_LgdDistricts_DistrictCode] FOREIGN KEY ([DistrictCode]) REFERENCES [LgdDistricts] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Programmes_LgdStates_StateCode] FOREIGN KEY ([StateCode]) REFERENCES [LgdStates] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Programmes_PortalUsers_CoordinatorId] FOREIGN KEY ([CoordinatorId]) REFERENCES [PortalUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Programmes_PortalUsers_OperationManagerId] FOREIGN KEY ([OperationManagerId]) REFERENCES [PortalUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Programmes_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Programmes_SubCategories_SubCategoryId] FOREIGN KEY ([SubCategoryId]) REFERENCES [SubCategories] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [RefreshTokens] (
        [Id] int NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [Token] nvarchar(200) NOT NULL,
        [ExpiresOn] datetime2 NOT NULL,
        [CreatedOn] datetime2 NOT NULL,
        [RevokedOn] datetime2 NULL,
        CONSTRAINT [PK_RefreshTokens] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RefreshTokens_PortalUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [UserCategories] (
        [UserId] int NOT NULL,
        [CategoryId] int NOT NULL,
        CONSTRAINT [PK_UserCategories] PRIMARY KEY ([UserId], [CategoryId]),
        CONSTRAINT [FK_UserCategories_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_UserCategories_PortalUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [UserProgramTypes] (
        [UserId] int NOT NULL,
        [ProgramTypeId] int NOT NULL,
        CONSTRAINT [PK_UserProgramTypes] PRIMARY KEY ([UserId], [ProgramTypeId]),
        CONSTRAINT [FK_UserProgramTypes_PortalUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_UserProgramTypes_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [UserSubCategories] (
        [UserId] int NOT NULL,
        [SubCategoryId] int NOT NULL,
        CONSTRAINT [PK_UserSubCategories] PRIMARY KEY ([UserId], [SubCategoryId]),
        CONSTRAINT [FK_UserSubCategories_PortalUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_UserSubCategories_SubCategories_SubCategoryId] FOREIGN KEY ([SubCategoryId]) REFERENCES [SubCategories] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [CurriculumTopics] (
        [Id] int NOT NULL IDENTITY,
        [SessionId] int NOT NULL,
        [TopicCode] nvarchar(80) NOT NULL,
        [TopicName] nvarchar(250) NOT NULL,
        [DisplayOrder] int NOT NULL,
        [DurationMinutes] int NULL,
        [LearningOutcome] nvarchar(500) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_CurriculumTopics] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_CurriculumTopics_CurriculumSessions_SessionId] FOREIGN KEY ([SessionId]) REFERENCES [CurriculumSessions] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [TrainingMaterials] (
        [Id] int NOT NULL IDENTITY,
        [Title] nvarchar(250) NOT NULL,
        [Description] nvarchar(1000) NULL,
        [Kind] varchar(40) NOT NULL,
        [CategoryId] int NOT NULL,
        [SubCategoryId] int NOT NULL,
        [ProgramTypeId] int NOT NULL,
        [CurriculumSessionId] int NULL,
        [FileName] nvarchar(260) NULL,
        [FileSizeKb] bigint NULL,
        [MimeType] nvarchar(150) NULL,
        [Url] nvarchar(500) NULL,
        [DurationMinutes] int NULL,
        [Language] nvarchar(60) NOT NULL,
        [VisibleToRoles] nvarchar(200) NOT NULL,
        [Version] nvarchar(20) NOT NULL,
        [PublishedOn] date NOT NULL,
        [DownloadAllowed] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_TrainingMaterials] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_TrainingMaterials_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_TrainingMaterials_CurriculumSessions_CurriculumSessionId] FOREIGN KEY ([CurriculumSessionId]) REFERENCES [CurriculumSessions] ([Id]) ON DELETE SET NULL,
        CONSTRAINT [FK_TrainingMaterials_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_TrainingMaterials_SubCategories_SubCategoryId] FOREIGN KEY ([SubCategoryId]) REFERENCES [SubCategories] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [ExamQuestionOptions] (
        [Id] int NOT NULL IDENTITY,
        [QuestionId] int NOT NULL,
        [Text] nvarchar(500) NOT NULL,
        [IsCorrect] bit NOT NULL,
        [DisplayOrder] int NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ExamQuestionOptions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ExamQuestionOptions_ExamQuestions_QuestionId] FOREIGN KEY ([QuestionId]) REFERENCES [ExamQuestions] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [RegistrationFields] (
        [Id] int NOT NULL IDENTITY,
        [SectionId] int NOT NULL,
        [Key] nvarchar(80) NOT NULL,
        [Label] nvarchar(250) NOT NULL,
        [Type] varchar(40) NOT NULL,
        [IsEnabled] bit NOT NULL,
        [Placeholder] nvarchar(200) NULL,
        [HelpText] nvarchar(500) NULL,
        [DisplayOrder] int NOT NULL,
        [ColSpan] int NOT NULL,
        [Validation_Required] bit NOT NULL,
        [Validation_MinLength] int NULL,
        [Validation_MaxLength] int NULL,
        [Validation_Min] decimal(18,2) NULL,
        [Validation_Max] decimal(18,2) NULL,
        [Validation_Pattern] nvarchar(250) NULL,
        [Validation_AllowedExtensions] nvarchar(200) NULL,
        [Validation_MaxFileSizeMb] int NULL,
        [VisibleWhenFieldKey] nvarchar(80) NULL,
        [VisibleWhenValues] nvarchar(500) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_RegistrationFields] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RegistrationFields_RegistrationSections_SectionId] FOREIGN KEY ([SectionId]) REFERENCES [RegistrationSections] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [ApplicationDocuments] (
        [Id] int NOT NULL IDENTITY,
        [ApplicationId] int NOT NULL,
        [FieldKey] nvarchar(80) NOT NULL,
        [Label] nvarchar(250) NOT NULL,
        [FileName] nvarchar(260) NOT NULL,
        [FileSizeKb] bigint NOT NULL,
        [ContentType] nvarchar(150) NULL,
        [StoragePath] nvarchar(500) NULL,
        [UploadedOn] datetime2 NOT NULL,
        [Verified] bit NOT NULL,
        [Remarks] nvarchar(500) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ApplicationDocuments] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ApplicationDocuments_Applications_ApplicationId] FOREIGN KEY ([ApplicationId]) REFERENCES [Applications] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [ScrutinyEvents] (
        [Id] int NOT NULL IDENTITY,
        [ApplicationId] int NOT NULL,
        [Action] varchar(40) NOT NULL,
        [ByUserName] nvarchar(160) NOT NULL,
        [ByRole] nvarchar(60) NOT NULL,
        [On] datetime2 NOT NULL,
        [Remarks] nvarchar(1000) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ScrutinyEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ScrutinyEvents_Applications_ApplicationId] FOREIGN KEY ([ApplicationId]) REFERENCES [Applications] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [ProgrammeParticipants] (
        [Id] int NOT NULL IDENTITY,
        [ProgrammeId] int NOT NULL,
        [ApplicantId] int NOT NULL,
        [ApplicationId] int NULL,
        [EnrolledOn] date NOT NULL,
        [AttendancePercent] decimal(18,2) NOT NULL,
        [ExamScore] decimal(18,2) NULL,
        [Result] varchar(40) NOT NULL,
        [CertificateNo] nvarchar(60) NULL,
        [FeedbackRating] int NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ProgrammeParticipants] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProgrammeParticipants_Applicants_ApplicantId] FOREIGN KEY ([ApplicantId]) REFERENCES [Applicants] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ProgrammeParticipants_Applications_ApplicationId] FOREIGN KEY ([ApplicationId]) REFERENCES [Applications] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ProgrammeParticipants_Programmes_ProgrammeId] FOREIGN KEY ([ProgrammeId]) REFERENCES [Programmes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [ProgrammeSessions] (
        [Id] int NOT NULL IDENTITY,
        [ProgrammeId] int NOT NULL,
        [SessionCode] nvarchar(60) NULL,
        [Title] nvarchar(250) NOT NULL,
        [SessionDate] date NOT NULL,
        [StartTime] time NOT NULL,
        [EndTime] time NOT NULL,
        [FacultyName] nvarchar(160) NULL,
        [PresentCount] int NOT NULL,
        [IsAttendanceLocked] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ProgrammeSessions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProgrammeSessions_Programmes_ProgrammeId] FOREIGN KEY ([ProgrammeId]) REFERENCES [Programmes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [RegistrationFieldOptions] (
        [Id] int NOT NULL IDENTITY,
        [FieldId] int NOT NULL,
        [Value] nvarchar(120) NOT NULL,
        [Label] nvarchar(250) NOT NULL,
        [DisplayOrder] int NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_RegistrationFieldOptions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_RegistrationFieldOptions_RegistrationFields_FieldId] FOREIGN KEY ([FieldId]) REFERENCES [RegistrationFields] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE TABLE [AttendanceRecords] (
        [Id] int NOT NULL IDENTITY,
        [SessionId] int NOT NULL,
        [ParticipantId] int NOT NULL,
        [Present] bit NOT NULL,
        [MarkedOn] datetime2 NOT NULL,
        [MarkedBy] nvarchar(160) NULL,
        CONSTRAINT [PK_AttendanceRecords] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_AttendanceRecords_ProgrammeParticipants_ParticipantId] FOREIGN KEY ([ParticipantId]) REFERENCES [ProgrammeParticipants] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_AttendanceRecords_ProgrammeSessions_SessionId] FOREIGN KEY ([SessionId]) REFERENCES [ProgrammeSessions] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_AdminRoles_Code] ON [AdminRoles] ([Code]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AgencyCategories_CategoryId] ON [AgencyCategories] ([CategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AgencyProgramTypes_ProgramTypeId] ON [AgencyProgramTypes] ([ProgramTypeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AgencySubCategories_SubCategoryId] ON [AgencySubCategories] ([SubCategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Applicants_ApplicantCode] ON [Applicants] ([ApplicantCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applicants_CategoryId] ON [Applicants] ([CategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applicants_DistrictCode] ON [Applicants] ([DistrictCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applicants_Email] ON [Applicants] ([Email]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Applicants_Pan] ON [Applicants] ([Pan]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applicants_StateCode] ON [Applicants] ([StateCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applicants_SubCategoryId] ON [Applicants] ([SubCategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ApplicationDocuments_ApplicationId] ON [ApplicationDocuments] ([ApplicationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applications_ApplicantId] ON [Applications] ([ApplicantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Applications_ApplicationNo] ON [Applications] ([ApplicationNo]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applications_AssignedToUserId] ON [Applications] ([AssignedToUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applications_CategoryId] ON [Applications] ([CategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applications_DistrictCode] ON [Applications] ([DistrictCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applications_ProgramTypeId] ON [Applications] ([ProgramTypeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applications_RegistrationFormId] ON [Applications] ([RegistrationFormId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applications_StateCode] ON [Applications] ([StateCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applications_Status_SubmittedOn] ON [Applications] ([Status], [SubmittedOn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Applications_SubCategoryId] ON [Applications] ([SubCategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_AttendanceRecords_ParticipantId] ON [AttendanceRecords] ([ParticipantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_AttendanceRecords_SessionId_ParticipantId] ON [AttendanceRecords] ([SessionId], [ParticipantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Categories_Code] ON [Categories] ([Code]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Curricula_ProgrammeCode] ON [Curricula] ([ProgrammeCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Curricula_ProgramTypeId] ON [Curricula] ([ProgramTypeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_CurriculumSessions_CurriculumId_SessionCode] ON [CurriculumSessions] ([CurriculumId], [SessionCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_CurriculumTopics_SessionId] ON [CurriculumTopics] ([SessionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ExamPapers_Code] ON [ExamPapers] ([Code]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ExamPapers_ProgramTypeId] ON [ExamPapers] ([ProgramTypeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ExamQuestionOptions_QuestionId] ON [ExamQuestionOptions] ([QuestionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ExamQuestions_ExamPaperId] ON [ExamQuestions] ([ExamPaperId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_FeeComponents_FeeStructureId] ON [FeeComponents] ([FeeStructureId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_FeeConcessions_FeeStructureId] ON [FeeConcessions] ([FeeStructureId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_FeeStructures_ProgramTypeId_EffectiveFrom] ON [FeeStructures] ([ProgramTypeId], [EffectiveFrom]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ImplementingAgencies_Code] ON [ImplementingAgencies] ([Code]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ImplementingAgencies_DistrictCode] ON [ImplementingAgencies] ([DistrictCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ImplementingAgencies_Email] ON [ImplementingAgencies] ([Email]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ImplementingAgencies_StateCode] ON [ImplementingAgencies] ([StateCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_LgdDistricts_StateCode] ON [LgdDistricts] ([StateCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_LgdStates_Name] ON [LgdStates] ([Name]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_OtpChallenges_Destination_Channel] ON [OtpChallenges] ([Destination], [Channel]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_PortalUsers_AgencyId] ON [PortalUsers] ([AgencyId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_PortalUsers_DistrictCode] ON [PortalUsers] ([DistrictCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_PortalUsers_Email] ON [PortalUsers] ([Email]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_PortalUsers_ReportsToUserId] ON [PortalUsers] ([ReportsToUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_PortalUsers_RoleId] ON [PortalUsers] ([RoleId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_PortalUsers_StateCode] ON [PortalUsers] ([StateCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_PortalUsers_UserCode] ON [PortalUsers] ([UserCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ProgrammeParticipants_ApplicantId] ON [ProgrammeParticipants] ([ApplicantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ProgrammeParticipants_ApplicationId] ON [ProgrammeParticipants] ([ApplicationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ProgrammeParticipants_ProgrammeId_ApplicantId] ON [ProgrammeParticipants] ([ProgrammeId], [ApplicantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Programmes_AgencyId] ON [Programmes] ([AgencyId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Programmes_CategoryId] ON [Programmes] ([CategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Programmes_CoordinatorId] ON [Programmes] ([CoordinatorId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Programmes_CurriculumId] ON [Programmes] ([CurriculumId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Programmes_DistrictCode] ON [Programmes] ([DistrictCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Programmes_OperationManagerId] ON [Programmes] ([OperationManagerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Programmes_ProgrammeId] ON [Programmes] ([ProgrammeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Programmes_ProgramTypeId] ON [Programmes] ([ProgramTypeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Programmes_StateCode] ON [Programmes] ([StateCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Programmes_Status_StartDate] ON [Programmes] ([Status], [StartDate]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_Programmes_SubCategoryId] ON [Programmes] ([SubCategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ProgrammeSessions_ProgrammeId] ON [ProgrammeSessions] ([ProgrammeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ProgramTypes_CategoryId_SubCategoryId] ON [ProgramTypes] ([CategoryId], [SubCategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ProgramTypes_Code] ON [ProgramTypes] ([Code]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ProgramTypes_SubCategoryId] ON [ProgramTypes] ([SubCategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RefreshTokens_Token] ON [RefreshTokens] ([Token]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RefreshTokens_UserId] ON [RefreshTokens] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RegistrationFieldOptions_FieldId] ON [RegistrationFieldOptions] ([FieldId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RegistrationFields_SectionId_Key] ON [RegistrationFields] ([SectionId], [Key]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RegistrationForms_ProgramTypeId_Version] ON [RegistrationForms] ([ProgramTypeId], [Version]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_RegistrationSections_FormId] ON [RegistrationSections] ([FormId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RolePermissions_RoleId_Permission] ON [RolePermissions] ([RoleId], [Permission]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_ScrutinyEvents_ApplicationId] ON [ScrutinyEvents] ([ApplicationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_SubCategories_CategoryId] ON [SubCategories] ([CategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE UNIQUE INDEX [IX_SubCategories_Code] ON [SubCategories] ([Code]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_TrainingMaterials_CategoryId] ON [TrainingMaterials] ([CategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_TrainingMaterials_CurriculumSessionId] ON [TrainingMaterials] ([CurriculumSessionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_TrainingMaterials_ProgramTypeId] ON [TrainingMaterials] ([ProgramTypeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_TrainingMaterials_SubCategoryId] ON [TrainingMaterials] ([SubCategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_UserCategories_CategoryId] ON [UserCategories] ([CategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_UserProgramTypes_ProgramTypeId] ON [UserProgramTypes] ([ProgramTypeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    CREATE INDEX [IX_UserSubCategories_SubCategoryId] ON [UserSubCategories] ([SubCategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923012826_InitialCreate'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260923012826_InitialCreate', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923030323_AddBrandingSettings'
)
BEGIN
    CREATE TABLE [BrandingSettings] (
        [Id] int NOT NULL,
        [OrganisationName] nvarchar(200) NOT NULL,
        [ShortName] nvarchar(40) NOT NULL,
        [PortalTitle] nvarchar(200) NOT NULL,
        [Tagline] nvarchar(300) NULL,
        [SupportEmail] nvarchar(200) NULL,
        [LogoData] varbinary(max) NULL,
        [LogoFileName] nvarchar(260) NULL,
        [LogoContentType] nvarchar(100) NULL,
        [LogoVersion] int NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_BrandingSettings] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923030323_AddBrandingSettings'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260923030323_AddBrandingSettings', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923080628_AddPartnerLogo'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [PartnerLogoContentType] nvarchar(100) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923080628_AddPartnerLogo'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [PartnerLogoData] varbinary(max) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923080628_AddPartnerLogo'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [PartnerLogoFileName] nvarchar(260) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923080628_AddPartnerLogo'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [PartnerLogoVersion] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923080628_AddPartnerLogo'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [PartnerName] nvarchar(120) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923080628_AddPartnerLogo'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260923080628_AddPartnerLogo', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923100259_AddEmailSettingsAndTemplates'
)
BEGIN
    CREATE TABLE [EmailSettings] (
        [Id] int NOT NULL,
        [Enabled] bit NOT NULL,
        [Host] nvarchar(200) NULL,
        [Port] int NOT NULL,
        [UseSsl] bit NOT NULL,
        [UserName] nvarchar(200) NULL,
        [Password] nvarchar(400) NULL,
        [FromAddress] nvarchar(200) NULL,
        [FromName] nvarchar(200) NULL,
        [ReplyTo] nvarchar(200) NULL,
        [RedirectAllTo] nvarchar(200) NULL,
        [TimeoutSeconds] int NOT NULL,
        [OtpValidityMinutes] int NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_EmailSettings] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923100259_AddEmailSettingsAndTemplates'
)
BEGIN
    CREATE TABLE [EmailTemplates] (
        [Id] int NOT NULL IDENTITY,
        [Key] nvarchar(60) NOT NULL,
        [Name] nvarchar(120) NOT NULL,
        [Description] nvarchar(400) NOT NULL,
        [Subject] nvarchar(300) NOT NULL,
        [HtmlBody] nvarchar(max) NOT NULL,
        [PlainTextBody] nvarchar(max) NOT NULL,
        [Placeholders] nvarchar(400) NOT NULL,
        [IsEnabled] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_EmailTemplates] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923100259_AddEmailSettingsAndTemplates'
)
BEGIN
    CREATE UNIQUE INDEX [IX_EmailTemplates_Key] ON [EmailTemplates] ([Key]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923100259_AddEmailSettingsAndTemplates'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260923100259_AddEmailSettingsAndTemplates', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923104349_AddEmailLog'
)
BEGIN
    CREATE TABLE [EmailLog] (
        [Id] int NOT NULL IDENTITY,
        [SentOn] datetime2 NOT NULL,
        [TemplateKey] nvarchar(60) NOT NULL,
        [Recipient] nvarchar(200) NOT NULL,
        [Subject] nvarchar(300) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [Error] nvarchar(2000) NULL,
        [Host] nvarchar(200) NULL,
        CONSTRAINT [PK_EmailLog] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923104349_AddEmailLog'
)
BEGIN
    CREATE INDEX [IX_EmailLog_SentOn] ON [EmailLog] ([SentOn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923104349_AddEmailLog'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260923104349_AddEmailLog', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923134939_ScopeDelegationChain'
)
BEGIN
    CREATE TABLE [AgencyStates] (
        [AgencyId] int NOT NULL,
        [StateCode] int NOT NULL,
        CONSTRAINT [PK_AgencyStates] PRIMARY KEY ([AgencyId], [StateCode]),
        CONSTRAINT [FK_AgencyStates_ImplementingAgencies_AgencyId] FOREIGN KEY ([AgencyId]) REFERENCES [ImplementingAgencies] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_AgencyStates_LgdStates_StateCode] FOREIGN KEY ([StateCode]) REFERENCES [LgdStates] ([Code]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923134939_ScopeDelegationChain'
)
BEGIN
    CREATE TABLE [UserDistricts] (
        [UserId] int NOT NULL,
        [DistrictCode] int NOT NULL,
        CONSTRAINT [PK_UserDistricts] PRIMARY KEY ([UserId], [DistrictCode]),
        CONSTRAINT [FK_UserDistricts_LgdDistricts_DistrictCode] FOREIGN KEY ([DistrictCode]) REFERENCES [LgdDistricts] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_UserDistricts_PortalUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923134939_ScopeDelegationChain'
)
BEGIN
    CREATE TABLE [UserStates] (
        [UserId] int NOT NULL,
        [StateCode] int NOT NULL,
        CONSTRAINT [PK_UserStates] PRIMARY KEY ([UserId], [StateCode]),
        CONSTRAINT [FK_UserStates_LgdStates_StateCode] FOREIGN KEY ([StateCode]) REFERENCES [LgdStates] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_UserStates_PortalUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923134939_ScopeDelegationChain'
)
BEGIN
    CREATE INDEX [IX_AgencyStates_StateCode] ON [AgencyStates] ([StateCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923134939_ScopeDelegationChain'
)
BEGIN
    CREATE INDEX [IX_UserDistricts_DistrictCode] ON [UserDistricts] ([DistrictCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923134939_ScopeDelegationChain'
)
BEGIN
    CREATE INDEX [IX_UserStates_StateCode] ON [UserStates] ([StateCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923134939_ScopeDelegationChain'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260923134939_ScopeDelegationChain', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923232420_CurriculumKeyedOnProgramType'
)
BEGIN
    DROP INDEX [IX_Curricula_ProgrammeCode] ON [Curricula];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923232420_CurriculumKeyedOnProgramType'
)
BEGIN
    DROP INDEX [IX_Curricula_ProgramTypeId] ON [Curricula];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923232420_CurriculumKeyedOnProgramType'
)
BEGIN
    DECLARE @var nvarchar(max);
    SELECT @var = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Curricula]') AND [c].[name] = N'ProgrammeCategory');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [Curricula] DROP CONSTRAINT ' + @var + ';');
    ALTER TABLE [Curricula] DROP COLUMN [ProgrammeCategory];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923232420_CurriculumKeyedOnProgramType'
)
BEGIN
    DECLARE @var1 nvarchar(max);
    SELECT @var1 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Curricula]') AND [c].[name] = N'ProgrammeCode');
    IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [Curricula] DROP CONSTRAINT ' + @var1 + ';');
    ALTER TABLE [Curricula] DROP COLUMN [ProgrammeCode];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923232420_CurriculumKeyedOnProgramType'
)
BEGIN
    DECLARE @var2 nvarchar(max);
    SELECT @var2 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Curricula]') AND [c].[name] = N'ProgrammeName');
    IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [Curricula] DROP CONSTRAINT ' + @var2 + ';');
    ALTER TABLE [Curricula] DROP COLUMN [ProgrammeName];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923232420_CurriculumKeyedOnProgramType'
)
BEGIN
    DECLARE @var3 nvarchar(max);
    SELECT @var3 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Curricula]') AND [c].[name] = N'Version');
    IF @var3 IS NOT NULL EXEC(N'ALTER TABLE [Curricula] DROP CONSTRAINT ' + @var3 + ';');
    ALTER TABLE [Curricula] DROP COLUMN [Version];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923232420_CurriculumKeyedOnProgramType'
)
BEGIN
    DECLARE @var4 nvarchar(max);
    SELECT @var4 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Curricula]') AND [c].[name] = N'ProgramTypeId');
    IF @var4 IS NOT NULL EXEC(N'ALTER TABLE [Curricula] DROP CONSTRAINT ' + @var4 + ';');
    EXEC(N'UPDATE [Curricula] SET [ProgramTypeId] = 0 WHERE [ProgramTypeId] IS NULL');
    ALTER TABLE [Curricula] ALTER COLUMN [ProgramTypeId] int NOT NULL;
    ALTER TABLE [Curricula] ADD DEFAULT 0 FOR [ProgramTypeId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923232420_CurriculumKeyedOnProgramType'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Curricula_ProgramTypeId] ON [Curricula] ([ProgramTypeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923232420_CurriculumKeyedOnProgramType'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260923232420_CurriculumKeyedOnProgramType', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923235631_SessionAndTopicStatus'
)
BEGIN
    ALTER TABLE [CurriculumTopics] ADD [Status] varchar(40) NOT NULL DEFAULT 'Active';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923235631_SessionAndTopicStatus'
)
BEGIN
    ALTER TABLE [CurriculumSessions] ADD [Status] varchar(40) NOT NULL DEFAULT 'Active';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260923235631_SessionAndTopicStatus'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260923235631_SessionAndTopicStatus', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924013259_ApplicantGenderAndSocialCategory'
)
BEGIN
    ALTER TABLE [Applicants] ADD [Gender] varchar(40) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924013259_ApplicantGenderAndSocialCategory'
)
BEGIN
    ALTER TABLE [Applicants] ADD [SocialCategory] varchar(40) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924013259_ApplicantGenderAndSocialCategory'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260924013259_ApplicantGenderAndSocialCategory', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE TABLE [OnSpotParticipants] (
        [Id] int NOT NULL IDENTITY,
        [ProgrammeId] int NOT NULL,
        [FullName] nvarchar(160) NOT NULL,
        [Mobile] nvarchar(15) NOT NULL,
        [Email] nvarchar(200) NOT NULL,
        [EnterpriseName] nvarchar(250) NOT NULL,
        [Designation] nvarchar(160) NULL,
        [UdyamNumber] nvarchar(40) NOT NULL,
        [Gender] varchar(40) NULL,
        [SocialCategory] varchar(40) NULL,
        [StateCode] int NULL,
        [DistrictCode] int NULL,
        [IsPresent] bit NULL,
        [AttendanceMarkedOn] datetime2 NULL,
        [FeedbackRating] int NULL,
        [FeedbackComments] nvarchar(1000) NULL,
        [FeedbackOn] datetime2 NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_OnSpotParticipants] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_OnSpotParticipants_LgdDistricts_DistrictCode] FOREIGN KEY ([DistrictCode]) REFERENCES [LgdDistricts] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_OnSpotParticipants_LgdStates_StateCode] FOREIGN KEY ([StateCode]) REFERENCES [LgdStates] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_OnSpotParticipants_Programmes_ProgrammeId] FOREIGN KEY ([ProgrammeId]) REFERENCES [Programmes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE TABLE [ProgrammeSubmissions] (
        [Id] int NOT NULL IDENTITY,
        [ProgrammeId] int NOT NULL,
        [SubmittedByUserId] int NOT NULL,
        [SubmittedOn] datetime2 NOT NULL,
        [TrainerCount] int NOT NULL,
        [SessionCount] int NOT NULL,
        [ParticipantCount] int NOT NULL,
        [PresentCount] int NOT NULL,
        [PhotoCount] int NOT NULL,
        [Remarks] nvarchar(1000) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ProgrammeSubmissions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProgrammeSubmissions_PortalUsers_SubmittedByUserId] FOREIGN KEY ([SubmittedByUserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ProgrammeSubmissions_Programmes_ProgrammeId] FOREIGN KEY ([ProgrammeId]) REFERENCES [Programmes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE TABLE [ProgrammeTrainers] (
        [Id] int NOT NULL IDENTITY,
        [ProgrammeId] int NOT NULL,
        [FullName] nvarchar(160) NOT NULL,
        [Mobile] nvarchar(15) NOT NULL,
        [Email] nvarchar(200) NULL,
        [Designation] nvarchar(160) NULL,
        [Organisation] nvarchar(200) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ProgrammeTrainers] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProgrammeTrainers_Programmes_ProgrammeId] FOREIGN KEY ([ProgrammeId]) REFERENCES [Programmes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE TABLE [ProgrammeVenues] (
        [Id] int NOT NULL IDENTITY,
        [ProgrammeId] int NOT NULL,
        [Name] nvarchar(200) NOT NULL,
        [Address] nvarchar(500) NOT NULL,
        [Landmark] nvarchar(200) NULL,
        [Latitude] decimal(18,2) NULL,
        [Longitude] decimal(18,2) NULL,
        [AccuracyMetres] decimal(18,2) NULL,
        [GeoTaggedOn] datetime2 NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ProgrammeVenues] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProgrammeVenues_Programmes_ProgrammeId] FOREIGN KEY ([ProgrammeId]) REFERENCES [Programmes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE TABLE [MonitoringSessions] (
        [Id] int NOT NULL IDENTITY,
        [ProgrammeId] int NOT NULL,
        [TrainerId] int NOT NULL,
        [CurriculumSessionId] int NOT NULL,
        [CurriculumTopicId] int NOT NULL,
        [ConductedOn] datetime2 NOT NULL,
        [Comments] nvarchar(1000) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_MonitoringSessions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_MonitoringSessions_CurriculumSessions_CurriculumSessionId] FOREIGN KEY ([CurriculumSessionId]) REFERENCES [CurriculumSessions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_MonitoringSessions_CurriculumTopics_CurriculumTopicId] FOREIGN KEY ([CurriculumTopicId]) REFERENCES [CurriculumTopics] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_MonitoringSessions_ProgrammeTrainers_TrainerId] FOREIGN KEY ([TrainerId]) REFERENCES [ProgrammeTrainers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_MonitoringSessions_Programmes_ProgrammeId] FOREIGN KEY ([ProgrammeId]) REFERENCES [Programmes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE TABLE [MonitoringPhotos] (
        [Id] int NOT NULL IDENTITY,
        [ProgrammeId] int NOT NULL,
        [Kind] varchar(40) NOT NULL,
        [VenueId] int NULL,
        [SessionId] int NULL,
        [ParticipantId] int NULL,
        [RelativePath] nvarchar(400) NOT NULL,
        [FileName] nvarchar(260) NOT NULL,
        [ContentType] nvarchar(100) NOT NULL,
        [SizeBytes] bigint NOT NULL,
        [Latitude] decimal(18,2) NULL,
        [Longitude] decimal(18,2) NULL,
        [CapturedOn] datetime2 NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_MonitoringPhotos] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_MonitoringPhotos_MonitoringSessions_SessionId] FOREIGN KEY ([SessionId]) REFERENCES [MonitoringSessions] ([Id]),
        CONSTRAINT [FK_MonitoringPhotos_OnSpotParticipants_ParticipantId] FOREIGN KEY ([ParticipantId]) REFERENCES [OnSpotParticipants] ([Id]),
        CONSTRAINT [FK_MonitoringPhotos_ProgrammeVenues_VenueId] FOREIGN KEY ([VenueId]) REFERENCES [ProgrammeVenues] ([Id]),
        CONSTRAINT [FK_MonitoringPhotos_Programmes_ProgrammeId] FOREIGN KEY ([ProgrammeId]) REFERENCES [Programmes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_MonitoringPhotos_ParticipantId] ON [MonitoringPhotos] ([ParticipantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_MonitoringPhotos_ProgrammeId_Kind] ON [MonitoringPhotos] ([ProgrammeId], [Kind]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_MonitoringPhotos_SessionId] ON [MonitoringPhotos] ([SessionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_MonitoringPhotos_VenueId] ON [MonitoringPhotos] ([VenueId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_MonitoringSessions_CurriculumSessionId] ON [MonitoringSessions] ([CurriculumSessionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_MonitoringSessions_CurriculumTopicId] ON [MonitoringSessions] ([CurriculumTopicId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_MonitoringSessions_ProgrammeId] ON [MonitoringSessions] ([ProgrammeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_MonitoringSessions_TrainerId] ON [MonitoringSessions] ([TrainerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_OnSpotParticipants_DistrictCode] ON [OnSpotParticipants] ([DistrictCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_OnSpotParticipants_ProgrammeId] ON [OnSpotParticipants] ([ProgrammeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE UNIQUE INDEX [IX_OnSpotParticipants_ProgrammeId_Mobile] ON [OnSpotParticipants] ([ProgrammeId], [Mobile]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_OnSpotParticipants_StateCode] ON [OnSpotParticipants] ([StateCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ProgrammeSubmissions_ProgrammeId] ON [ProgrammeSubmissions] ([ProgrammeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_ProgrammeSubmissions_SubmittedByUserId] ON [ProgrammeSubmissions] ([SubmittedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE INDEX [IX_ProgrammeTrainers_ProgrammeId] ON [ProgrammeTrainers] ([ProgrammeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ProgrammeVenues_ProgrammeId] ON [ProgrammeVenues] ([ProgrammeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924024055_CoordinatorFieldMonitoring'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260924024055_CoordinatorFieldMonitoring', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924041007_CertificationPolicyAndTemplates'
)
BEGIN
    ALTER TABLE [ProgramTypes] ADD [CertificationPolicy] varchar(40) NOT NULL DEFAULT 'QualificationOnly';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924041007_CertificationPolicyAndTemplates'
)
BEGIN
    CREATE TABLE [CertificateTemplates] (
        [Id] int NOT NULL IDENTITY,
        [ProgramTypeId] int NOT NULL,
        [Kind] varchar(40) NOT NULL,
        [RelativePath] nvarchar(400) NOT NULL,
        [FileName] nvarchar(260) NOT NULL,
        [ContentType] nvarchar(120) NOT NULL,
        [SizeBytes] bigint NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_CertificateTemplates] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_CertificateTemplates_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924041007_CertificationPolicyAndTemplates'
)
BEGIN
    CREATE UNIQUE INDEX [IX_CertificateTemplates_ProgramTypeId_Kind] ON [CertificateTemplates] ([ProgramTypeId], [Kind]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924041007_CertificationPolicyAndTemplates'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260924041007_CertificationPolicyAndTemplates', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924042943_CertificateIssuance'
)
BEGIN
    CREATE TABLE [Certificates] (
        [Id] int NOT NULL IDENTITY,
        [Number] nvarchar(60) NOT NULL,
        [Kind] varchar(40) NOT NULL,
        [ParticipantId] int NOT NULL,
        [ProgrammeId] int NOT NULL,
        [ProgramTypeId] int NOT NULL,
        [RecipientName] nvarchar(200) NOT NULL,
        [ProgrammeName] nvarchar(250) NOT NULL,
        [ProgramTypeName] nvarchar(250) NOT NULL,
        [IssuedOn] date NOT NULL,
        [ValidTill] date NULL,
        [IssuedByUserId] int NOT NULL,
        [RevokedOn] datetime2 NULL,
        [RevokedReason] nvarchar(500) NULL,
        [RevokedByUserId] int NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_Certificates] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Certificates_PortalUsers_IssuedByUserId] FOREIGN KEY ([IssuedByUserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Certificates_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Certificates_ProgrammeParticipants_ParticipantId] FOREIGN KEY ([ParticipantId]) REFERENCES [ProgrammeParticipants] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Certificates_Programmes_ProgrammeId] FOREIGN KEY ([ProgrammeId]) REFERENCES [Programmes] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924042943_CertificateIssuance'
)
BEGIN
    CREATE INDEX [IX_Certificates_IssuedByUserId] ON [Certificates] ([IssuedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924042943_CertificateIssuance'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Certificates_Number] ON [Certificates] ([Number]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924042943_CertificateIssuance'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Certificates_ParticipantId] ON [Certificates] ([ParticipantId]) WHERE [RevokedOn] IS NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924042943_CertificateIssuance'
)
BEGIN
    CREATE INDEX [IX_Certificates_ProgrammeId] ON [Certificates] ([ProgrammeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924042943_CertificateIssuance'
)
BEGIN
    CREATE INDEX [IX_Certificates_ProgramTypeId_IssuedOn] ON [Certificates] ([ProgramTypeId], [IssuedOn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924042943_CertificateIssuance'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260924042943_CertificateIssuance', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924050410_MaxParticipantsRename'
)
BEGIN
    EXEC sp_rename N'[Programmes].[SeatCapacity]', N'MaxParticipants', 'COLUMN';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260924050410_MaxParticipantsRename'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260924050410_MaxParticipantsRename', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925002812_SignupFormAndPanVerification'
)
BEGIN
    CREATE TABLE [ApplicantAnswers] (
        [Id] int NOT NULL IDENTITY,
        [ApplicantId] int NOT NULL,
        [Key] nvarchar(80) NOT NULL,
        [Value] nvarchar(2000) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ApplicantAnswers] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ApplicantAnswers_Applicants_ApplicantId] FOREIGN KEY ([ApplicantId]) REFERENCES [Applicants] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925002812_SignupFormAndPanVerification'
)
BEGIN
    CREATE TABLE [SignupFields] (
        [Id] int NOT NULL IDENTITY,
        [Key] nvarchar(80) NOT NULL,
        [Label] nvarchar(250) NOT NULL,
        [Placeholder] nvarchar(200) NULL,
        [HelpText] nvarchar(500) NULL,
        [Type] varchar(40) NOT NULL,
        [Required] bit NOT NULL,
        [DisplayOrder] int NOT NULL,
        [IsBuiltIn] bit NOT NULL,
        [IsLocked] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_SignupFields] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925002812_SignupFormAndPanVerification'
)
BEGIN
    CREATE TABLE [SignupFieldOptions] (
        [Id] int NOT NULL IDENTITY,
        [FieldId] int NOT NULL,
        [Value] nvarchar(120) NOT NULL,
        [Label] nvarchar(250) NOT NULL,
        [DisplayOrder] int NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_SignupFieldOptions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_SignupFieldOptions_SignupFields_FieldId] FOREIGN KEY ([FieldId]) REFERENCES [SignupFields] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925002812_SignupFormAndPanVerification'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ApplicantAnswers_ApplicantId_Key] ON [ApplicantAnswers] ([ApplicantId], [Key]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925002812_SignupFormAndPanVerification'
)
BEGIN
    CREATE INDEX [IX_SignupFieldOptions_FieldId] ON [SignupFieldOptions] ([FieldId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925002812_SignupFormAndPanVerification'
)
BEGIN
    CREATE UNIQUE INDEX [IX_SignupFields_Key] ON [SignupFields] ([Key]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925002812_SignupFormAndPanVerification'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260925002812_SignupFormAndPanVerification', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925010407_BrandingLogoLinks'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [LogoLinkUrl] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925010407_BrandingLogoLinks'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [PartnerLogoLinkUrl] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925010407_BrandingLogoLinks'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260925010407_BrandingLogoLinks', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925012802_SiteTextOverrides'
)
BEGIN
    CREATE TABLE [SiteTexts] (
        [Id] int NOT NULL IDENTITY,
        [Key] nvarchar(120) NOT NULL,
        [Value] nvarchar(2000) NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_SiteTexts] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925012802_SiteTextOverrides'
)
BEGIN
    CREATE UNIQUE INDEX [IX_SiteTexts_Key] ON [SiteTexts] ([Key]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925012802_SiteTextOverrides'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260925012802_SiteTextOverrides', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925015143_EvaluationSchemeAndSkills'
)
BEGIN
    ALTER TABLE [ProgramTypes] ADD [Evaluation_Kind] varchar(40) NOT NULL DEFAULT 'Written';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925015143_EvaluationSchemeAndSkills'
)
BEGIN
    ALTER TABLE [ProgramTypes] ADD [Evaluation_OverallPassMarks] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925015143_EvaluationSchemeAndSkills'
)
BEGIN
    ALTER TABLE [ProgramTypes] ADD [Evaluation_TotalMarks] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925015143_EvaluationSchemeAndSkills'
)
BEGIN
    ALTER TABLE [ProgramTypes] ADD [Evaluation_VivaMarks] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925015143_EvaluationSchemeAndSkills'
)
BEGIN
    ALTER TABLE [ProgramTypes] ADD [Evaluation_VivaPassMarks] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925015143_EvaluationSchemeAndSkills'
)
BEGIN
    ALTER TABLE [ProgramTypes] ADD [Evaluation_WrittenMarks] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925015143_EvaluationSchemeAndSkills'
)
BEGIN
    ALTER TABLE [ProgramTypes] ADD [Evaluation_WrittenPassMarks] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925015143_EvaluationSchemeAndSkills'
)
BEGIN
    CREATE TABLE [EvaluationSkills] (
        [Id] int NOT NULL IDENTITY,
        [ProgramTypeId] int NOT NULL,
        [Name] nvarchar(160) NOT NULL,
        [Description] nvarchar(500) NULL,
        [MaxMarks] int NOT NULL,
        [DisplayOrder] int NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_EvaluationSkills] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_EvaluationSkills_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925015143_EvaluationSchemeAndSkills'
)
BEGIN
    CREATE UNIQUE INDEX [IX_EvaluationSkills_ProgramTypeId_Name] ON [EvaluationSkills] ([ProgramTypeId], [Name]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925015143_EvaluationSchemeAndSkills'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260925015143_EvaluationSchemeAndSkills', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925030434_ParticipantMarksheet'
)
BEGIN
    ALTER TABLE [ProgrammeParticipants] ADD [ResultRecordedOn] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925030434_ParticipantMarksheet'
)
BEGIN
    ALTER TABLE [ProgrammeParticipants] ADD [VivaMarks] decimal(18,2) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925030434_ParticipantMarksheet'
)
BEGIN
    ALTER TABLE [ProgrammeParticipants] ADD [WrittenMarks] decimal(18,2) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925030434_ParticipantMarksheet'
)
BEGIN
    CREATE TABLE [ParticipantSkillMarks] (
        [Id] int NOT NULL IDENTITY,
        [ParticipantId] int NOT NULL,
        [SkillId] int NOT NULL,
        [Marks] decimal(18,2) NOT NULL,
        [TrainerId] int NULL,
        [MarkedOn] datetime2 NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ParticipantSkillMarks] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ParticipantSkillMarks_EvaluationSkills_SkillId] FOREIGN KEY ([SkillId]) REFERENCES [EvaluationSkills] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ParticipantSkillMarks_ProgrammeParticipants_ParticipantId] FOREIGN KEY ([ParticipantId]) REFERENCES [ProgrammeParticipants] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ParticipantSkillMarks_ProgrammeTrainers_TrainerId] FOREIGN KEY ([TrainerId]) REFERENCES [ProgrammeTrainers] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925030434_ParticipantMarksheet'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ParticipantSkillMarks_ParticipantId_SkillId] ON [ParticipantSkillMarks] ([ParticipantId], [SkillId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925030434_ParticipantMarksheet'
)
BEGIN
    CREATE INDEX [IX_ParticipantSkillMarks_SkillId] ON [ParticipantSkillMarks] ([SkillId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925030434_ParticipantMarksheet'
)
BEGIN
    CREATE INDEX [IX_ParticipantSkillMarks_TrainerId] ON [ParticipantSkillMarks] ([TrainerId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925030434_ParticipantMarksheet'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260925030434_ParticipantMarksheet', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925033002_OnlineExamSitting'
)
BEGIN
    ALTER TABLE [Programmes] ADD [ExamPaperId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925033002_OnlineExamSitting'
)
BEGIN
    CREATE TABLE [ExamAttempts] (
        [Id] int NOT NULL IDENTITY,
        [ParticipantId] int NOT NULL,
        [ExamPaperId] int NOT NULL,
        [AttemptNo] int NOT NULL,
        [StartedOn] datetime2 NOT NULL,
        [ExpiresOn] datetime2 NOT NULL,
        [SubmittedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        [Score] decimal(18,2) NOT NULL,
        [PaperTotal] decimal(18,2) NOT NULL,
        [Percentage] decimal(18,2) NOT NULL,
        [Passed] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ExamAttempts] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ExamAttempts_ExamPapers_ExamPaperId] FOREIGN KEY ([ExamPaperId]) REFERENCES [ExamPapers] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ExamAttempts_ProgrammeParticipants_ParticipantId] FOREIGN KEY ([ParticipantId]) REFERENCES [ProgrammeParticipants] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925033002_OnlineExamSitting'
)
BEGIN
    CREATE TABLE [ExamAnswers] (
        [Id] int NOT NULL IDENTITY,
        [AttemptId] int NOT NULL,
        [QuestionId] int NOT NULL,
        [SelectedOptionIds] nvarchar(200) NOT NULL,
        [IsCorrect] bit NOT NULL,
        [MarksAwarded] decimal(18,2) NOT NULL,
        [AnsweredOn] datetime2 NOT NULL,
        CONSTRAINT [PK_ExamAnswers] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ExamAnswers_ExamAttempts_AttemptId] FOREIGN KEY ([AttemptId]) REFERENCES [ExamAttempts] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ExamAnswers_ExamQuestions_QuestionId] FOREIGN KEY ([QuestionId]) REFERENCES [ExamQuestions] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925033002_OnlineExamSitting'
)
BEGIN
    CREATE INDEX [IX_Programmes_ExamPaperId] ON [Programmes] ([ExamPaperId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925033002_OnlineExamSitting'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ExamAnswers_AttemptId_QuestionId] ON [ExamAnswers] ([AttemptId], [QuestionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925033002_OnlineExamSitting'
)
BEGIN
    CREATE INDEX [IX_ExamAnswers_QuestionId] ON [ExamAnswers] ([QuestionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925033002_OnlineExamSitting'
)
BEGIN
    CREATE INDEX [IX_ExamAttempts_ExamPaperId] ON [ExamAttempts] ([ExamPaperId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925033002_OnlineExamSitting'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ExamAttempts_ParticipantId_AttemptNo] ON [ExamAttempts] ([ParticipantId], [AttemptNo]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925033002_OnlineExamSitting'
)
BEGIN
    ALTER TABLE [Programmes] ADD CONSTRAINT [FK_Programmes_ExamPapers_ExamPaperId] FOREIGN KEY ([ExamPaperId]) REFERENCES [ExamPapers] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260925033002_OnlineExamSitting'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260925033002_OnlineExamSitting', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928041937_QualificationCatalogue'
)
BEGIN
    CREATE TABLE [Qualifications] (
        [Id] int NOT NULL IDENTITY,
        [Code] nvarchar(40) NOT NULL,
        [Label] nvarchar(160) NOT NULL,
        [Rank] int NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_Qualifications] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928041937_QualificationCatalogue'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Qualifications_Code] ON [Qualifications] ([Code]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928041937_QualificationCatalogue'
)
BEGIN
    CREATE INDEX [IX_Qualifications_Rank] ON [Qualifications] ([Rank]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928041937_QualificationCatalogue'
)
BEGIN
    IF NOT EXISTS (SELECT 1 FROM Qualifications)
    INSERT INTO Qualifications (Code, Label, [Rank], Status, CreatedOn, CreatedBy)
    VALUES
        ('NONE', 'No minimum', 0, 'Active', SYSUTCDATETIME(), 'system'),
        ('CLASS_8', 'Class 8 (Middle)', 10, 'Active', SYSUTCDATETIME(), 'system'),
        ('CLASS_10', 'Class 10 (Secondary)', 20, 'Active', SYSUTCDATETIME(), 'system'),
        ('CLASS_12', 'Class 12 (Higher Secondary)', 30, 'Active', SYSUTCDATETIME(), 'system'),
        ('ITI', 'ITI', 40, 'Active', SYSUTCDATETIME(), 'system'),
        ('DIPLOMA', 'Diploma', 50, 'Active', SYSUTCDATETIME(), 'system'),
        ('GRADUATION', 'Graduation', 60, 'Active', SYSUTCDATETIME(), 'system'),
        ('POST_GRADUATION', 'Post Graduation', 70, 'Active', SYSUTCDATETIME(), 'system'),
        ('DOCTORATE', 'Doctorate', 80, 'Active', SYSUTCDATETIME(), 'system');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928041937_QualificationCatalogue'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260928041937_QualificationCatalogue', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928043338_RepeatableFormSections'
)
BEGIN
    DROP INDEX [IX_RegistrationSections_FormId] ON [RegistrationSections];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928043338_RepeatableFormSections'
)
BEGIN
    ALTER TABLE [RegistrationSections] ADD [IsRepeatable] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928043338_RepeatableFormSections'
)
BEGIN
    ALTER TABLE [RegistrationSections] ADD [ItemLabel] nvarchar(80) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928043338_RepeatableFormSections'
)
BEGIN
    ALTER TABLE [RegistrationSections] ADD [Key] nvarchar(80) NOT NULL DEFAULT N'';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928043338_RepeatableFormSections'
)
BEGIN
    ALTER TABLE [RegistrationSections] ADD [MaxEntries] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928043338_RepeatableFormSections'
)
BEGIN
    ALTER TABLE [RegistrationSections] ADD [MinEntries] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928043338_RepeatableFormSections'
)
BEGIN
    EXEC(N'UPDATE RegistrationSections SET [Key] = ''s'' + CAST(Id AS nvarchar(20)) WHERE [Key] = '''' OR [Key] IS NULL;');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928043338_RepeatableFormSections'
)
BEGIN
    EXEC(N'UPDATE RegistrationSections SET MinEntries = 1, MaxEntries = 1 WHERE MaxEntries = 0;');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928043338_RepeatableFormSections'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RegistrationSections_FormId_Key] ON [RegistrationSections] ([FormId], [Key]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928043338_RepeatableFormSections'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260928043338_RepeatableFormSections', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928231911_AttemptQuestionCount'
)
BEGIN
    ALTER TABLE [ExamAttempts] ADD [QuestionCount] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928231911_AttemptQuestionCount'
)
BEGIN
    EXEC(N'
    UPDATE a
    SET a.QuestionCount = (
        SELECT COUNT(*) FROM ExamQuestions q WHERE q.ExamPaperId = a.ExamPaperId)
    FROM ExamAttempts a
    WHERE a.QuestionCount = 0;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928231911_AttemptQuestionCount'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260928231911_AttemptQuestionCount', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928234836_SystemSettingsAndSubCategorySignupForm'
)
BEGIN
    DROP INDEX [IX_SignupFields_Key] ON [SignupFields];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928234836_SystemSettingsAndSubCategorySignupForm'
)
BEGIN
    ALTER TABLE [SignupFields] ADD [SubCategoryId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928234836_SystemSettingsAndSubCategorySignupForm'
)
BEGIN
    CREATE TABLE [SystemSettings] (
        [Id] int NOT NULL,
        [MaintenanceMode] bit NOT NULL,
        [MaintenanceMessage] nvarchar(500) NULL,
        [MaintenanceUntil] datetime2 NULL,
        [PaymentGateway] nvarchar(40) NULL,
        [PaymentEnabled] bit NOT NULL,
        [PaymentTestMode] bit NOT NULL,
        [MerchantId] nvarchar(200) NULL,
        [AccessCode] nvarchar(400) NULL,
        [WorkingKey] nvarchar(400) NULL,
        [ReturnUrl] nvarchar(500) NULL,
        [CancelUrl] nvarchar(500) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_SystemSettings] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928234836_SystemSettingsAndSubCategorySignupForm'
)
BEGIN
    CREATE UNIQUE INDEX [IX_SignupFields_SubCategoryId_Key] ON [SignupFields] ([SubCategoryId], [Key]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928234836_SystemSettingsAndSubCategorySignupForm'
)
BEGIN
    ALTER TABLE [SignupFields] ADD CONSTRAINT [FK_SignupFields_SubCategories_SubCategoryId] FOREIGN KEY ([SubCategoryId]) REFERENCES [SubCategories] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260928234836_SystemSettingsAndSubCategorySignupForm'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260928234836_SystemSettingsAndSubCategorySignupForm', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929001343_OneRegistrationPerCategory'
)
BEGIN
    DROP INDEX [IX_Applicants_Pan] ON [Applicants];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929001343_OneRegistrationPerCategory'
)
BEGIN
    CREATE UNIQUE INDEX [IX_Applicants_Pan_CategoryId] ON [Applicants] ([Pan], [CategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929001343_OneRegistrationPerCategory'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260929001343_OneRegistrationPerCategory', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929015000_ProgramTypeFormRequirements'
)
BEGIN
    ALTER TABLE [ProgramTypes] ADD [RequiresRegistrationForm] bit NOT NULL DEFAULT CAST(1 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929015000_ProgramTypeFormRequirements'
)
BEGIN
    ALTER TABLE [ProgramTypes] ADD [RequiresSignupForm] bit NOT NULL DEFAULT CAST(1 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929015000_ProgramTypeFormRequirements'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260929015000_ProgramTypeFormRequirements', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929025538_UserStatusHistory'
)
BEGIN
    CREATE TABLE [UserStatusEvents] (
        [Id] int NOT NULL IDENTITY,
        [UserId] int NOT NULL,
        [FromStatus] varchar(40) NOT NULL,
        [ToStatus] varchar(40) NOT NULL,
        [Reason] nvarchar(500) NOT NULL,
        [ByUserId] int NULL,
        [ByUserName] nvarchar(160) NOT NULL,
        [ByUserCode] nvarchar(20) NOT NULL,
        [On] datetime2 NOT NULL,
        CONSTRAINT [PK_UserStatusEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_UserStatusEvents_PortalUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929025538_UserStatusHistory'
)
BEGIN
    WITH parents AS (
        SELECT BaseRole, MIN(Id) AS ParentId, COUNT(*) AS Candidates
        FROM PortalUsers
        WHERE Status = 'Active'
        GROUP BY BaseRole
    )
    UPDATE u
    SET u.ReportsToUserId = p.ParentId
    FROM PortalUsers u
    JOIN parents p ON p.BaseRole =
        CASE u.BaseRole
            WHEN 'Admin'            THEN 'SuperAdmin'
            WHEN 'Ministry'         THEN 'SuperAdmin'
            WHEN 'OperationManager' THEN 'Admin'
            WHEN 'AgencyAdmin'      THEN 'OperationManager'
            WHEN 'Coordinator'      THEN 'AgencyAdmin'
        END
    WHERE u.ReportsToUserId IS NULL
      AND u.BaseRole <> 'SuperAdmin'
      AND p.Candidates = 1;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929025538_UserStatusHistory'
)
BEGIN
    CREATE INDEX [IX_UserStatusEvents_UserId_On] ON [UserStatusEvents] ([UserId], [On]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929025538_UserStatusHistory'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260929025538_UserStatusHistory', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929035516_DynamicSignupAnswers'
)
BEGIN
    DROP INDEX [IX_Applicants_Pan_CategoryId] ON [Applicants];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929035516_DynamicSignupAnswers'
)
BEGIN
    ALTER TABLE [ApplicantAnswers] ADD [Label] nvarchar(200) NOT NULL DEFAULT N'';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929035516_DynamicSignupAnswers'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Applicants_Pan_CategoryId] ON [Applicants] ([Pan], [CategoryId]) WHERE [Pan] <> ''''');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929035516_DynamicSignupAnswers'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260929035516_DynamicSignupAnswers', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929071539_PaymentTransactions'
)
BEGIN
    ALTER TABLE [Applications] ADD [FeeGst] decimal(18,2) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929071539_PaymentTransactions'
)
BEGIN
    ALTER TABLE [Applications] ADD [FeeTaxable] decimal(18,2) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929071539_PaymentTransactions'
)
BEGIN
    CREATE TABLE [PaymentTransactions] (
        [Id] int NOT NULL IDENTITY,
        [OrderId] nvarchar(40) NOT NULL,
        [ApplicationId] int NOT NULL,
        [ApplicantId] int NOT NULL,
        [FeeGross] decimal(18,2) NOT NULL,
        [TdsAmount] decimal(18,2) NOT NULL,
        [Amount] decimal(18,2) NOT NULL,
        [Currency] nvarchar(3) NOT NULL,
        [Status] varchar(40) NOT NULL,
        [Gateway] nvarchar(40) NOT NULL,
        [TestMode] bit NOT NULL,
        [Method] nvarchar(80) NULL,
        [TrackingId] nvarchar(80) NULL,
        [BankReference] nvarchar(80) NULL,
        [FailureReason] nvarchar(500) NULL,
        [InitiatedOn] datetime2 NOT NULL,
        [CompletedOn] datetime2 NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_PaymentTransactions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PaymentTransactions_Applicants_ApplicantId] FOREIGN KEY ([ApplicantId]) REFERENCES [Applicants] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_PaymentTransactions_Applications_ApplicationId] FOREIGN KEY ([ApplicationId]) REFERENCES [Applications] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929071539_PaymentTransactions'
)
BEGIN
    CREATE INDEX [IX_PaymentTransactions_ApplicantId_InitiatedOn] ON [PaymentTransactions] ([ApplicantId], [InitiatedOn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929071539_PaymentTransactions'
)
BEGIN
    CREATE INDEX [IX_PaymentTransactions_ApplicationId] ON [PaymentTransactions] ([ApplicationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929071539_PaymentTransactions'
)
BEGIN
    CREATE UNIQUE INDEX [IX_PaymentTransactions_OrderId] ON [PaymentTransactions] ([OrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929071539_PaymentTransactions'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260929071539_PaymentTransactions', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929085839_UploadLimitAndPanSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [MaxUploadMb] int NOT NULL DEFAULT 64;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929085839_UploadLimitAndPanSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [PanApiKey] nvarchar(400) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929085839_UploadLimitAndPanSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [PanApiKeyHeader] nvarchar(80) NOT NULL DEFAULT N'X-API-KEY';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929085839_UploadLimitAndPanSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [PanEndpoint] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929085839_UploadLimitAndPanSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [PanNamePath] nvarchar(120) NOT NULL DEFAULT N'name';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929085839_UploadLimitAndPanSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [PanProvider] nvarchar(80) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929085839_UploadLimitAndPanSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [PanRefuseWhenUnavailable] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929085839_UploadLimitAndPanSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [PanTimeoutSeconds] int NOT NULL DEFAULT 10;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929085839_UploadLimitAndPanSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [PanValidPath] nvarchar(120) NOT NULL DEFAULT N'valid';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929085839_UploadLimitAndPanSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [PanVerificationEnabled] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929085839_UploadLimitAndPanSettings'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260929085839_UploadLimitAndPanSettings', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929234345_ReportingViews'
)
BEGIN
    EXEC(N'
    CREATE VIEW dbo.vwApplicants AS
    SELECT
        a.Id                AS ApplicantId,
        a.ApplicantCode,
        a.FullName,
        a.Email,
        a.Mobile,
        a.Pan,
        a.Gender,
        a.SocialCategory,
        a.CategoryId,
        c.Name              AS CategoryName,
        a.SubCategoryId,
        sc.Name             AS SubCategoryName,
        a.StateCode,
        st.Name             AS StateName,
        a.DistrictCode,
        d.Name              AS DistrictName,
        a.City,
        a.KycStatus,
        a.EmailVerified,
        a.MobileVerified,
        a.IsBlocked,
        a.RegisteredOn,
        a.LastLoginOn
    FROM dbo.Applicants a
    LEFT JOIN dbo.Categories    c  ON c.Id  = a.CategoryId
    LEFT JOIN dbo.SubCategories sc ON sc.Id = a.SubCategoryId
    LEFT JOIN dbo.LgdStates     st ON st.Code = a.StateCode
    LEFT JOIN dbo.LgdDistricts  d  ON d.Code  = a.DistrictCode;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929234345_ReportingViews'
)
BEGIN
    EXEC(N'
    CREATE VIEW dbo.vwApplications AS
    SELECT
        ap.Id               AS ApplicationId,
        ap.ApplicationNo,
        ap.Status,
        ap.SubmittedOn,
        ap.Score,
        a.Id                AS ApplicantId,
        a.ApplicantCode,
        a.FullName          AS ApplicantName,
        a.Pan               AS ApplicantPan,
        ap.CategoryId,
        c.Name              AS CategoryName,
        ap.SubCategoryId,
        sc.Name             AS SubCategoryName,
        ap.ProgramTypeId,
        pt.Name             AS ProgramTypeName,
        ap.StateCode,
        st.Name             AS StateName,
        ap.DistrictCode,
        d.Name              AS DistrictName,
        ap.PaymentStatus,
        ap.FeeAmount,
        ap.FeeTaxable,
        ap.FeeGst,
        ap.TdsPercent,
        ap.Tan,
        ap.AssignedToUserId,
        u.FullName          AS AssignedToName
    FROM dbo.Applications ap
    JOIN      dbo.Applicants    a  ON a.Id  = ap.ApplicantId
    LEFT JOIN dbo.Categories    c  ON c.Id  = ap.CategoryId
    LEFT JOIN dbo.SubCategories sc ON sc.Id = ap.SubCategoryId
    LEFT JOIN dbo.ProgramTypes  pt ON pt.Id = ap.ProgramTypeId
    LEFT JOIN dbo.LgdStates     st ON st.Code = ap.StateCode
    LEFT JOIN dbo.LgdDistricts  d  ON d.Code  = ap.DistrictCode
    LEFT JOIN dbo.PortalUsers   u  ON u.Id  = ap.AssignedToUserId;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929234345_ReportingViews'
)
BEGIN
    EXEC(N'
    CREATE VIEW dbo.vwProgrammes AS
    SELECT
        p.Id                AS ProgrammeKey,
        p.ProgrammeId       AS ProgrammeCode,
        p.ProgrammeName,
        p.Status,
        p.Mode,
        p.StartDate,
        p.EndDate,
        p.MaxParticipants,
        p.ParticipantCount,
        p.CumulativeFeedback,
        p.RegistrationsOpen,
        p.ExamDateTime,
        p.CategoryId,
        c.Name              AS CategoryName,
        p.SubCategoryId,
        sc.Name             AS SubCategoryName,
        p.ProgramTypeId,
        pt.Name             AS ProgramTypeName,
        p.AgencyId,
        ia.Name             AS AgencyName,
        p.Venue,
        p.City,
        p.StateCode,
        st.Name             AS StateName,
        p.DistrictCode,
        d.Name              AS DistrictName
    FROM dbo.Programmes p
    LEFT JOIN dbo.Categories          c  ON c.Id  = p.CategoryId
    LEFT JOIN dbo.SubCategories       sc ON sc.Id = p.SubCategoryId
    LEFT JOIN dbo.ProgramTypes        pt ON pt.Id = p.ProgramTypeId
    LEFT JOIN dbo.ImplementingAgencies ia ON ia.Id = p.AgencyId
    LEFT JOIN dbo.LgdStates           st ON st.Code = p.StateCode
    LEFT JOIN dbo.LgdDistricts        d  ON d.Code  = p.DistrictCode;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929234345_ReportingViews'
)
BEGIN
    EXEC(N'
    CREATE VIEW dbo.vwParticipants AS
    SELECT
        pp.Id               AS ParticipantId,
        pp.ProgrammeId      AS ProgrammeKey,
        p.ProgrammeId       AS ProgrammeCode,
        p.ProgrammeName,
        p.StartDate,
        p.EndDate,
        p.ProgramTypeId,
        pt.Name             AS ProgramTypeName,
        p.AgencyId,
        ia.Name             AS AgencyName,
        p.StateCode,
        st.Name             AS StateName,
        a.Id                AS ApplicantId,
        a.ApplicantCode,
        a.FullName          AS ApplicantName,
        a.Gender,
        a.SocialCategory,
        pp.ApplicationId,
        pp.EnrolledOn,
        pp.AttendancePercent,
        pp.WrittenMarks,
        pp.VivaMarks,
        pp.ExamScore,
        pp.Result,
        pp.ResultRecordedOn,
        pp.FeedbackRating,
        pp.CertificateNo,
        cert.IssuedOn       AS CertificateIssuedOn,
        cert.ValidTill      AS CertificateValidTill,
        cert.RevokedOn      AS CertificateRevokedOn
    FROM dbo.ProgrammeParticipants pp
    JOIN      dbo.Programmes           p  ON p.Id  = pp.ProgrammeId
    JOIN      dbo.Applicants           a  ON a.Id  = pp.ApplicantId
    LEFT JOIN dbo.ProgramTypes         pt ON pt.Id = p.ProgramTypeId
    LEFT JOIN dbo.ImplementingAgencies ia ON ia.Id = p.AgencyId
    LEFT JOIN dbo.LgdStates            st ON st.Code = p.StateCode
    LEFT JOIN dbo.Certificates         cert ON cert.ParticipantId = pp.Id
                                           AND cert.RevokedOn IS NULL;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929234345_ReportingViews'
)
BEGIN
    EXEC(N'
    CREATE VIEW dbo.vwPayments AS
    SELECT
        t.Id                AS PaymentId,
        t.OrderId,
        t.Status,
        t.Gateway,
        t.TestMode,
        t.Method,
        t.TrackingId,
        t.BankReference,
        t.FailureReason,
        t.FeeGross,
        t.TdsAmount,
        t.Amount,
        t.Currency,
        t.InitiatedOn,
        t.CompletedOn,
        ap.Id               AS ApplicationId,
        ap.ApplicationNo,
        ap.ProgramTypeId,
        pt.Name             AS ProgramTypeName,
        a.Id                AS ApplicantId,
        a.ApplicantCode,
        a.FullName          AS ApplicantName
    FROM dbo.PaymentTransactions t
    JOIN      dbo.Applications ap ON ap.Id = t.ApplicationId
    JOIN      dbo.Applicants   a  ON a.Id  = t.ApplicantId
    LEFT JOIN dbo.ProgramTypes pt ON pt.Id = ap.ProgramTypeId;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260929234345_ReportingViews'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260929234345_ReportingViews', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930004641_RejectionReasons'
)
BEGIN
    ALTER TABLE [ScrutinyEvents] ADD [RejectionReasonLabel] nvarchar(200) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930004641_RejectionReasons'
)
BEGIN
    ALTER TABLE [Applications] ADD [RejectionReasonId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930004641_RejectionReasons'
)
BEGIN
    ALTER TABLE [Applications] ADD [RejectionReasonLabel] nvarchar(200) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930004641_RejectionReasons'
)
BEGIN
    CREATE TABLE [RejectionReasons] (
        [Id] int NOT NULL IDENTITY,
        [Label] nvarchar(200) NOT NULL,
        [DisplayOrder] int NOT NULL,
        [RequiresNote] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_RejectionReasons] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930004641_RejectionReasons'
)
BEGIN
    CREATE INDEX [IX_Applications_RejectionReasonId] ON [Applications] ([RejectionReasonId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930004641_RejectionReasons'
)
BEGIN
    CREATE INDEX [IX_RejectionReasons_DisplayOrder] ON [RejectionReasons] ([DisplayOrder]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930004641_RejectionReasons'
)
BEGIN
    CREATE UNIQUE INDEX [IX_RejectionReasons_Label] ON [RejectionReasons] ([Label]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930004641_RejectionReasons'
)
BEGIN
    ALTER TABLE [Applications] ADD CONSTRAINT [FK_Applications_RejectionReasons_RejectionReasonId] FOREIGN KEY ([RejectionReasonId]) REFERENCES [RejectionReasons] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930004641_RejectionReasons'
)
BEGIN
    SET QUOTED_IDENTIFIER ON;
    INSERT INTO dbo.RejectionReasons
        (Label, DisplayOrder, RequiresNote, Status, CreatedOn)
    VALUES
        ('Documents are not legible',              10, 0, 'Active', GETUTCDATE()),
        ('Required documents are missing',         20, 1, 'Active', GETUTCDATE()),
        ('Documents do not match the details given', 30, 1, 'Active', GETUTCDATE()),
        ('PAN could not be verified',              40, 0, 'Active', GETUTCDATE()),
        ('Does not meet the minimum qualification', 50, 0, 'Active', GETUTCDATE()),
        ('Does not meet the experience requirement', 60, 0, 'Active', GETUTCDATE()),
        ('Already registered under this category', 70, 0, 'Active', GETUTCDATE()),
        ('Fee has not been paid',                  80, 0, 'Active', GETUTCDATE()),
        ('Other',                                  90, 1, 'Active', GETUTCDATE());
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930004641_RejectionReasons'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930004641_RejectionReasons', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930011259_BlockReasonsAndHistory'
)
BEGIN
    ALTER TABLE [Applicants] ADD [BlockReasonLabel] nvarchar(200) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930011259_BlockReasonsAndHistory'
)
BEGIN
    ALTER TABLE [Applicants] ADD [BlockedOn] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930011259_BlockReasonsAndHistory'
)
BEGIN
    CREATE TABLE [BlockReasons] (
        [Id] int NOT NULL IDENTITY,
        [Label] nvarchar(200) NOT NULL,
        [DisplayOrder] int NOT NULL,
        [RequiresNote] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_BlockReasons] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930011259_BlockReasonsAndHistory'
)
BEGIN
    CREATE TABLE [ApplicantStatusEvents] (
        [Id] int NOT NULL IDENTITY,
        [ApplicantId] int NOT NULL,
        [Blocked] bit NOT NULL,
        [BlockReasonId] int NULL,
        [ReasonLabel] nvarchar(200) NULL,
        [Remarks] nvarchar(1000) NULL,
        [ByUserId] int NULL,
        [ByUserName] nvarchar(160) NOT NULL,
        [ByUserCode] nvarchar(40) NOT NULL,
        [On] datetime2 NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ApplicantStatusEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ApplicantStatusEvents_Applicants_ApplicantId] FOREIGN KEY ([ApplicantId]) REFERENCES [Applicants] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ApplicantStatusEvents_BlockReasons_BlockReasonId] FOREIGN KEY ([BlockReasonId]) REFERENCES [BlockReasons] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930011259_BlockReasonsAndHistory'
)
BEGIN
    CREATE INDEX [IX_ApplicantStatusEvents_ApplicantId_On] ON [ApplicantStatusEvents] ([ApplicantId], [On]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930011259_BlockReasonsAndHistory'
)
BEGIN
    CREATE INDEX [IX_ApplicantStatusEvents_BlockReasonId] ON [ApplicantStatusEvents] ([BlockReasonId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930011259_BlockReasonsAndHistory'
)
BEGIN
    CREATE INDEX [IX_BlockReasons_DisplayOrder] ON [BlockReasons] ([DisplayOrder]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930011259_BlockReasonsAndHistory'
)
BEGIN
    CREATE UNIQUE INDEX [IX_BlockReasons_Label] ON [BlockReasons] ([Label]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930011259_BlockReasonsAndHistory'
)
BEGIN
    SET QUOTED_IDENTIFIER ON;
    INSERT INTO dbo.BlockReasons
        (Label, DisplayOrder, RequiresNote, Status, CreatedOn)
    VALUES
        ('Fraudulent or forged documents',       10, 1, 'Active', GETUTCDATE()),
        ('Impersonation or a false identity',    20, 1, 'Active', GETUTCDATE()),
        ('Duplicate account for the same person', 30, 1, 'Active', GETUTCDATE()),
        ('Misconduct during a programme',        40, 1, 'Active', GETUTCDATE()),
        ('Misconduct during an examination',     50, 1, 'Active', GETUTCDATE()),
        ('Requested by the applicant',           60, 0, 'Active', GETUTCDATE()),
        ('Directed by the ministry',             70, 1, 'Active', GETUTCDATE()),
        ('Other',                                80, 1, 'Active', GETUTCDATE());
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930011259_BlockReasonsAndHistory'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930011259_BlockReasonsAndHistory', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930013411_UnblockReasons'
)
BEGIN
    DROP INDEX [IX_BlockReasons_Label] ON [BlockReasons];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930013411_UnblockReasons'
)
BEGIN
    ALTER TABLE [BlockReasons] ADD [Kind] varchar(40) NOT NULL DEFAULT 'Block';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930013411_UnblockReasons'
)
BEGIN
    CREATE UNIQUE INDEX [IX_BlockReasons_Kind_Label] ON [BlockReasons] ([Kind], [Label]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930013411_UnblockReasons'
)
BEGIN
    EXEC(N'
    SET QUOTED_IDENTIFIER ON;
    INSERT INTO dbo.BlockReasons
        (Kind, Label, DisplayOrder, RequiresNote, Status, CreatedOn)
    VALUES
        (''Unblock'', ''Blocked in error'',                    10, 1, ''Active'', GETUTCDATE()),
        (''Unblock'', ''Documents since verified'',            20, 0, ''Active'', GETUTCDATE()),
        (''Unblock'', ''Identity since confirmed'',            30, 0, ''Active'', GETUTCDATE()),
        (''Unblock'', ''Appeal upheld'',                       40, 1, ''Active'', GETUTCDATE()),
        (''Unblock'', ''Suspension period completed'',         50, 0, ''Active'', GETUTCDATE()),
        (''Unblock'', ''Requested by the applicant'',          60, 0, ''Active'', GETUTCDATE()),
        (''Unblock'', ''Directed by the ministry'',            70, 1, ''Active'', GETUTCDATE()),
        (''Unblock'', ''Other'',                               80, 1, ''Active'', GETUTCDATE());
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930013411_UnblockReasons'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930013411_UnblockReasons', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930064532_ReversedBrandingLogo'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [ReversedLogoContentType] nvarchar(100) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930064532_ReversedBrandingLogo'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [ReversedLogoData] varbinary(max) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930064532_ReversedBrandingLogo'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [ReversedLogoFileName] nvarchar(260) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930064532_ReversedBrandingLogo'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [ReversedLogoVersion] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930064532_ReversedBrandingLogo'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930064532_ReversedBrandingLogo', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930073107_ErpInvoiceSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ErpApiKey] nvarchar(400) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930073107_ErpInvoiceSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ErpApiKeyHeader] nvarchar(80) NOT NULL DEFAULT N'X-API-KEY';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930073107_ErpInvoiceSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ErpInvoiceEnabled] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930073107_ErpInvoiceSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ErpInvoiceEndpoint] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930073107_ErpInvoiceSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ErpInvoiceNumberPath] nvarchar(120) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930073107_ErpInvoiceSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ErpInvoicePdfPath] nvarchar(120) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930073107_ErpInvoiceSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ErpInvoiceReference] nvarchar(40) NOT NULL DEFAULT N'OrderId';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930073107_ErpInvoiceSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ErpProvider] nvarchar(80) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930073107_ErpInvoiceSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ErpStoreInvoiceCopy] bit NOT NULL DEFAULT CAST(1 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930073107_ErpInvoiceSettings'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ErpTimeoutSeconds] int NOT NULL DEFAULT 30;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930073107_ErpInvoiceSettings'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930073107_ErpInvoiceSettings', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930074813_PaymentInvoiceCopy'
)
BEGIN
    CREATE TABLE [PaymentInvoices] (
        [Id] int NOT NULL IDENTITY,
        [PaymentTransactionId] int NOT NULL,
        [InvoiceNumber] nvarchar(80) NULL,
        [FileName] nvarchar(260) NOT NULL,
        [ContentType] nvarchar(100) NOT NULL,
        [Content] varbinary(max) NOT NULL,
        [FetchedOn] datetime2 NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_PaymentInvoices] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PaymentInvoices_PaymentTransactions_PaymentTransactionId] FOREIGN KEY ([PaymentTransactionId]) REFERENCES [PaymentTransactions] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930074813_PaymentInvoiceCopy'
)
BEGIN
    CREATE UNIQUE INDEX [IX_PaymentInvoices_PaymentTransactionId] ON [PaymentInvoices] ([PaymentTransactionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930074813_PaymentInvoiceCopy'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930074813_PaymentInvoiceCopy', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    EXEC sp_rename N'[RegistrationFieldOptions]', N'ProfileFieldOptions', 'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    EXEC sp_rename N'[RegistrationFields]', N'ProfileFields', 'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    EXEC sp_rename N'[RegistrationSections]', N'ProfileSections', 'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    EXEC sp_rename N'[RegistrationForms]', N'ProfileForms', 'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    EXEC sp_rename N'[Applications].[RegistrationFormId]', N'ProfileFormId', 'COLUMN';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    EXEC sp_rename N'[ProgramTypes].[RequiresRegistrationForm]', N'RequiresProfileForm', 'COLUMN';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF OBJECT_ID('PK_RegistrationFieldOptions') IS NOT NULL EXEC sp_rename N'PK_RegistrationFieldOptions', N'PK_ProfileFieldOptions', N'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF OBJECT_ID('PK_RegistrationFields') IS NOT NULL EXEC sp_rename N'PK_RegistrationFields', N'PK_ProfileFields', N'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF OBJECT_ID('PK_RegistrationSections') IS NOT NULL EXEC sp_rename N'PK_RegistrationSections', N'PK_ProfileSections', N'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF OBJECT_ID('PK_RegistrationForms') IS NOT NULL EXEC sp_rename N'PK_RegistrationForms', N'PK_ProfileForms', N'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF OBJECT_ID('FK_RegistrationFieldOptions_RegistrationFields_FieldId') IS NOT NULL EXEC sp_rename N'FK_RegistrationFieldOptions_RegistrationFields_FieldId', N'FK_ProfileFieldOptions_ProfileFields_FieldId', N'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF OBJECT_ID('FK_RegistrationFields_RegistrationSections_SectionId') IS NOT NULL EXEC sp_rename N'FK_RegistrationFields_RegistrationSections_SectionId', N'FK_ProfileFields_ProfileSections_SectionId', N'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF OBJECT_ID('FK_RegistrationSections_RegistrationForms_FormId') IS NOT NULL EXEC sp_rename N'FK_RegistrationSections_RegistrationForms_FormId', N'FK_ProfileSections_ProfileForms_FormId', N'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF OBJECT_ID('FK_RegistrationForms_ProgramTypes_ProgramTypeId') IS NOT NULL EXEC sp_rename N'FK_RegistrationForms_ProgramTypes_ProgramTypeId', N'FK_ProfileForms_ProgramTypes_ProgramTypeId', N'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF OBJECT_ID('FK_Applications_RegistrationForms_RegistrationFormId') IS NOT NULL EXEC sp_rename N'FK_Applications_RegistrationForms_RegistrationFormId', N'FK_Applications_ProfileForms_ProfileFormId', N'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes i
                                        JOIN sys.tables t ON t.object_id = i.object_id
                                        WHERE t.name = 'ProfileFieldOptions'
                                          AND i.name = 'IX_RegistrationFieldOptions_FieldId') EXEC sp_rename N'ProfileFieldOptions.IX_RegistrationFieldOptions_FieldId', N'IX_ProfileFieldOptions_FieldId', N'INDEX';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes i
                                        JOIN sys.tables t ON t.object_id = i.object_id
                                        WHERE t.name = 'ProfileFields'
                                          AND i.name = 'IX_RegistrationFields_SectionId_Key') EXEC sp_rename N'ProfileFields.IX_RegistrationFields_SectionId_Key', N'IX_ProfileFields_SectionId_Key', N'INDEX';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes i
                                        JOIN sys.tables t ON t.object_id = i.object_id
                                        WHERE t.name = 'ProfileSections'
                                          AND i.name = 'IX_RegistrationSections_FormId_Key') EXEC sp_rename N'ProfileSections.IX_RegistrationSections_FormId_Key', N'IX_ProfileSections_FormId_Key', N'INDEX';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes i
                                        JOIN sys.tables t ON t.object_id = i.object_id
                                        WHERE t.name = 'ProfileForms'
                                          AND i.name = 'IX_RegistrationForms_ProgramTypeId_Version') EXEC sp_rename N'ProfileForms.IX_RegistrationForms_ProgramTypeId_Version', N'IX_ProfileForms_ProgramTypeId_Version', N'INDEX';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes i
                                        JOIN sys.tables t ON t.object_id = i.object_id
                                        WHERE t.name = 'Applications'
                                          AND i.name = 'IX_Applications_RegistrationFormId') EXEC sp_rename N'Applications.IX_Applications_RegistrationFormId', N'IX_Applications_ProfileFormId', N'INDEX';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930215827_RegistrationFormBecomesProfileForm'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930215827_RegistrationFormBecomesProfileForm', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    ALTER TABLE [ProfileForms] ADD [SubCategoryId] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    EXEC(N'
    UPDATE f
    SET f.SubCategoryId = pt.SubCategoryId
    FROM ProfileForms f
    JOIN ProgramTypes pt ON pt.Id = f.ProgramTypeId;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    EXEC(N'
    WITH ranked AS (
        SELECT Id, SubCategoryId, Version,
               ROW_NUMBER() OVER (
                   PARTITION BY SubCategoryId ORDER BY Id DESC) AS rn
        FROM ProfileForms
    )
    UPDATE f
    SET f.Version = LEFT(f.Version, 12) + ''-'' + CAST(f.Id AS varchar(6)),
        f.Status = ''Inactive''
    FROM ProfileForms f
    JOIN ranked r ON r.Id = f.Id
    WHERE r.rn > 1;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    ALTER TABLE [SubCategories] ADD [RequiresSignupForm] bit NOT NULL DEFAULT CAST(1 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    ALTER TABLE [SubCategories] ADD [RequiresProfileForm] bit NOT NULL DEFAULT CAST(1 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    EXEC(N'
    UPDATE sc
    SET sc.RequiresSignupForm = CASE WHEN EXISTS (
            SELECT 1 FROM ProgramTypes pt
            WHERE pt.SubCategoryId = sc.Id AND pt.RequiresSignupForm = 1)
        THEN 1 ELSE 0 END,
        sc.RequiresProfileForm = CASE WHEN EXISTS (
            SELECT 1 FROM ProgramTypes pt
            WHERE pt.SubCategoryId = sc.Id AND pt.RequiresProfileForm = 1)
        THEN 1 ELSE 0 END
    FROM SubCategories sc
    WHERE EXISTS (SELECT 1 FROM ProgramTypes pt WHERE pt.SubCategoryId = sc.Id);
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    ALTER TABLE [ProfileForms] DROP CONSTRAINT [FK_ProfileForms_ProgramTypes_ProgramTypeId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    DROP INDEX [IX_ProfileForms_ProgramTypeId_Version] ON [ProfileForms];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    DECLARE @var5 nvarchar(max);
    SELECT @var5 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProfileForms]') AND [c].[name] = N'ProgramTypeId');
    IF @var5 IS NOT NULL EXEC(N'ALTER TABLE [ProfileForms] DROP CONSTRAINT ' + @var5 + ';');
    ALTER TABLE [ProfileForms] DROP COLUMN [ProgramTypeId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    DECLARE @var6 nvarchar(max);
    SELECT @var6 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProgramTypes]') AND [c].[name] = N'RequiresProfileForm');
    IF @var6 IS NOT NULL EXEC(N'ALTER TABLE [ProgramTypes] DROP CONSTRAINT ' + @var6 + ';');
    ALTER TABLE [ProgramTypes] DROP COLUMN [RequiresProfileForm];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    DECLARE @var7 nvarchar(max);
    SELECT @var7 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProgramTypes]') AND [c].[name] = N'RequiresSignupForm');
    IF @var7 IS NOT NULL EXEC(N'ALTER TABLE [ProgramTypes] DROP CONSTRAINT ' + @var7 + ';');
    ALTER TABLE [ProgramTypes] DROP COLUMN [RequiresSignupForm];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ProfileForms_SubCategoryId_Version] ON [ProfileForms] ([SubCategoryId], [Version]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    ALTER TABLE [ProfileForms] ADD CONSTRAINT [FK_ProfileForms_SubCategories_SubCategoryId] FOREIGN KEY ([SubCategoryId]) REFERENCES [SubCategories] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930221630_ProfileFormMovesToSubCategory'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930221630_ProfileFormMovesToSubCategory', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ProfileBlockMonths] int NOT NULL DEFAULT 6;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ProfileMaxAttempts] int NOT NULL DEFAULT 3;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    ALTER TABLE [SystemSettings] ADD [ProgramTypeMaxAttempts] int NOT NULL DEFAULT 3;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    ALTER TABLE [Applicants] ADD [ProfileBlockReason] nvarchar(max) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    ALTER TABLE [Applicants] ADD [ProfileBlockedUntil] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    CREATE TABLE [ProfileSubmissions] (
        [Id] int NOT NULL IDENTITY,
        [ApplicantId] int NOT NULL,
        [SubCategoryId] int NOT NULL,
        [ProfileFormId] int NULL,
        [AttemptNo] int NOT NULL,
        [Responses] nvarchar(max) NOT NULL,
        [Status] varchar(40) NOT NULL,
        [SubmittedOn] datetime2 NULL,
        [DecidedOn] datetime2 NULL,
        [DecidedByUserName] nvarchar(200) NULL,
        [RejectionReasonId] int NULL,
        [RejectionReasonLabel] nvarchar(200) NULL,
        [Remarks] nvarchar(1000) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ProfileSubmissions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProfileSubmissions_Applicants_ApplicantId] FOREIGN KEY ([ApplicantId]) REFERENCES [Applicants] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_ProfileSubmissions_ProfileForms_ProfileFormId] FOREIGN KEY ([ProfileFormId]) REFERENCES [ProfileForms] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ProfileSubmissions_RejectionReasons_RejectionReasonId] FOREIGN KEY ([RejectionReasonId]) REFERENCES [RejectionReasons] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ProfileSubmissions_SubCategories_SubCategoryId] FOREIGN KEY ([SubCategoryId]) REFERENCES [SubCategories] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    CREATE TABLE [ProfileScrutinyEvents] (
        [Id] int NOT NULL IDENTITY,
        [SubmissionId] int NOT NULL,
        [Action] varchar(40) NOT NULL,
        [ByUserName] nvarchar(200) NOT NULL,
        [ByRole] nvarchar(80) NOT NULL,
        [On] datetime2 NOT NULL,
        [Remarks] nvarchar(1000) NULL,
        [RejectionReasonLabel] nvarchar(200) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ProfileScrutinyEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProfileScrutinyEvents_ProfileSubmissions_SubmissionId] FOREIGN KEY ([SubmissionId]) REFERENCES [ProfileSubmissions] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    CREATE INDEX [IX_ProfileScrutinyEvents_SubmissionId] ON [ProfileScrutinyEvents] ([SubmissionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ProfileSubmissions_ApplicantId_AttemptNo] ON [ProfileSubmissions] ([ApplicantId], [AttemptNo]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    CREATE INDEX [IX_ProfileSubmissions_ProfileFormId] ON [ProfileSubmissions] ([ProfileFormId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    CREATE INDEX [IX_ProfileSubmissions_RejectionReasonId] ON [ProfileSubmissions] ([RejectionReasonId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    CREATE INDEX [IX_ProfileSubmissions_Status_SubmittedOn] ON [ProfileSubmissions] ([Status], [SubmittedOn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    CREATE INDEX [IX_ProfileSubmissions_SubCategoryId] ON [ProfileSubmissions] ([SubCategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN

                    INSERT INTO ProfileSubmissions
                        (ApplicantId, SubCategoryId, ProfileFormId, AttemptNo, Responses,
                         Status, SubmittedOn, DecidedOn, DecidedByUserName, CreatedOn, CreatedBy)
                    SELECT  a.Id,
                            a.SubCategoryId,
                            NULL,
                            1,
                            ISNULL(x.Responses, N'{}'),
                            'Approved',
                            ISNULL(x.SubmittedOn, a.RegisteredOn),
                            SYSUTCDATETIME(),
                            'Carried over',
                            SYSUTCDATETIME(),
                            'Migration'
                    FROM Applicants a
                    OUTER APPLY (
                        SELECT TOP 1 ap.Responses, ap.SubmittedOn
                        FROM Applications ap
                        WHERE ap.ApplicantId = a.Id
                          AND ap.Status IN ('Approved', 'Enrolled')
                        ORDER BY ap.SubmittedOn DESC
                    ) x
                    WHERE EXISTS (
                        SELECT 1 FROM Applications ap
                        WHERE ap.ApplicantId = a.Id
                          AND ap.Status IN ('Approved', 'Enrolled'))
                      AND NOT EXISTS (
                        SELECT 1 FROM ProfileSubmissions ps WHERE ps.ApplicantId = a.Id);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930223024_ProfileSubmissionsAndAttempts'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930223024_ProfileSubmissionsAndAttempts', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930230036_BatchRegistrationAndExamSelfie'
)
BEGIN
    ALTER TABLE [ExamAttempts] ADD [SelfieContentType] nvarchar(100) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930230036_BatchRegistrationAndExamSelfie'
)
BEGIN
    ALTER TABLE [ExamAttempts] ADD [SelfieData] varbinary(max) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930230036_BatchRegistrationAndExamSelfie'
)
BEGIN
    ALTER TABLE [ExamAttempts] ADD [SelfieTakenOn] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930230036_BatchRegistrationAndExamSelfie'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930230036_BatchRegistrationAndExamSelfie', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930231448_ProfileFieldEligibilityRole'
)
BEGIN
    ALTER TABLE [ProfileFields] ADD [EligibilityRole] varchar(40) NOT NULL DEFAULT 'None';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930231448_ProfileFieldEligibilityRole'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930231448_ProfileFieldEligibilityRole', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930233138_ProfilePhotoFields'
)
BEGIN
    ALTER TABLE [ProfileFields] ADD [Validation_MaxPhotos] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930233138_ProfilePhotoFields'
)
BEGIN
    CREATE TABLE [ProfilePhotos] (
        [Id] int NOT NULL IDENTITY,
        [ApplicantId] int NOT NULL,
        [FieldKey] nvarchar(80) NOT NULL,
        [DisplayOrder] int NOT NULL,
        [ContentType] nvarchar(100) NOT NULL,
        [Content] varbinary(max) NOT NULL,
        [CapturedOn] datetime2 NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_ProfilePhotos] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProfilePhotos_Applicants_ApplicantId] FOREIGN KEY ([ApplicantId]) REFERENCES [Applicants] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930233138_ProfilePhotoFields'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ProfilePhotos_ApplicantId_FieldKey_DisplayOrder] ON [ProfilePhotos] ([ApplicantId], [FieldKey], [DisplayOrder]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930233138_ProfilePhotoFields'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930233138_ProfilePhotoFields', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930234227_ProfileAttachmentsHoldFilesToo'
)
BEGIN
    EXEC sp_rename N'[ProfilePhotos]', N'ProfileAttachments', 'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930234227_ProfileAttachmentsHoldFilesToo'
)
BEGIN
    IF OBJECT_ID('PK_ProfilePhotos') IS NOT NULL EXEC sp_rename N'PK_ProfilePhotos', N'PK_ProfileAttachments', N'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930234227_ProfileAttachmentsHoldFilesToo'
)
BEGIN
    IF OBJECT_ID('FK_ProfilePhotos_Applicants_ApplicantId') IS NOT NULL EXEC sp_rename N'FK_ProfilePhotos_Applicants_ApplicantId', N'FK_ProfileAttachments_Applicants_ApplicantId', N'OBJECT';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930234227_ProfileAttachmentsHoldFilesToo'
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes i
                                        JOIN sys.tables t ON t.object_id = i.object_id
                                        WHERE t.name = 'ProfileAttachments'
                                          AND i.name = 'IX_ProfilePhotos_ApplicantId_FieldKey_DisplayOrder') EXEC sp_rename N'ProfileAttachments.IX_ProfilePhotos_ApplicantId_FieldKey_DisplayOrder', N'IX_ProfileAttachments_ApplicantId_FieldKey_DisplayOrder', N'INDEX';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930234227_ProfileAttachmentsHoldFilesToo'
)
BEGIN
    ALTER TABLE [ProfileAttachments] ADD [FileName] nvarchar(260) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260930234227_ProfileAttachmentsHoldFilesToo'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260930234227_ProfileAttachmentsHoldFilesToo', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001004254_ProfileFormScrutinyOptional'
)
BEGIN
    ALTER TABLE [ProfileForms] ADD [RequiresScrutiny] bit NOT NULL DEFAULT CAST(1 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001004254_ProfileFormScrutinyOptional'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261001004254_ProfileFormScrutinyOptional', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    EXEC(N'
    IF EXISTS (SELECT 1 FROM Applicants WHERE Pan <> '''' GROUP BY Pan HAVING COUNT(*) > 1)
        THROW 50000, ''Two or more accounts share a PAN. One account now covers every category, so these have to be merged by hand before this migration can run. SELECT Pan, COUNT(*) FROM Applicants WHERE Pan <> '''''''' GROUP BY Pan HAVING COUNT(*) > 1 lists them.'', 1;

    IF EXISTS (SELECT 1 FROM SignupFields WHERE SubCategoryId IS NOT NULL)
        THROW 50000, ''A sub-category has its own sign-up form. There is one sign-up form now, so decide which fields belong on it and remove the rest before this migration can run. SELECT * FROM SignupFields WHERE SubCategoryId IS NOT NULL lists them.'', 1;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN

    DELETE o FROM SignupFieldOptions o
    JOIN SignupFields f ON f.Id = o.FieldId
    WHERE f.[Key] IN ('categoryId', 'subCategoryId');

    DELETE FROM SignupFields WHERE [Key] IN ('categoryId', 'subCategoryId');

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    ALTER TABLE [SignupFields] DROP CONSTRAINT [FK_SignupFields_SubCategories_SubCategoryId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    DROP INDEX [IX_SignupFields_SubCategoryId_Key] ON [SignupFields];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    DROP INDEX [IX_ProfileSubmissions_ApplicantId_AttemptNo] ON [ProfileSubmissions];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    DROP INDEX [IX_ProfileAttachments_ApplicantId_FieldKey_DisplayOrder] ON [ProfileAttachments];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    DROP INDEX [IX_Applicants_Pan_CategoryId] ON [Applicants];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    DECLARE @var8 nvarchar(max);
    SELECT @var8 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[SignupFields]') AND [c].[name] = N'SubCategoryId');
    IF @var8 IS NOT NULL EXEC(N'ALTER TABLE [SignupFields] DROP CONSTRAINT ' + @var8 + ';');
    ALTER TABLE [SignupFields] DROP COLUMN [SubCategoryId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    DECLARE @var9 nvarchar(max);
    SELECT @var9 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Applicants]') AND [c].[name] = N'ProfileBlockReason');
    IF @var9 IS NOT NULL EXEC(N'ALTER TABLE [Applicants] DROP CONSTRAINT ' + @var9 + ';');
    ALTER TABLE [Applicants] DROP COLUMN [ProfileBlockReason];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    DECLARE @var10 nvarchar(max);
    SELECT @var10 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Applicants]') AND [c].[name] = N'ProfileBlockedUntil');
    IF @var10 IS NOT NULL EXEC(N'ALTER TABLE [Applicants] DROP CONSTRAINT ' + @var10 + ';');
    ALTER TABLE [Applicants] DROP COLUMN [ProfileBlockedUntil];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    ALTER TABLE [ProfileSubmissions] ADD [CategoryId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    EXEC(N'
    UPDATE s SET s.CategoryId = c.CategoryId
    FROM ProfileSubmissions s
    JOIN SubCategories c ON c.Id = s.SubCategoryId
    WHERE s.CategoryId IS NULL;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    EXEC(N'
    IF EXISTS (SELECT 1 FROM ProfileSubmissions WHERE CategoryId IS NULL)
        THROW 50000, ''A profile submission names a sub-category that does not exist, so its category cannot be worked out. Fix those rows before this migration can run.'', 1;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    DECLARE @var11 nvarchar(max);
    SELECT @var11 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProfileSubmissions]') AND [c].[name] = N'CategoryId');
    IF @var11 IS NOT NULL EXEC(N'ALTER TABLE [ProfileSubmissions] DROP CONSTRAINT ' + @var11 + ';');
    ALTER TABLE [ProfileSubmissions] ALTER COLUMN [CategoryId] int NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    ALTER TABLE [ProfileAttachments] ADD [SubCategoryId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    EXEC(N'
    UPDATE a SET a.SubCategoryId = p.SubCategoryId
    FROM ProfileAttachments a
    JOIN Applicants p ON p.Id = a.ApplicantId
    WHERE a.SubCategoryId IS NULL AND p.SubCategoryId IS NOT NULL;

    DELETE FROM ProfileAttachments WHERE SubCategoryId IS NULL;
    ');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    DECLARE @var12 nvarchar(max);
    SELECT @var12 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProfileAttachments]') AND [c].[name] = N'SubCategoryId');
    IF @var12 IS NOT NULL EXEC(N'ALTER TABLE [ProfileAttachments] DROP CONSTRAINT ' + @var12 + ';');
    ALTER TABLE [ProfileAttachments] ALTER COLUMN [SubCategoryId] int NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    DECLARE @var13 nvarchar(max);
    SELECT @var13 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Applicants]') AND [c].[name] = N'SubCategoryId');
    IF @var13 IS NOT NULL EXEC(N'ALTER TABLE [Applicants] DROP CONSTRAINT ' + @var13 + ';');
    ALTER TABLE [Applicants] ALTER COLUMN [SubCategoryId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    DECLARE @var14 nvarchar(max);
    SELECT @var14 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Applicants]') AND [c].[name] = N'CategoryId');
    IF @var14 IS NOT NULL EXEC(N'ALTER TABLE [Applicants] DROP CONSTRAINT ' + @var14 + ';');
    ALTER TABLE [Applicants] ALTER COLUMN [CategoryId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    CREATE UNIQUE INDEX [IX_SignupFields_Key] ON [SignupFields] ([Key]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ProfileSubmissions_ApplicantId_SubCategoryId_AttemptNo] ON [ProfileSubmissions] ([ApplicantId], [SubCategoryId], [AttemptNo]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    CREATE INDEX [IX_ProfileSubmissions_CategoryId] ON [ProfileSubmissions] ([CategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ProfileAttachments_ApplicantId_SubCategoryId_FieldKey_DisplayOrder] ON [ProfileAttachments] ([ApplicantId], [SubCategoryId], [FieldKey], [DisplayOrder]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    CREATE INDEX [IX_ProfileAttachments_SubCategoryId] ON [ProfileAttachments] ([SubCategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_Applicants_Pan] ON [Applicants] ([Pan]) WHERE [Pan] <> ''''');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    ALTER TABLE [ProfileAttachments] ADD CONSTRAINT [FK_ProfileAttachments_SubCategories_SubCategoryId] FOREIGN KEY ([SubCategoryId]) REFERENCES [SubCategories] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    ALTER TABLE [ProfileSubmissions] ADD CONSTRAINT [FK_ProfileSubmissions_Categories_CategoryId] FOREIGN KEY ([CategoryId]) REFERENCES [Categories] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001010450_ApplicantHoldsAProfilePerCategory'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261001010450_ApplicantHoldsAProfilePerCategory', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001025140_RaisingAProgramIsItsOwnPermission'
)
BEGIN

    INSERT INTO RolePermissions (RoleId, Permission)
    SELECT r.Id, 'programs.create'
    FROM AdminRoles r
    WHERE r.BaseRole = 'AgencyAdmin'
      AND NOT EXISTS (
          SELECT 1 FROM RolePermissions p
          WHERE p.RoleId = r.Id AND p.Permission = 'programs.create'
      );

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001025140_RaisingAProgramIsItsOwnPermission'
)
BEGIN

    DELETE p FROM RolePermissions p
    JOIN AdminRoles r ON r.Id = p.RoleId
    WHERE r.BaseRole = 'SuperAdmin'
      AND p.Permission IN (
          'agencies.manage',
          'coordinators.manage',
          'programs.create',
          'programs.manage',
          'applications.scrutinise'
      );

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001025140_RaisingAProgramIsItsOwnPermission'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261001025140_RaisingAProgramIsItsOwnPermission', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001031002_SystemRolesBackToTheirSeededSets'
)
BEGIN

    SET NOCOUNT ON;

    DECLARE @sets TABLE (Code nvarchar(60), Permission nvarchar(80));

    INSERT INTO @sets (Code, Permission) VALUES
     -- Owns the masters, the roles and the portal. Appoints the tier below it,
     -- and does not hold the operational grants that belong to that tier.
     ('SUPER_ADMIN', 'masters.view'),         ('SUPER_ADMIN', 'masters.manage'),
     ('SUPER_ADMIN', 'curriculum.view'),      ('SUPER_ADMIN', 'curriculum.manage'),
     ('SUPER_ADMIN', 'fees.view'),            ('SUPER_ADMIN', 'fees.manage'),
     ('SUPER_ADMIN', 'exams.view'),           ('SUPER_ADMIN', 'exams.manage'),
     ('SUPER_ADMIN', 'materials.view'),       ('SUPER_ADMIN', 'materials.manage'),
     ('SUPER_ADMIN', 'roles.view'),           ('SUPER_ADMIN', 'roles.manage'),
     ('SUPER_ADMIN', 'users.view'),           ('SUPER_ADMIN', 'users.manage'),
     ('SUPER_ADMIN', 'users.status'),         ('SUPER_ADMIN', 'agencies.view'),
     ('SUPER_ADMIN', 'applications.view'),    ('SUPER_ADMIN', 'programs.view'),
     ('SUPER_ADMIN', 'coordinators.view'),    ('SUPER_ADMIN', 'reports.view'),
     ('SUPER_ADMIN', 'professionals.view'),   ('SUPER_ADMIN', 'trainers.view'),
     ('SUPER_ADMIN', 'trainers.manage'),      ('SUPER_ADMIN', 'settings.manage'),

     -- Sees the whole program and changes none of it.
     ('MINISTRY', 'masters.view'),            ('MINISTRY', 'curriculum.view'),
     ('MINISTRY', 'fees.view'),               ('MINISTRY', 'exams.view'),
     ('MINISTRY', 'materials.view'),          ('MINISTRY', 'agencies.view'),
     ('MINISTRY', 'users.view'),              ('MINISTRY', 'applications.view'),
     ('MINISTRY', 'programs.view'),           ('MINISTRY', 'coordinators.view'),
     ('MINISTRY', 'reports.view'),            ('MINISTRY', 'professionals.view'),
     ('MINISTRY', 'trainers.view'),

     -- Appoints operation managers, and scrutinises applications.
     ('ADMIN', 'masters.view'),               ('ADMIN', 'curriculum.view'),
     ('ADMIN', 'fees.view'),                  ('ADMIN', 'exams.view'),
     ('ADMIN', 'materials.view'),             ('ADMIN', 'agencies.view'),
     ('ADMIN', 'roles.view'),                 ('ADMIN', 'users.view'),
     ('ADMIN', 'users.manage'),               ('ADMIN', 'users.status'),
     ('ADMIN', 'applications.view'),          ('ADMIN', 'applications.scrutinise'),
     ('ADMIN', 'programs.view'),              ('ADMIN', 'coordinators.view'),
     ('ADMIN', 'reports.view'),               ('ADMIN', 'professionals.view'),
     ('ADMIN', 'trainers.view'),

     -- Empanels implementing agencies, and permits the batches they raise.
     ('OPS_MANAGER', 'masters.view'),         ('OPS_MANAGER', 'curriculum.view'),
     ('OPS_MANAGER', 'materials.view'),       ('OPS_MANAGER', 'agencies.view'),
     ('OPS_MANAGER', 'agencies.manage'),      ('OPS_MANAGER', 'users.view'),
     ('OPS_MANAGER', 'users.status'),         ('OPS_MANAGER', 'applications.view'),
     ('OPS_MANAGER', 'programs.view'),        ('OPS_MANAGER', 'programs.manage'),
     ('OPS_MANAGER', 'coordinators.view'),    ('OPS_MANAGER', 'reports.view'),
     ('OPS_MANAGER', 'professionals.view'),   ('OPS_MANAGER', 'trainers.view'),

     -- Raises its programs, adds its coordinators and runs them.
     ('AGENCY_ADMIN', 'masters.view'),        ('AGENCY_ADMIN', 'curriculum.view'),
     ('AGENCY_ADMIN', 'materials.view'),      ('AGENCY_ADMIN', 'roles.view'),
     ('AGENCY_ADMIN', 'users.view'),          ('AGENCY_ADMIN', 'users.manage'),
     ('AGENCY_ADMIN', 'users.status'),        ('AGENCY_ADMIN', 'coordinators.view'),
     ('AGENCY_ADMIN', 'coordinators.manage'), ('AGENCY_ADMIN', 'programs.view'),
     ('AGENCY_ADMIN', 'programs.create'),     ('AGENCY_ADMIN', 'programs.manage'),
     ('AGENCY_ADMIN', 'reports.view'),

     -- Records what happened at a session, and marks attendance.
     ('COORDINATOR', 'programs.view'),        ('COORDINATOR', 'programs.manage'),
     ('COORDINATOR', 'materials.view');

    DELETE p
    FROM RolePermissions p
    JOIN AdminRoles r ON r.Id = p.RoleId
    WHERE r.IsSystemRole = 1
      AND r.Code IN (SELECT DISTINCT Code FROM @sets);

    INSERT INTO RolePermissions (RoleId, Permission)
    SELECT r.Id, s.Permission
    FROM @sets s
    JOIN AdminRoles r ON r.Code = s.Code AND r.IsSystemRole = 1;

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001031002_SystemRolesBackToTheirSeededSets'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261001031002_SystemRolesBackToTheirSeededSets', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001032213_RolesAreSuperAdminsAlone'
)
BEGIN

    DELETE p FROM RolePermissions p
    JOIN AdminRoles r ON r.Id = p.RoleId
    WHERE r.BaseRole IN ('Admin', 'AgencyAdmin')
      AND p.Permission = 'roles.view';

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001032213_RolesAreSuperAdminsAlone'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261001032213_RolesAreSuperAdminsAlone', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001063302_OperationManagersHoldProgramTypes'
)
BEGIN

    INSERT INTO UserProgramTypes (UserId, ProgramTypeId)
    SELECT DISTINCT u.Id, p.Id
    FROM PortalUsers u
    JOIN UserSubCategories s ON s.UserId = u.Id
    JOIN ProgramTypes p ON p.SubCategoryId = s.SubCategoryId
    WHERE u.BaseRole = 'OperationManager'
      AND NOT EXISTS (SELECT 1 FROM UserProgramTypes t WHERE t.UserId = u.Id)
      AND NOT EXISTS (
          SELECT 1 FROM UserProgramTypes t
          WHERE t.UserId = u.Id AND t.ProgramTypeId = p.Id
      );

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001063302_OperationManagersHoldProgramTypes'
)
BEGIN

    INSERT INTO UserProgramTypes (UserId, ProgramTypeId)
    SELECT DISTINCT u.Id, p.Id
    FROM PortalUsers u
    JOIN UserCategories c ON c.UserId = u.Id
    JOIN ProgramTypes p ON p.CategoryId = c.CategoryId
    WHERE u.BaseRole = 'OperationManager'
      AND NOT EXISTS (SELECT 1 FROM UserProgramTypes t WHERE t.UserId = u.Id)
      AND NOT EXISTS (
          SELECT 1 FROM UserProgramTypes t
          WHERE t.UserId = u.Id AND t.ProgramTypeId = p.Id
      );

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001063302_OperationManagersHoldProgramTypes'
)
BEGIN

    DELETE c FROM UserCategories c
    JOIN PortalUsers u ON u.Id = c.UserId
    WHERE u.BaseRole = 'OperationManager';

    DELETE s FROM UserSubCategories s
    JOIN PortalUsers u ON u.Id = s.UserId
    WHERE u.BaseRole = 'OperationManager';

END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001063302_OperationManagersHoldProgramTypes'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261001063302_OperationManagersHoldProgramTypes', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001092223_SharedChoiceLists'
)
BEGIN
    ALTER TABLE [ProfileFields] ADD [OptionSetId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001092223_SharedChoiceLists'
)
BEGIN
    CREATE TABLE [OptionSets] (
        [Id] int NOT NULL IDENTITY,
        [Code] nvarchar(40) NOT NULL,
        [Name] nvarchar(120) NOT NULL,
        [Description] nvarchar(400) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_OptionSets] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001092223_SharedChoiceLists'
)
BEGIN
    CREATE TABLE [OptionSetItems] (
        [Id] int NOT NULL IDENTITY,
        [OptionSetId] int NOT NULL,
        [Value] nvarchar(120) NOT NULL,
        [Label] nvarchar(200) NOT NULL,
        [DisplayOrder] int NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_OptionSetItems] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_OptionSetItems_OptionSets_OptionSetId] FOREIGN KEY ([OptionSetId]) REFERENCES [OptionSets] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001092223_SharedChoiceLists'
)
BEGIN
    CREATE INDEX [IX_ProfileFields_OptionSetId] ON [ProfileFields] ([OptionSetId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001092223_SharedChoiceLists'
)
BEGIN
    CREATE UNIQUE INDEX [IX_OptionSetItems_OptionSetId_Value] ON [OptionSetItems] ([OptionSetId], [Value]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001092223_SharedChoiceLists'
)
BEGIN
    CREATE UNIQUE INDEX [IX_OptionSets_Code] ON [OptionSets] ([Code]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001092223_SharedChoiceLists'
)
BEGIN
    ALTER TABLE [ProfileFields] ADD CONSTRAINT [FK_ProfileFields_OptionSets_OptionSetId] FOREIGN KEY ([OptionSetId]) REFERENCES [OptionSets] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001092223_SharedChoiceLists'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261001092223_SharedChoiceLists', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    CREATE TABLE [FeedbackForms] (
        [Id] int NOT NULL IDENTITY,
        [ProgramTypeId] int NOT NULL,
        [Title] nvarchar(200) NOT NULL,
        [Intro] nvarchar(600) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        [Status] varchar(40) NOT NULL,
        CONSTRAINT [PK_FeedbackForms] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_FeedbackForms_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    CREATE TABLE [FeedbackReceipts] (
        [Id] int NOT NULL IDENTITY,
        [ParticipantId] int NOT NULL,
        [SubmittedOn] datetime2 NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_FeedbackReceipts] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_FeedbackReceipts_ProgrammeParticipants_ParticipantId] FOREIGN KEY ([ParticipantId]) REFERENCES [ProgrammeParticipants] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    CREATE TABLE [FeedbackResponses] (
        [Id] int NOT NULL IDENTITY,
        [ProgrammeId] int NOT NULL,
        [ProgramTypeId] int NOT NULL,
        [FeedbackFormId] int NULL,
        [Answers] nvarchar(max) NOT NULL,
        [SubmittedOn] date NOT NULL,
        CONSTRAINT [PK_FeedbackResponses] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_FeedbackResponses_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_FeedbackResponses_Programmes_ProgrammeId] FOREIGN KEY ([ProgrammeId]) REFERENCES [Programmes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    CREATE TABLE [FeedbackQuestions] (
        [Id] int NOT NULL IDENTITY,
        [FormId] int NOT NULL,
        [Key] nvarchar(80) NOT NULL,
        [Text] nvarchar(400) NOT NULL,
        [HelpText] nvarchar(400) NULL,
        [Type] varchar(40) NOT NULL,
        [Required] bit NOT NULL,
        [DisplayOrder] int NOT NULL,
        [MaxRating] int NOT NULL,
        [OptionSetId] int NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_FeedbackQuestions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_FeedbackQuestions_FeedbackForms_FormId] FOREIGN KEY ([FormId]) REFERENCES [FeedbackForms] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_FeedbackQuestions_OptionSets_OptionSetId] FOREIGN KEY ([OptionSetId]) REFERENCES [OptionSets] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    CREATE TABLE [FeedbackQuestionOptions] (
        [Id] int NOT NULL IDENTITY,
        [QuestionId] int NOT NULL,
        [Value] nvarchar(120) NOT NULL,
        [Label] nvarchar(200) NOT NULL,
        [DisplayOrder] int NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_FeedbackQuestionOptions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_FeedbackQuestionOptions_FeedbackQuestions_QuestionId] FOREIGN KEY ([QuestionId]) REFERENCES [FeedbackQuestions] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_FeedbackForms_ProgramTypeId] ON [FeedbackForms] ([ProgramTypeId]) WHERE [Status] = ''Active''');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    CREATE INDEX [IX_FeedbackQuestionOptions_QuestionId] ON [FeedbackQuestionOptions] ([QuestionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    CREATE UNIQUE INDEX [IX_FeedbackQuestions_FormId_Key] ON [FeedbackQuestions] ([FormId], [Key]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    CREATE INDEX [IX_FeedbackQuestions_OptionSetId] ON [FeedbackQuestions] ([OptionSetId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    CREATE UNIQUE INDEX [IX_FeedbackReceipts_ParticipantId] ON [FeedbackReceipts] ([ParticipantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    CREATE INDEX [IX_FeedbackResponses_ProgrammeId] ON [FeedbackResponses] ([ProgrammeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    CREATE INDEX [IX_FeedbackResponses_ProgramTypeId] ON [FeedbackResponses] ([ProgramTypeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261001095346_FeedbackAfterTheBatch'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261001095346_FeedbackAfterTheBatch', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261002021121_OneScrutinyOnTheProfile'
)
BEGIN
    INSERT INTO ScrutinyEvents
        (ApplicationId, Action, ByUserName, ByRole, [On], Remarks, CreatedOn)
    SELECT a.Id, 'Approved', 'System', 'Applicant', GETUTCDATE(),
           'Approved on submission: scrutiny of applications was withdrawn. The '
           + 'profile for this discipline had already been scrutinised and accepted.',
           GETUTCDATE()
    FROM Applications a
    WHERE a.Status IN ('Submitted', 'UnderScrutiny', 'Clarification');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261002021121_OneScrutinyOnTheProfile'
)
BEGIN
    UPDATE Applications
    SET Status = 'Approved'
    WHERE Status IN ('Submitted', 'UnderScrutiny', 'Clarification');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261002021121_OneScrutinyOnTheProfile'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261002021121_OneScrutinyOnTheProfile', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261003023038_PortalUserPincode'
)
BEGIN
    ALTER TABLE [PortalUsers] ADD [Pincode] nvarchar(6) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261003023038_PortalUserPincode'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261003023038_PortalUserPincode', N'10.0.12');
END;

COMMIT;
GO

