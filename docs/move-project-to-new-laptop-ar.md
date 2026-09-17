# الطريقة السريعة لنقل وتشغيل Remote Work Analytics على لابتوب آخر

هذا الدليل مخصص للحالة التالية:

- اللابتوب الثاني بعيد وستدخل إليه عبر AnyDesk.
- ستجهز ملف ZIP واحدًا على جهازك الحالي.
- سترفع ZIP إلى Google Drive ثم تنزله على اللابتوب الثاني.
- تريد نقل النظام مع قاعدة البيانات والمستخدمين والمهام ولقطات الشاشة.

لا تحتاج تحديث Windows قبل النقل، ولا تحتاج تشفير ZIP إذا كان Google Drive خاصًا بك ولم تشارك الرابط مع أحد. التشفير يبقى خيارًا إضافيًا فقط.

## الخلاصة

ستنفذ ثماني خطوات فقط:

1. إنهاء Session ومزامنة Agent على جهازك الحالي.
2. تشغيل مقطع PowerShell واحد لتجهيز ZIP.
3. رفع ZIP إلى Google Drive.
4. تنزيل ZIP على اللابتوب الثاني عبر AnyDesk.
5. تثبيت Node.js وMariaDB فقط.
6. فك الملفات واستعادة قاعدة البيانات.
7. تشغيل `npm ci` وبناء المشروع.
8. تشغيل النظام وتثبيت Agent الجاهز.

---

## أولًا: تجهيز ZIP على جهازك الحالي

### 1. أغلق جلسة الموظف

قبل تجهيز النسخة:

1. افتح Windows Agent.
2. تأكد أن حالة الاتصال Online.
3. انتظر حتى تنتهي المزامنة ولا تبقى صور أو بيانات معلقة.
4. اضغط End Session إذا كانت هناك جلسة نشطة.
5. أغلق Agent.

### 2. افتح PowerShell داخل المشروع

افتح هذا المجلد:

```text
D:\DeskE\dProtech\7Projects2026\Confirm_Projects2026\Zeina_Raghad\project\RemoteWorkAnalytics
```

ثم اضغط داخل شريط العنوان في File Explorer، واكتب:

```text
powershell
```

واضغط Enter.

### 3. ابنِ أحدث Agent وشغّل قاعدة البيانات فقط

مثبت Agent الموجود قد يكون أقدم من آخر تعديلات الكود. ابنِ أحدث نسخة على جهازك الحالي قبل تجهيز ZIP:

```powershell
$env:CARGO_TARGET_DIR = Join-Path $env:LOCALAPPDATA 'RemoteWorkCargoTarget'

# إغلاق نسخة Agent التي تعمل من مجلد البناء حتى لا تقفل ملف EXE.
$targetAgent = Join-Path $env:CARGO_TARGET_DIR 'release\remote-work-agent.exe'
$runningAgent = Get-CimInstance Win32_Process -Filter "Name='remote-work-agent.exe'" |
  Where-Object {
    $_.ExecutablePath -and
    ([IO.Path]::GetFullPath($_.ExecutablePath) -eq [IO.Path]::GetFullPath($targetAgent))
  }
foreach ($process in $runningAgent) {
  Stop-Process -Id $process.ProcessId -Force
  Wait-Process -Id $process.ProcessId -Timeout 10 -ErrorAction SilentlyContinue
}

npm run tauri -w @remote-work/agent -- build
if ($LASTEXITCODE -ne 0) { throw 'فشل بناء Windows Agent.' }
```

نفّذ هذا بعد إنهاء Session والمزامنة كما في الخطوة الأولى. سبب الإغلاق أن Windows يمنع Rust من استبدال `remote-work-agent.exe` أثناء تشغيله.

ثم شغّل MariaDB فقط حتى نستطيع أخذ نسخة قاعدة البيانات، بدون تشغيل Web أو Agent:

```powershell
$databaseDirectory = Join-Path $env:LOCALAPPDATA 'RemoteWorkMariaDB'
$mariaDbServer = 'C:\Program Files\MariaDB 11.4\bin\mysqld.exe'

if (-not (Get-NetTCPConnection -LocalPort 3310 -State Listen -ErrorAction SilentlyContinue)) {
  Start-Process -FilePath $mariaDbServer `
    -ArgumentList "--defaults-file=$databaseDirectory\my.ini" `
    -WindowStyle Hidden
}

Start-Sleep -Seconds 2
if (-not (Get-NetTCPConnection -LocalPort 3310 -State Listen -ErrorAction SilentlyContinue)) {
  throw 'MariaDB لا تعمل على المنفذ 3310.'
}
```

### 4. جهز حزمة النقل بأمر واحد

انسخ المقطع التالي كاملًا والصقه في PowerShell. هذا المقطع لا يحذف شيئًا من مشروعك؛ ينشئ نسخة نظيفة على سطح المكتب ثم يضغطها:

```powershell
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path '.').Path
$transferRoot = Join-Path $env:USERPROFILE 'Desktop\RemoteWorkTransfer'
$zipPath = Join-Path $env:USERPROFILE 'Desktop\RemoteWorkAnalytics-transfer.zip'

if (Test-Path -LiteralPath $transferRoot) {
  throw "احذف أو غيّر اسم المجلد القديم أولًا: $transferRoot"
}
if (Test-Path -LiteralPath $zipPath) {
  throw "احذف أو غيّر اسم ملف ZIP القديم أولًا: $zipPath"
}

New-Item -ItemType Directory -Path $transferRoot | Out-Null
New-Item -ItemType Directory -Path "$transferRoot\screenshots" | Out-Null
New-Item -ItemType Directory -Path "$transferRoot\agent-installer" | Out-Null

# قراءة إعدادات المشروع الحالية بدون عرض كلمات المرور.
Get-Content -LiteralPath "$projectRoot\.env" | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
    $parts = $line -split '=', 2
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

# نسخة حديثة من قاعدة البيانات.
$dumpExe = 'C:\Program Files\MariaDB 11.4\bin\mariadb-dump.exe'
$dumpArguments = @(
  "--host=$($env:MYSQL_HOST)",
  "--port=$($env:MYSQL_PORT)",
  "--user=$($env:MYSQL_USER)",
  '--single-transaction',
  '--routines',
  '--triggers',
  '--hex-blob',
  '--default-character-set=utf8mb4',
  "--result-file=$transferRoot\database.sql",
  $env:MYSQL_DATABASE
)

$env:MYSQL_PWD = $env:MYSQL_PASSWORD
try {
  & $dumpExe @dumpArguments
  if ($LASTEXITCODE -ne 0) { throw 'فشل تصدير قاعدة البيانات.' }
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

# دمج موقعي لقطات الشاشة الحاليين.
$screenshotSources = @(
  "$projectRoot\private-storage\screenshots",
  "$projectRoot\apps\api\private-storage\screenshots"
)
foreach ($source in $screenshotSources) {
  if (Test-Path -LiteralPath $source) {
    & robocopy.exe $source "$transferRoot\screenshots" /E /R:2 /W:2 /XJ | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "فشل نسخ الصور من: $source" }
  }
}

# نسخ الكود بدون node_modules وملفات البناء الضخمة.
$codeDestination = "$transferRoot\RemoteWorkAnalytics"
$excludedDirectories = @(
  "$projectRoot\node_modules",
  "$projectRoot\apps\web\node_modules",
  "$projectRoot\apps\agent\node_modules",
  "$projectRoot\apps\web\.next",
  "$projectRoot\apps\api\dist",
  "$projectRoot\apps\agent\dist",
  "$projectRoot\apps\agent\src-tauri\target",
  "$projectRoot\.runtime",
  "$projectRoot\.runtime-logs",
  "$projectRoot\.tmp-rust",
  "$projectRoot\private-storage",
  "$projectRoot\apps\api\private-storage",
  "$projectRoot\SmartGuardDesk"
)
$copyArguments = @(
  $projectRoot, $codeDestination,
  '/E', '/R:2', '/W:2', '/XJ', '/XD'
) + $excludedDirectories + @(
  '/XF', '.env', '*.log', 'SmartGuardDesk.rar', 'remote_work_backup.sql'
)
& robocopy.exe @copyArguments | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'فشل نسخ كود المشروع.' }

# حفظ إعدادات المشروع باسم واضح داخل ZIP.
Copy-Item -LiteralPath "$projectRoot\.env" `
  -Destination "$transferRoot\environment.env" -Force

# نسخ مثبت Agent الجاهز؛ لا حاجة لبناء Rust على اللابتوب الثاني.
$agentInstaller = Join-Path $env:LOCALAPPDATA `
  'RemoteWorkCargoTarget\release\bundle\nsis\Remote Work Agent_0.1.0_x64-setup.exe'
if (-not (Test-Path -LiteralPath $agentInstaller)) {
  throw "مثبت Agent غير موجود: $agentInstaller"
}
$latestAgentSource = Get-ChildItem `
  "$projectRoot\apps\agent\src", "$projectRoot\apps\agent\src-tauri\src" `
  -File -Recurse | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ((Get-Item $agentInstaller).LastWriteTime -lt $latestAgentSource.LastWriteTime) {
  throw 'مثبت Agent أقدم من الكود. أعد تنفيذ أمر tauri build في الخطوة السابقة.'
}
Copy-Item -LiteralPath $agentInstaller `
  -Destination "$transferRoot\agent-installer\RemoteWorkAgent-Setup.exe" -Force

# التحقق ثم إنشاء ZIP عادي.
if ((Get-Item "$transferRoot\database.sql").Length -eq 0) {
  throw 'ملف قاعدة البيانات فارغ.'
}
if (-not (Test-Path "$codeDestination\package-lock.json")) {
  throw 'package-lock.json غير موجود في نسخة النقل.'
}
if (-not (Test-Path "$codeDestination\apps\api\prisma\migrations")) {
  throw 'Prisma migrations غير موجودة في نسخة النقل.'
}

Compress-Archive -Path "$transferRoot\*" `
  -DestinationPath $zipPath -CompressionLevel Fastest

Get-Item -LiteralPath $zipPath | Select-Object FullName, Length, LastWriteTime
Write-Host "تم تجهيز الملف بنجاح: $zipPath" -ForegroundColor Green
```

بعد نجاح الأمر ستجد على سطح المكتب:

```text
RemoteWorkAnalytics-transfer.zip
```

هذا ZIP يحتوي:

- كود المشروع كاملًا.
- قاعدة البيانات الحالية.
- لقطات الشاشة.
- ملف إعدادات النظام.
- مثبت Windows Agent الجاهز.

ولا يحتوي المجلدات الكبيرة غير الضرورية مثل:

```text
node_modules
.next
dist
target
.runtime-logs
```

لا تحذف `src-tauri` من المصدر؛ الكود الخاص به موجود داخل ZIP، لكن مجلد `target` الضخم فقط هو المستبعد.

### 5. ارفع ZIP إلى Google Drive

1. افتح Google Drive.
2. ارفع `RemoteWorkAnalytics-transfer.zip`.
3. انتظر حتى ينتهي الرفع.
4. لا تجعل الرابط عامًا ولا تستخدم `Anyone with the link`.
5. افتح Drive بالحساب نفسه على اللابتوب الثاني.

التشفير غير مطلوب في هذه الطريقة. إذا كانت بيانات المشروع حساسة جدًا، تستطيع تشفير ZIP لاحقًا، لكنه ليس جزءًا من خطوات التشغيل السريعة.

---

## ثانيًا: تجهيز اللابتوب الثاني عبر AnyDesk

### 6. قبل البدء

- تأكد أن AnyDesk يعمل وأن لديك صلاحية Administrator.
- اجعل اللابتوب موصولًا بالشاحن.
- لا تشغّل Windows Update الآن؛ ليس مطلوبًا لتشغيل المشروع.
- تجنب Restart إذا لم يكن هناك شخص بجانب الجهاز، إلا إذا كان AnyDesk Unattended Access مضبوطًا.

### 7. نزّل ZIP وفك الضغط

من Google Drive نزّل:

```text
RemoteWorkAnalytics-transfer.zip
```

ثم افتح PowerShell كمسؤول ونفّذ:

```powershell
$zipPath = Join-Path $env:USERPROFILE 'Downloads\RemoteWorkAnalytics-transfer.zip'
$transferRoot = 'C:\Migration\RemoteWorkTransfer'

if (Test-Path -LiteralPath $transferRoot) {
  throw "المجلد موجود مسبقًا: $transferRoot"
}

New-Item -ItemType Directory -Path $transferRoot -Force | Out-Null
Expand-Archive -LiteralPath $zipPath -DestinationPath $transferRoot

Get-ChildItem -LiteralPath $transferRoot
```

يجب أن تظهر هذه العناصر:

```text
RemoteWorkAnalytics
database.sql
screenshots
environment.env
agent-installer
```

---

## ثالثًا: البرامج المطلوبة على اللابتوب الثاني

### المطلوب الآن لتشغيل النظام

ثبّت برنامجين فقط:

1. [Node.js 22.23.2 x64 — تنزيل مباشر](https://nodejs.org/dist/v22.23.2/node-v22.23.2-x64.msi)
2. [MariaDB 11.4.12 x64 — تنزيل مباشر](https://archive.mariadb.org/mariadb-11.4.12/winx64-packages/mariadb-11.4.12-winx64.msi)

أثناء تثبيت MariaDB استخدم المسار الافتراضي:

```text
C:\Program Files\MariaDB 11.4
```

إذا طلب MariaDB إعداد Database Instance أثناء التثبيت، تستطيع إلغاء هذا الخيار؛ سننشئ Instance المشروع بالأمر الموجود أدناه.

أغلق PowerShell وافتحه من جديد بعد تثبيت Node.js، ثم تحقق:

```powershell
node --version
npm --version
& 'C:\Program Files\MariaDB 11.4\bin\mariadb.exe' --version
```

### برامج لا تحتاجها الآن

لا تحتاج Rust أو Visual Studio Build Tools لتشغيل Agent؛ لأن ZIP يحتوي مثبت Agent الجاهز.

تحتاجهما فقط إذا أردت تعديل كود Agent وإعادة بنائه على اللابتوب الثاني مستقبلًا:

- [Rustup x64 — تنزيل مباشر](https://win.rustup.rs/x86_64)
- [Visual Studio Build Tools 2022 — تنزيل مباشر](https://aka.ms/vs/17/release/vs_BuildTools.exe)

Git وVS Code اختياريان أيضًا ولا يؤثران في تشغيل النظام.

---

## رابعًا: وضع المشروع والبيانات في أماكنها

افتح PowerShell كمسؤول ونفّذ:

```powershell
$transferRoot = 'C:\Migration\RemoteWorkTransfer'
$projectRoot = 'C:\Projects\RemoteWorkAnalytics'
$screenshotRoot = 'C:\RemoteWorkData\screenshots'

New-Item -ItemType Directory -Path 'C:\Projects' -Force | Out-Null
New-Item -ItemType Directory -Path $screenshotRoot -Force | Out-Null

& robocopy.exe "$transferRoot\RemoteWorkAnalytics" $projectRoot /E /R:2 /W:2 /XJ | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'فشل نسخ المشروع.' }

& robocopy.exe "$transferRoot\screenshots" $screenshotRoot /E /R:2 /W:2 /XJ | Out-Null
if ($LASTEXITCODE -ge 8) { throw 'فشل نسخ لقطات الشاشة.' }

Copy-Item -LiteralPath "$transferRoot\environment.env" `
  -Destination "$projectRoot\.env" -Force

notepad "$projectRoot\.env"
```

داخل `.env` تأكد فقط من هذه القيم:

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=4000
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3310
CORS_ORIGINS=http://localhost:3000
SCREENSHOT_STORAGE_PATH=C:/RemoteWorkData/screenshots
```

لا تغيّر كلمات المرور أو `JWT_ACCESS_SECRET` أو `METRICS_TOKEN` الموجودة في الملف.

---

## خامسًا: إنشاء قاعدة البيانات واستعادة البيانات

انسخ هذا المقطع كاملًا إلى PowerShell. سيستخدم كلمات المرور الموجودة في `.env` تلقائيًا:

```powershell
$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\Projects\RemoteWorkAnalytics'
$transferRoot = 'C:\Migration\RemoteWorkTransfer'

# قراءة .env.
Get-Content -LiteralPath "$projectRoot\.env" | ForEach-Object {
  $line = $_.Trim()
  if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
    $parts = $line -split '=', 2
    $name = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

$required = @('MYSQL_DATABASE','MYSQL_USER','MYSQL_PASSWORD','MYSQL_ROOT_PASSWORD')
foreach ($name in $required) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
    throw "$name غير موجود في .env"
  }
}

# إنشاء MariaDB الخاصة بالمشروع على 3310.
$databaseDirectory = Join-Path $env:LOCALAPPDATA 'RemoteWorkMariaDB'
$installDatabase = 'C:\Program Files\MariaDB 11.4\bin\mariadb-install-db.exe'
if (Test-Path -LiteralPath $databaseDirectory) {
  throw "مجلد قاعدة البيانات موجود مسبقًا: $databaseDirectory"
}

& $installDatabase `
  "--datadir=$databaseDirectory" `
  "--password=$($env:MYSQL_ROOT_PASSWORD)" `
  '--port=3310'
if ($LASTEXITCODE -ne 0) { throw 'فشل إنشاء MariaDB.' }

Start-Process `
  -FilePath 'C:\Program Files\MariaDB 11.4\bin\mysqld.exe' `
  -ArgumentList "--defaults-file=$databaseDirectory\my.ini" `
  -WindowStyle Hidden

for ($attempt = 0; $attempt -lt 20; $attempt++) {
  if (Get-NetTCPConnection -LocalPort 3310 -State Listen -ErrorAction SilentlyContinue) { break }
  Start-Sleep -Milliseconds 500
}
if (-not (Get-NetTCPConnection -LocalPort 3310 -State Listen -ErrorAction SilentlyContinue)) {
  throw 'MariaDB لم تعمل على المنفذ 3310.'
}

# إنشاء قاعدة التطبيق ومستخدمها.
$databaseName = $env:MYSQL_DATABASE
$applicationUser = $env:MYSQL_USER
if ($databaseName -notmatch '^[A-Za-z0-9_]+$') { throw 'اسم قاعدة البيانات غير صالح.' }
if ($applicationUser -notmatch '^[A-Za-z0-9_]+$') { throw 'اسم مستخدم قاعدة البيانات غير صالح.' }

$escapedPassword = $env:MYSQL_PASSWORD.Replace('\', '\\').Replace("'", "''")
$sql = @"
CREATE DATABASE IF NOT EXISTS ``$databaseName`` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$applicationUser'@'127.0.0.1' IDENTIFIED BY '$escapedPassword';
ALTER USER '$applicationUser'@'127.0.0.1' IDENTIFIED BY '$escapedPassword';
CREATE USER IF NOT EXISTS '$applicationUser'@'localhost' IDENTIFIED BY '$escapedPassword';
ALTER USER '$applicationUser'@'localhost' IDENTIFIED BY '$escapedPassword';
GRANT ALL PRIVILEGES ON ``$databaseName``.* TO '$applicationUser'@'127.0.0.1';
GRANT ALL PRIVILEGES ON ``$databaseName``.* TO '$applicationUser'@'localhost';
FLUSH PRIVILEGES;
"@

$env:MYSQL_PWD = $env:MYSQL_ROOT_PASSWORD
try {
  & 'C:\Program Files\MariaDB 11.4\bin\mariadb.exe' `
    '--host=127.0.0.1' '--port=3310' '--user=root' "--execute=$sql"
  if ($LASTEXITCODE -ne 0) { throw 'فشل إنشاء مستخدم قاعدة البيانات.' }
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

# استعادة البيانات السابقة.
$dumpPath = (Resolve-Path "$transferRoot\database.sql").Path.Replace('\', '/')
$env:MYSQL_PWD = $env:MYSQL_PASSWORD
try {
  & 'C:\Program Files\MariaDB 11.4\bin\mariadb.exe' `
    '--host=127.0.0.1' '--port=3310' `
    "--user=$($env:MYSQL_USER)" `
    "--execute=source $dumpPath" `
    $env:MYSQL_DATABASE
  if ($LASTEXITCODE -ne 0) { throw 'فشل استعادة قاعدة البيانات.' }
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
}

Write-Host 'تمت استعادة قاعدة البيانات بنجاح.' -ForegroundColor Green
```

---

## سادسًا: تنزيل `node_modules` وبناء النظام

من PowerShell:

```powershell
Set-Location 'C:\Projects\RemoteWorkAnalytics'

npm ci
npm run db:generate
npm run db:migrate
npm run build
```

نفّذ `npm ci` مرة واحدة فقط من جذر المشروع. هذا الأمر ينشئ:

- `node_modules` الخارجية في جذر المشروع.
- أي `node_modules` داخلية يحتاجها Web أو Agent تلقائيًا.

لا تدخل إلى `apps/web` أو `apps/agent` لتشغيل `npm install` منفصل.

للتأكد من أن النسخة سليمة، يوصى كذلك بتشغيل:

```powershell
npm test
npm run lint
```

---

## سابعًا: تشغيل النظام

```powershell
Set-Location 'C:\Projects\RemoteWorkAnalytics'
powershell -ExecutionPolicy Bypass -File scripts\start-local.ps1
```

سيفتح النظام على:

```text
http://localhost:3000
```

ويمكن فحص الـAPI من:

```text
http://127.0.0.1:4000/api/v1/health/ready
```

سجل الدخول بحساب المدير الحالي. ستحتاج تسجيل الدخول مرة واحدة لأن Cookies المتصفح القديم لا تنتقل إلى اللابتوب الجديد.

---

## ثامنًا: تثبيت Windows Agent

افتح هذا الملف:

```text
C:\Migration\RemoteWorkTransfer\agent-installer\RemoteWorkAgent-Setup.exe
```

ثبّته بالإعدادات الافتراضية، ثم افتح **Remote Work Agent** من قائمة Start.

عند تسجيل الدخول استخدم عنوان API التالي:

```text
http://localhost:4000/api/v1
```

ثم سجل الدخول بحساب الموظف وابدأ Session جديدة.

إذا طلب Agent تثبيت WebView2 فوافق على التثبيت؛ مثبت Agent مجهز لتنزيل WebView2 عند الحاجة.

---

## فحص سريع بعد التشغيل

تأكد من الآتي فقط:

- صفحة المدير تفتح على `http://localhost:3000`.
- الموظفون والمهام السابقة موجودون.
- لقطات الشاشة القديمة تظهر.
- Agent يسجل الدخول.
- بدء Session جديدة يرسل Activity وScreenshot إلى النظام.

بعد نجاح كل شيء تستطيع حذف:

```text
C:\Migration\RemoteWorkTransfer
RemoteWorkAnalytics-transfer.zip من Downloads
RemoteWorkAnalytics-transfer.zip من Google Drive
```

لا تحذف:

```text
C:\Projects\RemoteWorkAnalytics
C:\RemoteWorkData\screenshots
%LOCALAPPDATA%\RemoteWorkMariaDB
```

## حلول سريعة للمشاكل

### `npm` غير معروف

أغلق PowerShell وافتحه من جديد بعد تثبيت Node.js.

### MariaDB ليست في المسار المتوقع

تأكد من وجود:

```text
C:\Program Files\MariaDB 11.4\bin\mysqld.exe
```

### الموقع لا يفتح

افتح:

```text
C:\Projects\RemoteWorkAnalytics\.runtime-logs
```

وراجع `api.err.log` و`web.err.log`.

### Agent يعرض `localhost refused to connect`

شغّل النظام أولًا وتأكد أن هذا الرابط يعمل في المتصفح:

```text
http://127.0.0.1:4000/api/v1/health/ready
```

ثم أغلق Agent وافتحه مجددًا.

## روابط إضافية اختيارية

- [Visual C++ Redistributable x64](https://aka.ms/vs/17/release/vc_redist.x64.exe) — ثبّته فقط إذا ظهر خطأ مكتبات Windows عند تشغيل Agent.
- [WebView2 Evergreen](https://go.microsoft.com/fwlink/p/?LinkId=2124703) — ثبّته فقط إذا لم يستطع مثبت Agent تنزيله.
- [Git for Windows](https://github.com/git-for-windows/git/releases/download/v2.54.0.windows.1/Git-2.54.0-64-bit.exe) — اختياري.
- [Visual Studio Code](https://code.visualstudio.com/sha/download?build=stable&os=win32-x64-user) — اختياري.
