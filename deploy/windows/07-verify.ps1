<#
.SYNOPSIS
    Checks the deployed site actually works.

.DESCRIPTION
    Every check hits the site the way a user or a client would, over the real
    hostname and the real certificate. A deployment that has not been verified
    from outside has not been verified.

.EXAMPLE
    .\07-verify.ps1
    .\07-verify.ps1 -BaseUrl https://leanstaging.qci.org.in
#>
[CmdletBinding()]
param(
    [string] $BaseUrl = 'https://leanstaging.qci.org.in',
    [string] $SitePath = 'E:\inetpub\cbms',
    [string] $StorageRoot = 'E:\cbms-data',
    [string] $SiteName = 'CBMS',
    [string] $PoolName = 'CbmsAppPool'
)

$ErrorActionPreference = 'Continue'
$script:Failed = 0
$uri = [Uri] $BaseUrl

# --- Make this client capable of talking to a current server -----------------

# Windows PowerShell 5.1 negotiates SSL 3.0 and TLS 1.0 unless told otherwise,
# and a current IIS refuses both: the connection is closed before any HTTP
# happens, and every check below then reports a transport error that says
# nothing whatever about the site. It is the client that is out of date.
$protocols = [Net.SecurityProtocolType]::Tls12
$sslProtocols = [Security.Authentication.SslProtocols]::Tls12
if ([Enum]::IsDefined([Net.SecurityProtocolType], 'Tls13')) {
    $protocols = $protocols -bor [Net.SecurityProtocolType]::Tls13
    $sslProtocols = $sslProtocols -bor [Security.Authentication.SslProtocols]::Tls13
}
[Net.ServicePointManager]::SecurityProtocol = $protocols

function Check {
    param([string] $Name, [scriptblock] $Test)

    try {
        $detail = & $Test
        Write-Host ("  [ok]   {0}{1}" -f $Name, $(if ($detail) { " - $detail" })) -ForegroundColor Green
    }
    catch {
        Write-Host ("  [FAIL] {0} - {1}" -f $Name, $_.Exception.Message) -ForegroundColor Red
        $script:Failed++
    }
}

function Get-HttpResult {
    <#
        Windows PowerShell 5.1 raises System.Net.WebException for a non-2xx
        response; PowerShell 7 raises HttpResponseException, a type 5.1 does
        not have - so a catch clause naming it fails to bind and the check dies
        with "Unable to find type" whatever the server actually said. This
        reads the status off either one.

        A transport failure is rethrown rather than turned into a status. There
        is no status: nothing answered, and a check that treats that as an
        answer is how a dead site comes to look healthy.
    #>
    param([string] $Url, [switch] $NoRedirect)

    # -ErrorAction Stop because this script runs at 'Continue': without it a
    # non-2xx is printed as a red error block before the catch tidies it away,
    # and a run that is behaving correctly looks like one that is not.
    $call = @{ Uri = $Url; UseBasicParsing = $true; TimeoutSec = 20; ErrorAction = 'Stop' }
    if ($NoRedirect) { $call.MaximumRedirection = 0 }

    try {
        $response = Invoke-WebRequest @call
        return [pscustomobject]@{ Status = [int] $response.StatusCode; Content = $response.Content }
    }
    catch {
        $response = $_.Exception.Response
        if (-not $response) { throw }
        $status = if ($response.StatusCode -is [int]) { $response.StatusCode }
                  else { [int] $response.StatusCode }
        return [pscustomobject]@{ Status = $status; Content = $null }
    }
}

Write-Host "`nVerifying $BaseUrl`n" -ForegroundColor Cyan

# --- Is anything there at all? ----------------------------------------------

# Without this, a site that is simply down produces eight transport errors and
# two green lines, because "Swagger is not exposed" is satisfied by nothing
# answering. A run that reports a dead site as partly healthy is worse than no
# run at all, so establish that something is listening before asking it
# anything.
$listening = $false
$probe = New-Object Net.Sockets.TcpClient
try {
    $async = $probe.BeginConnect($uri.Host, 443, $null, $null)
    if ($async.AsyncWaitHandle.WaitOne(5000)) {
        $probe.EndConnect($async)
        $listening = $probe.Connected
    }
}
catch { $listening = $false }
finally { $probe.Close() }

if (-not $listening) {
    Write-Host "  Nothing is answering on $($uri.Host):443.`n" -ForegroundColor Red
    Write-Host "  Where it stands on this machine:" -ForegroundColor Cyan

    Import-Module WebAdministration -ErrorAction SilentlyContinue

    try {
        $state = (Get-WebAppPoolState -Name $PoolName -ErrorAction Stop).Value
        Write-Host ("    application pool {0}: {1}" -f $PoolName, $state) -ForegroundColor Gray
    }
    catch {
        Write-Host ("    application pool {0}: does not exist - run 05-install-iis.ps1" -f $PoolName) -ForegroundColor Yellow
    }

    try {
        $site = Get-Website -Name $SiteName -ErrorAction Stop
        Write-Host ("    site {0}: {1}" -f $SiteName, $site.State) -ForegroundColor Gray
        Get-WebBinding -Name $SiteName -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host ("    binding: {0} {1}" -f $_.protocol, $_.bindingInformation) -ForegroundColor Gray
        }
    }
    catch {
        Write-Host ("    site {0}: does not exist - run 05-install-iis.ps1" -f $SiteName) -ForegroundColor Yellow
    }

    $onPort = @(Get-NetTCPConnection -LocalPort 443 -State Listen -ErrorAction SilentlyContinue)
    if ($onPort.Count -eq 0) {
        Write-Host "    port 443: nothing is listening" -ForegroundColor Yellow
    }
    else {
        Write-Host "    port 443: listening" -ForegroundColor Gray
    }

    # The usual answer on a staging box: the name does not point here yet. The
    # site can be perfectly healthy and still unreachable by the name it is
    # bound to, and no amount of looking at IIS will show that.
    try {
        $resolved = @([Net.Dns]::GetHostAddresses($uri.Host) |
            Where-Object { $_.AddressFamily -eq 'InterNetwork' } |
            ForEach-Object { $_.IPAddressToString })
        # Loopback counts as this machine, or testing with -BaseUrl
        # https://localhost is told its own name points somewhere else.
        $mine = @([Net.Dns]::GetHostAddresses([Net.Dns]::GetHostName()) |
            Where-Object { $_.AddressFamily -eq 'InterNetwork' } |
            ForEach-Object { $_.IPAddressToString }) + '127.0.0.1'

        Write-Host ("    {0} resolves to {1}" -f $uri.Host, ($resolved -join ', ')) -ForegroundColor Gray
        Write-Host ("    this machine is  {0}" -f ($mine -join ', ')) -ForegroundColor Gray

        if (-not ($resolved | Where-Object { $mine -contains $_ })) {
            Write-Host ''
            Write-Host "    The name does not resolve to this machine. Either DNS has not" -ForegroundColor Yellow
            Write-Host "    been pointed here yet, or you are testing from the wrong host." -ForegroundColor Yellow
            Write-Host "    To test before DNS moves, add a hosts entry on the machine you" -ForegroundColor Yellow
            Write-Host "    browse from:" -ForegroundColor Yellow
            Write-Host ("      {0}    {1}" -f $mine[0], $uri.Host) -ForegroundColor Gray
            Write-Host ("      in {0}{1}system32{1}drivers{1}etc{1}hosts" -f $env:SystemRoot, [char] 92) -ForegroundColor Gray
        }
    }
    catch {
        Write-Host ("    {0} does not resolve at all" -f $uri.Host) -ForegroundColor Yellow
    }

    Write-Host ''
    exit 1
}

# --- Certificate ------------------------------------------------------------

Check 'TLS certificate valid and trusted' {
    $client = New-Object Net.Sockets.TcpClient($uri.Host, 443)
    try {
        # Default validation: if this stream authenticates, a browser will too,
        # which is the only question worth asking about a certificate. The
        # protocols are named explicitly because the short overload offers SSL
        # 3.0 and TLS 1.0 and nothing else.
        $ssl = New-Object Net.Security.SslStream($client.GetStream(), $false)
        $ssl.AuthenticateAsClient($uri.Host, $null, $sslProtocols, $true)
        $cert = [Security.Cryptography.X509Certificates.X509Certificate2] $ssl.RemoteCertificate
        $days = [int]($cert.NotAfter - (Get-Date)).TotalDays
        if ($days -lt 0) { throw "expired $([Math]::Abs($days)) days ago" }
        "$($cert.Subject), $days days remaining"
    }
    finally { $client.Close() }
}

# --- API --------------------------------------------------------------------

Check 'API health endpoint' {
    $r = Get-HttpResult "$BaseUrl/health"
    if ($r.Status -ne 200) { throw "HTTP $($r.Status)" }
    "HTTP 200"
}

Check 'Public programme listing answers anonymously' {
    $r = Invoke-RestMethod "$BaseUrl/api/public/programmes?page=1&pageSize=1" -TimeoutSec 20 -ErrorAction Stop
    if (-not $r.success) { throw "envelope reported failure" }
    "total $($r.data.total)"
}

Check 'Branding endpoint (database is reachable)' {
    $r = Invoke-RestMethod "$BaseUrl/api/branding" -TimeoutSec 20 -ErrorAction Stop
    if (-not $r.success) { throw "envelope reported failure" }
    $r.data.portalTitle
}

Check 'An unknown /api path returns 404, not the SPA' {
    $r = Get-HttpResult "$BaseUrl/api/no-such-endpoint"
    if ($r.Status -eq 200) { throw "answered 200 - the SPA fallback is swallowing API 404s" }
    if ($r.Status -ne 404) { throw "HTTP $($r.Status)" }
    "404"
}

# --- Portal -----------------------------------------------------------------

Check 'Portal shell served at the root' {
    $r = Get-HttpResult $BaseUrl
    if ($r.Status -ne 200) { throw "HTTP $($r.Status)" }
    if ($r.Content -notmatch '<app-root|Capacity Building') { throw "no Angular shell in the response" }
    "index.html"
}

Check 'Deep link /programmes returns the shell, not a 404' {
    $r = Get-HttpResult "$BaseUrl/programmes"
    if ($r.Status -ne 200) { throw "HTTP $($r.Status)" }
    if ($r.Content -notmatch '<app-root') { throw "did not return the shell" }
    "HTTP 200"
}

Check 'http redirects to https' {
    $r = Get-HttpResult ("http://{0}/" -f $uri.Host) -NoRedirect
    if ($r.Status -notin 301, 302, 307, 308) { throw "HTTP $($r.Status), expected a redirect" }
    "HTTP $($r.Status)"
}

# --- Server side ------------------------------------------------------------

Check 'Storage roots exist and are writable by the app pool' {
    foreach ($leaf in @('monitoring', 'certificate-templates')) {
        $path = Join-Path $StorageRoot $leaf
        if (-not (Test-Path $path)) { throw "$path is missing" }
        $file = Join-Path $path ('.write-probe-' + [Guid]::NewGuid().ToString('N').Substring(0, 6))
        Set-Content -Path $file -Value 'probe' -ErrorAction Stop
        Remove-Item $file -Force
    }
    'both writable'
}

Check 'Storage sits outside the published folder' {
    if ($StorageRoot.StartsWith($SitePath, [StringComparison]::OrdinalIgnoreCase)) {
        throw "a redeploy would delete the uploaded files"
    }
    'safe from redeploys'
}

Check 'No development secrets in the deployed configuration' {
    $file = Join-Path $SitePath 'appsettings.Production.json'
    $text = Get-Content $file -Raw
    if ($text -match 'dev-only-signing-key') { throw "the development signing key is still in place" }
    if ($text -match '"Default"\s*:\s*""') { throw "the connection string is empty" }
    'clean'
}

Check 'Swagger is not exposed' {
    # Get-HttpResult rethrows a transport failure rather than reporting a
    # status, which is what keeps this honest: the earlier version caught
    # everything and called it "not reachable", so a site that was down passed
    # this check.
    $r = Get-HttpResult "$BaseUrl/swagger/index.html"
    if ($r.Status -eq 200) { throw "Swagger is reachable in production" }
    "not reachable (HTTP $($r.Status))"
}

# --- Result -----------------------------------------------------------------

Write-Host ''
if ($script:Failed -eq 0) {
    Write-Host "All checks passed. The site is live at $BaseUrl`n" -ForegroundColor Green
    Write-Host "Set the Super Admin password with .\08-first-run.ps1, then sign in as SA0001.`n" -ForegroundColor Cyan
    exit 0
}

Write-Host ("{0} check(s) failed.`n" -f $script:Failed) -ForegroundColor Red
exit 1
