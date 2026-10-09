<#
.SYNOPSIS
    The staging release, for a server where the backup is taken by hand.

.DESCRIPTION
    This is release-staging.ps1 -SkipBackup and nothing else. It exists because
    a flag has to be remembered and a name does not, and because a release that
    took no backup is worth being able to see in the shell history rather than
    having to infer from an argument three scripts deep.

    Everything else is unchanged, and every other flag still works: whatever is
    typed after the script name is handed to release-staging.ps1 as it stands,
    so -Plan, -WebOnly, -AppsOnly, -NoPull and -SkipMigrations behave exactly
    as they do there.

    What is skipped is 10-backup.ps1, which 20-release.ps1 would otherwise run
    immediately before the schema changes. What is not skipped: the current
    build is still copied to <site>.previous, and verification failing still
    puts it back. That is a copy of our own files, it costs seconds, and it is
    the only way back from a bad publish.

    So the exposure is the database alone, and it is covered by taking the
    backup first:

        .\windows\10-backup.ps1 -SkipFiles -Label 'before-release'

    which writes a dated .bak and reads it back with RESTORE VERIFYONLY before
    reporting success. Worth doing where the release has a migration that
    writes rows: 21-rollback.ps1 can revert a schema change, but reverting the
    column a migration wrote to does not un-write the rows it put there.

.EXAMPLE
    .\release-staging-nobackup.ps1
    Pull, then the web and both apps.

.EXAMPLE
    .\release-staging-nobackup.ps1 -Plan
    What that would do, without doing it.

.EXAMPLE
    .\release-staging-nobackup.ps1 -WebOnly -SkipMigrations
    A code-only web release: nothing to migrate, so nothing to back up.
#>

$ErrorActionPreference = 'Stop'

$release = Join-Path $PSScriptRoot 'release-staging.ps1'
if (-not (Test-Path $release)) {
    throw "release-staging.ps1 is not beside this script. Expected $release"
}

# Said once, for the log. -Plan changes nothing, so it does not need telling.
if (@($args) -notcontains '-Plan') {
    Write-Host "`n  No backup will be taken here; the database is backed up by hand." -ForegroundColor Yellow
}

$global:LASTEXITCODE = 0
& $release -SkipBackup @args
exit $LASTEXITCODE
