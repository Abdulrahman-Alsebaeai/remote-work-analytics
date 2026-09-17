param([Parameter(Mandatory=$true)][string]$BackupRoot, [int]$RetentionCount = 14)
$ErrorActionPreference = 'Stop'
if ($RetentionCount -lt 1) { throw 'RetentionCount must be at least 1.' }
$required = 'MYSQL_HOST','MYSQL_DATABASE','MYSQL_USER','MYSQL_PASSWORD','SCREENSHOT_STORAGE_PATH'
foreach ($name in $required) { if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) { throw "$name is required." } }
$root = [IO.Path]::GetFullPath($BackupRoot); New-Item -ItemType Directory -Path $root -Force | Out-Null
$stamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'); $target = Join-Path $root $stamp; New-Item -ItemType Directory -Path $target | Out-Null
$dump = Join-Path $target 'database.sql'; $screenshots = [IO.Path]::GetFullPath($env:SCREENSHOT_STORAGE_PATH)
$port = if ($env:MYSQL_PORT) { $env:MYSQL_PORT } else { '3306' }; $env:MYSQL_PWD = $env:MYSQL_PASSWORD
try { & mysqldump.exe --host=$env:MYSQL_HOST --port=$port --user=$env:MYSQL_USER --single-transaction --routines --triggers --hex-blob --set-gtid-purged=OFF --result-file=$dump $env:MYSQL_DATABASE; if ($LASTEXITCODE -ne 0) { throw 'mysqldump failed.' } } finally { Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue }
if (Test-Path -LiteralPath $screenshots) { Compress-Archive -LiteralPath $screenshots -DestinationPath (Join-Path $target 'screenshots.zip') -CompressionLevel Optimal }
$files = Get-ChildItem -LiteralPath $target -File | ForEach-Object { [ordered]@{ name=$_.Name; bytes=$_.Length; sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } }
[ordered]@{ version=1; createdAt=(Get-Date).ToUniversalTime().ToString('o'); database=$env:MYSQL_DATABASE; files=$files } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $target 'manifest.json') -Encoding utf8
$backups = Get-ChildItem -LiteralPath $root -Directory | Sort-Object Name -Descending | Select-Object -Skip $RetentionCount
foreach ($backup in $backups) { if ([IO.Path]::GetFullPath($backup.Parent.FullName) -ne $root) { throw 'Unsafe retention path.' }; Remove-Item -LiteralPath $backup.FullName -Recurse -Force }
Write-Output $target
