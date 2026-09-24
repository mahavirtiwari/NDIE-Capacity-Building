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

