BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013011302_MoreThanOneWayIntoAProgramme'
)
BEGIN
    CREATE TABLE [ProgramTypeEligibilityRoutes] (
        [Id] int NOT NULL IDENTITY,
        [ProgramTypeId] int NOT NULL,
        [QualificationCode] nvarchar(200) NOT NULL,
        [MinExperienceYears] int NOT NULL,
        [Requirements] nvarchar(2000) NULL,
        [DisplayOrder] int NOT NULL,
        CONSTRAINT [PK_ProgramTypeEligibilityRoutes] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ProgramTypeEligibilityRoutes_ProgramTypes_ProgramTypeId] FOREIGN KEY ([ProgramTypeId]) REFERENCES [ProgramTypes] ([Id]) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013011302_MoreThanOneWayIntoAProgramme'
)
BEGIN
    CREATE INDEX [IX_ProgramTypeEligibilityRoutes_ProgramTypeId_DisplayOrder] ON [ProgramTypeEligibilityRoutes] ([ProgramTypeId], [DisplayOrder]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013011302_MoreThanOneWayIntoAProgramme'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ProgramTypeEligibilityRoutes_ProgramTypeId_QualificationCode] ON [ProgramTypeEligibilityRoutes] ([ProgramTypeId], [QualificationCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013011302_MoreThanOneWayIntoAProgramme'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261013011302_MoreThanOneWayIntoAProgramme', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032055_ANoticeCanBeAddressedToOnePerson'
)
BEGIN
    ALTER TABLE [Notifications] ADD [UserId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032055_ANoticeCanBeAddressedToOnePerson'
)
BEGIN
    CREATE INDEX [IX_Notifications_UserId] ON [Notifications] ([UserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032055_ANoticeCanBeAddressedToOnePerson'
)
BEGIN
    ALTER TABLE [Notifications] ADD CONSTRAINT [FK_Notifications_PortalUsers_UserId] FOREIGN KEY ([UserId]) REFERENCES [PortalUsers] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032055_ANoticeCanBeAddressedToOnePerson'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261013032055_ANoticeCanBeAddressedToOnePerson', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032815_AVenueMovesOnlyWhenTheManagerSaysSo'
)
BEGIN
    ALTER TABLE [Programmes] ADD [RequestedCity] nvarchar(120) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032815_AVenueMovesOnlyWhenTheManagerSaysSo'
)
BEGIN
    ALTER TABLE [Programmes] ADD [RequestedDistrictCode] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032815_AVenueMovesOnlyWhenTheManagerSaysSo'
)
BEGIN
    ALTER TABLE [Programmes] ADD [RequestedPincode] nvarchar(6) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032815_AVenueMovesOnlyWhenTheManagerSaysSo'
)
BEGIN
    ALTER TABLE [Programmes] ADD [RequestedVenue] nvarchar(300) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032815_AVenueMovesOnlyWhenTheManagerSaysSo'
)
BEGIN
    ALTER TABLE [Programmes] ADD [VenueChangeReason] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032815_AVenueMovesOnlyWhenTheManagerSaysSo'
)
BEGIN
    ALTER TABLE [Programmes] ADD [VenueChangeRequestedByUserId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032815_AVenueMovesOnlyWhenTheManagerSaysSo'
)
BEGIN
    ALTER TABLE [Programmes] ADD [VenueChangeRequestedOn] datetime2 NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032815_AVenueMovesOnlyWhenTheManagerSaysSo'
)
BEGIN
    CREATE INDEX [IX_Programmes_RequestedDistrictCode] ON [Programmes] ([RequestedDistrictCode]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032815_AVenueMovesOnlyWhenTheManagerSaysSo'
)
BEGIN
    ALTER TABLE [Programmes] ADD CONSTRAINT [FK_Programmes_LgdDistricts_RequestedDistrictCode] FOREIGN KEY ([RequestedDistrictCode]) REFERENCES [LgdDistricts] ([Code]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013032815_AVenueMovesOnlyWhenTheManagerSaysSo'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261013032815_AVenueMovesOnlyWhenTheManagerSaysSo', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013040504_AChoiceCanSayWhatItMeans'
)
BEGIN
    ALTER TABLE [OptionSetItems] ADD [Description] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261013040504_AChoiceCanSayWhatItMeans'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261013040504_AChoiceCanSayWhatItMeans', N'10.0.12');
END;

COMMIT;
GO

