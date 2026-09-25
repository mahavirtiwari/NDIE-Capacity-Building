<#
.SYNOPSIS
    Backs up the database and the uploaded files.

.DESCRIPTION
    Two things on this server cannot be rebuilt from the repository: the
    database, and E:\cbms-data — the coordinator photographs and the certificate
    artwork. Everything else is a checkout and a build.

    The database goes to a dated .bak, written with CHECKSUM and then read back
    with RESTORE VERIFYONLY. A backup nobody has verified is a file, not a
    backup; the verify is the difference between having one and believing you
    have one.

    The files are mirrored with robocopy. Be clear-eyed about what a mirror is:
    it is a copy of now, not a history. A file deleted this morning is gone from
    the mirror tonight. Pair it with -ZipData, or with something that takes the
    backup folder off this machine, before treating it as safe.

.PARAMETER BackupRoot
    Where to write. Defaults to the production settings file. A second disc is
    worth more than a second folder.

.PARAMETER KeepDays
    How many days of .bak files to keep. The most recent is never pruned,
    whatever this says — a retention rule that can leave you with nothing is
    worse than no retention rule.

.PARAMETER ZipData
    Also take a dated archive of the uploaded files, not just the mirror. Slow
    and large once there are many photographs; worth it weekly.

.PARAMETER SkipFiles
    Database only. For the backup a release takes before it migrates, where the
    files are not about to be touched.

.EXAMPLE
    .\10-backup.ps1
    .\10-backup.ps1 -ZipData
    .\10-backup.ps1 -SkipFiles -Label 'before-release'
#>
[CmdletBinding()]
param(
    [string] $SitePath,
    [string] $StorageRoot,
    [string] $BackupRoot,
    [int]    $KeepDays,
    [string] $Label,
    [switch] $ZipData,
    [switch] $SkipFiles
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '_common.ps1')

$settings    = Import-DeploySettings
$SitePath    = Get-Setting $SitePath    $settings 'SitePath'    'E:\inetpub\cbms'
$StorageRoot = Get-Setting $StorageRoot $settings 'StorageRoot' 'E:\cbms-data'
$BackupRoot  = Get-Setting $BackupRoot  $settings 'BackupRoot'  'E:\cbms-backups'
if (-not $PSBoundParameters.ContainsKey('KeepDays')) {
    $KeepDays = [int] (Get-Setting $null $settings 'KeepDays' 30)
}

$started = Get-Date
$stamp   = $started.ToString('yyyyMMdd-HHmmss')
$suffix  = if ($Label) { '-' + ($Label -replace '[^\w\-]', '-') } else { '' }

Write-Host "`n=== Backing up CBMS ===`n" -ForegroundColor Cyan

$connectionString = Get-SqlConnectionString -SitePath $SitePath
$sqlArgs          = Get-SqlcmdArguments -ConnectionString $connectionString

# The database name as the site connects to it, so a backup can never be taken
# of a database the site is not using.
$builder = New-Object System.Data.Common.DbConnectionStringBuilder
$builder.set_ConnectionString($connectionString)
$database = foreach ($key in 'database', 'initial catalog') {
    if ($builder.ContainsKey($key)) { $builder[$key]; break }
}
if (-not $database) { throw "No database in the site's connection string." }

$server = foreach ($key in 'server', 'data source') {
    if ($builder.ContainsKey($key)) { $builder[$key]; break }
}

$dbFolder = Join-Path $BackupRoot 'database'
New-Item -ItemType Directory -Path $dbFolder -Force | Out-Null

function Get-SqlServiceAccount {
    <#
    .SYNOPSIS
        The Windows account SQL Server runs as.

    .DESCRIPTION
        BACKUP DATABASE is executed by the server, not by this script, so the
        file is written by the service account and not by whoever is signed in.
        That is the single most common reason a backup script that looks
        correct fails with "Operating system error 5".

        Asked of the server when it will say, and derived from the instance
        name when it will not: a virtual service account is NT SERVICE\MSSQLSERVER
        for a default instance and NT SERVICE\MSSQL$<INSTANCE> for a named one.
    #>
    param([string] $Instance)

    $answer = Invoke-Native 'sqlcmd' 'sqlcmd' ($sqlArgs + @('-Q',
        "SET NOCOUNT ON; SELECT TOP 1 service_account FROM sys.dm_server_services WHERE servicename LIKE 'SQL Server%';"
    )) -IgnoreExitCode
    $global:LASTEXITCODE = 0

    $account = ($answer | Where-Object { $_ -and $_ -notmatch '^Msg |^Level |^\s*$' } | Select-Object -First 1)
    if ($account) { return $account.Trim() }

    $named = if ($Instance -match '\\(.+)$') { $Matches[1] } else { $null }
    if ($named) { return "NT SERVICE\MSSQL`$$named" }
    return 'NT SERVICE\MSSQLSERVER'
}

function Assert-BackupFolderWritable {
    <#
        Checked before the backup rather than diagnosed after it. The server
        writes the file; if it cannot, every run fails the same way and the
        message is about a device rather than about a permission.
    #>
    param([string] $Folder)

    $probe = Join-Path $Folder ('.writetest-{0}' -f [Guid]::NewGuid().ToString('N').Substring(0, 6))

    # A zero-page backup of master is the cheapest thing the server can be
    # asked to write, and it proves the one thing in question.
    Invoke-Native 'sqlcmd' 'sqlcmd' ($sqlArgs + @('-Q',
        ("BACKUP DATABASE [master] TO DISK = N'{0}' WITH INIT, COPY_ONLY, STATS = 100;" -f $probe)
    )) -IgnoreExitCode | Out-Null
    $ok = $LASTEXITCODE -eq 0
    $global:LASTEXITCODE = 0

    if ($ok) {
        Remove-Item $probe -Force -ErrorAction SilentlyContinue
        return
    }

    $account = Get-SqlServiceAccount -Instance $server
    Write-Host "  [--]  SQL Server cannot write to $Folder" -ForegroundColor Yellow
    Write-Host "        It runs as $account, and the backup is written by the server." -ForegroundColor DarkGray
    Write-Host "        Granting it access..." -ForegroundColor Gray

    Invoke-Native 'icacls' 'icacls' @($Folder, '/grant', ('{0}:(OI)(CI)M' -f $account), '/T') -IgnoreExitCode | Out-Null
    $granted = $LASTEXITCODE -eq 0
    $global:LASTEXITCODE = 0

    if (-not $granted) {
        throw ("SQL Server ({0}) cannot write to {1}, and granting it failed. Run this in an elevated prompt:`n" +
               "    icacls `"{1}`" /grant `"{0}:(OI)(CI)M`" /T") -f $account, $Folder
    }

    Write-Host "  [ok]  $account may now write to $Folder" -ForegroundColor Green
}

function Invoke-Sql {
    param([Parameter(Mandatory)] [string] $Query, [switch] $Stream)
    Invoke-Native "sqlcmd" 'sqlcmd' ($sqlArgs + @('-Q', $Query)) -Stream:$Stream
}

# --- database ---------------------------------------------------------------

$backupPath = Join-Path $dbFolder ("{0}-{1}{2}.bak" -f $database, $stamp, $suffix)

# COMPRESSION is not in every edition, and Express is the one most likely to be
# under a deployment like this. Asked rather than assumed: a backup that fails
# on the option is a backup that did not happen.
$edition = [int] (Invoke-Sql "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('EngineEdition') AS varchar);").Trim()
$canCompress = $edition -ne 4   # 4 is Express

$options = @('CHECKSUM', 'INIT', 'STATS = 10', "NAME = N'$database full backup'")
if ($canCompress) { $options = @('COMPRESSION') + $options }

Assert-BackupFolderWritable -Folder $dbFolder

Write-Host "  Backing up [$database]..." -ForegroundColor Gray
Invoke-Sql ("BACKUP DATABASE [{0}] TO DISK = N'{1}' WITH {2};" -f
    $database, $backupPath, ($options -join ', ')) | Out-Null

if (-not (Test-Path $backupPath)) {
    throw "sqlcmd reported success but $backupPath is not there. Check that SQL Server's service account can write to $dbFolder — the backup is written by the server, not by this script."
}

Write-Host "  Verifying the file reads back..." -ForegroundColor Gray
Invoke-Sql ("RESTORE VERIFYONLY FROM DISK = N'{0}' WITH CHECKSUM;" -f $backupPath) | Out-Null

$sizeMb = [math]::Round((Get-Item $backupPath).Length / 1MB, 1)
Write-Host ("  [ok]  {0}  ({1} MB{2})" -f (Split-Path $backupPath -Leaf), $sizeMb,
    $(if ($canCompress) { ', compressed' } else { '' })) -ForegroundColor Green

# --- uploaded files ---------------------------------------------------------

if (-not $SkipFiles) {
    if (-not (Test-Path $StorageRoot)) {
        Write-Host "  [--]  $StorageRoot does not exist yet; nothing uploaded." -ForegroundColor DarkGray
    }
    else {
        $mirror = Join-Path $BackupRoot 'data-mirror'
        New-Item -ItemType Directory -Path $mirror -Force | Out-Null

        Write-Host "  Mirroring $StorageRoot..." -ForegroundColor Gray
        # /MIR mirrors, /R:2 /W:5 gives up quickly on a locked file rather than
        # retrying for half an hour, /NFL /NDL /NP keep the log readable.
        # Robocopy's exit codes are a bit map: under 8 is success of some kind.
        Invoke-Native 'robocopy' 'robocopy' @(
            $StorageRoot, $mirror, '/MIR', '/R:2', '/W:5', '/NFL', '/NDL', '/NP', '/NJH', '/NJS'
        ) -IgnoreExitCode | Out-Null

        if ($LASTEXITCODE -ge 8) { throw "robocopy failed (exit $LASTEXITCODE)." }
        $global:LASTEXITCODE = 0

        $files = (Get-ChildItem $mirror -Recurse -File -ErrorAction SilentlyContinue).Count
        Write-Host "  [ok]  $files file(s) mirrored" -ForegroundColor Green

        if ($ZipData) {
            $zip = Join-Path $BackupRoot ("data-{0}{1}.zip" -f $stamp, $suffix)
            Write-Host "  Archiving the mirror..." -ForegroundColor Gray
            Compress-Archive -Path (Join-Path $mirror '*') -DestinationPath $zip -Force
            Write-Host ("  [ok]  {0}  ({1} MB)" -f (Split-Path $zip -Leaf),
                [math]::Round((Get-Item $zip).Length / 1MB, 1)) -ForegroundColor Green
        }
    }
}

# --- retention --------------------------------------------------------------

$all = @(Get-ChildItem $dbFolder -Filter '*.bak' | Sort-Object LastWriteTime -Descending)
$stale = @($all | Select-Object -Skip 1 |
    Where-Object { $_.LastWriteTime -lt $started.AddDays(-$KeepDays) })

foreach ($file in $stale) {
    Remove-Item $file.FullName -Force
    Write-Host "  [--]  pruned $($file.Name)" -ForegroundColor DarkGray
}

Write-Host ("`n{0} backup(s) kept in {1}" -f ($all.Count - $stale.Count), $dbFolder)
Write-Host ("Finished in {0:n0}s.`n" -f ((Get-Date) - $started).TotalSeconds) -ForegroundColor Green

# The release script reads this to record what it took before it migrated.
return $backupPath
