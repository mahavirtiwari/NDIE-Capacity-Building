BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007052318_AFloorForABatchAndAPostponementAsked'
)
BEGIN
    ALTER TABLE [ProgramTypes] ADD [MinParticipants] int NOT NULL DEFAULT 0;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007052318_AFloorForABatchAndAPostponementAsked'
)
BEGIN
    ALTER TABLE [Programmes] ADD [PostponementReason] nvarchar(max) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007052318_AFloorForABatchAndAPostponementAsked'
)
BEGIN
    ALTER TABLE [Programmes] ADD [PostponementRequestedByUserId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007052318_AFloorForABatchAndAPostponementAsked'
)
BEGIN
    ALTER TABLE [Programmes] ADD [PostponementRequestedOn] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007052318_AFloorForABatchAndAPostponementAsked'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261007052318_AFloorForABatchAndAPostponementAsked', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007054704_BatchHoursAndVenuePincode'
)
BEGIN
    ALTER TABLE [Programmes] ADD [EndTime] time NOT NULL DEFAULT '17:00:00';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007054704_BatchHoursAndVenuePincode'
)
BEGIN
    ALTER TABLE [Programmes] ADD [Pincode] nvarchar(6) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007054704_BatchHoursAndVenuePincode'
)
BEGIN
    ALTER TABLE [Programmes] ADD [StartTime] time NOT NULL DEFAULT '10:00:00';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007054704_BatchHoursAndVenuePincode'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261007054704_BatchHoursAndVenuePincode', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007061016_CoordinatorPanAndAadhaar'
)
BEGIN
    ALTER TABLE [PortalUsers] ADD [Aadhaar] nvarchar(12) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007061016_CoordinatorPanAndAadhaar'
)
BEGIN
    ALTER TABLE [PortalUsers] ADD [Pan] nvarchar(10) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007061016_CoordinatorPanAndAadhaar'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261007061016_CoordinatorPanAndAadhaar', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007090836_AdminOrganisationName'
)
BEGIN
    ALTER TABLE [PortalUsers] ADD [OrganisationName] nvarchar(200) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007090836_AdminOrganisationName'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261007090836_AdminOrganisationName', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007100846_NotificationsAndPushDevices'
)
BEGIN
    CREATE TABLE [Notifications] (
        [Id] int NOT NULL IDENTITY,
        [Title] nvarchar(120) NOT NULL,
        [Body] nvarchar(500) NOT NULL,
        [Audience] varchar(40) NOT NULL,
        [SubCategoryId] int NULL,
        [StateCode] int NULL,
        [LinkPath] nvarchar(200) NULL,
        [Kind] nvarchar(40) NOT NULL,
        [Status] varchar(40) NOT NULL,
        [SentOn] datetime2 NULL,
        [Handsets] int NOT NULL,
        [Delivered] int NOT NULL,
        [Failed] int NOT NULL,
        [Note] nvarchar(500) NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_Notifications] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Notifications_LgdStates_StateCode] FOREIGN KEY ([StateCode]) REFERENCES [LgdStates] ([Code]) ON DELETE NO ACTION,
        CONSTRAINT [FK_Notifications_SubCategories_SubCategoryId] FOREIGN KEY ([SubCategoryId]) REFERENCES [SubCategories] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007100846_NotificationsAndPushDevices'
)
BEGIN
    CREATE TABLE [PushDevices] (
        [Id] int NOT NULL IDENTITY,
        [Token] nvarchar(200) NOT NULL,
        [Platform] nvarchar(20) NOT NULL,
        [App] nvarchar(20) NOT NULL,
        [ApplicantId] int NULL,
        [UserId] int NULL,
        [LastSeenOn] datetime2 NOT NULL,
        [IsActive] bit NOT NULL,
        [CreatedBy] nvarchar(max) NULL,
        [CreatedOn] datetime2 NOT NULL,
        [ModifiedBy] nvarchar(max) NULL,
        [ModifiedOn] datetime2 NULL,
        CONSTRAINT [PK_PushDevices] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_PushDevices_Applicants_ApplicantId] FOREIGN KEY ([ApplicantId]) REFERENCES [Applicants] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_PushDevices_PortalUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007100846_NotificationsAndPushDevices'
)
BEGIN
    CREATE TABLE [NotificationReads] (
        [Id] int NOT NULL IDENTITY,
        [NotificationId] int NOT NULL,
        [ApplicantId] int NULL,
        [UserId] int NULL,
        [ReadOn] datetime2 NOT NULL,
        CONSTRAINT [PK_NotificationReads] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_NotificationReads_Notifications_NotificationId] FOREIGN KEY ([NotificationId]) REFERENCES [Notifications] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007100846_NotificationsAndPushDevices'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_NotificationReads_NotificationId_ApplicantId] ON [NotificationReads] ([NotificationId], [ApplicantId]) WHERE [ApplicantId] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007100846_NotificationsAndPushDevices'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_NotificationReads_NotificationId_UserId] ON [NotificationReads] ([NotificationId], [UserId]) WHERE [UserId] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007100846_NotificationsAndPushDevices'
)
BEGIN
    CREATE INDEX [IX_Notifications_SentOn] ON [Notifications] ([SentOn]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007100846_NotificationsAndPushDevices'
)
BEGIN
    CREATE INDEX [IX_Notifications_StateCode] ON [Notifications] ([StateCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007100846_NotificationsAndPushDevices'
)
BEGIN
    CREATE INDEX [IX_Notifications_SubCategoryId] ON [Notifications] ([SubCategoryId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007100846_NotificationsAndPushDevices'
)
BEGIN
    CREATE INDEX [IX_PushDevices_ApplicantId] ON [PushDevices] ([ApplicantId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007100846_NotificationsAndPushDevices'
)
BEGIN
    CREATE UNIQUE INDEX [IX_PushDevices_Token] ON [PushDevices] ([Token]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007100846_NotificationsAndPushDevices'
)
BEGIN
    CREATE INDEX [IX_PushDevices_UserId] ON [PushDevices] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261007100846_NotificationsAndPushDevices'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261007100846_NotificationsAndPushDevices', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var nvarchar(max);
    SELECT @var = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProgrammeVenues]') AND [c].[name] = N'Longitude');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [ProgrammeVenues] DROP CONSTRAINT ' + @var + ';');
    ALTER TABLE [ProgrammeVenues] ALTER COLUMN [Longitude] decimal(9,6) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var1 nvarchar(max);
    SELECT @var1 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProgrammeVenues]') AND [c].[name] = N'Latitude');
    IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [ProgrammeVenues] DROP CONSTRAINT ' + @var1 + ';');
    ALTER TABLE [ProgrammeVenues] ALTER COLUMN [Latitude] decimal(9,6) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var2 nvarchar(max);
    SELECT @var2 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProgrammeVenues]') AND [c].[name] = N'AccuracyMetres');
    IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [ProgrammeVenues] DROP CONSTRAINT ' + @var2 + ';');
    ALTER TABLE [ProgrammeVenues] ALTER COLUMN [AccuracyMetres] decimal(8,2) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var3 nvarchar(max);
    SELECT @var3 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Programmes]') AND [c].[name] = N'CumulativeFeedback');
    IF @var3 IS NOT NULL EXEC(N'ALTER TABLE [Programmes] DROP CONSTRAINT ' + @var3 + ';');
    ALTER TABLE [Programmes] ALTER COLUMN [CumulativeFeedback] decimal(4,2) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var4 nvarchar(max);
    SELECT @var4 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProgrammeParticipants]') AND [c].[name] = N'ExamScore');
    IF @var4 IS NOT NULL EXEC(N'ALTER TABLE [ProgrammeParticipants] DROP CONSTRAINT ' + @var4 + ';');
    ALTER TABLE [ProgrammeParticipants] ALTER COLUMN [ExamScore] decimal(6,2) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var5 nvarchar(max);
    SELECT @var5 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ProgrammeParticipants]') AND [c].[name] = N'AttendancePercent');
    IF @var5 IS NOT NULL EXEC(N'ALTER TABLE [ProgrammeParticipants] DROP CONSTRAINT ' + @var5 + ';');
    ALTER TABLE [ProgrammeParticipants] ALTER COLUMN [AttendancePercent] decimal(5,2) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    ALTER TABLE [ProfileSubmissions] ADD [AssignedOn] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    ALTER TABLE [ProfileAttachments] ADD [DeviceModel] nvarchar(120) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    ALTER TABLE [ProfileAttachments] ADD [DeviceOsVersion] nvarchar(40) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    ALTER TABLE [ProfileAttachments] ADD [DevicePlatform] nvarchar(40) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    ALTER TABLE [ProfileAttachments] ADD [Latitude] decimal(9,6) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    ALTER TABLE [ProfileAttachments] ADD [Longitude] decimal(9,6) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    ALTER TABLE [ProfileAttachments] ADD [Stamped] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    ALTER TABLE [ProfileAttachments] ADD [SyncedOn] datetime2 NOT NULL DEFAULT '0001-01-01T00:00:00.0000000';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    EXEC(N'UPDATE [ProfileAttachments] SET [SyncedOn] = [CapturedOn]');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var6 nvarchar(max);
    SELECT @var6 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[MonitoringPhotos]') AND [c].[name] = N'Longitude');
    IF @var6 IS NOT NULL EXEC(N'ALTER TABLE [MonitoringPhotos] DROP CONSTRAINT ' + @var6 + ';');
    ALTER TABLE [MonitoringPhotos] ALTER COLUMN [Longitude] decimal(9,6) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var7 nvarchar(max);
    SELECT @var7 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[MonitoringPhotos]') AND [c].[name] = N'Latitude');
    IF @var7 IS NOT NULL EXEC(N'ALTER TABLE [MonitoringPhotos] DROP CONSTRAINT ' + @var7 + ';');
    ALTER TABLE [MonitoringPhotos] ALTER COLUMN [Latitude] decimal(9,6) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var8 nvarchar(max);
    SELECT @var8 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[FeeStructures]') AND [c].[name] = N'GstPercent');
    IF @var8 IS NOT NULL EXEC(N'ALTER TABLE [FeeStructures] DROP CONSTRAINT ' + @var8 + ';');
    ALTER TABLE [FeeStructures] ALTER COLUMN [GstPercent] decimal(5,2) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var9 nvarchar(max);
    SELECT @var9 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[FeeConcessions]') AND [c].[name] = N'Percentage');
    IF @var9 IS NOT NULL EXEC(N'ALTER TABLE [FeeConcessions] DROP CONSTRAINT ' + @var9 + ';');
    ALTER TABLE [FeeConcessions] ALTER COLUMN [Percentage] decimal(5,2) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var10 nvarchar(max);
    SELECT @var10 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ExamQuestions]') AND [c].[name] = N'NegativeMarks');
    IF @var10 IS NOT NULL EXEC(N'ALTER TABLE [ExamQuestions] DROP CONSTRAINT ' + @var10 + ';');
    ALTER TABLE [ExamQuestions] ALTER COLUMN [NegativeMarks] decimal(6,2) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var11 nvarchar(max);
    SELECT @var11 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ExamQuestions]') AND [c].[name] = N'Marks');
    IF @var11 IS NOT NULL EXEC(N'ALTER TABLE [ExamQuestions] DROP CONSTRAINT ' + @var11 + ';');
    ALTER TABLE [ExamQuestions] ALTER COLUMN [Marks] decimal(6,2) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var12 nvarchar(max);
    SELECT @var12 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[ExamPapers]') AND [c].[name] = N'PassPercentage');
    IF @var12 IS NOT NULL EXEC(N'ALTER TABLE [ExamPapers] DROP CONSTRAINT ' + @var12 + ';');
    ALTER TABLE [ExamPapers] ALTER COLUMN [PassPercentage] decimal(5,2) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var13 nvarchar(max);
    SELECT @var13 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Applications]') AND [c].[name] = N'TdsPercent');
    IF @var13 IS NOT NULL EXEC(N'ALTER TABLE [Applications] DROP CONSTRAINT ' + @var13 + ';');
    ALTER TABLE [Applications] ALTER COLUMN [TdsPercent] decimal(5,2) NOT NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    DECLARE @var14 nvarchar(max);
    SELECT @var14 = QUOTENAME([d].[name])
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Applications]') AND [c].[name] = N'Score');
    IF @var14 IS NOT NULL EXEC(N'ALTER TABLE [Applications] DROP CONSTRAINT ' + @var14 + ';');
    ALTER TABLE [Applications] ALTER COLUMN [Score] decimal(6,2) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009064259_ProfilePhotoCaptureAndRota'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261009064259_ProfilePhotoCaptureAndRota', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009071221_MonitoringPhotoCapture'
)
BEGIN
    ALTER TABLE [MonitoringPhotos] ADD [DeviceModel] nvarchar(120) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009071221_MonitoringPhotoCapture'
)
BEGIN
    ALTER TABLE [MonitoringPhotos] ADD [DeviceOsVersion] nvarchar(40) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009071221_MonitoringPhotoCapture'
)
BEGIN
    ALTER TABLE [MonitoringPhotos] ADD [DevicePlatform] nvarchar(40) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009071221_MonitoringPhotoCapture'
)
BEGIN
    ALTER TABLE [MonitoringPhotos] ADD [Stamped] bit NOT NULL DEFAULT CAST(0 AS bit);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009071221_MonitoringPhotoCapture'
)
BEGIN
    ALTER TABLE [MonitoringPhotos] ADD [SyncedOn] datetime2 NOT NULL DEFAULT '0001-01-01T00:00:00.0000000';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009071221_MonitoringPhotoCapture'
)
BEGIN
    EXEC(N'UPDATE [MonitoringPhotos] SET [SyncedOn] = [CapturedOn]');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009071221_MonitoringPhotoCapture'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261009071221_MonitoringPhotoCapture', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009102809_QualityControlOnSubmissions'
)
BEGIN
    ALTER TABLE [ProgrammeSubmissions] ADD [QcByUserId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009102809_QualityControlOnSubmissions'
)
BEGIN
    ALTER TABLE [ProgrammeSubmissions] ADD [QcByUserName] nvarchar(200) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009102809_QualityControlOnSubmissions'
)
BEGIN
    ALTER TABLE [ProgrammeSubmissions] ADD [QcOn] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009102809_QualityControlOnSubmissions'
)
BEGIN
    ALTER TABLE [ProgrammeSubmissions] ADD [QcRemarks] nvarchar(1000) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009102809_QualityControlOnSubmissions'
)
BEGIN
    ALTER TABLE [ProgrammeSubmissions] ADD [QcStatus] varchar(40) NOT NULL DEFAULT 'Pending';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009102809_QualityControlOnSubmissions'
)
BEGIN
    EXEC(N'UPDATE [ProgrammeSubmissions] SET [QcStatus] = ''Pending'' WHERE [QcStatus] IS NULL OR [QcStatus] = ''''');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009102809_QualityControlOnSubmissions'
)
BEGIN
    CREATE INDEX [IX_ProgrammeSubmissions_QcByUserId] ON [ProgrammeSubmissions] ([QcByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009102809_QualityControlOnSubmissions'
)
BEGIN
    CREATE INDEX [IX_ProgrammeSubmissions_QcStatus] ON [ProgrammeSubmissions] ([QcStatus]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009102809_QualityControlOnSubmissions'
)
BEGIN
    ALTER TABLE [ProgrammeSubmissions] ADD CONSTRAINT [FK_ProgrammeSubmissions_PortalUsers_QcByUserId] FOREIGN KEY ([QcByUserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009102809_QualityControlOnSubmissions'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261009102809_QualityControlOnSubmissions', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009110332_AttendancePerDay'
)
BEGIN
    CREATE TABLE [OnSpotAttendance] (
        [Id] int NOT NULL IDENTITY,
        [ParticipantId] int NOT NULL,
        [ProgrammeId] int NOT NULL,
        [Day] date NOT NULL,
        [IsPresent] bit NOT NULL,
        [MarkedOn] datetime2 NOT NULL,
        [MarkedBy] nvarchar(200) NULL,
        CONSTRAINT [PK_OnSpotAttendance] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_OnSpotAttendance_OnSpotParticipants_ParticipantId] FOREIGN KEY ([ParticipantId]) REFERENCES [OnSpotParticipants] ([Id]) ON DELETE CASCADE,
        CONSTRAINT [FK_OnSpotAttendance_Programmes_ProgrammeId] FOREIGN KEY ([ProgrammeId]) REFERENCES [Programmes] ([Id])
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009110332_AttendancePerDay'
)
BEGIN
    CREATE UNIQUE INDEX [IX_OnSpotAttendance_ParticipantId_Day] ON [OnSpotAttendance] ([ParticipantId], [Day]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009110332_AttendancePerDay'
)
BEGIN
    CREATE INDEX [IX_OnSpotAttendance_ProgrammeId_Day] ON [OnSpotAttendance] ([ProgrammeId], [Day]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009110332_AttendancePerDay'
)
BEGIN
    EXEC(N'INSERT INTO [OnSpotAttendance] ([ParticipantId], [ProgrammeId], [Day], [IsPresent], [MarkedOn], [MarkedBy]) SELECT p.[Id], p.[ProgrammeId], g.[StartDate], p.[IsPresent], ISNULL(p.[AttendanceMarkedOn], SYSUTCDATETIME()), ''Carried over'' FROM [OnSpotParticipants] p JOIN [Programmes] g ON g.[Id] = p.[ProgrammeId] WHERE p.[IsPresent] IS NOT NULL AND g.[StartDate] = g.[EndDate]');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009110332_AttendancePerDay'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261009110332_AttendancePerDay', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009112017_TrainerEngagementAndCredentials'
)
BEGIN
    ALTER TABLE [ProgrammeTrainers] ADD [Aadhaar] nvarchar(12) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009112017_TrainerEngagementAndCredentials'
)
BEGIN
    ALTER TABLE [ProgrammeTrainers] ADD [Engagement] varchar(40) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009112017_TrainerEngagementAndCredentials'
)
BEGIN
    ALTER TABLE [ProgrammeTrainers] ADD [Qualification] nvarchar(120) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009112017_TrainerEngagementAndCredentials'
)
BEGIN
    ALTER TABLE [ProgrammeTrainers] ADD [YearsExperience] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261009112017_TrainerEngagementAndCredentials'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261009112017_TrainerEngagementAndCredentials', N'10.0.12');
END;

COMMIT;
GO

