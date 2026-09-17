[CmdletBinding()]
param(
  [switch]$Development
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$logDirectory = Join-Path $projectRoot '.runtime-logs'
$databaseDirectory = Join-Path $env:LOCALAPPDATA 'RemoteWorkMariaDB'
$mariaDbExecutable = 'C:\Program Files\MariaDB 11.4\bin\mysqld.exe'

if (-not (Test-Path (Join-Path $projectRoot '.env'))) {
  throw 'Missing .env. Copy .env.example to .env and configure it first.'
}
if (-not (Test-Path $mariaDbExecutable)) {
  throw 'MariaDB 11.4 is not installed in the expected location.'
}
if (-not (Test-Path (Join-Path $databaseDirectory 'my.ini'))) {
  throw 'The local RemoteWorkMariaDB database has not been initialized.'
}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

if (-not (Get-NetTCPConnection -LocalPort 3310 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $mariaDbExecutable -ArgumentList "--defaults-file=$databaseDirectory\my.ini" -WindowStyle Hidden
}

for ($attempt = 0; $attempt -lt 20; $attempt++) {
  if (Get-NetTCPConnection -LocalPort 3310 -State Listen -ErrorAction SilentlyContinue) { break }
  Start-Sleep -Milliseconds 500
}
if (-not (Get-NetTCPConnection -LocalPort 3310 -State Listen -ErrorAction SilentlyContinue)) {
  throw 'MariaDB did not become ready on port 3310.'
}

& npm.cmd run db:migrate
if ($LASTEXITCODE -ne 0) { throw 'Database migrations failed.' }

if (-not $Development) {
  if (-not (Test-Path (Join-Path $projectRoot 'apps\api\dist\main.js'))) {
    throw 'API production build is missing. Run: npm run build -w @remote-work/api'
  }
  if (-not (Test-Path (Join-Path $projectRoot 'apps\web\.next\BUILD_ID'))) {
    throw 'Web production build is missing. Run: npm run build -w @remote-work/web'
  }
}

if (-not (Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue)) {
  if ($Development) {
    Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev:api') -WorkingDirectory $projectRoot -RedirectStandardOutput (Join-Path $logDirectory 'api.out.log') -RedirectStandardError (Join-Path $logDirectory 'api.err.log') -WindowStyle Hidden
  } else {
    Start-Process -FilePath 'node.exe' -ArgumentList @('apps/api/dist/main.js') -WorkingDirectory $projectRoot -RedirectStandardOutput (Join-Path $logDirectory 'api.out.log') -RedirectStandardError (Join-Path $logDirectory 'api.err.log') -WindowStyle Hidden
  }
}

if (-not (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue)) {
  if ($Development) {
    Start-Process -FilePath 'npm.cmd' -ArgumentList @('exec', '-w', '@remote-work/web', '--', 'next', 'dev', '--webpack') -WorkingDirectory $projectRoot -RedirectStandardOutput (Join-Path $logDirectory 'web.out.log') -RedirectStandardError (Join-Path $logDirectory 'web.err.log') -WindowStyle Hidden
  } else {
    Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'start', '-w', '@remote-work/web') -WorkingDirectory $projectRoot -RedirectStandardOutput (Join-Path $logDirectory 'web.out.log') -RedirectStandardError (Join-Path $logDirectory 'web.err.log') -WindowStyle Hidden
  }
}

$agentExecutable = Join-Path $env:LOCALAPPDATA 'RemoteWorkCargoTarget\release\remote-work-agent.exe'
if ((Test-Path $agentExecutable) -and -not (Get-Process 'remote-work-agent' -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $agentExecutable
}

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Seconds 1
  try {
    $api = Invoke-WebRequest 'http://127.0.0.1:4000/api/v1/health/ready' -UseBasicParsing -TimeoutSec 2
    $web = Invoke-WebRequest 'http://127.0.0.1:3000/login' -UseBasicParsing -TimeoutSec 3
    if ($api.StatusCode -eq 200 -and $web.StatusCode -eq 200) { $ready = $true; break }
  } catch { }
}

if (-not $ready) { throw "Services did not become ready. Check $logDirectory" }
Start-Process 'http://localhost:3000'
Write-Host 'Remote Work Analytics is running at http://localhost:3000' -ForegroundColor Green
