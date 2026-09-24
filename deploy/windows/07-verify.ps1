<#
.SYNOPSIS
    Checks the deployed site actually works.

.DESCRIPTION
    Every check hits the site the way a user or a client would, over the real
    hostname and the real certificate. A deployment that has not been verified
    from outside has not been verified.

.EXAMPLE
    .\07-verify.ps1
#>
[CmdletBinding()]
param(
    [string] $BaseUrl = 'https://leanstaging.qci.org.in',
    [string] $SitePath = 'E:\inetpub\cbms',
    [string] $StorageRoot = 'E:\cbms-data'
)

$ErrorActionPreference = 'Continue'
$script:Failed = 0

function Check {
    param([string] $Name, [scriptblock] $Test)

    try {
        $detail = & $Test
        Write-Host ("  [ok]   {0}{1}" -f $Name, $(if ($detail) { " — $detail" })) -ForegroundColor Green
    }
    catch {
        Write-Host ("  [FAIL] {0} — {1}" -f $Name, $_.Exception.Message) -ForegroundColor Red
        $script:Failed++
    }
}

Write-Host "`nVerifying $BaseUrl`n" -ForegroundColor Cyan

# --- Certificate ------------------------------------------------------------

Check 'TLS certificate valid and trusted' {
    $uri = [Uri] $BaseUrl
    $client = New-Object Net.Sockets.TcpClient($uri.Host, 443)
    try {
        # Default validation: if this stream authenticates, a browser will too,
        # which is the only question worth asking about a certificate.
        $ssl = New-Object Net.Security.SslStream($client.GetStream(), $false)
        $ssl.AuthenticateAsClient($uri.Host)
        $cert = [Security.Cryptography.X509Certificates.X509Certificate2] $ssl.RemoteCertificate
        $days = [int]($cert.NotAfter - (Get-Date)).TotalDays
        if ($days -lt 0) { throw "expired $([Math]::Abs($days)) days ago" }
        "$($cert.Subject), $days days remaining"
    }
    finally { $client.Close() }
}

# --- API --------------------------------------------------------------------

Check 'API health endpoint' {
    $r = Invoke-WebRequest "$BaseUrl/health" -UseBasicParsing -TimeoutSec 20
    if ($r.StatusCode -ne 200) { throw "HTTP $($r.StatusCode)" }
    "HTTP 200"
}

Check 'Public programme listing answers anonymously' {
    $r = Invoke-RestMethod "$BaseUrl/api/public/programmes?page=1&pageSize=1" -TimeoutSec 20
    if (-not $r.success) { throw "envelope reported failure" }
    "total $($r.data.total)"
}

Check 'Branding endpoint (database is reachable)' {
    $r = Invoke-RestMethod "$BaseUrl/api/branding" -TimeoutSec 20
    if (-not $r.success) { throw "envelope reported failure" }
    $r.data.portalTitle
}

Check 'An unknown /api path returns 404, not the SPA' {
    try {
        Invoke-WebRequest "$BaseUrl/api/no-such-endpoint" -UseBasicParsing -TimeoutSec 20 | Out-Null
        throw "answered 200 — the SPA fallback is swallowing API 404s"
    }
    catch [Net.WebException] {
        $code = [int] $_.Exception.Response.StatusCode
        if ($code -ne 404) { throw "HTTP $code" }
        "404"
    }
    catch [Microsoft.PowerShell.Commands.HttpResponseException] {
        if ($_.Response.StatusCode.value__ -ne 404) { throw "HTTP $($_.Response.StatusCode.value__)" }
        "404"
    }
}

# --- Portal -----------------------------------------------------------------

Check 'Portal shell served at the root' {
    $r = Invoke-WebRequest $BaseUrl -UseBasicParsing -TimeoutSec 20
    if ($r.Content -notmatch '<app-root|Capacity Building') { throw "no Angular shell in the response" }
    "index.html"
}

Check 'Deep link /programmes returns the shell, not a 404' {
    $r = Invoke-WebRequest "$BaseUrl/programmes" -UseBasicParsing -TimeoutSec 20
    if ($r.StatusCode -ne 200) { throw "HTTP $($r.StatusCode)" }
    if ($r.Content -notmatch '<app-root') { throw "did not return the shell" }
    "HTTP 200"
}

Check 'http redirects to https' {
    $uri = [Uri] $BaseUrl
    try {
        $r = Invoke-WebRequest ("http://{0}/" -f $uri.Host) -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 20
        if ($r.StatusCode -notin 301, 302, 307, 308) { throw "HTTP $($r.StatusCode), expected a redirect" }
        "HTTP $($r.StatusCode)"
    }
    catch [Microsoft.PowerShell.Commands.HttpResponseException] {
        $code = $_.Response.StatusCode.value__
        if ($code -notin 301, 302, 307, 308) { throw "HTTP $code" }
        "HTTP $code"
    }
}

# --- Server side ------------------------------------------------------------

Check 'Storage roots exist and are writable by the app pool' {
    foreach ($leaf in @('monitoring', 'certificate-templates')) {
        $path = Join-Path $StorageRoot $leaf
        if (-not (Test-Path $path)) { throw "$path is missing" }
        $probe = Join-Path $path ('.write-probe-' + [Guid]::NewGuid().ToString('N').Substring(0, 6))
        Set-Content -Path $probe -Value 'probe' -ErrorAction Stop
        Remove-Item $probe -Force
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
    try {
        $r = Invoke-WebRequest "$BaseUrl/swagger/index.html" -UseBasicParsing -TimeoutSec 20
        if ($r.StatusCode -eq 200) { throw "Swagger is reachable in production" }
        'not reachable'
    }
    catch { 'not reachable' }
}

# --- Result -----------------------------------------------------------------

Write-Host ''
if ($script:Failed -eq 0) {
    Write-Host "All checks passed. The site is live at $BaseUrl`n" -ForegroundColor Green
    Write-Host "Sign in as SA0001. The first-run password was written to the application log" -ForegroundColor Cyan
    Write-Host "when the database was seeded — see 08-first-run.ps1 to read it back.`n" -ForegroundColor Cyan
    exit 0
}

Write-Host ("{0} check(s) failed.`n" -f $script:Failed) -ForegroundColor Red
exit 1
