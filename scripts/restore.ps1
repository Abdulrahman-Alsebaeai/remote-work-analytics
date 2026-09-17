param([Parameter(Mandatory=$true)][string]$BackupPath, [switch]$ConfirmRestore)
$ErrorActionPreference = 'Stop'
if (-not $ConfirmRestore) { throw 'Restore is destructive. Re-run with -ConfirmRestore after stopping API workers.' }
$required = 'MYSQL_HOST','MYSQL_DATABASE','MYSQL_USER','MYSQL_PASSWORD','SCREENSHOT_STORAGE_PATH'
foreach ($name in $required) { if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) { throw "$name is required." } }
$source = [IO.Path]::GetFullPath($BackupPath); $manifestPath = Join-Path $source 'manifest.json'; if (-not (Test-Path -LiteralPath $manifestPath)) { throw 'Backup manifest not found.' }
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
foreach ($file in $manifest.files) { $path = Join-Path $source $file.name; if (-not (Test-Path -LiteralPath $path) -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $file.sha256) { throw "Backup integrity check failed for $($file.name)." } }
$dump = Join-Path $source 'database.sql'; $port = if ($env:MYSQL_PORT) { $env:MYSQL_PORT } else { '3306' }; $env:MYSQL_PWD = $env:MYSQL_PASSWORD
try { Get-Content -LiteralPath $dump | & mysql.exe --host=$env:MYSQL_HOST --port=$port --user=$env:MYSQL_USER $env:MYSQL_DATABASE; if ($LASTEXITCODE -ne 0) { throw 'Database restore failed.' } } finally { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
$archive = Join-Path $source 'screenshots.zip'
if (Test-Path -LiteralPath $archive) { $destination = [IO.Path]::GetFullPath($env:SCREENSHOT_STORAGE_PATH); $parent = Split-Path -Parent $destination; New-Item -ItemType Directory -Path $parent -Force | Out-Null; $staging = Join-Path $parent ('.restore-' + [Guid]::NewGuid()); Expand-Archive -LiteralPath $archive -DestinationPath $staging; if (Test-Path -LiteralPath $destination) { Move-Item -LiteralPath $destination -Destination ($destination + '.before-restore-' + (Get-Date -Format 'yyyyMMddHHmmss')) }; $restored = Get-ChildItem -LiteralPath $staging -Directory | Select-Object -First 1; if (-not $restored) { throw 'Screenshot archive is empty.' }; Move-Item -LiteralPath $restored.FullName -Destination $destination; Remove-Item -LiteralPath $staging -Recurse -Force }
Write-Output 'Restore completed. Run readiness and sample-file checks before starting workers.'
