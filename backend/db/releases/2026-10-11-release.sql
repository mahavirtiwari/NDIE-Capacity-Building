BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261010113236_AProfileFieldSaysWhatItHolds'
)
BEGIN
    EXEC sp_rename N'[ProfileFields].[EligibilityRole]', N'Role', 'COLUMN';
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261010113236_AProfileFieldSaysWhatItHolds'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261010113236_AProfileFieldSaysWhatItHolds', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261011013735_ARegistrationRemembersItsBatch'
)
BEGIN
    ALTER TABLE [Applications] ADD [ProgrammeId] int NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261011013735_ARegistrationRemembersItsBatch'
)
BEGIN
    CREATE INDEX [IX_Applications_ProgrammeId] ON [Applications] ([ProgrammeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261011013735_ARegistrationRemembersItsBatch'
)
BEGIN
    ALTER TABLE [Applications] ADD CONSTRAINT [FK_Applications_Programmes_ProgrammeId] FOREIGN KEY ([ProgrammeId]) REFERENCES [Programmes] ([Id]) ON DELETE NO ACTION;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261011013735_ARegistrationRemembersItsBatch'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261011013735_ARegistrationRemembersItsBatch', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261011014246_AnAddressIsProvenBeforeItMoves'
)
BEGIN
    ALTER TABLE [Applicants] ADD [PendingEmail] nvarchar(200) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261011014246_AnAddressIsProvenBeforeItMoves'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261011014246_AnAddressIsProvenBeforeItMoves', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261011021046_ASessionSaysWhenItRuns'
)
BEGIN
    ALTER TABLE [CurriculumSessions] ADD [EndTime] time NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261011021046_ASessionSaysWhenItRuns'
)
BEGIN
    ALTER TABLE [CurriculumSessions] ADD [StartTime] time NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261011021046_ASessionSaysWhenItRuns'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261011021046_ASessionSaysWhenItRuns', N'10.0.12');
END;

COMMIT;
GO

BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261011023832_SupportAndAboutAreTheirsToWrite'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [AboutText] nvarchar(4000) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261011023832_SupportAndAboutAreTheirsToWrite'
)
BEGIN
    ALTER TABLE [BrandingSettings] ADD [SupportUrl] nvarchar(500) NULL;
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20261011023832_SupportAndAboutAreTheirsToWrite'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20261011023832_SupportAndAboutAreTheirsToWrite', N'10.0.12');
END;

COMMIT;
GO

