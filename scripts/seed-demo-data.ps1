$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$environment = Get-Content (Join-Path $projectRoot '.env')
$passwordLine = $environment | Where-Object { $_ -like 'SEED_ADMIN_PASSWORD=*' }
$adminPassword = $passwordLine.Substring($passwordLine.IndexOf('=') + 1)
$apiUrl = 'http://127.0.0.1:4000/api/v1'
$employeePassword = 'Employee@2026!'

$login = Invoke-RestMethod "$apiUrl/auth/login" -Method Post -ContentType 'application/json' -Body (@{ email = 'admin@example.com'; password = $adminPassword } | ConvertTo-Json)
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
$people = @(
  @{ displayName = 'Abdullah Nasser'; email = 'abdullah.nasser@example.com' },
  @{ displayName = 'Sara Alharbi'; email = 'sara.alharbi@example.com' },
  @{ displayName = 'Omar Khalid'; email = 'omar.khalid@example.com' },
  @{ displayName = 'Noura Ahmed'; email = 'noura.ahmed@example.com' },
  @{ displayName = 'Fahad Alqahtani'; email = 'fahad.alqahtani@example.com' },
  @{ displayName = 'Layan Mohammed'; email = 'layan.mohammed@example.com' },
  @{ displayName = 'Yousef Ali'; email = 'yousef.ali@example.com' },
  @{ displayName = 'Reem Hassan'; email = 'reem.hassan@example.com' },
  @{ displayName = 'Khalid Saleh'; email = 'khalid.saleh@example.com' },
  @{ displayName = 'Huda Ibrahim'; email = 'huda.ibrahim@example.com' }
)

$existingUsers = Invoke-RestMethod "$apiUrl/users" -Headers $headers
$usersByEmail = @{}
foreach ($candidate in $existingUsers) { $usersByEmail[$candidate.email] = $candidate }
$employees = @()
foreach ($person in $people) {
  $employee = $usersByEmail[$person.email]
  if (-not $employee) {
    $employee = Invoke-RestMethod "$apiUrl/users" -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ displayName = $person.displayName; email = $person.email; password = $employeePassword; role = 'EMPLOYEE' } | ConvertTo-Json)
  }
  $employees += $employee
}

$taskTemplates = @(
  @{ title = 'Prepare weekly sales report'; description = 'Compile the weekly results and highlight important changes.'; priority = 'HIGH'; deadline = '2026-08-07T14:00:00.000Z'; employee = 0 },
  @{ title = 'Update client records'; description = 'Review and update incomplete client information.'; priority = 'MEDIUM'; deadline = '2026-08-08T13:00:00.000Z'; employee = 1 },
  @{ title = 'Review support tickets'; description = 'Review open support requests and document next actions.'; priority = 'URGENT'; deadline = '2026-08-06T12:00:00.000Z'; employee = 2 },
  @{ title = 'Create team meeting presentation'; description = 'Prepare the slides for the upcoming team meeting.'; priority = 'HIGH'; deadline = '2026-08-09T10:00:00.000Z'; employee = 0 },
  @{ title = 'Audit project documentation'; description = 'Check project documentation for missing or outdated sections.'; priority = 'MEDIUM'; deadline = '2026-08-10T14:00:00.000Z'; employee = 1 },
  @{ title = 'Test latest application release'; description = 'Run the release checklist and report discovered issues.'; priority = 'HIGH'; deadline = '2026-08-08T15:00:00.000Z'; employee = 2 },
  @{ title = 'Organize shared project files'; description = 'Apply the agreed folder structure and naming convention.'; priority = 'LOW'; deadline = '2026-08-11T12:00:00.000Z'; employee = 0 },
  @{ title = 'Research competitor features'; description = 'Summarize notable competitor features and opportunities.'; priority = 'MEDIUM'; deadline = '2026-08-12T14:00:00.000Z'; employee = 1 },
  @{ title = 'Update task progress report'; description = 'Prepare an accurate status update for all active tasks.'; priority = 'HIGH'; deadline = '2026-08-07T11:00:00.000Z'; employee = 2 },
  @{ title = 'Prepare monthly performance summary'; description = 'Summarize performance metrics and key observations.'; priority = 'MEDIUM'; deadline = '2026-08-14T14:00:00.000Z'; employee = 0 }
)

$existingTasks = @(Invoke-RestMethod "$apiUrl/tasks" -Headers $headers)
foreach ($task in $taskTemplates) {
  if (-not ($existingTasks | Where-Object { $_.title -eq $task.title })) {
    Invoke-RestMethod "$apiUrl/tasks" -Method Post -Headers $headers -ContentType 'application/json' -Body (@{ title = $task.title; description = $task.description; priority = $task.priority; deadline = $task.deadline; assigneeId = $employees[$task.employee].id } | ConvertTo-Json) | Out-Null
  }
}

Write-Output "Demo data ready: $($people.Count) employees and $($taskTemplates.Count) tasks."
Write-Output "Employee password: $employeePassword"
