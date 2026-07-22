# 10-minute stack stability watch — exits non-zero on ERROR-level log bursts or unhealthy containers.
param(
  [int]$Minutes = 10,
  [int]$IntervalSec = 60
)

$ErrorActionPreference = 'Continue'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $Root

$services = @(
  'api_gateway', 'auth_service', 'user_service', 'appointment_service',
  'clinic_service', 'scheduling_service', 'notification_service', 'emr_service',
  'reminder_service', 'system_manager_service', 'postgres_backup', 'prometheus', 'alertmanager'
)

$iterations = [math]::Max(1, [int]($Minutes * 60 / $IntervalSec))
$failures = @()

Write-Host "==> Stability watch: ${Minutes}m (${iterations} checks every ${IntervalSec}s)"

for ($i = 1; $i -le $iterations; $i++) {
  $ts = Get-Date -Format 'HH:mm:ss'
  $issues = @()

  $restarting = docker ps --filter 'status=restarting' --format '{{.Names}}' 2>$null
  if ($restarting) { $issues += "restarting: $($restarting -join ', ')" }

  $unhealthy = docker ps --filter 'health=unhealthy' --format '{{.Names}}' 2>$null
  if ($unhealthy) { $issues += "unhealthy: $($unhealthy -join ', ')" }

  foreach ($svc in $services) {
    $errs = docker logs $svc --since "${IntervalSec}s" 2>&1 |
      Select-String -Pattern '"level":"ERROR"|level=error|FATAL|QueryFailedError|Unable to connect to the database' |
      Measure-Object | Select-Object -ExpandProperty Count
    if ($errs -gt 0) { $issues += "${svc}: ${errs} error(s)" }
  }

  if ($issues.Count -gt 0) {
    $line = "[$ts] CHECK $i/$iterations FAIL - $($issues -join '; ')"
    Write-Host $line
    $failures += $line
  } else {
    Write-Host "[$ts] CHECK $i/$iterations OK"
  }

  if ($i -lt $iterations) { Start-Sleep -Seconds $IntervalSec }
}

if ($failures.Count -gt 0) {
  Write-Host "`nFAILED: $($failures.Count) check(s) had issues"
  exit 1
}

Write-Host "`nPASSED: stack ran clean for ${Minutes} minutes"
exit 0
